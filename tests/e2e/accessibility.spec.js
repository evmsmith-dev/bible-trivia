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
  await page.locator("#player-entry-btn").click();
  await page.locator("#player-open-settings-btn").click();
  await expect(page.locator("#settings-overlay")).toBeVisible();

  await page.keyboard.press("Escape");
  await expect(page.locator("#settings-overlay")).toBeHidden();
  await expect(page.locator("#player-overlay")).toBeVisible();
  await expect(page.locator("#player-open-settings-btn")).toBeFocused();

  await page.keyboard.press("Escape");
  await expect(page.locator("#player-overlay")).toBeHidden();
  await expect(page.locator("#player-entry-btn")).toBeFocused();
});

test("Escape while editing the name cancels the edit but keeps the overlay open", async ({ page }) => {
  await page.locator("#player-entry-btn").click();
  await page.locator("#player-name-edit-btn").click();
  await page.locator("#player-name-input").fill("Changed");
  await page.keyboard.press("Escape");
  await expect(page.locator("#player-overlay")).toBeVisible();
  await expect(page.locator("#player-name-display")).toHaveText("Player");
});

test("Settings text comes from the mode config", async ({ page }) => {
  await page.locator("#player-entry-btn").click();
  await page.locator("#player-open-settings-btn").click();
  await expect(page.locator(".difficulty-btn")).toHaveCount(4);
  await page.locator('.difficulty-btn[data-mode="superHard"]').click();
  await expect(page.locator("#mode-description")).toContainText("250 pts • 18 sec");
  await expect(page.locator('.difficulty-btn[data-mode="superHard"]')).toHaveAttribute("aria-pressed", "true");
});

test("How to Play sits on its own line below the Start button", async ({ page }) => {
  const start = await page.locator("#start-btn").boundingBox();
  const howTo = await page.locator("#how-to-play-link").boundingBox();
  expect(howTo.y).toBeGreaterThanOrEqual(start.y + start.height);
  // Centered under Start (within a few pixels).
  expect(Math.abs((howTo.x + howTo.width / 2) - (start.x + start.width / 2))).toBeLessThan(4);
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
