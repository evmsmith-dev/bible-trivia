import { test, expect } from "@playwright/test";
import * as h from "./helpers.js";

test("Scores shows the overview, top scores per mode, recent games and categories", async ({ page }) => {
  await h.openApp(page);

  await h.openScores(page);
  await expect(page.locator(".stat-card").first()).toContainText("Games played");
  await expect(page.locator(".stat-card").first()).toContainText("0");
  await expect(page.locator(".scores-empty").first()).toContainText("No Medium scores yet");
  await page.locator("#scores-page .page-back").click();

  // Two Medium rounds, then one Easy round.
  for (const [index, correct] of [7, 9].entries()) {
    if (index) await page.locator("#restart-same").click();
    else await page.locator("#start-btn").click();
    await h.finishCountdown(page);
    await h.playRound(page, { correctAnswers: correct });
    await h.expectSummary(page);
    await page.clock.runFor(16000); // let celebrations finish
  }
  await h.goHomeFromSummary(page);
  await h.chooseDifficulty(page, "easy");
  await h.startNormalGame(page);
  await h.playRound(page, { correctAnswers: 10 });
  await h.expectSummary(page);
  await page.clock.runFor(16000);
  await h.goHomeFromSummary(page);

  await h.openScores(page);
  const cards = page.locator(".stat-card");
  await expect(cards.nth(0)).toContainText("3"); // games played
  await expect(cards.nth(1)).toContainText("87%"); // 26 of 30 right
  await expect(cards.nth(1)).toContainText("26 of 30 right");

  // Opens on the current mode (Easy): one score. Switching to Medium shows two, best first.
  await expect(page.locator('.mode-switch-btn[data-mode="easy"]')).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator(".score-row")).toHaveCount(1);
  await expect(page.locator(".score-row").first()).toContainText("10/10");
  await page.locator('.mode-switch-btn[data-mode="medium"]').click();
  await expect(page.locator('.mode-switch-btn[data-mode="medium"]')).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator(".score-row")).toHaveCount(2);
  await expect(page.locator(".score-row").first()).toContainText("9/10");
  await expect(page.locator(".score-row").first()).toContainText("🥇");

  // Recent games: newest first.
  const games = page.locator("#scores-recent-title").locator("..").locator(".game-row");
  await expect(games).toHaveCount(3);
  await expect(games.first()).toContainText("Easy");
  await expect(games.first()).toContainText("10/10");

  // Right answers by category add up to the total.
  const counts = await page.locator(".category-count").allTextContents();
  expect(counts.map(Number).reduce((a, b) => a + b, 0)).toBe(26);
});
