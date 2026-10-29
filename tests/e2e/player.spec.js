import { test, expect } from "@playwright/test";
import * as h from "./helpers.js";

test.describe("player and settings", () => {
  test.beforeEach(async ({ page }) => {
    await h.openApp(page);
  });

  test("renaming validates length and saves with Save", async ({ page }) => {
    await h.openPlayerSheet(page);
    const input = page.locator("#player-name-input");
    await expect(input).toHaveValue("Player");
    await input.fill(" x ");
    await page.locator("#player-save-btn").click();
    await expect(page.locator("#player-name-error")).toContainText("2 to 15 letters");
    await expect(page.locator("#player-sheet")).toBeVisible();

    await input.fill("  Ruth  ");
    await input.press("Enter"); // Enter saves too
    await expect(page.locator("#player-sheet")).toBeHidden();
    await expect(page.locator(".player-tile.is-active")).toContainText("Ruth");
    await h.backToHome(page);
    await expect(page.locator("#player-entry-name")).toHaveText("Ruth");

    await page.reload();
    await expect(page.locator("#player-entry-name")).toHaveText("Ruth");
  });

  test("all pictures show at once, and the choice is saved with Save", async ({ page }) => {
    await h.openPlayerSheet(page);
    const options = page.locator("#player-avatar-options [role=radio]");
    await expect(options).toHaveCount(24); // every picture (8 emoji + 16 drawings), no paging
    const option = page.locator('#player-avatar-options [data-avatar-id^="image-"]').first();
    const avatarId = await option.getAttribute("data-avatar-id");
    await option.click();
    await expect(option).toHaveAttribute("aria-checked", "true");
    await page.locator("#player-save-btn").click();
    await h.backToHome(page);
    await expect(page.locator("#player-entry-avatar img")).toHaveAttribute("src", /icons\/avatars\//);

    await page.reload();
    await h.waitForReady(page);
    expect((await h.readProfile(page)).avatarId).toBe(avatarId);
  });

  test("closing the sheet without saving keeps the old name and picture", async ({ page }) => {
    await h.openPlayerSheet(page);
    await page.locator("#player-name-input").fill("Changed");
    await page.locator('#player-avatar-options [data-avatar-id="emoji-cool"]').click();
    await page.locator("#player-sheet .sheet-close").click();
    await expect(page.locator("#player-sheet")).toBeHidden();
    await h.backToHome(page);
    await expect(page.locator("#player-entry-name")).toHaveText("Player");
    expect((await h.readProfile(page)).avatarId).not.toBe("emoji-cool");

    await h.openPlayerSheet(page); // reopening starts from the saved values
    await expect(page.locator("#player-name-input")).toHaveValue("Player");
  });

  test("difficulty mode persists and changes the timer", async ({ page }) => {
    await h.openSettings(page);
    await page.locator('.difficulty-btn[data-mode="hard"]').click();
    await expect(page.locator('.difficulty-btn[data-mode="hard"]')).toHaveClass(/active/);

    await page.reload();
    await h.waitForReady(page);
    await h.startNormalGame(page);
    await expect(page.locator("#timer-display")).toHaveText("21");
  });

  test("the mode button on Home shows the difficulty and changes it", async ({ page }) => {
    const chip = page.locator("#mode-chip");
    await expect(chip).toHaveText("🟠 Medium ▾");
    await chip.click();
    await expect(page.locator("#settings-overlay")).toBeVisible();
    await page.locator('.difficulty-btn[data-mode="easy"]').click();
    await page.locator("#settings-overlay .settings-close").click();
    await expect(chip).toHaveText("🟢 Easy ▾");

    await page.reload();
    await h.waitForReady(page);
    await expect(chip).toHaveText("🟢 Easy ▾");
  });

  test("reset player clears progress", async ({ page }) => {
    await h.startNormalGame(page);
    await h.playRound(page, { correctAnswers: 10 });
    await h.expectSummary(page);
    await page.clock.runFor(5000);
    await h.goHomeFromSummary(page);
    expect((await h.readProfile(page)).nonDailyCorrectAnswers).toBe(10);

    page.once("dialog", (dialog) => dialog.accept());
    await h.openPlayerSheet(page);
    await page.locator("#player-reset-btn").click();
    await expect.poll(async () => (await h.readProfile(page)).nonDailyCorrectAnswers).toBe(0);
    await expect(page.locator("#player-sheet")).toBeHidden();
    await h.backToHome(page);
    await h.openScores(page);
    await expect(page.locator("#scores-recent-title").locator("..")).toContainText("No games yet");
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

  // Saved settings and scores from the old version load too. Scores opens on the saved mode.
  await h.openScores(page);
  await expect(page.locator('.mode-switch-btn[data-mode="superHard"]')).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator(".score-list")).toContainText("1,234");
  await expect(page.locator(".game-list").first().locator(".game-row")).toHaveCount(5);
  await expect(page.locator(".game-list").first()).toContainText("Jan 2"); // old-style dates still read well
  await page.keyboard.press("Escape");
  await h.openSettings(page);
  await expect(page.locator('.difficulty-btn[data-mode="superHard"]')).toHaveClass(/active/);
});
