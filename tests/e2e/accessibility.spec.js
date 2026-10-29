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

test("the difficulty picker lists every mode from the config; Settings has no difficulty", async ({ page }) => {
  await page.locator("#mode-chip").click();
  const options = page.locator(".difficulty-option");
  await expect(options).toHaveCount(4);
  await expect(page.locator('.difficulty-option[data-mode="medium"]')).toHaveAttribute("aria-checked", "true");
  await expect(page.locator('.difficulty-option[data-mode="medium"]')).toBeFocused();
  await expect(page.locator('.difficulty-option[data-mode="superHard"]')).toContainText("250 pts · 18 sec");
  await page.locator('.difficulty-option[data-mode="superHard"]').click();
  await expect(page.locator("#difficulty-sheet")).toBeHidden();
  await expect(page.locator("#mode-chip")).toHaveText("⚫ Super Hard ▾");

  await h.openSettings(page);
  await expect(page.locator("#settings-overlay")).not.toContainText(/difficulty/i);
});

test("opening a player's sheet doesn't focus the name box (no phone keyboard)", async ({ page }) => {
  await h.openPlayerSheet(page);
  await expect(page.locator("#player-sheet-title")).toBeFocused();
  await expect(page.locator("#player-name-input")).not.toBeFocused();
  await page.keyboard.press("Escape");
  await page.locator("#player-add-btn").click();
  await expect(page.locator("#player-sheet-title")).toHaveText("New player");
  await expect(page.locator("#player-name-input")).not.toBeFocused();
});

test("the mode button sits under Start; Help is in one row with Scores and Settings", async ({ page }) => {
  const start = await page.locator("#start-btn").boundingBox();
  const mode = await page.locator("#mode-chip").boundingBox();
  expect(mode.y).toBeGreaterThanOrEqual(start.y + start.height - 6);
  expect(Math.abs((mode.x + mode.width / 2) - (start.x + start.width / 2))).toBeLessThan(4);

  await expect(page.locator("#how-to-play-link")).toHaveText("❓ Help");
  const boxes = await Promise.all(["#home-scores-btn", "#home-settings-btn", "#how-to-play-link"]
    .map((selector) => page.locator(selector).boundingBox()));
  for (const box of boxes) expect(Math.abs(box.y - boxes[0].y)).toBeLessThan(2); // one row

  await page.locator("#how-to-play-link").click();
  await expect(page.locator("#how-to-play-overlay")).toBeVisible();
});

test("the Scores, Settings and Help row fits on one line on the smallest phone", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 667 });
  const boxes = await Promise.all(["#home-scores-btn", "#home-settings-btn", "#how-to-play-link"]
    .map((selector) => page.locator(selector).boundingBox()));
  for (const box of boxes) expect(Math.abs(box.y - boxes[0].y)).toBeLessThan(2);
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
