import { test, expect } from "@playwright/test";
import * as h from "./helpers.js";

async function startDaily(page) {
  await page.locator("#daily-challenge-link").click();
  await expect(page.locator("#daily-start-btn")).toBeEnabled();
  await page.locator("#daily-start-btn").click();
  await h.finishCountdown(page);
  await expect(page.locator("#progress")).toContainText("Daily | Question 1 of 10");
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
    await h.chooseReview(page, "skip");
    await expect(page.locator("#summary")).toContainText("Daily challenge not completed");
    await expect(page.locator("#restart-same")).toHaveCount(0);
    await h.goHomeFromSummary(page);

    await startDaily(page);
    const secondAttempt = await collectQuestions(page, { correct: true });
    // A retry can't be passed just by remembering the first attempt's answers.
    expect(secondAttempt.filter((question) => firstAttempt.includes(question))).toEqual([]);
    await h.chooseReview(page, "skip");
    await expect(page.locator("#summary")).toContainText("Daily challenge complete");
    await expect(page.locator("#summary")).toContainText("Attempts: 2");
    await page.clock.runFor(5000);
    await h.goHomeFromSummary(page);

    await page.locator("#daily-challenge-link").click();
    await expect(page.locator("#daily-start-btn")).toBeDisabled();
    await expect(page.locator("#daily-challenge-status")).toContainText("Active");
  });

  test("the result can be shared as an emoji grid", async ({ page }) => {
    await page.addInitScript(() => {
      navigator.share = async (data) => { window.__sharedText = data.text; };
    });
    await page.reload();
    await h.waitForReady(page);
    await startDaily(page);
    for (let i = 0; i < 10; i++) await h.answer(page, { correct: i !== 2 });
    await h.chooseReview(page, "skip");
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
    await h.chooseReview(page, "skip");
    await page.locator("#share-daily-btn").click();
    await expect(page.locator("#share-status")).toContainText("copied");
    expect(await page.evaluate(() => navigator.clipboard.readText())).toContain("🟥🟥🟥🟥🟥🟥🟥🟥🟥🟥");
  });

  test("daily answers do not count toward the player level", async ({ page }) => {
    await startDaily(page);
    await collectQuestions(page, { correct: true });
    await h.chooseReview(page, "skip");
    await page.clock.runFor(5000);
    expect((await h.readProfile(page)).nonDailyCorrectAnswers).toBe(0);
  });
});
