import assert from "node:assert/strict";
import { test } from "node:test";
import { calculatePoints, getLevel, getLevelProgress, getNextStreakBonusLabel, getStreakBonus } from "../../src/lib/scoring.js";

test("streak bonus starts at 3 and caps at 10", () => {
  assert.equal(getStreakBonus(0), 0);
  assert.equal(getStreakBonus(2), 0);
  assert.equal(getStreakBonus(3), 25);
  assert.equal(getStreakBonus(10), 260);
  assert.equal(getStreakBonus(25), 260);
});

test("next streak bonus label", () => {
  assert.equal(getNextStreakBonusLabel(0), "Next bonus at 3");
  assert.equal(getNextStreakBonusLabel(2), "Next: +25 at 3");
  assert.equal(getNextStreakBonusLabel(10), "Cap reached at 10");
});

test("speed bonus is capped at the base points", () => {
  const instant = calculatePoints({ mode: "medium", secondsLeft: 25 });
  assert.deepEqual(instant, { base: 100, dailyBonus: 0, speedBonus: 100, streakBonus: 0, total: 200 });
  const late = calculatePoints({ mode: "medium", secondsLeft: 0 });
  assert.equal(late.speedBonus, 3); // 0.75s grace
});

test("daily bonus and streak bonus are added", () => {
  const points = calculatePoints({ mode: "easy", secondsLeft: 0, dailyBonusActive: true, streak: 5 });
  assert.equal(points.dailyBonus, 3); // 5% of 50, rounded
  assert.equal(points.streakBonus, 80);
});

test("levels follow the thresholds", () => {
  assert.equal(getLevel(0), 1);
  assert.equal(getLevel(24), 1);
  assert.equal(getLevel(25), 2);
  assert.equal(getLevel(1640), 12);
  assert.equal(getLevel(99999), 12);
});

test("level progress", () => {
  assert.deepEqual(getLevelProgress(35), { level: 2, percent: (10 / 35) * 100, remaining: 25, isMaxLevel: false });
  assert.equal(getLevelProgress(2000).isMaxLevel, true);
});
