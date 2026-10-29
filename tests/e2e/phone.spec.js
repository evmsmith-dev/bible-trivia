import { test, expect } from "@playwright/test";
import * as h from "./helpers.js";

const overflow = (page) => page.evaluate(() => document.documentElement.scrollHeight - window.innerHeight);

async function reachSummary(page, { wrong = 3 } = {}) {
  await h.startNormalGame(page);
  await h.playRound(page, { correctAnswers: 10 - wrong });
  await h.chooseReview(page, "skip");
  await expect(page.locator("#summary")).toBeVisible();
  await page.clock.runFor(8000); // let any celebration finish
}

test.describe("screens fit without scrolling", () => {
  test("the summary fits an iPhone SE screen", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await h.openApp(page);
    await reachSummary(page);
    expect(await overflow(page)).toBeLessThanOrEqual(0);
  });

  for (const [name, width, height] of [["a small phone held sideways", 667, 375], ["an iPhone held sideways", 844, 390]]) {
    test(`home, game and summary fit ${name}`, async ({ page }) => {
      await page.setViewportSize({ width, height });
      await h.openApp(page);
      expect(await overflow(page)).toBeLessThanOrEqual(0);
      await reachSummary(page);
      expect(await overflow(page)).toBeLessThanOrEqual(0);
      await page.locator("#restart-same").click();
      await h.finishCountdown(page);
      expect(await overflow(page)).toBeLessThanOrEqual(0);
    });
  }
});

test.describe("leaving the app mid-question", () => {
  async function setHidden(page, hidden) {
    await page.evaluate((isHidden) => {
      Object.defineProperty(document, "visibilityState", { configurable: true, get: () => (isHidden ? "hidden" : "visible") });
      document.dispatchEvent(new Event("visibilitychange"));
    }, hidden);
  }

  test("pauses the timer and covers the question until Resume", async ({ page }) => {
    await h.openApp(page);
    await h.startNormalGame(page);
    await page.clock.runFor(3000);
    const before = Number(await page.locator("#timer-display").textContent());

    await setHidden(page, true);
    await page.clock.runFor(60_000); // far longer than any question's time limit
    await setHidden(page, false);

    await expect(page.locator("#pause-overlay")).toBeVisible();
    await expect(page.locator("#progress")).toContainText("Question 1 of 10");
    expect(Number(await page.locator("#timer-display").textContent())).toBe(before);

    await page.locator("#pause-resume-btn").click();
    await expect(page.locator("#pause-overlay")).toBeHidden();
    await page.clock.runFor(2000);
    expect(Number(await page.locator("#timer-display").textContent())).toBeLessThan(before);
    await h.answer(page, { correct: true });
    await expect(page.locator("#progress")).toContainText("Correct: 1");
  });

  test("does nothing once the question is answered", async ({ page }) => {
    await h.openApp(page);
    await h.startNormalGame(page);
    await page.locator('#options .option[data-correct="true"]').click();
    await setHidden(page, true);
    await page.clock.runFor(3000);
    await expect(page.locator("#pause-overlay")).toBeHidden();
    await expect(page.locator("#progress")).toContainText("Question 2 of 10");
  });
});

test.describe("vibration", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      window.__vibrations = [];
      Object.defineProperty(navigator, "vibrate", { configurable: true, value: (pattern) => { window.__vibrations.push(pattern); return true; } });
    });
    await h.openApp(page);
  });

  test("buzzes once for a right answer and twice for a wrong one", async ({ page }) => {
    await h.startNormalGame(page);
    await h.answer(page, { correct: true });
    await h.answer(page, { correct: false });
    expect(await page.evaluate(() => window.__vibrations)).toEqual([40, [70, 60, 70]]);
  });

  test("can be turned off in Settings", async ({ page }) => {
    await page.locator("#player-entry-btn").click();
    await page.locator("#player-open-settings-btn").click();
    await expect(page.locator("#vibration-setting")).toBeVisible();
    await page.locator('.vibration-btn[data-value="off"]').click();
    await expect(page.locator('.vibration-btn[data-value="off"]')).toHaveAttribute("aria-pressed", "true");
    await page.keyboard.press("Escape");
    await page.keyboard.press("Escape");
    await page.evaluate(() => { window.__vibrations = []; });

    await h.startNormalGame(page);
    await h.answer(page, { correct: true });
    expect(await page.evaluate(() => window.__vibrations)).toEqual([]);
  });
});

test("the vibration setting is hidden on devices that can't vibrate", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "vibrate", { configurable: true, value: undefined });
  });
  await h.openApp(page);
  await page.locator("#player-entry-btn").click();
  await page.locator("#player-open-settings-btn").click();
  await expect(page.locator("#settings-title")).toBeVisible();
  await expect(page.locator("#vibration-setting")).toBeHidden();
});
