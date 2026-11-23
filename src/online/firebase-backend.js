// Online play through Firebase: anonymous sign-in (no email, no password, nothing personal) and
// the Realtime Database. Loaded only when someone opens Play online, so the rest of the app stays
// small and works offline. database.rules.json is the server-side half of this file.
import { initializeApp } from "firebase/app";
import { initializeAppCheck, ReCaptchaEnterpriseProvider, ReCaptchaV3Provider } from "firebase/app-check";
import { getAuth, signInAnonymously, onAuthStateChanged } from "firebase/auth";
import {
  getDatabase, ref, get, set, update, remove, onValue, runTransaction, onDisconnect, serverTimestamp,
  query, orderByChild, endAt, limitToFirst,
} from "firebase/database";
import { makeCode, newGameRecord, seatOf, SEATS, withFinish, withNext, withStart, GAME_LIFETIME_MS } from "./common.js";

export async function createFirebaseBackend(config, appCheckSiteKey = null, appCheckProvider = "enterprise") {
  const app = initializeApp(config);
  if (appCheckSiteKey) {
    // On a developer's own computer, App Check prints a debug token in the console instead; add
    // it under App Check → Apps → Manage debug tokens to test against the real project.
    if (["localhost", "127.0.0.1"].includes(location.hostname)) self.FIREBASE_APPCHECK_DEBUG_TOKEN = true;
    // Invisible: reCAPTCHA scores the request in the background, players never see a challenge.
    const provider = appCheckProvider === "v3" ? new ReCaptchaV3Provider(appCheckSiteKey) : new ReCaptchaEnterpriseProvider(appCheckSiteKey);
    initializeAppCheck(app, { provider, isTokenAutoRefreshEnabled: true });
  }
  const auth = getAuth(app);
  const db = getDatabase(app);
  // The same anonymous id comes back on this device, so a player can rejoin their games.
  const user = await new Promise((resolve, reject) => {
    const stop = onAuthStateChanged(auth, (u) => {
      if (u) { stop(); resolve(u); return; }
      signInAnonymously(auth).catch((error) => { stop(); reject(error); });
    }, reject);
  });
  const uid = user.uid;
  const gameRef = (code, path = "") => ref(db, `games/${code}${path ? `/${path}` : ""}`);
  const secureRandom = () => crypto.getRandomValues(new Uint32Array(1))[0] / 2 ** 32;
  // Question times use the server's clock, so a phone with its clock set wrong is still in step.
  let offset = 0;
  onValue(ref(db, ".info/serverTimeOffset"), (snap) => { offset = snap.val() || 0; });
  const serverNow = () => Date.now() + offset;

  const attempt = async (write) => {
    try { await write(); return true; } catch { return false; } // refused by the rules, or offline
  };
  /** Reads the game, applies a pure move from common.js, and writes the paths it changed. */
  async function move(code, change, paths) {
    try {
      const game = (await get(gameRef(code))).val();
      const next = game && change(game);
      if (!next) return false;
      await update(gameRef(code), paths(next));
      return true;
    } catch {
      return false;
    }
  }

  return {
    kind: "firebase",
    uid,
    serverNow,
    async create({ avatar, bank, settings }) {
      for (let tries = 0; tries < 5; tries++) {
        const code = makeCode(secureRandom);
        const record = { ...newGameRecord({ uid, avatar, bank, settings, now: serverNow() }), created: serverTimestamp() };
        record.expires = serverNow() + GAME_LIFETIME_MS;
        const outcome = await runTransaction(gameRef(code), (game) => (game === null ? record : undefined));
        if (outcome.committed) return code;
      }
      throw new Error("busy");
    },
    async read(code) {
      return (await get(gameRef(code))).val();
    },
    async join(code, avatar) {
      const game = (await get(gameRef(code))).val();
      if (!game || game.expires < serverNow()) throw new Error("not-found");
      const mine = seatOf(game, uid);
      if (mine) return { seat: mine };
      for (const seat of SEATS) {
        if (game.p?.[seat]) continue;
        try {
          const outcome = await runTransaction(gameRef(code, `p/${seat}`), (s) => (s === null ? { u: uid, a: avatar } : undefined));
          if (outcome.committed && outcome.snapshot.val()?.u === uid) return { seat };
        } catch {
          // someone took it first, or the rules refused: try the next seat
        }
      }
      throw new Error("full");
    },
    watch(code, cb) {
      return onValue(gameRef(code), (snapshot) => cb(snapshot.val()), () => cb(null));
    },
    setSettings: (code, settings) => attempt(() => set(gameRef(code, "set"), settings)),
    start: (code, ids) => move(code, (g) => withStart(g, uid, ids, serverNow()), (next) => ({
      st: next.st, [`qs/${next.q.r}`]: next.qs[next.q.r], q: next.q, [`qa/${next.q.r}/${next.q.i}`]: next.q.at,
    })),
    next: (code) => move(code, (g) => withNext(g, uid, serverNow()), (next) => ({
      q: next.q, [`qa/${next.q.r}/${next.q.i}`]: next.q.at,
    })),
    finish: (code) => move(code, (g) => withFinish(g, uid), () => ({ st: "over" })),
    answer: (code, { r, i, seat, choice, ms }) => attempt(() => set(gameRef(code, `ans/${r}/${i}/${seat}`), { c: choice, ms: Math.max(0, Math.min(60000, Math.round(ms))), at: serverTimestamp() })),
    react: (code, e, seat) => attempt(() => set(gameRef(code, `rx/${seat}`), { e, at: serverTimestamp() })),
    claimHost: (code, seat) => attempt(() => set(gameRef(code, "hs"), seat)),
    setPresence(code, seat) {
      const mine = gameRef(code, `on/${seat}`);
      // Mark this player online whenever the connection (re)opens; Firebase marks them offline
      // by itself if the phone loses the connection or the app is closed.
      const stop = onValue(ref(db, ".info/connected"), (snap) => {
        if (snap.val() !== true) return;
        onDisconnect(mine).set(false).then(() => set(mine, true)).catch(() => {});
      });
      return () => { stop(); set(mine, false).catch(() => {}); };
    },
    async sweep() {
      // Delete games past their 24 hours (the rules allow anyone to delete an expired game).
      try {
        const old = await get(query(ref(db, "games"), orderByChild("expires"), endAt(serverNow() - 5 * 60 * 1000), limitToFirst(25)));
        const deletions = [];
        old.forEach((child) => { deletions.push(remove(child.ref).catch(() => {})); });
        await Promise.all(deletions);
      } catch {
        // Not allowed or offline: try again another time.
      }
    },
  };
}
