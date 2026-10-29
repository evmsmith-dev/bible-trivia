import assert from "node:assert/strict";
import { test } from "node:test";
import { summaryHeadline } from "../../src/lib/scoring.js";

test("the summary headline follows how the round went", () => {
  assert.equal(summaryHeadline(10, "Dad"), "Perfect round, Dad!");
  assert.equal(summaryHeadline(9, "Dad"), "Excellent, Dad!");
  assert.equal(summaryHeadline(8, "Dad"), "Excellent, Dad!");
  assert.equal(summaryHeadline(7, "Dad"), "Great job, Dad!");
  assert.equal(summaryHeadline(6, "Dad"), "Great job, Dad!");
  assert.equal(summaryHeadline(5, "Dad"), "Good effort, Dad!");
  assert.equal(summaryHeadline(4, "Dad"), "Good effort, Dad!");
  assert.equal(summaryHeadline(3, "Dad"), "Nice try, Dad!");
  assert.equal(summaryHeadline(0, "Dad"), "Nice try, Dad!");
});
