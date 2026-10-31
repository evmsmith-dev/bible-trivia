import { test, expect } from "@playwright/test";
import * as h from "./helpers.js";

test("Home shows the day's verse, and tapping it shows the whole verse with a link", async ({ page }) => {
  await h.skipFirstRunHelp(page);
  await page.clock.install({ time: new Date("2026-12-25T09:00:00") });
  await page.goto("index.html");
  await h.waitForReady(page);
  const verse = page.locator("#home-verse");
  await expect(verse).toBeVisible();
  await expect(page.locator("#home-sub")).toBeHidden();
  await expect(page.locator("#home-verse-ref")).toHaveText("📖 Luke 2:14");
  await expect(page.locator("#home-verse-text")).toHaveText("“Glory to God in the highest, on earth peace, good will toward men.”");

  await verse.click();
  await expect(page.locator("#verse-overlay")).toBeVisible();
  await expect(page.locator("#verse-full-ref")).toHaveText("Luke 2:14");
  const link = page.locator("#verse-chapter-link");
  await expect(link).toHaveText("Read Luke 2 on Bible Gateway ›");
  await expect(link).toHaveAttribute("href", "https://www.biblegateway.com/passage/?search=Luke%202&version=NIV");
  await page.keyboard.press("Escape");
  await expect(page.locator("#verse-overlay")).toBeHidden();
});

test("the verse changes at midnight while the app stays open", async ({ page }) => {
  await h.skipFirstRunHelp(page);
  await page.clock.install({ time: new Date("2026-12-24T23:59:00") });
  await page.goto("index.html");
  await h.waitForReady(page);
  await expect(page.locator("#home-verse-ref")).toHaveText("📖 Luke 2:11");
  await page.clock.runFor(2 * 60_000);
  await expect(page.locator("#home-verse-ref")).toHaveText("📖 Luke 2:14");
});

test("if the verses can't load, Home keeps its usual line", async ({ page }) => {
  await page.route("**/data/verses.json", (route) => route.abort());
  await h.openApp(page);
  await expect(page.locator("#home-sub")).toBeVisible();
  await expect(page.locator("#home-verse")).toBeHidden();
});
