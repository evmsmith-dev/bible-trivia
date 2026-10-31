import { test, expect } from "@playwright/test";
import fs from "node:fs";
import * as h from "./helpers.js";

async function playAndGoHome(page, correctAnswers) {
  await h.startNormalGame(page);
  await h.playRound(page, { correctAnswers });
  await h.expectSummary(page);
  await page.clock.runFor(16000); // let celebrations finish
  await h.goHomeFromSummary(page);
}

async function saveBackup(page) {
  await h.openSettings(page);
  const [download] = await Promise.all([page.waitForEvent("download"), page.locator("#backup-save-btn").click()]);
  expect(download.suggestedFilename()).toMatch(/^bible-trivia-backup-\d{4}-\d{2}-\d{2}\.json$/);
  await expect(page.locator("#backup-status")).toContainText("Backup saved");
  return download.path();
}

test("a backup saves every player and loading it restores them", async ({ page }) => {
  await h.openApp(page);
  await playAndGoHome(page, 5);
  await h.addPlayer(page, "Mom");
  await playAndGoHome(page, 8);
  await h.openSettings(page);
  await page.locator('.theme-btn[data-value="dark"]').click();
  await h.backToHome(page);

  const file = await saveBackup(page);
  const data = JSON.parse(fs.readFileSync(file, "utf8"));
  expect(data.app).toBe("bible-trivia");
  expect(data.players.map((player) => player.profile.name)).toEqual([expect.any(String), "Mom"]);
  expect(data.players.map((player) => player.history.length)).toEqual([1, 1]);
  expect(data.activeId).toBe(data.players[1].id);
  expect(data.device.theme).toBe("dark");
  expect(Object.keys(data.players[1].badges)).toContain("first-steps"); // badges travel with the backup
  expect(Object.keys(data.players[1].practice)).toHaveLength(2); // so does the practice list (Mom missed 2)
  await h.backToHome(page);

  // Things change after the backup: another round, a new player, light mode.
  await playAndGoHome(page, 3);
  await h.addPlayer(page, "Sam");
  await h.openSettings(page);
  await page.locator('.theme-btn[data-value="light"]').click();

  // Loading the backup asks first, then puts everything back as it was.
  await page.locator("#backup-file").setInputFiles(file);
  await expect(page.locator("#backup-overlay")).toBeVisible();
  await expect(page.locator("#backup-confirm-text")).toContainText("It has 2 players");
  await expect(page.locator("#backup-confirm-text")).toContainText("Mom");
  await page.locator("#backup-confirm-btn").click();
  await h.waitForReady(page);

  // With two players, the app asks who's playing; Sam was added after the backup, so he's gone.
  await expect(page.locator("#players-page")).toBeVisible();
  await expect(page.locator(".player-pick")).toHaveCount(2);
  await page.locator(".player-pick", { hasText: "Mom" }).click();
  await expect(page.locator("#players-page")).toBeHidden();
  await expect(page.locator("#player-entry-name")).toHaveText("Mom");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(page.locator("#how-to-play-overlay")).toBeHidden();
  await h.openScores(page);
  await expect(page.locator(".stat-card").first()).toContainText("1"); // Mom's one game, not two
});

test("Cancel keeps everything, and other files are refused", async ({ page }) => {
  await h.openApp(page);
  await playAndGoHome(page, 5);
  const file = await saveBackup(page);

  await page.locator("#backup-file").setInputFiles(file);
  await page.locator("#backup-cancel-btn").click();
  await expect(page.locator("#backup-overlay")).toBeHidden();
  await expect(page.locator("#settings-overlay")).toBeVisible();

  await page.locator("#backup-file").setInputFiles({ name: "notes.json", mimeType: "application/json", buffer: Buffer.from('{"app":"world-geography-quiz","players":[]}') });
  await expect(page.locator("#backup-status")).toHaveText("That file isn't a Bible Trivia backup.");
  await page.locator("#backup-file").setInputFiles({ name: "photo.json", mimeType: "application/json", buffer: Buffer.from("not json") });
  await expect(page.locator("#backup-status")).toHaveText("That file isn't a Bible Trivia backup.");
  await expect(page.locator("#backup-overlay")).toBeHidden();
});

test("loading a backup isn't undone by the player who was playing before it", async ({ page }) => {
  await h.openApp(page);
  await h.openPlayerSheet(page);
  await page.locator("#player-name-input").fill("Before");
  await page.locator("#player-save-btn").click();
  await h.backToHome(page);
  await expect(page.locator("#player-entry-name")).toHaveText("Before");

  const backup = { app: "bible-trivia", version: 1, activeId: "primary",
    players: [{ id: "primary", profile: { name: "Dad", nonDailyCorrectAnswers: 130, levelPoints: 130, levelCountVersion: 2 } }] };
  await h.openSettings(page);
  await page.locator("#backup-file").setInputFiles({ name: "backup.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(backup)) });
  await page.locator("#backup-confirm-btn").click();
  await h.waitForReady(page);
  await expect(page.locator("#player-entry-name")).toHaveText("Dad");
  await expect(page.locator("#player-entry-level")).toHaveText("Level 4");
});
