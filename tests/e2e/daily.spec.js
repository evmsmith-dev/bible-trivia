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

  test("a failed attempt can be retried with the same questions; passing completes the day", async ({ page }) => {
    await startDaily(page);
    const firstAttempt = await collectQuestions(page, { correct: false });
    await h.chooseReview(page, "skip");
    await expect(page.locator("#summary")).toContainText("Daily challenge not completed");
    await expect(page.locator("#restart-same")).toHaveCount(0);
    await h.goHomeFromSummary(page);

    await startDaily(page);
    const secondAttempt = await collectQuestions(page, { correct: true });
    expect(secondAttempt).toEqual(firstAttempt);
    await h.chooseReview(page, "skip");
    await expect(page.locator("#summary")).toContainText("Daily challenge complete");
    await expect(page.locator("#summary")).toContainText("Attempts: 2");
    await page.clock.runFor(5000);
    await h.goHomeFromSummary(page);

    await page.locator("#daily-challenge-link").click();
    await expect(page.locator("#daily-start-btn")).toBeDisabled();
    await expect(page.locator("#daily-challenge-status")).toContainText("Active");
  });

  test("daily answers do not count toward the player level", async ({ page }) => {
    await startDaily(page);
    await collectQuestions(page, { correct: true });
    await h.chooseReview(page, "skip");
    await page.clock.runFor(5000);
    expect((await h.readProfile(page)).nonDailyCorrectAnswers).toBe(0);
  });
});
