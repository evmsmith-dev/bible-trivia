import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { MODES } from "../../src/config.js";
import { answerKey, openingKey, selectQuestionsForMode } from "../../src/lib/selection.js";
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

test("a round never repeats a correct answer or a question opening", () => {
  for (const mode of Object.keys(MODES)) {
    const random = createSeededRandom(`variety-${mode}`);
    let recent = [];
    for (let round = 0; round < 200; round++) {
      const picked = selectQuestionsForMode(questions, mode, random, 10, recent);
      const answers = picked.map(answerKey);
      const openings = picked.map(openingKey);
      assert.equal(new Set(answers).size, 10, `${mode} round ${round}: repeated answer in ${answers}`);
      assert.equal(new Set(openings).size, 10, `${mode} round ${round}: look-alike questions ${openings}`);
      recent = [...recent, ...picked.map((q) => q.id)].slice(-500);
    }
  }
});

test("answers and openings are compared loosely (case, punctuation, spacing)", () => {
  assert.equal(answerKey({ opts: ["Paul.", "x"], ans: 0 }), answerKey({ opts: ["y", " paul "], ans: 1 }));
  assert.equal(openingKey({ q: "Which Gospel contains the story of Zacchaeus?" }), "which gospel contains the story");
});

test("when a clash can't be avoided, the round is still filled", () => {
  const same = Array.from({ length: 30 }, (_, i) => ({
    id: i + 1, q: `Who was the apostle number ${i}?`, opts: ["Paul", "Peter", "John", "James"], ans: 0,
    category: ["Old Testament", "New Testament", "General"][i % 3], difficulty: "easy",
  }));
  assert.equal(selectQuestionsForMode(same, "easy", createSeededRandom("clash"), 10).length, 10);
});
