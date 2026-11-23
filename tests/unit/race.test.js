import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import {
  bankFingerprint, cleanCode, makeCode, newGameRecord, timing, withAnswer, withFinish, withHostClaim, withJoin, withNext,
  withReaction, withSettings, withStart, MAX_SEATS,
} from "../../src/online/common.js";
import { CLAMP_MS, effectiveMs, questionResult, roundWinners, standings, usedIds, winsTonight } from "../../src/lib/race.js";

const T0 = 1_800_000_000_000;
const settings = { m: "medium", n: 5, s: "first" };
const bank = new Map([1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((id) => [id, { id, ans: id % 4 }]));
const right = (id) => id % 4;
const wrong = (id) => (id + 1) % 4;

/** A game with players A (host), B and C, started at T0. */
function startedGame(rule = "first") {
  let g = newGameRecord({ uid: "A", avatar: 0, bank: "x", settings: { ...settings, s: rule }, now: T0 });
  g = withJoin(g, "B", 3, T0);
  g = withJoin(g, "C", 9, T0);
  return withStart(g, "A", [1, 2, 3, 4, 5], T0);
}
const opens = (g) => g.q.at + timing(g.set.m).lockMs;
/** `who` answers the current question `afterMs` after it unlocks, with the phone reporting `ms`. */
function answer(g, who, { correct = true, afterMs = 1000, ms = afterMs } = {}) {
  const id = [1, 2, 3, 4, 5][g.q.n];
  const next = withAnswer(g, who, { r: g.q.r, i: g.q.i, choice: correct ? right(id) : wrong(id), ms }, opens(g) + afterMs);
  assert.ok(next, `${who}'s answer should be accepted`);
  return next;
}

test("codes and the question-bank fingerprint", () => {
  for (let i = 0; i < 100; i++) assert.match(makeCode(), /^[A-HJKMNP-Z2-9]{6}$/); // same pattern as database.rules.json
  assert.equal(cleanCode(" k7q f2m "), "K7QF2M");
  assert.equal(cleanCode("K7QF2I"), null);
  const questions = JSON.parse(readFileSync(new URL("../../data/questions.json", import.meta.url), "utf8"));
  const print = bankFingerprint(questions);
  assert.match(print, /^[0-9a-f]{16}$/);
  assert.equal(bankFingerprint(JSON.parse(JSON.stringify(questions))), print, "the minified build gives the same fingerprint");
  const changed = structuredClone(questions);
  changed[0].ans = (changed[0].ans + 1) % 4;
  assert.notEqual(bankFingerprint(changed), print, "a corrected answer changes it");
});

test("joining: seats fill in order, up to 8, and rejoining keeps your seat", () => {
  let g = newGameRecord({ uid: "A", avatar: 0, bank: "x", settings, now: T0 });
  for (let i = 1; i < MAX_SEATS; i++) g = withJoin(g, `P${i}`, i, T0);
  assert.equal(Object.keys(g.p).length, MAX_SEATS);
  assert.equal(g.p.s7.u, "P7");
  assert.equal(g.m.P7, "s7", "who's in lists each player's one seat");
  assert.equal(g.m.A, "s0");
  assert.equal(withJoin(g, "late", 1, T0), null, "a full game can't be joined");
  assert.equal(withJoin(g, "P3", 1, T0), g, "rejoining is fine");
  assert.equal(withJoin(g, "Z", 1, g.expires + 1), null, "an expired game can't be joined");
});

test("only the host starts, changes settings and moves on", () => {
  let g = newGameRecord({ uid: "A", avatar: 0, bank: "x", settings, now: T0 });
  g = withJoin(g, "B", 1, T0);
  assert.equal(withSettings(g, "B", { m: "hard", n: 10, s: "everyone" }), null);
  assert.equal(withSettings(g, "A", { m: "nope", n: 10, s: "first" }), null);
  g = withSettings(g, "A", { m: "hard", n: 5, s: "everyone" });
  assert.deepEqual(g.set, { m: "hard", n: 5, s: "everyone" });
  assert.equal(withStart(g, "B", [1, 2, 3, 4, 5], T0), null);
  assert.equal(withStart(g, "A", [1, 2, 3], T0), null, "the round needs its full number of questions");
  g = withStart(g, "A", [1, 2, 3, 4, 5], T0);
  assert.equal(g.st, "playing");
  assert.deepEqual(g.q, { r: "r0", i: "q0", n: 0, at: T0 + 3000 });
  assert.equal(g.qa.r0.q0, T0 + 3000);
  assert.equal(withSettings(g, "A", settings), null, "no changes mid-round");
  assert.equal(withNext(g, "B", T0 + 9000), null);
  assert.equal(withNext(g, "A", T0 + 1000), null, "not before the question has even appeared");
  g = withNext(g, "A", T0 + 20000);
  assert.equal(g.q.i, "q1");
  assert.equal(g.qa.r0.q1, T0 + 23000);
  assert.equal(withFinish(g, "A"), null, "the round isn't over until its last question");
});

test("answers: one per player, only in the open window, for the current question", () => {
  let g = startedGame();
  const at = opens(g);
  const tryAnswer = (who, now, extra = {}) => withAnswer(g, who, { r: "r0", i: "q0", choice: 1, ms: 500, ...extra }, now);
  assert.equal(tryAnswer("B", at - 1), null, "not during the reading time");
  assert.equal(tryAnswer("B", at + timing("medium").answerMs + timing("medium").slackMs + 1), null, "not after time is up");
  assert.equal(tryAnswer("Z", at + 500), null, "only seated players");
  assert.equal(tryAnswer("B", at + 500, { i: "q1" }), null, "only the current question");
  assert.equal(tryAnswer("B", at + 500, { choice: 4 }), null);
  g = tryAnswer("B", at + 500);
  assert.deepEqual(g.ans.r0.q0.s1, { c: 1, ms: 500, at: at + 500 });
  assert.equal(withAnswer(g, "B", { r: "r0", i: "q0", choice: 2, ms: 900 }, at + 900), null, "no second try");
});

test("the phone's own time is trusted only within 300 ms of the server's", () => {
  assert.equal(effectiveMs({ ms: 800, at: 2000 }, 1000), 800, "lag taken out");
  assert.equal(effectiveMs({ ms: 100, at: 2000 }, 1000), 1000 - CLAMP_MS, "a too-good claim is clamped");
  assert.equal(effectiveMs({ ms: 1500, at: 2000 }, 1000), 1000, "never slower than the server saw");
  assert.equal(effectiveMs({ ms: 700 }, NaN), 700);
});

test("first correct answer gets the point; a wrong answer scores nothing", () => {
  const r = questionResult({ s0: { c: 2, ms: 900, at: 1900 }, s1: { c: 1, ms: 400, at: 1400 }, s2: { c: 2, ms: 1600, at: 2600 } }, 2, 1000, "first");
  assert.deepEqual(r.firsts, ["s0"]);
  assert.equal(r.bySeat.s0.points, 1);
  assert.equal(r.bySeat.s1.points, 0, "the faster wrong answer doesn't count");
  assert.equal(r.bySeat.s2.points, 0);
  assert.equal(r.bySeat.s2.correct, true);
});

test("right answers within 250 ms of the fastest share the point", () => {
  const r = questionResult({ s0: { c: 0, ms: 1000, at: 2000 }, s1: { c: 0, ms: 1200, at: 2200 }, s2: { c: 0, ms: 1300, at: 2300 } }, 0, 1000, "first");
  assert.deepEqual(r.firsts, ["s0", "s1"]);
  assert.equal(r.bySeat.s2.points, 0);
});

test("everyone scores: 2 for first, 1 for any other right answer", () => {
  const r = questionResult({ s0: { c: 3, ms: 1000, at: 2000 }, s1: { c: 3, ms: 3000, at: 4000 }, s2: { c: 1, ms: 500, at: 1500 } }, 3, 1000, "everyone");
  assert.equal(r.bySeat.s0.points, 2);
  assert.equal(r.bySeat.s1.points, 1);
  assert.equal(r.bySeat.s2.points, 0);
});

test("nobody right: nobody scores", () => {
  const r = questionResult({ s0: { c: 1, ms: 1000, at: 2000 } }, 0, 1000);
  assert.deepEqual(r.firsts, []);
  assert.equal(r.fastestMs, null);
});

test("standings, tie-breaks, round winners and wins tonight", () => {
  let g = startedGame();
  // Q1: B first. Q2: C first, B right but slower. Q3: B first. Q4: C first. Q5: nobody.
  g = answer(g, "B", { afterMs: 800 }); g = answer(g, "C", { afterMs: 2000 });
  g = withNext(g, "A", g.q.at + 20000);
  g = answer(g, "C", { afterMs: 700 }); g = answer(g, "B", { afterMs: 1500 });
  g = withNext(g, "A", g.q.at + 20000);
  g = answer(g, "B", { afterMs: 900 });
  g = withNext(g, "A", g.q.at + 20000);
  g = answer(g, "C", { afterMs: 600 }); g = answer(g, "A", { correct: false, afterMs: 300 });
  g = withNext(g, "A", g.q.at + 20000);
  g = answer(g, "A", { correct: false, afterMs: 400 });

  const list = standings(g, bank);
  assert.deepEqual(list.map((row) => [row.seat, row.points, row.correct]), [["s1", 2, 3], ["s2", 2, 3], ["s0", 0, 0]]);
  // B and C have 2 points and 3 right answers each; B's right answers took 3,200 ms, C's 3,300 ms.
  assert.deepEqual(list.map((row) => row.rank), [1, 2, 3]);
  assert.deepEqual(standings(g, bank, "r0", 1).map((row) => row.seat), ["s1", "s2", "s0"], "after the first question");

  assert.deepEqual(winsTonight(g, bank), {}, "the round isn't over yet");
  g = withFinish(g, "A");
  assert.equal(g.st, "over");
  assert.deepEqual(roundWinners(g, bank, "r0"), ["s1"]);
  assert.deepEqual(winsTonight(g, bank), { s1: 1 });

  // A rematch: a new round with new questions; the scoreboard starts again.
  g = withStart(g, "A", [6, 7, 8, 9, 10], g.q.at + 30000);
  assert.equal(g.q.r, "r1");
  assert.deepEqual(usedIds(g), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  assert.ok(standings(g, bank).every((row) => row.points === 0));
  assert.deepEqual(winsTonight(g, bank), { s1: 1 }, "last round's win still counts");
});

test("players level on every tie-break share the win", () => {
  let g = startedGame();
  g = answer(g, "B", { afterMs: 1000 }); g = answer(g, "C", { afterMs: 1100 });
  for (let n = 1; n < 5; n++) g = withNext(g, "A", g.q.at + 20000);
  g = withFinish(g, "A");
  const list = standings(g, bank);
  assert.deepEqual(list.map((row) => row.rank), [1, 2, 3], "C was 100 ms slower in total");
  let h = startedGame();
  h = answer(h, "B", { afterMs: 1000 }); h = answer(h, "C", { afterMs: 1000 });
  for (let n = 1; n < 5; n++) h = withNext(h, "A", h.q.at + 20000);
  h = withFinish(h, "A");
  assert.deepEqual(roundWinners(h, bank, "r0"), ["s1", "s2"]);
});

test("reactions are rate-limited; the host can be replaced only when offline", () => {
  let g = startedGame();
  g = withReaction(g, "B", 2, T0);
  assert.equal(g.rx.s1.e, 2);
  assert.equal(withReaction(g, "B", 1, T0 + 100), null);
  assert.equal(withReaction(g, "B", 9, T0 + 5000), null);
  g = { ...g, on: { s0: true, s1: true, s2: true } };
  assert.equal(withHostClaim(g, "B"), null, "the host is still here");
  g = { ...g, on: { ...g.on, s0: false } };
  g = withHostClaim(g, "B");
  assert.equal(g.hs, "s1");
  assert.ok(withNext(g, "B", g.q.at + 20000), "the new host can move on");
});
