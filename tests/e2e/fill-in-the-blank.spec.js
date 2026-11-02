import { test, expect } from "@playwright/test";
import * as h from "./helpers.js";

// Serve only fill-in-the-blank questions, so every question in the round has a blank.
async function onlyBlankQuestions(page) {
  await page.route("**/data/questions.json", async (route) => {
    const response = await route.fetch();
    const bank = await response.json();
    await route.fulfill({ response, json: bank.filter((question) => question.q.includes("___")) });
  });
}

test("a fill-in-the-blank question shows a blank that the right answer fills in", async ({ page }) => {
  await onlyBlankQuestions(page);
  await h.openApp(page);
  await h.startNormalGame(page);

  const blank = page.locator("#question .blank");
  await expect(blank).toHaveCount(1);
  await expect(blank).not.toHaveClass(/is-filled/);
  await expect(page.locator("#question")).not.toContainText("___");

  // A wrong answer still fills the blank with the right one.
  await h.waitForAnswers(page);
  const right = await page.locator('#options .option[data-correct="true"]').getAttribute("data-answer");
  await page.locator('#options .option[data-correct="false"]').first().click();
  await expect(blank).toHaveClass(/is-filled/);
  await expect(blank).toHaveText(right);
  await page.clock.runFor(3000);

  // The next question starts with an empty blank again.
  await expect(page.locator("#question .blank")).not.toHaveClass(/is-filled/);

  // Review shows each sentence with its answer filled in.
  for (let i = 1; i < 10; i++) await h.answer(page, { correct: true });
  await h.expectSummary(page);
  await page.locator("#summary-review-btn").click();
  const first = page.locator(".review-question-title").first();
  await expect(first.locator(".blank.is-filled")).toHaveText(right);
  await expect(first).not.toContainText("___");
});
