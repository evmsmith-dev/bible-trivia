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

    await h.chooseReview(page, "review");
    await expect(page.locator("#round-review .review-card")).toHaveCount(10);
    await expect(page.locator("#round-review .review-result-badge.correct")).toHaveCount(10);
    await page.locator("#review-continue").click();

    const summary = page.locator("#summary");
    await expect(summary).toBeVisible();
    await expect(summary).toContainText("You got 10 right out of 10 (100%)");
    await expect(summary).toContainText("Matthew 25:21"); // top encouragement tier
    const score = Number(/Total Score: (\d+)/.exec(await summary.textContent())[1]);
    expect(score).toBeGreaterThan(1000);

    // First game with points is a new high score.
    await expect(page.locator("#highscore-celebration")).toBeVisible();
    await page.clock.runFor(5000);

    // History and top score survive a reload.
    await page.reload();
    await h.waitForReady(page);
    await page.locator("#player-entry-btn").click();
    await page.locator("#player-open-leaderboard-btn").click();
    await expect(page.locator("#welcome-leaderboard-content")).toContainText(String(score));
    await page.locator('.leaderboard-tab[data-panel="leaderboard-history"]').click();
    await expect(page.locator("#welcome-history-content")).toContainText(/10\s*\/\s*10/);
  });

  test("a wrong answer highlights exactly one correct option and breaks the streak", async ({ page }) => {
    await h.startNormalGame(page);
    await h.answer(page, { correct: true });
    await expect(page.locator("#streak-hud-count")).toHaveText("Streak: 1");

    await page.locator('#options .option[data-correct="false"]').first().click();
    await expect(page.locator("#options .option.correct")).toHaveCount(1);
    await expect(page.locator('#options .option.correct')).toHaveAttribute("data-correct", "true");
    await expect(page.locator("#options .option.incorrect")).toHaveCount(1);
    await expect(page.locator("#streak-hud-count")).toHaveText("Streak: 0");
  });

  test("running out of time counts as incorrect and advances", async ({ page }) => {
    await h.startNormalGame(page);
    await page.clock.runFor(26000); // medium mode: 25 seconds
    await expect(page.locator("#feedback")).toHaveClass(/timeout/);
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
  });

  test("number keys 1-4 answer the question", async ({ page }) => {
    await h.startNormalGame(page);
    await page.keyboard.press("1");
    await expect(page.locator("#options .option.grayed, #options .option.correct").first()).toBeVisible();
    await page.clock.runFor(3000);
    await expect(page.locator("#progress")).toContainText("Question 2 of 10");
  });

  test("Play again keeps the streak bonus; Home resets it", async ({ page }) => {
    await h.startNormalGame(page);
    await h.playRound(page, { correctAnswers: 10 });
    await h.chooseReview(page, "skip");
    await page.clock.runFor(5000);
    await expect(page.locator(".streak-carryover-banner")).toBeVisible();

    await page.locator("#restart-same").click();
    await h.finishCountdown(page);
    await expect(page.locator("#streak-hud-count")).toHaveText("Streak: 10");

    await h.playRound(page, { correctAnswers: 0 });
    await h.chooseReview(page, "skip");
    await page.clock.runFor(5000);
    await h.goHomeFromSummary(page);
    await h.startNormalGame(page);
    await expect(page.locator("#streak-hud-count")).toHaveText("Streak: 0");
  });
});
