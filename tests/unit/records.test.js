import assert from "node:assert/strict";
import { test } from "node:test";
import {
  applyDailyCompletion, normalizeMode, reconcileLevelCounter, sanitizeDailyStats,
  sanitizePlayerName, sanitizePlayerStats, sanitizeProfile, trimHighScores,
} from "../../src/lib/records.js";

test("mode normalisation accepts old spellings", () => {
  assert.equal(normalizeMode("Super Hard"), "superHard");
  assert.equal(normalizeMode("superHard"), "superHard");
  assert.equal(normalizeMode("HARD"), "hard");
  assert.equal(normalizeMode(undefined), "medium");
});

test("player names are trimmed and must be 2-15 characters", () => {
  assert.equal(sanitizePlayerName("  Ruth "), "Ruth");
  assert.equal(sanitizePlayerName("x"), null);
  assert.equal(sanitizePlayerName("a".repeat(16)), null);
});

test("profiles are repaired", () => {
  assert.deepEqual(sanitizeProfile({ name: "?", avatarId: "missing", nonDailyCorrectAnswers: -4 }), {
    id: "primary", name: "Player", avatarId: "emoji-smile", nonDailyCorrectAnswers: 0, levelCountVersion: 1,
  });
});

test("old level counters are rebuilt once from normal-game history", () => {
  const old = sanitizeProfile({ name: "Ann", nonDailyCorrectAnswers: 200 });
  const history = [{ correct: 8 }, { correct: 7 }];
  const fixed = reconcileLevelCounter(old, history);
  assert.equal(fixed.nonDailyCorrectAnswers, 15);
  assert.equal(fixed.levelCountVersion, 2);
  assert.equal(reconcileLevelCounter(fixed, [{ correct: 1 }]), fixed); // only once
  assert.equal(reconcileLevelCounter(old, []).nonDailyCorrectAnswers, 200); // no history: keep
});

test("stats sanitising fills missing fields", () => {
  const stats = sanitizePlayerStats({ totalCorrectClicks: 3.4, currentStreak: 5, allTimeBestStreak: 2 });
  assert.equal(stats.totalCorrectClicks, 3);
  assert.equal(stats.allTimeBestStreak, 5);
  assert.deepEqual(stats.correctCountByMode, { easy: 0, medium: 0, hard: 0, superHard: 0 });
});

test("high scores keep the top 5 per mode, best first", () => {
  const scores = Array.from({ length: 8 }, (_, i) => ({ score: i * 10, timestamp: "2026-01-01T00:00:00Z", correct: i, total: 10, difficultyMode: "hard" }));
  scores.push({ score: 5, timestamp: "2026-01-01T00:00:00Z", correct: 1, total: 10, difficultyMode: "Super Hard" });
  const trimmed = trimHighScores(scores);
  assert.deepEqual(trimmed.filter((s) => s.difficultyMode === "hard").map((s) => s.score), [70, 60, 50, 40, 30]);
  assert.equal(trimmed.filter((s) => s.difficultyMode === "superHard").length, 1);
});

test("daily streak continues from yesterday and resets after a gap", () => {
  let stats = sanitizeDailyStats(null);
  stats = applyDailyCompletion(stats, "2026-03-01", true);
  stats = applyDailyCompletion(stats, "2026-03-02", true);
  assert.equal(stats.currentDailyStreak, 2);
  assert.equal(stats.totalDailyCompletions, 2);
  stats = applyDailyCompletion(stats, "2026-03-05", true);
  assert.equal(stats.currentDailyStreak, 1);
  assert.equal(stats.bestDailyStreak, 2);
  assert.deepEqual(applyDailyCompletion(stats, "2026-03-06", false), stats); // not a first completion
});
