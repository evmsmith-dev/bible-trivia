// Shared helpers for the end-to-end tests. Tests drive the real UI and use Playwright's
// fake clock so countdowns, timers and auto-advance delays run instantly.
const { expect } = require("@playwright/test");

const PROFILE_KEY = "bibleTriviaPlayer_primary_profile";
const DB_NAME = "BibleTriviaDB_player_primary";

async function openApp(page, { clock = true } = {}) {
  if (clock) {
    await page.clock.install();
  }
  await page.goto("index.html");
  await expect(page.locator("#start-btn")).toBeVisible();
  // Wait for saved data to finish loading (the welcome player card is rendered after load).
  await expect(page.locator("#player-entry-level")).toHaveText(/Level \d+/);
}

async function finishCountdown(page) {
  await page.clock.runFor(3200);
  await expect(page.locator("#options .option").first()).toBeVisible();
}

async function startNormalGame(page) {
  await page.locator("#start-btn").click();
  await finishCountdown(page);
}

async function currentQuestionNumber(page) {
  const text = await page.locator("#progress").textContent();
  return Number(/Question (\d+)/.exec(text)[1]);
}

/** Answer the visible question correctly or incorrectly, then let the game advance. */
async function answer(page, { correct }) {
  const option = page.locator(`#options .option[data-correct="${correct ? "true" : "false"}"]`).first();
  await option.click();
  await page.clock.runFor(3000);
}

async function playRound(page, { correctAnswers = 10 } = {}) {
  for (let i = 0; i < 10; i++) {
    await answer(page, { correct: i < correctAnswers });
  }
}

async function chooseReview(page, choice) {
  const overlay = page.locator("#review-choice-overlay");
  await expect(overlay).toBeVisible();
  await page.locator(choice === "review" ? "#overlay-review-btn" : "#overlay-skip-btn").click();
}

async function goHomeFromSummary(page) {
  await page.locator("#restart-change").click();
  await expect(page.locator("#start-btn")).toBeVisible();
}

async function readProfile(page) {
  return page.evaluate((key) => JSON.parse(localStorage.getItem(key) || "null"), PROFILE_KEY);
}

module.exports = {
  PROFILE_KEY,
  DB_NAME,
  openApp,
  finishCountdown,
  startNormalGame,
  currentQuestionNumber,
  answer,
  playRound,
  chooseReview,
  goHomeFromSummary,
  readProfile,
};
