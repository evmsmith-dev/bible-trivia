import { test, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

// Service-worker tests share one server folder, so they run one at a time.
test.describe.configure({ mode: "serial" });

const appDir = path.resolve(process.env.APP_DIR || "dist");
const swPath = path.join(appDir, "service-worker.js");

test.beforeEach(({}, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "Service-worker tests run once, on desktop.");
  test.skip(!fs.readFileSync(swPath, "utf8").includes("PRECACHE = [\"./\","), "Service-worker tests need the built app (npm run test:e2e).");
});

async function waitForControl(page) {
  await page.goto("index.html");
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true);
}

test("the app works offline after the first visit", async ({ page, context }) => {
  await waitForControl(page);
  await context.setOffline(true);
  await page.reload();
  await expect(page.locator("#start-btn")).toBeVisible();
  await page.locator("#start-btn").click();
  await expect(page.locator("#options .option").first()).toBeVisible({ timeout: 6000 });
  expect(await page.evaluate(() => document.fonts.check("16px Fredoka"))).toBe(true);
});

test("a new version shows an update banner on the Home screen and reloads on Update", async ({ page }) => {
  const original = fs.readFileSync(swPath, "utf8");
  try {
    await waitForControl(page);
    fs.writeFileSync(swPath, original.replace(/const BUILD_VERSION = "[^"]+";/, 'const BUILD_VERSION = "TEST";'));
    await page.evaluate(() => navigator.serviceWorker.getRegistration().then((r) => r.update()));
    const banner = page.locator("#update-banner");
    await expect(banner).toBeVisible({ timeout: 15000 });
    await Promise.all([page.waitForEvent("load"), page.locator("#update-banner-btn").click()]);
    await expect.poll(() => page.evaluate(() => caches.keys())).toEqual(["bible-trivia-TEST"]);
  } finally {
    fs.writeFileSync(swPath, original);
  }
});
