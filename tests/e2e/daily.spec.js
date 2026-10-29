import { test, expect } from "@playwright/test";
import * as h from "./helpers.js";

async function startDaily(page) {
  await page.locator("#daily-challenge-link").click();
  await expect(page.locator("#daily-start-btn")).toBeEnabled();
  await page.locator("#daily-start-btn").click();
  await h.finishCountdown(page);
  await expect(page.locator("#progress")).toContainText("Daily | Question 1 of 10");
  await expect(page.locator("#daily-tag")).toBeVisible();
}

async function collectQuestions(page, { correct }) {
  const questions = [];
  for (let i = 0; i < 10; i++) {
    questions.push(await page.locator("#question").textContent());
    await h.answer(page, { correct });
  }
  return questions;
}

test.describe("daily challenge", () => {
  test.beforeEach(async ({ page }) => {
    await h.openApp(page);
  });

  test("a failed attempt can be retried with different questions; passing completes the day", async ({ page }) => {
    await startDaily(page);
    const firstAttempt = await collectQuestions(page, { correct: false });
    await h.expectSummary(page);
    await expect(page.locator("#summary")).toContainText("Not complete yet: 70% needed");
    await expect(page.locator(".summary-eyebrow")).toHaveText("🎯 Daily Challenge");
    await expect(page.locator("#share-daily-btn")).toBeVisible();
    await expect(page.locator("#restart-same")).toHaveCount(0);
    await h.goHomeFromSummary(page);

    await startDaily(page);
    const secondAttempt = await collectQuestions(page, { correct: true });
    // A retry can't be passed just by remembering the first attempt's answers.
    expect(secondAttempt.filter((question) => firstAttempt.includes(question))).toEqual([]);
    await h.expectSummary(page);
    await expect(page.locator("#summary")).toContainText("Daily Challenge complete (70%+)");
    await expect(page.locator("#summary")).toContainText("Tries: 2");
    await page.clock.runFor(5000);
    await h.goHomeFromSummary(page);

    await page.locator("#daily-challenge-link").click();
    await expect(page.locator("#daily-start-btn")).toBeDisabled();
    await expect(page.locator("#daily-challenge-status")).toContainText("Active");
  });

  test("a missed challenge offers Try Again, then Back to Home; a completed one offers Share", async ({ page }) => {
    await startDaily(page);
    await h.playRound(page, { correctAnswers: 3 });
    await h.expectSummary(page);
    const buttons = page.locator(".summary-actions button");
    await expect(buttons).toHaveText(["🔁 Try Again", "🏠 Back to Home", "📤 Share result"]);
    const retry = await page.locator("#daily-retry-btn").boundingBox();
    const home = await page.locator("#restart-change").boundingBox();
    expect(home.width).toBeGreaterThan(retry.width * 0.95); // a full-size button, not a text link

    await page.locator("#daily-retry-btn").click();
    await h.finishCountdown(page);
    await expect(page.locator("#progress")).toContainText("Daily | Question 1 of 10");
    await h.playRound(page, { correctAnswers: 8 });
    await h.expectSummary(page);
    await page.clock.runFor(5000);
    await expect(buttons).toHaveText(["📤 Share Result", "🏠 Back to Home"]);
    await expect(page.locator("#daily-retry-btn")).toHaveCount(0);
    await page.locator("#restart-change").click();
    await expect(page.locator("#start-btn")).toBeVisible();
  });

  test("the result can be shared as an emoji grid", async ({ page }) => {
    await page.addInitScript(() => {
      navigator.share = async (data) => { window.__sharedText = data.text; };
    });
    await page.reload();
    await h.waitForReady(page);
    await startDaily(page);
    for (let i = 0; i < 10; i++) await h.answer(page, { correct: i !== 2 });
    await h.expectSummary(page);
    await page.clock.runFor(5000);
    await page.locator("#share-daily-btn").click();
    const text = await page.evaluate(() => window.__sharedText);
    expect(text).toContain("Bible Trivia Daily Challenge");
    expect(text).toContain("🟩🟩🟥🟩🟩🟩🟩🟩🟩🟩");
    expect(text).toMatch(/9\/10 · [\d,]+ pts/);
  });

  test("without a share sheet the result is copied to the clipboard", async ({ page, context, browserName }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await page.addInitScript(() => { delete Navigator.prototype.share; });
    await page.reload();
    await h.waitForReady(page);
    await startDaily(page);
    await h.playRound(page, { correctAnswers: 0 });
    await h.expectSummary(page);
    await page.locator("#share-daily-btn").click();
    await expect(page.locator("#share-status")).toContainText("copied");
    expect(await page.evaluate(() => navigator.clipboard.readText())).toContain("🟥🟥🟥🟥🟥🟥🟥🟥🟥🟥");
  });

  test("daily answers do not count toward the player level", async ({ page }) => {
    await startDaily(page);
    await collectQuestions(page, { correct: true });
    await h.expectSummary(page);
    await page.clock.runFor(5000);
    expect((await h.readProfile(page)).nonDailyCorrectAnswers).toBe(0);
  });
});

test("the Daily Challenge skips questions the player just saw", async ({ page }) => {
  await h.openApp(page);
  // Three Medium rounds (the daily's mode) first.
  const seen = new Set();
  for (let round = 0; round < 3; round++) {
    if (round) await page.locator("#restart-same").click();
    else await page.locator("#start-btn").click();
    await h.finishCountdown(page);
    (await collectQuestions(page, { correct: false })).forEach((q) => seen.add(q));
    await h.expectSummary(page);
    await page.clock.runFor(16000);
  }
  await h.goHomeFromSummary(page);

  await startDaily(page);
  const daily = await collectQuestions(page, { correct: true });
  expect(daily.filter((q) => seen.has(q))).toEqual([]);
});
