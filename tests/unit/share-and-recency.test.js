import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { buildDailyShareText } from "../../src/lib/share.js";
import { selectQuestionsForMode } from "../../src/lib/selection.js";
import { state } from "../../src/state.js";
import { getDailyAttemptQuestions } from "../../src/features/daily.js";
import { sanitizeDailyRecord, createDailySeed } from "../../src/lib/records.js";

const questions = JSON.parse(readFileSync(new URL("../../data/questions.json", import.meta.url), "utf8"));

test("share text has the date, emoji grid, score and link", () => {
  const text = buildDailyShareText({
    dateKey: "2026-10-29",
    results: [true, true, false, true, true, true, false, true, true, true],
    score: 1234,
    url: "https://example.org/trivia/",
  });
  assert.equal(text, [
    "Bible Trivia Daily Challenge 🎯",
    "Thu, Oct 29, 2026",
    "🟩🟩🟥🟩🟩🟩🟥🟩🟩🟩",
    "8/10 · 1,234 pts",
    "https://example.org/trivia/",
  ].join("\n"));
  assert.match(buildDailyShareText({ dateKey: "2026-10-29", results: [true], score: 5, attemptNumber: 2 }), /attempt 2$/);
});

test("rounds pick questions the player hasn't seen before ones seen recently", () => {
  const easy = questions.filter((q) => q.difficulty === "easy");
  const recent = easy.slice(0, easy.length - 30).map((q) => q.id); // all but 30 easy questions seen
  const fresh = new Set(easy.slice(-30).map((q) => q.id));
  const picked = selectQuestionsForMode(questions, "easy", Math.random, 10, recent);
  assert.equal(picked.length, 10);
  assert.ok(picked.every((q) => fresh.has(q.id)), "all ten should be unseen questions");
});

test("when everything has been seen, the oldest-seen questions come first", () => {
  const easy = questions.filter((q) => q.difficulty === "easy").map((q) => q.id);
  const picked = selectQuestionsForMode(questions, "easy", Math.random, 10, easy);
  const oldestHalf = new Set(easy.slice(0, Math.ceil(easy.length / 2)));
  assert.ok(picked.every((q) => oldestHalf.has(q.id)));
});

test("daily retries get a different, repeatable question set", () => {
  state.questions = questions;
  state.questionsById = new Map(questions.map((q) => [q.id, q]));
  const seed = createDailySeed("2026-10-29");
  const firstIds = selectQuestionsForMode(questions, "medium", undefined, 10).map((q) => q.id);
  const record = sanitizeDailyRecord({ dateKey: "2026-10-29", seed, questionIds: firstIds });

  const attempt1 = getDailyAttemptQuestions(record, 0).map((q) => q.id);
  const attempt2 = getDailyAttemptQuestions(record, 1).map((q) => q.id);
  const attempt3 = getDailyAttemptQuestions(record, 2).map((q) => q.id);
  assert.deepEqual(attempt1, firstIds);
  assert.equal(attempt2.length, 10);
  assert.equal(attempt2.filter((id) => attempt1.includes(id)).length, 0);
  assert.equal(attempt3.filter((id) => attempt1.includes(id) || attempt2.includes(id)).length, 0);
  assert.deepEqual(getDailyAttemptQuestions(record, 1).map((q) => q.id), attempt2); // repeatable
});
