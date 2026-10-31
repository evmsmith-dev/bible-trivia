import { test, expect } from "@playwright/test";
import * as h from "./helpers.js";

/** A backup with one player who has played `games` rounds (loaded through Settings). */
function backupWith(games) {
  const history = Array.from({ length: games }, (_, i) => ({
    timestamp: new Date(Date.UTC(2026, 8, 1 + i)).toISOString(), correct: 6, total: 10, score: 900, percent: 60, difficultyMode: "medium",
  }));
  return Buffer.from(JSON.stringify({ app: "bible-trivia", version: 1, activeId: "primary", players: [{ id: "primary", profile: { name: "Dad" }, history }] }));
}

async function loadBackup(page, games) {
  await h.openSettings(page);
  await page.locator("#backup-file").setInputFiles({ name: "backup.json", mimeType: "application/json", buffer: backupWith(games) });
  await page.locator("#backup-confirm-btn").click();
  await h.waitForReady(page);
}

test("after 20 games without a backup, Home suggests one; Not now hides it", async ({ page }) => {
  await h.openApp(page);
  await expect(page.locator("#backup-reminder")).toHaveCount(0);
  await loadBackup(page, 20);
  const reminder = page.locator("#backup-reminder");
  await expect(reminder).toBeVisible();
  await expect(reminder).toContainText("You haven't saved a backup on this device yet.");

  await page.locator("#backup-reminder-later").click();
  await expect(reminder).toHaveCount(0);
  await page.reload();
  await h.waitForReady(page);
  await expect(reminder).toHaveCount(0); // snoozed for a week
});

test("saving from the reminder records the date, shown in Settings", async ({ page }) => {
  await h.openApp(page);
  await h.openSettings(page);
  await expect(page.locator("#backup-last")).toHaveText("No backup saved on this device yet.");
  await h.backToHome(page);
  await loadBackup(page, 25);

  const [download] = await Promise.all([page.waitForEvent("download"), page.locator("#backup-reminder-save").click()]);
  expect(download.suggestedFilename()).toMatch(/^bible-trivia-backup-/);
  await expect(page.locator("#backup-reminder")).toHaveCount(0);
  await expect(page.locator("#toast")).toContainText("Backup saved");
  await h.openSettings(page);
  await expect(page.locator("#backup-last")).toHaveText(/^Last backup: [A-Z][a-z]{2} \d+, \d{4}$/);

  // Starting a round hides the reminder; it's for Home only.
  await h.backToHome(page);
  await page.evaluate(() => localStorage.removeItem("bibleTrivia_lastBackup"));
  await page.reload();
  await h.waitForReady(page);
  await expect(page.locator("#backup-reminder")).toBeVisible();
  await page.locator("#start-btn").click();
  await expect(page.locator("#backup-reminder")).toHaveCount(0);
});
