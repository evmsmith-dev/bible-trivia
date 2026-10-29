// Shared helpers for the end-to-end tests. Tests drive the real UI and use Playwright's
// fake clock so countdowns, timers and auto-advance delays run instantly.
import { expect } from "@playwright/test";

export const PROFILE_KEY = "bibleTriviaPlayer_primary_profile";
export const DB_NAME = "BibleTriviaDB_player_primary";

/** Most tests start on a fresh device, where How to Play would open by itself; mark it seen. */
export async function skipFirstRunHelp(page) {
  await page.addInitScript(() => {
    try {
      localStorage.setItem("bibleTriviaPlayer_primary_howToPlaySeen", "1");
    } catch {
      // storage blocked: nothing to skip
    }
  });
}

export async function openApp(page, { clock = true, firstRunHelp = false } = {}) {
  if (!firstRunHelp) await skipFirstRunHelp(page);
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

/** Chooses a difficulty with a "🟠 Medium ▾" button (Home's, unless another is given). */
export async function chooseDifficulty(page, mode, chip = page.locator("#mode-chip")) {
  await chip.click();
  await expect(page.locator("#difficulty-sheet")).toBeVisible();
  await page.locator(`.difficulty-option[data-mode="${mode}"]`).click();
  await expect(page.locator("#difficulty-sheet")).toBeHidden(); // choosing closes the picker
}

/** Settings (⚙️ on Home). */
export async function openSettings(page) {
  await page.locator("#home-settings-btn").click();
  await expect(page.locator("#settings-overlay")).toBeVisible();
}

/** "Who's playing?" (tap the avatar on Home). */
export async function openWhosPlaying(page) {
  await page.locator("#player-entry-btn").click();
  await expect(page.locator("#players-page")).toBeVisible();
}

/** The Edit player sheet for the current player (avatar on Home, then ✏️ on their card). */
export async function openPlayerSheet(page) {
  await openWhosPlaying(page);
  await page.locator(".player-tile.is-active .player-edit").click();
  await expect(page.locator("#player-sheet")).toBeVisible();
}

/** Closes any open pages, sheets and popups (Escape closes the top one each time). */
export async function backToHome(page) {
  for (let i = 0; i < 4 && await page.locator("#players-page, #player-sheet, #scores-page, #settings-overlay").filter({ visible: true }).count(); i++) {
    await page.keyboard.press("Escape");
  }
  await expect(page.locator("#start-btn")).toBeVisible();
}

/** Adds a player from "Who's playing?" (they become the current player). */
export async function addPlayer(page, name) {
  await openWhosPlaying(page);
  await page.locator("#player-add-btn").click();
  await page.locator("#player-name-input").fill(name);
  await page.locator("#player-save-btn").click();
  await expect(page.locator("#players-page")).toBeHidden();
  // A new player sees How to Play once.
  await expect(page.locator("#how-to-play-overlay")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.locator("#how-to-play-overlay")).toBeHidden();
  await expect(page.locator("#player-entry-name")).toHaveText(name);
}

export async function readProfile(page) {
  return page.evaluate((key) => JSON.parse(localStorage.getItem(key) || "null"), PROFILE_KEY);
}

