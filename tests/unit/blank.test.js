import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { fillBlank, isFillInTheBlank, splitBlank } from "../../src/lib/blank.js";

test("splitBlank finds the blank, or returns null", () => {
  assert.deepEqual(splitBlank("“Pray without ___.”"), ["“Pray without ", ".”"]);
  assert.deepEqual(splitBlank("___ is first"), ["", " is first"]);
  assert.equal(splitBlank("Who built the ark?"), null);
});

test("fillBlank drops the answer into the sentence", () => {
  assert.equal(fillBlank("“In the beginning, God created the heavens and the ___.”", "earth"),
    "“In the beginning, God created the heavens and the earth.”");
  assert.equal(fillBlank("No blank here", "x"), "No blank here");
});

test("the bank has fill-in-the-blank questions at every difficulty and in every category", () => {
  const bank = JSON.parse(readFileSync(new URL("../../data/questions.json", import.meta.url), "utf8"));
  const blanks = bank.filter(isFillInTheBlank);
  for (const difficulty of ["easy", "medium", "hard"]) {
    for (const category of ["Old Testament", "New Testament", "General"]) {
      const count = blanks.filter((q) => q.difficulty === difficulty && q.category === category).length;
      assert.ok(count >= 10, `${difficulty} / ${category} has ${count}`);
    }
  }
  // Filling in the right answer never leaves a stray blank or doubled space.
  for (const q of blanks) assert.doesNotMatch(fillBlank(q.q, q.opts[q.ans]), /_|\s{2}/, `id ${q.id}`);
});
