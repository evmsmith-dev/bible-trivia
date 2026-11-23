// Checks database.rules.json against the Firebase Realtime Database emulator, through its REST API
// (no Firebase SDK needed). Run with:  npm run test:rules
// (that starts the emulator with firebase-tools, which needs Java; CI does it on every push).
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { before, beforeEach, test } from "node:test";

const HOST = process.env.FIREBASE_DATABASE_EMULATOR_HOST || "127.0.0.1:9000";
const NS = "demo-bible-trivia-default-rtdb";
const BASE = `http://${HOST}`;
const RULES = readFileSync(new URL("../../database.rules.json", import.meta.url), "utf8");
const TS = { ".sv": "timestamp" };

/** An unsigned ID token: the emulator accepts these as signed-in (anonymous) users. */
function tokenFor(uid) {
  const b64 = (value) => Buffer.from(JSON.stringify(value)).toString("base64url");
  const now = Math.floor(Date.now() / 1000);
  return `${b64({ alg: "none", typ: "JWT" })}.${b64({
    iss: "https://securetoken.google.com/demo-bible-trivia", aud: "demo-bible-trivia", iat: now, exp: now + 3600, auth_time: now,
    sub: uid, user_id: uid, provider_id: "anonymous", firebase: { sign_in_provider: "anonymous", identities: {} },
  })}.`;
}

async function call(method, path, uid, body) {
  const auth = uid === "owner" ? "" : uid ? `&auth=${tokenFor(uid)}` : "";
  const response = await fetch(`${BASE}/${path}.json?ns=${NS}${auth}`, {
    method,
    headers: uid === "owner" ? { Authorization: "Bearer owner" } : {},
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  return { ok: response.ok, status: response.status, value: text ? JSON.parse(text) : null };
}
const put = (path, uid, body) => call("PUT", path, uid, body);
const patch = (path, uid, body) => call("PATCH", path, uid, body);
const del = (path, uid) => call("DELETE", path, uid);
const read = async (path) => (await call("GET", path, "owner")).value;
const allowed = async (promise, message) => assert.equal((await promise).ok, true, message);
const denied = async (promise, message) => assert.equal((await promise).ok, false, message);

const CODE = "K7QF2M";
const G = `games/${CODE}`;
const IDS5 = "1,2,3,4,5";
const settings = { m: "medium", n: 5, s: "first" };
const newGame = (now, uid = "host") => ({
  created: TS, expires: now + 86_400_000, bank: "0123456789abcdef", hs: "s0", set: settings, st: "lobby", p: { s0: { u: uid, a: 3 } }, m: { [uid]: "s0" },
});
/** Creating a game writes it together with the player's "last created" stamp, as the app does. */
const create = (uid, game, code = CODE) => patch("", uid, { [`games/${code}`]: game, [`limits/${uid}`]: TS });
/** Joining writes the seat together with the player's entry in "who's in", as the app does. */
const join = (uid, seat, avatar = 1) => patch(G, uid, { [`p/${seat}`]: { u: uid, a: avatar }, [`m/${uid}`]: seat });

before(async () => {
  const response = await fetch(`${BASE}/.settings/rules.json?ns=${NS}`, { method: "PUT", headers: { Authorization: "Bearer owner" }, body: RULES });
  assert.equal(response.ok, true, `the emulator should accept the rules: ${await response.text()}`);
});

beforeEach(async () => {
  await put("", "owner", null);
});

/** Creates the game, seats `host`, `bob` and `cat`, and returns its record. */
async function lobby() {
  await allowed(create("host", newGame(Date.now())), "the host creates a game");
  await allowed(join("bob", "s1"), "Bob joins");
  await allowed(join("cat", "s2", 2), "Cat joins");
  await allowed(put(`${G}/on/s0`, "host", true));
  return read(G);
}

async function start() {
  await lobby();
  const at = Date.now() + 3000;
  await allowed(patch(G, "host", { st: "playing", "qs/r0": IDS5, q: { r: "r0", i: "q0", n: 0, at }, "qa/r0/q0": at }), "the host starts");
  return at;
}

/** Moves the current question back in time, so its answer window is open now. */
async function openNow(lockMs = 2000) {
  await put(`${G}/q/at`, "owner", Date.now() - lockMs - 100);
}

test("creating a game: only as seat s0 and host, in the lobby, with a fixed shape", async () => {
  const now = Date.now();
  await denied(create(null, newGame(now)), "signed out");
  await denied(create("mallory", newGame(now)), "someone else in seat s0");
  await denied(create("host", newGame(now), "bad-code"));
  await denied(create("host", { ...newGame(now), st: "playing" }));
  await denied(create("host", { ...newGame(now), expires: now + 9 * 86_400_000 }), "kept longer than a day");
  await denied(create("host", { ...newGame(now), name: "Bob" }), "no extra fields (no free text)");
  await denied(create("host", { ...newGame(now), p: { s0: { u: "host", a: 3, name: "x" } } }));
  await denied(create("host", { ...newGame(now), m: {} }), "the host must be listed in who's in");
  await denied(put(G, "host", newGame(now)), "not without the rate-limit stamp");
  await allowed(create("host", newGame(now)));
  await denied(patch("", "pat", { [G]: newGame(now, "pat"), "limits/pat": TS }), "an existing game can't be overwritten");
});

test("one new game per player every 10 seconds", async () => {
  const now = Date.now();
  await allowed(create("host", newGame(now)));
  await denied(create("host", newGame(now), "K7QF2N"), "too soon after the last one");
  await denied(patch("", "host", { "games/K7QF2N": newGame(now), "limits/host": now - 60_000 }), "the stamp must be the server's time");
  await denied(put("limits/bob", "host", TS), "only your own stamp");
  await put("limits/host", "owner", now - 11_000);
  await allowed(create("host", newGame(now), "K7QF2N"), "fine after 10 seconds");
});

test("joining takes an empty seat once; one seat per player; seats are s0–s7 only", async () => {
  await lobby();
  await denied(join("mallory", "s1"), "a taken seat");
  await denied(patch(G, "mallory", { "p/s3": { u: "someone-else", a: 0 }, "m/mallory": "s3" }), "only yourself");
  await denied(join("mallory", "s8"), "no ninth seat");
  await denied(join("mallory", "s3", 30), "only real avatars");
  await denied(put(`${G}/p/s3`, "mallory", { u: "mallory", a: 0 }), "not without an entry in who's in");
  await denied(put(`${G}/m/mallory`, "mallory", "s3"), "not without the seat");
  await denied(join("bob", "s3"), "Bob already has a seat");
  await allowed(join("dan", "s3", 29));
  await denied(join("dan", "s4"), "a second seat for the same player");
  await denied(put(`${G}/m/dan`, "dan", "s4"), "who's in can't be changed");
  await denied(put(`${G}/on/s3`, "bob", true), "only your own presence");
  await allowed(put(`${G}/on/s3`, "dan", true));
});

test("players change only their own picture", async () => {
  await lobby();
  await allowed(put(`${G}/p/s1/a`, "bob", 12));
  await denied(put(`${G}/p/s2/a`, "bob", 5), "not someone else's");
  await denied(put(`${G}/p/s1/a`, "bob", 30), "only real avatars");
  await denied(put(`${G}/p/s1/u`, "bob", "mallory"), "the seat's owner can't be changed");
  await denied(put(`${G}/p/s5/a`, "bob", 1), "not an empty seat");
});

test("only the host changes settings and starts; the round needs its questions", async () => {
  await lobby();
  await denied(put(`${G}/set`, "bob", { m: "hard", n: 10, s: "everyone" }));
  await denied(put(`${G}/set`, "host", { m: "impossible", n: 10, s: "first" }));
  await denied(put(`${G}/set`, "host", { m: "hard", n: 7, s: "first" }));
  await allowed(put(`${G}/set`, "host", settings));
  const at = Date.now() + 3000;
  await denied(patch(G, "bob", { st: "playing", "qs/r0": IDS5, q: { r: "r0", i: "q0", n: 0, at }, "qa/r0/q0": at }), "not the host");
  await denied(patch(G, "host", { st: "playing", q: { r: "r0", i: "q0", n: 0, at } }), "no questions picked");
  await denied(patch(G, "host", { st: "playing", "qs/r0": "1,2,3", q: { r: "r0", i: "q0", n: 0, at } }), "too few questions");
  await denied(patch(G, "host", { st: "playing", "qs/r0": IDS5, q: { r: "r0", i: "q0", n: 0, at: Date.now() + 60_000 } }), "too far ahead");
  await allowed(patch(G, "host", { st: "playing", "qs/r0": IDS5, q: { r: "r0", i: "q0", n: 0, at }, "qa/r0/q0": at }));
  await denied(put(`${G}/set`, "host", { m: "hard", n: 5, s: "first" }), "no settings changes mid-round");
});

test("answers: one per player, only in the open window, stamped with the server's time", async () => {
  await start();
  const answer = { c: 2, ms: 900, at: TS };
  await denied(put(`${G}/ans/r0/q0/s1`, "bob", answer), "still in the reading time");
  await openNow();
  await denied(put(`${G}/ans/r0/q0/s2`, "bob", answer), "not someone else's seat");
  await denied(put(`${G}/ans/r0/q1/s1`, "bob", answer), "not a question that isn't open");
  await denied(put(`${G}/ans/r0/q0/s1`, "bob", { ...answer, at: Date.now() - 5000 }), "the time must be the server's");
  await denied(put(`${G}/ans/r0/q0/s1`, "bob", { ...answer, c: 4 }));
  await denied(put(`${G}/ans/r0/q0/s1`, "bob", { ...answer, extra: 1 }));
  await allowed(put(`${G}/ans/r0/q0/s1`, "bob", answer));
  await denied(put(`${G}/ans/r0/q0/s1`, "bob", { ...answer, c: 1 }), "no second try");
  await put(`${G}/q/at`, "owner", Date.now() - 2000 - 25_000 - 3000);
  await denied(put(`${G}/ans/r0/q0/s2`, "cat", answer), "after time is up");
});

test("moving on: the host, one question at a time; finishing only after the last", async () => {
  await start();
  await denied(patch(G, "host", { q: { r: "r0", i: "q1", n: 1, at: Date.now() + 3000 } }), "not before the question has appeared");
  await openNow();
  const at = Date.now() + 3000;
  await denied(patch(G, "bob", { q: { r: "r0", i: "q1", n: 1, at }, "qa/r0/q1": at }), "only the host");
  await denied(patch(G, "host", { q: { r: "r0", i: "q2", n: 2, at } }), "no skipping");
  await denied(patch(G, "host", { st: "over" }), "not after question 1 of 5");
  await allowed(patch(G, "host", { q: { r: "r0", i: "q1", n: 1, at }, "qa/r0/q1": at }));
  await denied(put(`${G}/qa/r0/q1`, "host", at + 5), "question times are written once");
  for (let n = 2; n < 5; n++) {
    await openNow();
    const next = Date.now() + 3000;
    await allowed(patch(G, "host", { q: { r: "r0", i: `q${n}`, n, at: next }, [`qa/r0/q${n}`]: next }), `question ${n + 1}`);
  }
  await openNow();
  await denied(patch(G, "host", { q: { r: "r0", i: "q5", n: 5, at: Date.now() + 3000 } }), "no sixth question in a 5-question round");
  await allowed(patch(G, "host", { st: "over" }));
  // Play again: a new round from the start.
  const again = Date.now() + 3000;
  await denied(patch(G, "host", { st: "playing", q: { r: "r1", i: "q0", n: 0, at: again } }), "the new round needs its questions");
  await allowed(patch(G, "host", { st: "playing", "qs/r1": "6,7,8,9,10", q: { r: "r1", i: "q0", n: 0, at: again }, "qa/r1/q0": again }));
});

test("the host can be replaced only while the host is offline", async () => {
  await lobby();
  await denied(put(`${G}/hs`, "bob", "s1"), "the host is online");
  await allowed(put(`${G}/on/s0`, "host", false));
  await denied(put(`${G}/hs`, "bob", "s2"), "only to your own seat");
  await allowed(put(`${G}/hs`, "bob", "s1"));
  await allowed(put(`${G}/set`, "bob", { m: "easy", n: 10, s: "everyone" }), "the new host can change settings");
  await denied(put(`${G}/set`, "host", settings), "the old host can't");
});

test("reactions: your own seat, a fixed set, at most one every 1.5 s", async () => {
  await lobby();
  await denied(put(`${G}/rx/s2`, "bob", { e: 0, at: TS }));
  await denied(put(`${G}/rx/s1`, "bob", { e: 5, at: TS }));
  await allowed(put(`${G}/rx/s1`, "bob", { e: 0, at: TS }));
  await denied(put(`${G}/rx/s1`, "bob", { e: 1, at: TS }), "too soon");
});

test("reading needs the code; old games can be swept by anyone, others by no one", async () => {
  await lobby();
  assert.equal((await call("GET", G, "mallory")).ok, true, "anyone signed in with the code can read it");
  assert.equal((await call("GET", G, null)).ok, false);
  assert.equal((await call("GET", "games", "mallory")).ok, false, "games can't be listed");
  await denied(del(G, "mallory"), "a live game can't be deleted");
  await put(`${G}/expires`, "owner", Date.now() - 1000);
  await allowed(del(G, "mallory"), "an expired game can");
  await denied(put("other/thing", "mallory", 1), "nothing outside games/");
});
