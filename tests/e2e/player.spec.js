import { test, expect } from "@playwright/test";
import * as h from "./helpers.js";

test.describe("player profile and settings", () => {
  test.beforeEach(async ({ page }) => {
    await h.openApp(page);
  });

  test("renaming validates length and persists", async ({ page }) => {
    await page.locator("#player-entry-btn").click();
    await page.locator("#player-name-edit-btn").click();
    await page.locator("#player-name-input").fill(" x ");
    await page.locator("#player-name-confirm-btn").click();
    await expect(page.locator("#player-name-error")).toContainText("2 to 15 characters");

    await page.locator("#player-name-input").fill("  Ruth  ");
    await page.locator("#player-name-input").press("Enter");
    await expect(page.locator("#player-name-display")).toHaveText("Ruth");

    await page.reload();
    await expect(page.locator("#player-entry-name")).toHaveText("Ruth");
  });

  test("choosing an avatar persists", async ({ page }) => {
    await page.locator("#player-entry-btn").click();
    await page.locator("#avatar-page-next").click();
    const option = page.locator("#player-avatar-options [role=radio]").first();
    const avatarId = await option.getAttribute("data-avatar-id");
    await option.click();
    await expect(page.locator("#player-save-status")).toContainText("Avatar Updated");
    await expect(option).toHaveAttribute("aria-checked", "true");
    await page.reload();
    await h.waitForReady(page);
    expect((await h.readProfile(page)).avatarId).toBe(avatarId);
    await expect(page.locator("#player-entry-avatar img")).toHaveAttribute("src", /icons\/avatars\//);
  });

  test("difficulty mode persists and changes the timer", async ({ page }) => {
    await page.locator("#player-entry-btn").click();
    await page.locator("#player-open-settings-btn").click();
    await page.locator('.difficulty-btn[data-mode="hard"]').click();
    await expect(page.locator('.difficulty-btn[data-mode="hard"]')).toHaveClass(/active/);

    await page.reload();
    await h.waitForReady(page);
    await h.startNormalGame(page);
    await expect(page.locator("#timer-display")).toHaveText("21");
  });

  test("'Always skip' review preference goes straight to the summary", async ({ page }) => {
    await page.locator("#player-entry-btn").click();
    await page.locator("#player-open-settings-btn").click();
    await page.locator('.review-pref-btn[data-value="alwaysSkip"]').click();
    await page.locator("#settings-overlay .settings-close").click();
    await page.locator("#player-overlay .player-close").click();

    await h.startNormalGame(page);
    await h.playRound(page, { correctAnswers: 3 });
    await expect(page.locator("#review-choice-overlay")).toBeHidden();
    await expect(page.locator("#summary")).toContainText("You got 3 right");
  });

  test("reset player clears progress", async ({ page }) => {
    await h.startNormalGame(page);
    await h.playRound(page, { correctAnswers: 10 });
    await h.chooseReview(page, "skip");
    await page.clock.runFor(5000);
    await h.goHomeFromSummary(page);
    expect((await h.readProfile(page)).nonDailyCorrectAnswers).toBe(10);

    page.once("dialog", (dialog) => dialog.accept());
    await page.locator("#player-entry-btn").click();
    await page.locator("#player-reset-btn").click();
    await expect.poll(async () => (await h.readProfile(page)).nonDailyCorrectAnswers).toBe(0);
    await page.locator("#player-open-leaderboard-btn").click();
    await page.locator('.leaderboard-tab[data-panel="leaderboard-history"]').click();
    await expect(page.locator("#welcome-history-content")).toContainText("No game history yet");
  });
});

test("data saved by the previous version still loads; an inflated level counter is rebuilt from game history", async ({ page }) => {
  // Create the database with the app, then seed legacy data from a page that doesn't run the app.
  await page.goto("index.html");
  await h.waitForReady(page);
  await page.goto("manifest.json");
  await page.evaluate(async ({ profileKey, dbName }) => {
    localStorage.setItem(profileKey, JSON.stringify({ id: "primary", name: "Tester", avatarId: "emoji-cool", nonDailyCorrectAnswers: 200 }));
    await new Promise((resolve, reject) => {
      const request = indexedDB.open(dbName);
      request.onsuccess = () => {
        const db = request.result;
        const tx = db.transaction(["gameHistory", "highScores", "settings"], "readwrite");
        for (let i = 0; i < 5; i++) {
          tx.objectStore("gameHistory").add({ timestamp: "1/2/2026, 3:04:05 PM", correct: 8, total: 10, score: 900, percent: 80, difficultyMode: "medium", categories: {} });
        }
        tx.objectStore("highScores").add({ score: 1234, timestamp: "2026-01-02T15:04:05.000Z", correct: 9, total: 10, difficultyMode: "Super Hard" });
        tx.objectStore("settings").put({ key: "difficultyMode", value: "superHard" });
        tx.oncomplete = () => { db.close(); resolve(); };
        tx.onerror = () => reject(tx.error);
      };
      request.onerror = () => reject(request.error);
    });
  }, { profileKey: h.PROFILE_KEY, dbName: h.DB_NAME });

  await page.goto("index.html");
  await expect(page.locator("#player-entry-name")).toHaveText("Tester");
  await expect(page.locator("#player-entry-level")).toHaveText("Level 2"); // 40 correct answers
  expect(await h.readProfile(page)).toMatchObject({ nonDailyCorrectAnswers: 40, levelCountVersion: 2 });

  // Saved settings and scores from the old version load too.
  await page.locator("#player-entry-btn").click();
  await page.locator("#player-open-leaderboard-btn").click();
  await expect(page.locator("#welcome-leaderboard-content")).toContainText("1234");
  await page.locator('.leaderboard-tab[data-panel="leaderboard-history"]').click();
  await expect(page.locator("#welcome-history-content tbody tr")).toHaveCount(5);
  await page.keyboard.press("Escape");
  await page.locator("#player-open-settings-btn").click();
  await expect(page.locator('.difficulty-btn[data-mode="superHard"]')).toHaveClass(/active/);
});
