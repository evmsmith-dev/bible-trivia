import { test, expect } from "@playwright/test";
import * as h from "./helpers.js";

const tile = (page, name) => page.locator(".badge-tile").filter({ has: page.locator(".badge-name", { hasText: new RegExp(`^${name}$`) }) });

async function finishRound(page, correctAnswers) {
  await h.playRound(page, { correctAnswers });
  await h.expectSummary(page);
  await page.clock.runFor(16000); // let celebrations finish
}

test("a round that earns badges says so, and the chip opens them on Scores", async ({ page }) => {
  await h.openApp(page);
  await h.startNormalGame(page);
  await finishRound(page, 10);
  const chip = page.locator("#summary-badges-btn");
  await expect(chip).toContainText("new badges");
  await expect(chip).toHaveAccessibleName(/First Steps.*Perfect Round/);

  await chip.click();
  await expect(page.locator("#scores-page")).toBeVisible();
  await expect(page.locator("#scores-badges")).toBeInViewport();
  const perfect = tile(page, "Perfect Round");
  await expect(perfect).toHaveClass(/is-earned/);
  await expect(perfect).toContainText("Earned");
  await expect(tile(page, "Super Scholar")).not.toHaveClass(/is-earned/);
  await expect(tile(page, "Faithful Reader")).toContainText("1 / 10");

  // The next round earns nothing new: no chip.
  await page.locator("#scores-page .page-back").click();
  await page.locator("#restart-same").click();
  await h.finishCountdown(page);
  await finishRound(page, 3);
  await expect(page.locator("#summary-badges-btn")).toHaveCount(0);
});

test("existing players are credited quietly, and badges count on Everyone", async ({ page }) => {
  // 200 right answers (Level 5) from before badges existed.
  await page.addInitScript(() => {
    if (!localStorage.getItem("bibleTriviaPlayer_primary_profile")) {
      localStorage.setItem("bibleTriviaPlayer_primary_profile", JSON.stringify({ id: "primary", name: "Dad", avatarId: "emoji-smile", nonDailyCorrectAnswers: 200, levelCountVersion: 2 }));
    }
  });
  await h.openApp(page);
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("bibleTriviaPlayer_primary_badges")));
  expect(saved.level).toEqual({ tier: 1, earnedAt: null });

  // The first round only announces what it earned (First Steps), not the level badge.
  await h.startNormalGame(page);
  await finishRound(page, 4);
  await expect(page.locator("#summary-badges-btn")).toHaveAccessibleName(/^New badge: First Steps/);
  await h.goHomeFromSummary(page);

  await h.addPlayer(page, "Mom");
  await h.openScores(page);
  await page.locator('.scores-tab[data-view="everyone"]').click();
  await expect(page.locator(".everyone-row", { hasText: "Dad" })).toContainText("🏅 2");
  await expect(page.locator(".everyone-row", { hasText: "Mom" })).toContainText("🏅 0");
});

test("answers can't be tapped until the question has been on screen a moment", async ({ page }) => {
  await h.openApp(page);
  await h.startNormalGame(page);
  const options = page.locator("#options .option");
  await expect(options.first()).toBeDisabled();
  await expect(page.locator("#options")).toHaveClass(/is-reading/);
  await page.keyboard.press("1"); // ignored while locked
  await expect(page.locator("#options .option.correct")).toHaveCount(0);
  await expect(page.locator("#timer-display")).toHaveText("25"); // the timer waits too

  await page.clock.runFor(1000);
  await expect(options.first()).toBeEnabled();
  await expect(page.locator("#options")).not.toHaveClass(/is-reading/);
  await page.clock.runFor(2000);
  await expect(page.locator("#timer-display")).toHaveText("23");
});

test("ending a round while the answers are still locked, then keeping playing, unlocks them", async ({ page }) => {
  await h.openApp(page);
  await h.startNormalGame(page);
  await page.locator("#quit-btn").click();
  await page.clock.runFor(5000); // nothing unlocks behind the confirmation
  await expect(page.locator("#options .option").first()).toBeDisabled();
  await page.locator("#quit-keep-btn").click();
  await expect(page.locator("#options .option").first()).toBeEnabled();
  await h.answer(page, { correct: true });
  await expect(page.locator("#progress")).toContainText("Question 2 of 10");
});
