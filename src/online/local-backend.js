// A stand-in for Firebase used by the browser tests: games live in localStorage and changes are
// announced over a BroadcastChannel, so several tabs in one browser can play each other exactly
// like separate devices would through Firebase. Each tab is its own player (its id is in sessionStorage).
// It applies the same checks as the server rules, through the pure moves in common.js.
import {
  makeCode, newGameRecord, timing, seatOf, withAnswer, withFinish, withHostClaim, withJoin, withNext, withReaction, withSettings, withStart,
} from "./common.js";

const STORE = "bibleTrivia_localServer";
const channel = typeof BroadcastChannel !== "undefined" ? new BroadcastChannel("bible-trivia-online") : null;
const listeners = new Map(); // code → Set of callbacks

const readAll = () => { try { return JSON.parse(localStorage.getItem(STORE)) || {}; } catch { return {}; } };
// The newest copy of each game this tab has seen, which can be newer than its view of localStorage.
const latest = new Map();
const read = (code) => (latest.has(code) ? latest.get(code) : readAll()[code] || null);

function write(code, game) {
  const all = readAll();
  if (game) all[code] = game; else delete all[code];
  localStorage.setItem(STORE, JSON.stringify(all));
  latest.set(code, game || null);
  notify(code, game || null);
  channel?.postMessage({ code, game: game || null });
}

function notify(code, game) {
  for (const cb of listeners.get(code) || []) setTimeout(() => cb(game), 0);
}
channel?.addEventListener("message", (e) => { latest.set(e.data.code, e.data.game); notify(e.data.code, e.data.game); });

/** Applies `change(game)`; nothing is written if it returns null. Resolves true if written. */
function transact(code, change) {
  const game = read(code);
  const next = game && change(game);
  if (!next) return Promise.resolve(false);
  if (next !== game) write(code, next);
  return Promise.resolve(true);
}

// Random ids from the browser's secure generator, the same as the codes (this backend only runs in
// the tests, but there's no reason for weaker randomness here).
const newUid = () => `local-${Array.from(crypto.getRandomValues(new Uint8Array(6)), (b) => b.toString(16).padStart(2, "0")).join("")}`;

export async function createLocalBackend() {
  let uid = sessionStorage.getItem("bibleTrivia_localUid");
  if (!uid) { uid = newUid(); sessionStorage.setItem("bibleTrivia_localUid", uid); }
  const presence = [];
  const setOn = (code, seat, value) => transact(code, (g) => ({ ...g, on: { ...g.on, [seat]: value } }));
  addEventListener("pagehide", () => { for (const [code, seat] of presence) setOn(code, seat, false); });
  // For the tests: act as if this tab's anonymous account had been cleaned up and replaced.
  window.__triviaNewUid = () => { uid = newUid(); sessionStorage.setItem("bibleTrivia_localUid", uid); };
  return {
    kind: "local",
    get uid() { return uid; },
    serverNow: () => Date.now(),
    async create({ avatar, bank, settings }) {
      // One new game per player per 10 seconds, as the server rules allow.
      const limits = read("limits") || {};
      if (Date.now() - (limits[uid] || 0) < timing().createGapMs) throw new Error("slow-down");
      write("limits", { ...limits, [uid]: Date.now() });
      let code;
      do code = makeCode(); while (read(code));
      write(code, newGameRecord({ uid, avatar, bank, settings, now: Date.now() }));
      return code;
    },
    async read(code) {
      return read(code);
    },
    async join(code, avatar) {
      const game = read(code);
      if (!game || game.expires < Date.now()) throw new Error("not-found");
      const next = withJoin(game, uid, avatar);
      if (!next) throw new Error("full");
      if (next !== game) write(code, next);
      return { seat: seatOf(next, uid) };
    },
    watch(code, cb) {
      if (!listeners.has(code)) listeners.set(code, new Set());
      listeners.get(code).add(cb);
      setTimeout(() => cb(read(code)), 0);
      return () => listeners.get(code)?.delete(cb);
    },
    setSettings: (code, settings) => transact(code, (g) => withSettings(g, uid, settings)),
    start: (code, ids) => transact(code, (g) => withStart(g, uid, ids)),
    next: (code) => transact(code, (g) => withNext(g, uid)),
    finish: (code) => transact(code, (g) => withFinish(g, uid)),
    answer: (code, a) => transact(code, (g) => withAnswer(g, uid, a)),
    react: (code, e) => transact(code, (g) => withReaction(g, uid, e)),
    claimHost: (code) => transact(code, (g) => withHostClaim(g, uid)),
    setPresence(code, seat) {
      presence.push([code, seat]);
      setOn(code, seat, true);
      return () => setOn(code, seat, false);
    },
    async sweep() {
      for (const [code, g] of Object.entries(readAll())) if (g.expires < Date.now()) write(code, null);
    },
  };
}
