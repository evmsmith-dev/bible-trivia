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
