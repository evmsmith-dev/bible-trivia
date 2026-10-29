import { test, expect } from "@playwright/test";
import * as h from "./helpers.js";

const theme = (page) => page.evaluate(() => document.documentElement.dataset.theme);
const bodyBackground = (page) => page.evaluate(() => getComputedStyle(document.body).backgroundColor);

async function openSettings(page) {
  await page.locator("#home-settings-btn").click();
  await expect(page.locator("#settings-overlay")).toBeVisible();
}

test("follows the device's dark setting by default", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await h.openApp(page);
  expect(await theme(page)).toBe("dark");
  expect(await bodyBackground(page)).toBe("rgb(16, 21, 16)");
  await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute("content", "#1b5e20");

  // Switching the device to light while on Auto switches the app too.
  await page.emulateMedia({ colorScheme: "light" });
  await expect.poll(() => theme(page)).toBe("light");
  await expect.poll(() => bodyBackground(page)).toBe("rgb(232, 245, 233)");
});

test("light mode keeps the original colors", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "light" });
  await h.openApp(page);
  expect(await theme(page)).toBe("light");
  const card = await page.evaluate(() => getComputedStyle(document.getElementById("welcome")).backgroundColor);
  expect(card).toBe("rgb(255, 255, 255)");
});

test("Appearance can force dark or light, and is remembered", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "light" });
  await h.openApp(page);
  await openSettings(page);
  await expect(page.locator('.theme-btn[data-value="auto"]')).toHaveAttribute("aria-pressed", "true");

  await page.locator('.theme-btn[data-value="dark"]').click();
  expect(await theme(page)).toBe("dark");
  await page.reload();
  await h.waitForReady(page);
  expect(await theme(page)).toBe("dark"); // set before the page draws, from saved preference

  await page.emulateMedia({ colorScheme: "dark" });
  await openSettings(page);
  await page.locator('.theme-btn[data-value="light"]').click();
  expect(await theme(page)).toBe("light");
  await page.reload();
  await h.waitForReady(page);
  expect(await theme(page)).toBe("light");
});

test("text on the yellow buttons stays dark in dark mode", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await h.openApp(page);
  const color = await page.evaluate(() => getComputedStyle(document.getElementById("start-btn")).color);
  expect(color).toBe("rgb(51, 51, 51)");
});

test("the manifest theme color works in both light and dark mode", async ({ page }) => {
  // Android paints an installed app's bottom navigation bar with the manifest theme_color,
  // and the manifest can't change with the theme, so it must be a deep color, not bright green.
  await page.goto("index.html");
  const manifest = await page.evaluate(() => fetch("manifest.json").then((r) => r.json()));
  expect(manifest.theme_color).toBe("#1b5e20");
  // The top status bar matches the bottom bar, in light and dark mode.
  for (const scheme of ["light", "dark"]) {
    await page.emulateMedia({ colorScheme: scheme });
    await h.openApp(page);
    await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute("content", "#1b5e20");
  }
});
