import assert from "node:assert/strict";
import { test } from "node:test";
import { pickPracticeRound, practiceQuestions, recordMiss, recordRight, sanitizePractice } from "../../src/lib/practice.js";

const bank = new Map(Array.from({ length: 30 }, (_, i) => [i + 1, { id: i + 1, q: `Q${i + 1}` }]));

test("misses go on the list and right answers take them off", () => {
  let list = recordMiss({}, 3, "2026-10-30T10:00:00Z");
  list = recordMiss(list, 3, "2026-10-30T11:00:00Z");
  list = recordMiss(list, 7, "2026-10-30T12:00:00Z");
  assert.deepEqual(list[3], { misses: 2, lastMissed: "2026-10-30T11:00:00Z" });
  assert.equal(Object.keys(list).length, 2);
  list = recordRight(list, 3);
  assert.deepEqual(Object.keys(list), ["7"]);
  assert.equal(recordRight(list, 99), list); // not on the list: unchanged
});

test("a practice round is the 10 most recently missed questions, still in the bank", () => {
  let list = {};
  for (let id = 1; id <= 15; id++) list = recordMiss(list, id, `2026-10-30T10:${String(id).padStart(2, "0")}:00Z`);
  list = recordMiss(list, 999, "2026-10-30T11:00:00Z"); // no longer in the bank
  assert.equal(practiceQuestions(list, bank).length, 15);
  const round = pickPracticeRound(list, bank, () => 0.5);
  assert.equal(round.length, 10);
  assert.deepEqual(round.map((q) => q.id).sort((a, b) => a - b), [6, 7, 8, 9, 10, 11, 12, 13, 14, 15]);
});

test("saved lists are cleaned and capped", () => {
  assert.deepEqual(sanitizePractice({ 5: { misses: "x" }, abc: { misses: 2 }, 8: null }), {
    5: { misses: 1, lastMissed: "" }, 8: { misses: 1, lastMissed: "" },
  });
  const big = Object.fromEntries(Array.from({ length: 250 }, (_, i) => [i + 1, { misses: 1, lastMissed: new Date(Date.UTC(2026, 0, 1, 0, i)).toISOString() }]));
  const kept = sanitizePractice(big);
  assert.equal(Object.keys(kept).length, 200);
  assert.ok(kept[250] && !kept[1]); // the most recent are kept
});
