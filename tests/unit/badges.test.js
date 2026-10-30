import assert from "node:assert/strict";
import { test } from "node:test";
import { BADGES, badgeProgress, countEarned, sanitizeEarned, tierName, TOTAL_BADGE_LEVELS, updateEarned } from "../../src/lib/badges.js";
import { sanitizeDailyStats, sanitizePlayerStats } from "../../src/lib/records.js";

const game = (correct, difficultyMode = "medium", score = 1000) => ({ timestamp: "2026-10-29T12:00:00Z", correct, total: 10, score, percent: correct * 10, difficultyMode });
const data = (overrides = {}) => ({
  history: [],
  playerStats: sanitizePlayerStats(null),
  dailyStats: sanitizeDailyStats(null),
  dailyChallenges: {},
  profile: { nonDailyCorrectAnswers: 0, levelPoints: 0 },
  ...overrides,
});
const tierOf = (d, id, earned = {}) => badgeProgress(d, earned).find((entry) => entry.badge.id === id).tier;

test("a new player has no badges", () => {
  assert.equal(countEarned(updateEarned(data(), {}).earned), 0);
  assert.equal(TOTAL_BADGE_LEVELS, BADGES.reduce((sum, badge) => sum + badge.goals.length, 0));
});

test("rounds, perfect rounds and hard rounds", () => {
  const d = data({ history: [game(4), game(10), game(8, "hard"), game(10, "superHard", 4200)] });
  assert.equal(tierOf(d, "first-steps"), 1);
  assert.equal(tierOf(d, "perfect-round"), 1);
  assert.equal(tierOf(d, "hard-hitter"), 1);
  assert.equal(tierOf(d, "super-scholar"), 1);
  assert.equal(tierOf(d, "high-scorer"), 3); // 4,200 passes 1,500, 2,500 and 4,000
  // Only rounds with 5+ right count toward Faithful Reader, so 3 of the 4 here.
  assert.equal(badgeProgress(d).find((entry) => entry.badge.id === "faithful-reader").value, 3);
  assert.equal(tierOf(data({ history: [game(7, "medium")] }), "hard-hitter"), 0); // Medium doesn't count
});

test("Faithful Reader levels at 10, 50 and 100 rounds with 5+ right", () => {
  const rounds = (n, correct = 6) => Array.from({ length: n }, () => game(correct));
  assert.equal(tierOf(data({ history: rounds(9) }), "faithful-reader"), 0);
  assert.equal(tierOf(data({ history: rounds(10) }), "faithful-reader"), 1);
  assert.equal(tierOf(data({ history: rounds(100) }), "faithful-reader"), 3);
  assert.equal(tierOf(data({ history: rounds(100, 2) }), "faithful-reader"), 0); // random tapping doesn't count
});

test("knowledge, level and Daily Challenge badges", () => {
  const playerStats = sanitizePlayerStats({ allTimeBestStreak: 12, correctByCategory: { "Old Testament": 160, "New Testament": 49, General: 30 } });
  const dailyStats = sanitizeDailyStats({ totalDailyCompletions: 3, bestDailyStreak: 8 });
  const d = data({ playerStats, dailyStats, profile: { nonDailyCorrectAnswers: 400, levelPoints: 400 }, dailyChallenges: { "2026-10-29": { bestCorrect: 10 } } });
  assert.equal(tierOf(d, "on-fire"), 1);
  assert.equal(tierOf(d, "ot-scholar"), 2);
  assert.equal(tierOf(d, "nt-scholar"), 0);
  assert.equal(tierOf(d, "well-rounded"), 1); // 25+ in all three
  assert.equal(tierOf(d, "level"), 1); // 400 right answers is Level 7
  assert.equal(tierOf(d, "daily-starter"), 1);
  assert.equal(tierOf(d, "week-streak"), 1);
  assert.equal(tierOf(d, "daily-ace"), 1);
  assert.equal(tierOf(d, "perfect-round"), 1); // a perfect Daily Challenge counts too
});

test("earned levels are kept, and only new ones are reported", () => {
  const first = updateEarned(data({ history: [game(10)] }), {}, "2026-10-29T12:00:00Z");
  assert.deepEqual(first.newlyEarned.map(({ badge }) => badge.id).sort(), ["first-steps", "perfect-round"]);
  assert.equal(first.earned["perfect-round"].earnedAt, "2026-10-29T12:00:00Z");

  const again = updateEarned(data({ history: [game(10), game(3)] }), first.earned);
  assert.deepEqual(again.newlyEarned, []);
  // A Daily Ace stays earned after the 30-day Daily records no longer include it.
  const ace = updateEarned(data({ dailyChallenges: { "2026-01-01": { bestCorrect: 10 } } }), {}).earned;
  assert.equal(tierOf(data(), "daily-ace", ace), 1);
});

test("saved badges are cleaned and level names follow the number of levels", () => {
  assert.deepEqual(sanitizeEarned({ "perfect-round": { tier: 5, earnedAt: 3 }, nope: { tier: 1 }, "on-fire": { tier: 0 } }),
    { "perfect-round": { tier: 1, earnedAt: null } });
  const byId = Object.fromEntries(BADGES.map((badge) => [badge.id, badge]));
  assert.deepEqual([1, 2, 3].map((tier) => tierName(byId["ot-scholar"], tier)), ["Bronze", "Silver", "Gold"]);
  assert.deepEqual([1, 2].map((tier) => tierName(byId["week-streak"], tier)), ["Bronze", "Gold"]);
  assert.equal(tierName(byId["perfect-round"], 1), "");
});
