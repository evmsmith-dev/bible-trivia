import { test, expect } from "@playwright/test";
import * as h from "./helpers.js";

test.describe("round flow", () => {
  test.beforeEach(async ({ page }) => {
    await h.openApp(page);
  });

  test("tapping the countdown starts the round straight away", async ({ page }) => {
    await page.locator("#start-btn").click();
    await expect(page.locator("#countdown-overlay")).toBeVisible();
    await expect(page.locator("#countdown-skip-hint")).toBeVisible();
    await page.locator("#countdown-overlay").click();
    await expect(page.locator("#countdown-overlay")).toBeHidden();
    await expect(page.locator("#options .option").first()).toBeVisible();
    await expect(page.locator("#progress")).toContainText("Question 1 of 10");
  });

  test("Keep Playing carries on with the timer where it stopped", async ({ page }) => {
    await h.startNormalGame(page);
    await page.clock.runFor(3000);
    const before = Number(await page.locator("#timer-display").textContent());

    await page.locator("#quit-btn").click();
    await expect(page.locator("#quit-overlay")).toBeVisible();
    await page.clock.runFor(60_000); // the clock is stopped while deciding
    await page.locator("#quit-keep-btn").click();
    await expect(page.locator("#quit-overlay")).toBeHidden();
    expect(Number(await page.locator("#timer-display").textContent())).toBe(before);

    await h.answer(page, { correct: true });
    await expect(page.locator("#progress")).toContainText("Question 2 of 10");
  });

  test("ending a round between questions resumes on the next question if kept", async ({ page }) => {
    await h.startNormalGame(page);
    await page.locator('#options .option[data-correct="true"]').click();
    await page.locator("#quit-btn").click();
    await page.keyboard.press("Escape"); // same as Keep Playing
    await expect(page.locator("#progress")).toContainText("Question 2 of 10");
  });

  test("End Round goes Home without saving the round", async ({ page }) => {
    await h.startNormalGame(page);
    await h.answer(page, { correct: true });
    await page.locator("#quit-btn").click();
    await page.locator("#quit-confirm-btn").click();
    await expect(page.locator("#start-btn")).toBeVisible();
    await expect(page.locator("#question-container")).toBeHidden();

    await h.openScores(page);
    await expect(page.locator("#scores-recent-title").locator("..")).toContainText("No games yet");
  });

  test("keys A–D and 1–4 pick the matching answer", async ({ page }) => {
    await h.startNormalGame(page);
    const second = await page.locator("#options .option").nth(1).textContent();
    await page.keyboard.press("b");
    await expect(page.locator("#options .option").nth(1)).toHaveClass(/correct|incorrect/);
    expect(second.startsWith("B)")).toBe(true);
    await page.clock.runFor(3000);

    await page.keyboard.press("3");
    await expect(page.locator("#options .option").nth(2)).toHaveClass(/correct|incorrect/);
  });
});

test("the retired review preference is removed from storage", async ({ page }) => {
  await h.skipFirstRunHelp(page);
  await page.addInitScript(() => localStorage.setItem("bibleTriviaPlayer_primary_roundReviewPreference", "alwaysSkip"));
  await page.clock.install();
  await page.goto("index.html");
  await h.waitForReady(page);
  await expect.poll(() => page.evaluate(() => localStorage.getItem("bibleTriviaPlayer_primary_roundReviewPreference"))).toBeNull();
  // A round still ends on the summary, with Review Answers available.
  await h.startNormalGame(page);
  await h.playRound(page, { correctAnswers: 5 });
  await expect(page.locator("#summary-review-btn")).toBeVisible();
});

test("the summary's mode button changes the difficulty for the next round", async ({ page }) => {
  await h.openApp(page);
  await h.startNormalGame(page);
  await h.playRound(page, { correctAnswers: 5 });
  await h.expectSummary(page);
  await page.clock.runFor(16000); // let any celebration finish

  const chip = page.locator("#summary-mode-chip");
  await expect(chip).toHaveText("🟠 Medium ▾");
  await h.chooseDifficulty(page, "hard", chip);
  await expect(chip).toHaveText("🔴 Hard ▾");
  await expect(page.locator("#mode-chip")).toHaveText("🔴 Hard ▾"); // Home matches

  await page.locator("#restart-same").click();
  await h.finishCountdown(page);
  await expect(page.locator("#timer-display")).toHaveText("21"); // Hard's timer
});
