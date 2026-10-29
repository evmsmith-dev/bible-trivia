import { test, expect } from "@playwright/test";
import * as h from "./helpers.js";

test.beforeEach(async ({ page }) => {
  await h.openApp(page);
});

test("Welcome links are keyboard-reachable buttons", async ({ page }) => {
  await page.locator("#daily-challenge-link").focus();
  await page.keyboard.press("Enter");
  await expect(page.locator("#daily-challenge-overlay")).toBeVisible();
});

test("Escape closes the top overlay and returns focus", async ({ page }) => {
  await h.openSettings(page);
  await page.keyboard.press("Escape");
  await expect(page.locator("#settings-overlay")).toBeHidden();
  await expect(page.locator("#home-settings-btn")).toBeFocused();

  await h.openScores(page);
  await expect(page.locator("#scores-page .page-back")).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(page.locator("#scores-page")).toBeHidden();
  await expect(page.locator("#home-scores-btn")).toBeFocused();
});

test("the phone's Back gesture closes pages and sheets instead of leaving the app", async ({ page }) => {
  await h.openScores(page);
  await page.goBack();
  await expect(page.locator("#scores-page")).toBeHidden();
  await expect(page.locator("#start-btn")).toBeVisible();

  // A sheet on top of a page: Back closes the sheet, then the page.
  await h.openPlayerSheet(page);
  await page.goBack();
  await expect(page.locator("#player-sheet")).toBeHidden();
  await expect(page.locator("#players-page")).toBeVisible();
  await page.goBack();
  await expect(page.locator("#players-page")).toBeHidden();

  // After closing in the app, the next page reuses the same history entry.
  await h.openWhosPlaying(page);
  await page.locator("#players-page .page-back").click();
  await h.openSettings(page);
  await page.goBack();
  await expect(page.locator("#settings-overlay")).toBeHidden();
  await expect(page.locator("#start-btn")).toBeVisible();
});

test("Settings text comes from the mode config", async ({ page }) => {
  await h.openSettings(page);
  await expect(page.locator(".difficulty-btn")).toHaveCount(4);
  await page.locator('.difficulty-btn[data-mode="superHard"]').click();
  await expect(page.locator("#mode-description")).toContainText("250 pts • 18 sec");
  await expect(page.locator('.difficulty-btn[data-mode="superHard"]')).toHaveAttribute("aria-pressed", "true");
});

test("the mode button and How to Play each sit on their own line below Start", async ({ page }) => {
  const start = await page.locator("#start-btn").boundingBox();
  const mode = await page.locator("#mode-chip").boundingBox();
  const howTo = await page.locator("#how-to-play-link").boundingBox();
  expect(mode.y).toBeGreaterThanOrEqual(start.y + start.height - 6);
  expect(howTo.y).toBeGreaterThanOrEqual(mode.y + mode.height);
  // Centered under Start (within a few pixels).
  for (const box of [mode, howTo]) {
    expect(Math.abs((box.x + box.width / 2) - (start.x + start.width / 2))).toBeLessThan(4);
  }
});

test.describe("phone layout", () => {
  for (const [name, width, height] of [["iPhone SE", 375, 667], ["iPhone in Safari", 390, 664], ["tall phone", 412, 915]]) {
    test(`home and game screens fit a ${name} screen without scrolling`, async ({ page }) => {
      await page.setViewportSize({ width, height });
      await h.openApp(page);
      const overflow = () => page.evaluate(() => document.documentElement.scrollHeight - window.innerHeight);
      expect(await overflow()).toBeLessThanOrEqual(0);

      await h.startNormalGame(page);
      expect(await overflow()).toBeLessThanOrEqual(0);
      // The answer buttons sit inside the screen and are comfortably tappable.
      const last = await page.locator("#options .option").last().boundingBox();
      expect(last.y + last.height).toBeLessThanOrEqual(height);
      expect(last.height).toBeGreaterThanOrEqual(48);
    });
  }
});
