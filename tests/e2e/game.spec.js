import { test, expect } from "@playwright/test";
import * as h from "./helpers.js";

test.describe("normal game", () => {
  test.beforeEach(async ({ page }) => {
    await h.openApp(page);
  });

  test("a perfect round reaches the summary with the score, review and saved history", async ({ page }) => {
    await h.startNormalGame(page);
    await expect(page.locator("#progress")).toContainText("Question 1 of 10");
    await h.playRound(page, { correctAnswers: 10 });

    // No "review this round?" question: the round goes straight to the summary.
    const summary = page.locator("#summary");
    await expect(summary).toBeVisible();
    await expect(page.locator(".summary-headline")).toHaveText(/^Perfect round, .+!$/);
    await expect(page.locator(".summary-score")).toHaveAttribute("aria-label", "10 of 10 right, 100%");
    await expect(page.locator(".summary-score-big")).toHaveText("10");
    await expect(page.locator(".summary-dots")).toHaveText("✅".repeat(10));
    const score = Number((await page.locator("#summary-points").textContent()).replace(/,/g, ""));
    expect(score).toBeGreaterThan(1000);

    // First game with points is a new high score.
    await expect(page.locator("#highscore-celebration")).toBeVisible();
    await page.clock.runFor(5000);

    // Review Answers opens the review from the summary, and Back returns to it.
    await page.locator("#summary-review-btn").click();
    await expect(page.locator("#round-review .review-card")).toHaveCount(10);
    await expect(page.locator("#round-review .review-result-badge.correct")).toHaveCount(10);
    await page.locator("#review-continue").click();
    await expect(summary).toBeVisible();
    await expect(page.locator("#highscore-celebration")).toBeHidden(); // celebrations don't replay

    // History and top score survive a reload.
    await page.reload();
    await h.waitForReady(page);
    await h.openScores(page);
    await expect(page.locator(".score-list")).toContainText(score.toLocaleString("en-US"));
    await expect(page.locator(".game-list").first()).toContainText("10/10");
  });

  test("a wrong answer highlights exactly one correct option and breaks the streak", async ({ page }) => {
    await h.startNormalGame(page);
    await h.answer(page, { correct: true });
    await expect(page.locator("#streak-hud-count")).toHaveText("Streak: 1");

    await h.waitForAnswers(page);
    await page.locator('#options .option[data-correct="false"]').first().click();
    await expect(page.locator("#options .option.correct")).toHaveCount(1);
    await expect(page.locator('#options .option.correct')).toHaveAttribute("data-correct", "true");
    await expect(page.locator("#options .option.incorrect")).toHaveCount(1);
    await expect(page.locator("#streak-hud-count")).toHaveText("Streak: 0");
  });

  test("progress dots show a check for right answers and a cross for wrong ones", async ({ page }) => {
    await h.startNormalGame(page);
    const dots = page.locator("#progress-dots span");
    await expect(dots.nth(0)).toHaveText("🔵");

    await h.waitForAnswers(page);
    await page.locator('#options .option[data-correct="true"]').click();
    await expect(dots.nth(0)).toHaveText("✅"); // shown right away, before moving on
    await page.clock.runFor(3000);

    await h.waitForAnswers(page);
    await page.locator('#options .option[data-correct="false"]').first().click();
    await expect(dots.nth(1)).toHaveText("❌");
    await page.clock.runFor(3000);

    await page.clock.runFor(26000); // let question 3 time out
    await expect(dots.nth(2)).toHaveText("❌");
    await page.clock.runFor(3000);
    await expect(dots.nth(3)).toHaveText("🔵");
    await expect(dots.nth(4)).toHaveText("⚪");
  });

  test("running out of time counts as incorrect and advances", async ({ page }) => {
    await h.startNormalGame(page);
    await page.clock.runFor(26000); // medium mode: 25 seconds
    await expect(page.locator("#feedback")).toHaveClass(/timeout/);
    await expect(page.locator("#feedback")).toContainText("Time's up!");
    await expect(page.locator("#feedback")).toContainText("Answer:");
    await expect(page.locator("#options .option.correct")).toHaveCount(1);
    await page.clock.runFor(3000);
    await expect(page.locator("#progress")).toContainText("Question 2 of 10");
  });

  test("the game keeps working when the confetti library cannot load", async ({ page }) => {
    await page.route(/confetti/, (route) => route.abort());
    await page.reload();
    await h.waitForReady(page);
    await h.startNormalGame(page);
    await h.answer(page, { correct: true });
    await expect(page.locator("#progress")).toContainText("Question 2 of 10");
    await expect(page.locator("#progress")).toContainText("Correct: 1");
    await expect(page.locator("#score-display")).not.toHaveText("⭐ 0");
    await expect(page.locator("#daily-tag")).toBeHidden();
  });

  test("the points pop-up shows the breakdown and doesn't cover the answers", async ({ page }) => {
    await h.startNormalGame(page);
    await h.waitForAnswers(page);
    await page.locator('#options .option[data-correct="true"]').click();
    const feedback = page.locator("#feedback");
    await expect(feedback).toContainText(/\+\d+ pts/);
    await expect(feedback).toContainText("+100 base");
    await expect(feedback).toContainText("speed");
    const popup = await feedback.boundingBox();
    const question = await page.locator("#question").boundingBox();
    expect(popup.y + popup.height).toBeLessThanOrEqual(question.y + 1);
  });

  test("new rounds avoid questions seen recently", async ({ page }) => {
    const seen = new Set();
    let repeats = 0;
    for (let round = 0; round < 3; round++) {
      if (round === 0) await h.startNormalGame(page);
      for (let i = 0; i < 10; i++) {
        const text = await page.locator("#question").textContent();
        if (seen.has(text)) repeats++;
        seen.add(text);
        await h.answer(page, { correct: false });
      }
      await h.expectSummary(page);
      await page.locator("#restart-same").click();
      await h.finishCountdown(page);
    }
    expect(repeats).toBe(0);
    // Remembered across reloads.
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem("bibleTriviaPlayer_primary_recentQuestionIds")).length)).toBe(31);
  });

  test("number keys 1-4 answer the question", async ({ page }) => {
    await h.startNormalGame(page);
    await h.waitForAnswers(page);
    await page.keyboard.press("1");
    await expect(page.locator("#options .option.grayed, #options .option.correct").first()).toBeVisible();
    await page.clock.runFor(3000);
    await expect(page.locator("#progress")).toContainText("Question 2 of 10");
  });

  test("Play again keeps the streak bonus; Home resets it", async ({ page }) => {
    await h.startNormalGame(page);
    await h.playRound(page, { correctAnswers: 10 });
    await h.expectSummary(page);
    await page.clock.runFor(5000);
    await expect(page.locator(".streak-carryover-banner")).toBeVisible();

    await page.locator("#restart-same").click();
    await h.finishCountdown(page);
    await expect(page.locator("#streak-hud-count")).toHaveText("Streak: 10");

    await h.playRound(page, { correctAnswers: 0 });
    await h.expectSummary(page);
    await page.clock.runFor(5000);
    await h.goHomeFromSummary(page);
    await h.startNormalGame(page);
    await expect(page.locator("#streak-hud-count")).toHaveText("Streak: 0");
  });
});
