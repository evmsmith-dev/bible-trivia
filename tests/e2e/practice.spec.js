import { test, expect } from "@playwright/test";
import * as h from "./helpers.js";

const PRACTICE_KEY = "bibleTriviaPlayer_primary_practice";
const practiceList = (page) => page.evaluate((key) => JSON.parse(localStorage.getItem(key) || "{}"), PRACTICE_KEY);

/** Answers the visible practice question, then taps Next. */
async function practiseAnswer(page, { correct }) {
  await h.waitForAnswers(page);
  await page.locator(`#options .option[data-correct="${correct}"]`).first().click();
  await expect(page.locator("#practice-next")).toBeVisible();
  await page.locator("#practice-next-btn").click();
}

test("with nothing to practise, the card says so", async ({ page }) => {
  await h.openApp(page);
  await expect(page.locator("#practice-card-status")).toHaveText("Questions you miss will show up here");
  await page.locator("#practice-link").click();
  await expect(page.locator("#toast")).toContainText("Nothing to practise yet");
  await expect(page.locator("#countdown-overlay")).toBeHidden();
});

test("missed questions can be practised without a timer, points or streak", async ({ page }) => {
  await h.openApp(page);
  await h.startNormalGame(page);
  await h.playRound(page, { correctAnswers: 7 });
  await h.expectSummary(page);
  await page.clock.runFor(16000);
  await h.goHomeFromSummary(page);
  expect(Object.keys(await practiceList(page))).toHaveLength(3);
  await expect(page.locator("#practice-card-count")).toHaveText("3");
  await expect(page.locator("#practice-card-status")).toHaveText("3 questions you missed · no timer");

  const before = await h.readProfile(page);
  await page.locator("#practice-link").click();
  // No 3-2-1: nothing is timed, so the first question is straight there.
  await expect(page.locator("#countdown-overlay")).toBeHidden();
  await expect(page.locator("#options .option").first()).toBeVisible();
  await expect(page.locator("#practice-tag")).toBeVisible();
  for (const hidden of ["#timer-display", "#score-display", "#streak-hud"]) await expect(page.locator(hidden)).toBeHidden();
  await expect(page.locator("#progress-dots span")).toHaveCount(3);

  // No timer: nothing happens however long it waits; the answer then shows the reference and Next.
  await h.waitForAnswers(page);
  await page.clock.runFor(120_000);
  await expect(page.locator("#options .option").first()).toBeEnabled();
  await page.locator('#options .option[data-correct="true"]').click();
  await expect(page.locator("#feedback")).toContainText("Right!");
  // A question with a Bible reference links to it (General questions may have none).
  if (await page.locator("#practice-ref").isVisible()) {
    await expect(page.locator("#practice-ref a")).toHaveAttribute("href", /biblegateway\.com/);
  }
  await page.clock.runFor(10_000);
  await expect(page.locator("#practice-next")).toBeVisible(); // waits for Next
  await page.locator("#practice-next-btn").click();

  await practiseAnswer(page, { correct: false });
  await h.waitForAnswers(page);
  await page.locator('#options .option[data-correct="true"]').click();
  await expect(page.locator("#practice-next-btn")).toHaveText("See results ›");
  await page.locator("#practice-next-btn").click();

  await expect(page.locator(".summary-eyebrow")).toHaveText("📖 Practice");
  await expect(page.locator(".summary-score-big")).toHaveText("2");
  await expect(page.locator(".summary-practice")).toContainText("2 off your list · 1 still to practise");
  await expect(page.locator("#practice-again-btn")).toBeVisible();
  expect(Object.keys(await practiceList(page))).toHaveLength(1);

  // Practice doesn't count toward levels, scores or history.
  expect(await h.readProfile(page)).toMatchObject({ levelPoints: before.levelPoints, nonDailyCorrectAnswers: before.nonDailyCorrectAnswers });

  await page.locator("#practice-again-btn").click();
  await expect(page.locator("#options .option").first()).toBeVisible();
  await expect(page.locator("#progress-dots span")).toHaveCount(1);
  await practiseAnswer(page, { correct: true });
  await expect(page.locator(".summary-practice")).toContainText("Your practice list is clear!");
  await expect(page.locator("#practice-again-btn")).toHaveCount(0);
  await h.goHomeFromSummary(page);
  await expect(page.locator("#practice-card-status")).toHaveText("Questions you miss will show up here");
  await h.openScores(page);
  await expect(page.locator(".stat-card").first()).toContainText("1"); // still one game played
});

test("a missed question comes back in Practice, and ending Practice early keeps it on the list", async ({ page }) => {
  await h.openApp(page);
  await h.startNormalGame(page);
  const missed = await page.locator("#question").textContent();
  await h.answer(page, { correct: false });
  expect(Object.keys(await practiceList(page))).toHaveLength(1);
  await page.locator("#quit-btn").click();
  await page.locator("#quit-confirm-btn").click();
  await page.locator("#practice-link").click();
  await expect(page.locator("#options .option").first()).toBeVisible();
  await expect(page.locator("#question")).toHaveText(missed);
  await page.locator("#quit-btn").click();
  await expect(page.locator("#quit-text")).toHaveText("Questions you've already got right stay off your practice list.");
  await page.locator("#quit-confirm-btn").click();
  expect(Object.keys(await practiceList(page))).toHaveLength(1); // ending early keeps it
});

test("the list holds at most 10, and a round that empties it earns Clean Slate", async ({ page }) => {
  await h.openApp(page);
  await h.startNormalGame(page);
  await h.playRound(page, { correctAnswers: 0 });
  await h.expectSummary(page);
  await page.clock.runFor(16000);
  await page.locator("#restart-same").click();
  await h.finishCountdown(page);
  await h.playRound(page, { correctAnswers: 5 });
  await h.expectSummary(page);
  await page.clock.runFor(16000);
  await h.goHomeFromSummary(page);
  expect(Object.keys(await practiceList(page))).toHaveLength(10); // 15 missed, the 10 latest kept
  await expect(page.locator("#practice-card-count")).toHaveText("10");

  await page.locator("#practice-link").click();
  for (let i = 0; i < 10; i++) await practiseAnswer(page, { correct: true });
  await expect(page.locator(".summary-practice")).toContainText("Your practice list is clear!");
  await expect(page.locator("#summary-badges-btn")).toHaveAccessibleName(/Clean Slate/);
});

test("Clear list empties the practice list (from the results or Edit player)", async ({ page }) => {
  await h.openApp(page);
  await h.startNormalGame(page);
  await h.playRound(page, { correctAnswers: 6 });
  await h.expectSummary(page);
  await page.clock.runFor(16000);
  await h.goHomeFromSummary(page);
  await page.locator("#practice-link").click();
  await practiseAnswer(page, { correct: false });
  await page.locator("#quit-btn").click();
  await page.locator("#quit-confirm-btn").click();
  expect(Object.keys(await practiceList(page))).toHaveLength(4);

  // Edit player shows the count and clears after confirming.
  await h.openPlayerSheet(page);
  const clear = page.locator("#player-practice-clear-btn");
  await expect(clear).toHaveText("Clear practice list (4)");
  page.once("dialog", (dialog) => dialog.accept());
  await clear.click();
  await expect(clear).toBeHidden();
  expect(await practiceList(page)).toEqual({});
  await h.backToHome(page);
  await expect(page.locator("#practice-card-status")).toHaveText("Questions you miss will show up here");
});

test("Practice can be turned off in Settings", async ({ page }) => {
  await h.openApp(page);
  await h.openSettings(page);
  await expect(page.locator('.practice-btn[data-value="on"]')).toHaveAttribute("aria-pressed", "true");
  await page.locator('.practice-btn[data-value="off"]').click();
  await h.backToHome(page);
  await expect(page.locator("#practice-link")).toBeHidden();

  // While it's off, misses aren't added to the list.
  await h.startNormalGame(page);
  await h.answer(page, { correct: false });
  expect(await practiceList(page)).toEqual({});
  await page.locator("#quit-btn").click();
  await page.locator("#quit-confirm-btn").click();

  await h.openSettings(page);
  await page.locator('.practice-btn[data-value="on"]').click();
  await h.backToHome(page);
  await expect(page.locator("#practice-link")).toBeVisible();
  await page.reload();
  await h.waitForReady(page);
  await expect(page.locator("#practice-link")).toBeVisible(); // remembered
});
