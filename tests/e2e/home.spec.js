import { test, expect } from "@playwright/test";
import * as h from "./helpers.js";

test("Home greets the player and shows their level", async ({ page }) => {
  await h.openApp(page);
  await expect(page.locator(".home-greeting")).toHaveText("Hi, Player!");
  await expect(page.locator("#player-entry-level")).toHaveText("Level 1");
  await expect(page.locator("#home-level-to-go")).toHaveText("25 to go");

  await h.startNormalGame(page);
  await h.playRound(page, { correctAnswers: 10 });
  await h.expectSummary(page);
  await page.clock.runFor(16000);
  await h.goHomeFromSummary(page);
  await expect(page.locator("#home-level-to-go")).toHaveText("15 to go");
  const fill = await page.locator("#home-level-fill").evaluate((el) => parseFloat(el.style.width));
  expect(fill).toBeCloseTo(40, 0);

  await h.addPlayer(page, "Mom");
  await expect(page.locator(".home-greeting")).toHaveText("Hi, Mom!");
  await expect(page.locator("#home-level-to-go")).toHaveText("25 to go");
});

test("the Daily Challenge card shows today's status and the streak", async ({ page }) => {
  await h.openApp(page);
  const card = page.locator("#daily-challenge-link");
  await expect(card).toContainText("Today's Daily Challenge");
  await expect(page.locator("#daily-card-status")).toHaveText("Not started · Start a streak today");
  await expect(page.locator("#daily-challenge-new-badge")).toBeVisible();

  await card.click(); // opening it acknowledges the day
  await expect(page.locator("#daily-challenge-overlay")).toBeVisible();
  await page.locator("#daily-start-btn").click();
  await h.finishCountdown(page);
  await h.playRound(page, { correctAnswers: 10 });
  await h.expectSummary(page);
  await page.clock.runFor(16000);
  await h.goHomeFromSummary(page);

  await expect(page.locator("#daily-card-status")).toHaveText("✅ Completed · 🔥 1-day streak");
  await expect(card).toHaveClass(/is-complete/);
  await expect(page.locator("#daily-challenge-new-badge")).toBeHidden();
});
