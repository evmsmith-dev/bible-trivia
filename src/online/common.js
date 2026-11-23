// Shared by both online backends (Firebase and the local test backend), and by the screens.
//
// A game is stored at games/{code} as:
// {
//   created, expires,           // server ms; games are deleted after expires (24 hours)
//   bank,                       // fingerprint of data/questions.json: every device must have the same bank
//   hs: "s0",                   // the host's seat: starts rounds and moves to the next question
//   set: { m, n, s },           // mode ("easy"…"superHard"), questions per round (5/10/15),
//                               // scoring ("first" = first correct gets the point, "everyone" = 2 first / 1 others)
//   st,                         // "lobby", "playing" or "over" (a round finished)
//   p: { s0: { u, a }, … },     // seats s0–s7: anonymous player id + avatar number. No names, no free text.
//   m: { [uid]: "s0", … },      // who's in the game: each player id holds exactly one seat
//   on: { s0: true, … },        // presence: true while that player has the game open
//   qs: { r0: "412,88,…" },     // each round's question ids, chosen by the host's device
//   q: { r, i, n, at },         // the current question: round key ("r0"), question key ("q3"),
//                               // its number (3), and the server time it appears
//   qa: { r0: { q3: at } },     // when each question appeared (kept, so old answers can be timed)
//   ans: { r0: { q3: { s1: { c, ms, at } } } },
//                               // c = the chosen option's ORIGINAL index (0–3, not its place on screen),
//                               // ms = time from unlock to tap measured on the device, at = server time
//   rx: { s1: { e, at } },      // the last emoji reaction (one of REACTIONS)
// }
// limits/{uid}: when that player last created a game (one new game per 10 seconds per player).
// database.rules.json enforces the same shape and the same checks on the Firebase server.
import { AVATARS, MODE_KEYS, MODES } from "../config.js";

export const MAX_SEATS = 8;
export const SEATS = Array.from({ length: MAX_SEATS }, (_, i) => `s${i}`);
export const GAME_LIFETIME_MS = 24 * 60 * 60 * 1000;
export const ROUND_LENGTHS = [5, 10, 15];
export const SCORING = {
  first: { label: "First correct", detail: "The first right answer gets the point" },
  everyone: { label: "Everyone scores", detail: "2 points for first, 1 for any other right answer" },
};
export const REACTIONS = ["👏", "😮", "😂", "🙏", "🎉"];
export const REACTION_GAP_MS = 2000;

// Timings (ms). The tests set window.__TRIVIA_FAST to run them at a tenth of the speed; the
// Firebase rules always use the real values.
const scale = () => (typeof window !== "undefined" && window.__TRIVIA_FAST ? 0.1 : 1);
export const timing = (mode = "medium") => {
  const k = scale();
  return {
    leadMs: 3000 * k, // the 3-2-1 before each question (every device shows it at the same server time)
    lockMs: (mode === "easy" ? 2500 : 2000) * k, // reading time before answers can be tapped
    answerMs: (MODES[mode] || MODES.medium).seconds * 1000 * k,
    revealMs: k < 1 ? 2000 : 5000, // the answer and scoreboard between questions (long enough for the tests to read)
    slackMs: 1500 * k, // network allowance at the end of the answer window
    hostGoneMs: 6000 * k, // host offline this long → the next player takes over
    createGapMs: 10000 * k, // one new game per player per 10 seconds (protects the free plan)
  };
};

// No 0/O, 1/I/L: codes are read aloud and typed on phones.
const CODE_LETTERS = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
export const CODE_LENGTH = 6;

/**
 * A new game code from the browser's secure random generator. Each letter is picked without bias:
 * random bytes past the last whole multiple of the alphabet's size are thrown away.
 */
export function makeCode() {
  const limit = 256 - (256 % CODE_LETTERS.length);
  let code = "";
  while (code.length < CODE_LENGTH) {
    for (const byte of crypto.getRandomValues(new Uint8Array(CODE_LENGTH * 2))) {
      if (byte < limit && code.length < CODE_LENGTH) code += CODE_LETTERS[byte % CODE_LETTERS.length];
    }
  }
  return code;
}

/** Tidies what someone typed: "k7q f2m" → "K7QF2M". Returns null if it can't be a code. */
export function cleanCode(text) {
  const code = String(text || "").toUpperCase().replace(/[^A-Z0-9]/g, "").replace(/O/g, "0");
  return code.length === CODE_LENGTH && [...code].every((c) => CODE_LETTERS.includes(c)) ? code : null;
}

/** A short fingerprint of the question bank (FNV-1a over its JSON), so devices can tell if they match. */
export function bankFingerprint(questions) {
  const text = JSON.stringify(questions);
  let a = 2166136261;
  let b = 5381;
  for (let i = 0; i < text.length; i++) {
    const ch = text.charCodeAt(i);
    a = Math.imul(a ^ ch, 16777619);
    b = (Math.imul(b, 33) + ch) | 0;
  }
  return (a >>> 0).toString(16).padStart(8, "0") + (b >>> 0).toString(16).padStart(8, "0");
}

/** The stored number for a profile avatar id (0 if it isn't one of AVATARS). */
export const avatarIndex = (avatarId) => Math.max(0, AVATARS.findIndex((avatar) => avatar.id === avatarId));

/** The avatar to show for a stored number. Only ever one of AVATARS, whatever is stored. */
export const avatarAt = (index) => (Number.isInteger(index) && index >= 0 && index < AVATARS.length ? AVATARS[index] : AVATARS[0]);

export const seatOf = (game, uid) => SEATS.find((seat) => game?.p?.[seat]?.u === uid) || null;
export const seatsTaken = (game) => SEATS.filter((seat) => game?.p?.[seat]);
export const seatNumber = (seat) => Number(seat.slice(1)) + 1; // "s0" → Player 1
export const roundKey = (n) => `r${n}`;
export const questionKey = (n) => `q${n}`;
export const roundNumber = (key) => Number(String(key || "").slice(1));
export const roundIds = (game, r) => String(game?.qs?.[r] || "").split(",").filter(Boolean).map(Number);
export const isHost = (game, uid) => Boolean(game) && game.p?.[game.hs]?.u === uid;
export const isOnline = (game, seat) => game?.on?.[seat] === true;
export const answersFor = (game, r, i) => game?.ans?.[r]?.[i] || {};

const validSettings = (set) => Boolean(set) && MODE_KEYS.includes(set.m) && ROUND_LENGTHS.includes(set.n) && Object.keys(SCORING).includes(set.s);

export function newGameRecord({ uid, avatar, bank, settings, now }) {
  return {
    created: now,
    expires: now + GAME_LIFETIME_MS,
    bank,
    hs: "s0",
    set: { m: settings.m, n: settings.n, s: settings.s },
    st: "lobby",
    p: { s0: { u: uid, a: avatar } },
    m: { [uid]: "s0" },
  };
}

// ---------- The pure moves. Each returns the next game, or null when it isn't allowed. ----------
// The local test backend applies them as they are; the Firebase rules check the same things.

/** Takes the first empty seat. Returns the same game if this player is already seated. */
export function withJoin(game, uid, avatar, now = Date.now()) {
  if (!game || game.expires < now) return null;
  if (seatOf(game, uid)) return game;
  const seat = SEATS.find((s) => !game.p?.[s]);
  if (!seat) return null;
  return { ...game, p: { ...game.p, [seat]: { u: uid, a: avatar } }, m: { ...game.m, [uid]: seat } };
}

export function withSettings(game, uid, settings) {
  if (!isHost(game, uid) || game.st === "playing" || !validSettings(settings)) return null;
  return { ...game, set: { m: settings.m, n: settings.n, s: settings.s } };
}

/** Starts the first round from the lobby, or the next round after one finishes. */
export function withStart(game, uid, ids, now = Date.now()) {
  if (!isHost(game, uid) || game.st === "playing") return null;
  if (!Array.isArray(ids) || ids.length !== game.set.n) return null;
  const r = roundKey(game.q ? roundNumber(game.q.r) + 1 : 0);
  const at = now + timing(game.set.m).leadMs;
  return {
    ...game,
    st: "playing",
    qs: { ...game.qs, [r]: ids.join(",") },
    q: { r, i: questionKey(0), n: 0, at },
    qa: { ...game.qa, [r]: { [questionKey(0)]: at } },
  };
}

/** Moves on to the next question of the round. */
export function withNext(game, uid, now = Date.now()) {
  if (!isHost(game, uid) || game.st !== "playing") return null;
  const n = game.q.n + 1;
  if (n >= game.set.n || now < game.q.at) return null;
  const i = questionKey(n);
  const at = now + timing(game.set.m).leadMs;
  return { ...game, q: { ...game.q, i, n, at }, qa: { ...game.qa, [game.q.r]: { ...game.qa?.[game.q.r], [i]: at } } };
}

/** Ends the round (after its last question). */
export function withFinish(game, uid) {
  if (!isHost(game, uid) || game.st !== "playing" || game.q.n !== game.set.n - 1) return null;
  return { ...game, st: "over" };
}

/** One answer per player per question, only for the current question and only while it's open. */
export function withAnswer(game, uid, { r, i, choice, ms }, now = Date.now()) {
  const seat = seatOf(game, uid);
  if (!seat || game.st !== "playing" || game.q.r !== r || game.q.i !== i) return null;
  if (game.ans?.[r]?.[i]?.[seat]) return null;
  if (!Number.isInteger(choice) || choice < 0 || choice > 3) return null;
  const t = timing(game.set.m);
  const opens = game.q.at + t.lockMs;
  if (now < opens || now > opens + t.answerMs + t.slackMs) return null;
  const answer = { c: choice, ms: Math.max(0, Math.min(60000, Math.round(ms))), at: now };
  return {
    ...game,
    ans: { ...game.ans, [r]: { ...game.ans?.[r], [i]: { ...game.ans?.[r]?.[i], [seat]: answer } } },
  };
}

export function withReaction(game, uid, e, now = Date.now()) {
  const seat = seatOf(game, uid);
  if (!seat || !Number.isInteger(e) || e < 0 || e >= REACTIONS.length) return null;
  const last = game.rx?.[seat];
  if (last && now - last.at < REACTION_GAP_MS * 0.75) return null;
  return { ...game, rx: { ...game.rx, [seat]: { e, at: now } } };
}

/** A seated player takes over as host when the host's device has gone offline. */
export function withHostClaim(game, uid) {
  const seat = seatOf(game, uid);
  if (!seat || seat === game.hs || isOnline(game, game.hs)) return null;
  return { ...game, hs: seat };
}
