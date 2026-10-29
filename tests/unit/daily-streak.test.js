import assert from "node:assert/strict";
import { test } from "node:test";
import { currentDailyStreak } from "../../src/features/daily.js";
import { state } from "../../src/state.js";

test("the Home card's streak only counts if the last completed day was today or yesterday", () => {
  Object.assign(state.dailyStats, { currentDailyStreak: 5, lastCompletedDateKey: "2026-10-29" });
  assert.equal(currentDailyStreak("2026-10-29"), 5); // completed today
  assert.equal(currentDailyStreak("2026-10-30"), 5); // completed yesterday: still alive today
  assert.equal(currentDailyStreak("2026-10-31"), 0); // missed a day
  Object.assign(state.dailyStats, { currentDailyStreak: 3, lastCompletedDateKey: "2026-12-31" });
  assert.equal(currentDailyStreak("2027-01-01"), 3); // across a new year
  Object.assign(state.dailyStats, { currentDailyStreak: 0, lastCompletedDateKey: null });
  assert.equal(currentDailyStreak("2026-10-29"), 0);
});
