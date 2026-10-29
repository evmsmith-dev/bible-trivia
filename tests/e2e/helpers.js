// Shared helpers for the end-to-end tests. Tests drive the real UI and use Playwright's
// fake clock so countdowns, timers and auto-advance delays run instantly.
import { expect } from "@playwright/test";

export const PROFILE_KEY = "bibleTriviaPlayer_primary_profile";
export const DB_NAME = "BibleTriviaDB_player_primary";

export async function openApp(page, { clock = true } = {}) {
  if (clock) {
    await page.clock.install();
  }
  await page.goto("index.html");
  await waitForReady(page);
}

/** The app adds `is-ready` to <body> once questions and saved data have loaded. */
export async function waitForReady(page) {
  await expect(page.locator("body.is-ready")).toBeAttached();
  await expect(page.locator("#start-btn")).toBeVisible();
}

export async function finishCountdown(page) {
  await page.clock.runFor(3200);
  await expect(page.locator("#options .option").first()).toBeVisible();
}

export async function startNormalGame(page) {
  await page.locator("#start-btn").click();
  await finishCountdown(page);
}

export async function currentQuestionNumber(page) {
  const text = await page.locator("#progress").textContent();
  return Number(/Question (\d+)/.exec(text)[1]);
}

/** Answer the visible question correctly or incorrectly, then let the game advance. */
export async function answer(page, { correct }) {
  const option = page.locator(`#options .option[data-correct="${correct ? "true" : "false"}"]`).first();
  await option.click();
  await page.clock.runFor(3000);
}

export async function playRound(page, { correctAnswers = 10 } = {}) {
  for (let i = 0; i < 10; i++) {
    await answer(page, { correct: i < correctAnswers });
  }
}

/** A finished round goes straight to the summary (Review Answers is a button there). */
export async function expectSummary(page) {
  await expect(page.locator("#summary")).toBeVisible();
}

export async function goHomeFromSummary(page) {
  await page.locator("#restart-change").click();
  await expect(page.locator("#start-btn")).toBeVisible();
}

/** The Scores page (🏆 on Home). */
export async function openScores(page) {
  await page.locator("#home-scores-btn").click();
  await expect(page.locator("#scores-page")).toBeVisible();
}

/** Settings (⚙️ on Home). */
export async function openSettings(page) {
  await page.locator("#home-settings-btn").click();
  await expect(page.locator("#settings-overlay")).toBeVisible();
}

/** The Edit player sheet (tap the avatar on Home). */
export async function openPlayerSheet(page) {
  await page.locator("#player-entry-btn").click();
  await expect(page.locator("#player-sheet")).toBeVisible();
}

export async function readProfile(page) {
  return page.evaluate((key) => JSON.parse(localStorage.getItem(key) || "null"), PROFILE_KEY);
}

