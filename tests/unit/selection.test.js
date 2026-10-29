import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { MODES } from "../../src/config.js";
import { selectQuestionsForMode } from "../../src/lib/selection.js";
import { createSeededRandom, getDateKeyOffset } from "../../src/lib/utils.js";

const questions = JSON.parse(readFileSync(new URL("../../data/questions.json", import.meta.url), "utf8"));

for (const mode of Object.keys(MODES)) {
  test(`${mode}: 10 unique questions of the allowed difficulties`, () => {
    for (let run = 0; run < 25; run++) {
      const picked = selectQuestionsForMode(questions, mode);
      assert.equal(picked.length, 10);
      assert.equal(new Set(picked.map((q) => q.id)).size, 10);
      assert.ok(picked.every((q) => MODES[mode].mix.difficulties.includes(q.difficulty)));
    }
  });
}

test("rounds are balanced 4 Old Testament / 4 New Testament / 2 General", () => {
  const picked = selectQuestionsForMode(questions, "medium");
  const count = (category) => picked.filter((q) => q.category === category).length;
  assert.deepEqual([count("Old Testament"), count("New Testament"), count("General")], [4, 4, 2]);
});

test("the same seed always gives the same daily questions", () => {
  const a = selectQuestionsForMode(questions, "medium", createSeededRandom("2026-10-29|v1|daily")).map((q) => q.id);
  const b = selectQuestionsForMode(questions, "medium", createSeededRandom("2026-10-29|v1|daily")).map((q) => q.id);
  const c = selectQuestionsForMode(questions, "medium", createSeededRandom("2026-10-30|v1|daily")).map((q) => q.id);
  assert.deepEqual(a, b);
  assert.notDeepEqual(a, c);
});

test("date offsets cross month and year boundaries", () => {
  assert.equal(getDateKeyOffset("2026-03-01", -1), "2026-02-28");
  assert.equal(getDateKeyOffset("2026-12-31", 1), "2027-01-01");
  assert.equal(getDateKeyOffset("bad", 1), null);
});

test("Medium mode aims for 5 easy and 5 medium questions", () => {
  const picked = selectQuestionsForMode(questions, "medium");
  assert.equal(picked.filter((q) => q.difficulty === "easy").length, 5);
  assert.equal(picked.filter((q) => q.difficulty === "medium").length, 5);
});
