import { test, expect } from "@playwright/test";
import * as h from "./helpers.js";

async function playOneRound(page, correctAnswers) {
  await h.startNormalGame(page);
  await h.playRound(page, { correctAnswers });
  await h.expectSummary(page);
  await page.clock.runFor(16000); // let celebrations finish
  await h.goHomeFromSummary(page);
}

const gamesPlayed = (page) => page.locator(".stat-card").first();

test.describe("several players on one device", () => {
  test.beforeEach(async ({ page }) => {
    await h.openApp(page);
  });

  test("the existing player stays first, and each player keeps their own scores", async ({ page }) => {
    await playOneRound(page, 10);
    await h.openWhosPlaying(page);
    await expect(page.locator(".player-tile")).toHaveCount(2); // the player + "Add player"
    await expect(page.locator(".player-tile.is-active")).toContainText("Player");
    await page.locator("#players-page .page-back").click();

    await h.addPlayer(page, "Mom");
    await h.openScores(page);
    await expect(gamesPlayed(page)).toContainText("0");
    await h.backToHome(page);
    await playOneRound(page, 4);

    // Switch back: the first player's game is still theirs alone.
    await h.openWhosPlaying(page);
    await page.locator(".player-pick", { hasText: "Player" }).click();
    await expect(page.locator("#players-page")).toBeHidden();
    await expect(page.locator("#player-entry-name")).toHaveText("Player");
    await expect(page.locator("#player-entry-level")).toHaveText("Level 1");
    await h.openScores(page);
    await expect(gamesPlayed(page)).toContainText("1");
    await expect(page.locator(".score-row").first()).toContainText("10/10");

    // The first player's data is still saved under its original names.
    expect((await h.readProfile(page)).nonDailyCorrectAnswers).toBe(10);
  });

  test("each player has their own difficulty; light/dark is shared", async ({ page }) => {
    await h.openSettings(page);
    await page.locator('.theme-btn[data-value="dark"]').click();
    await page.keyboard.press("Escape");

    await h.addPlayer(page, "Sam");
    await expect(page.locator("#mode-chip")).toHaveText("🟠 Medium ▾");
    await page.locator("#mode-chip").click();
    await page.locator('.difficulty-btn[data-mode="easy"]').click();
    await page.keyboard.press("Escape");
    await expect(page.locator("#mode-chip")).toHaveText("🟢 Easy ▾");
    expect(await page.evaluate(() => document.documentElement.dataset.theme)).toBe("dark");

    await h.openWhosPlaying(page);
    await page.locator(".player-pick", { hasText: "Player" }).click();
    await expect(page.locator("#mode-chip")).toHaveText("🟠 Medium ▾");
    expect(await page.evaluate(() => document.documentElement.dataset.theme)).toBe("dark");
  });

  test("with two or more players, the app asks who's playing at launch", async ({ page }) => {
    await page.reload();
    await h.waitForReady(page);
    await expect(page.locator("#players-page")).toBeHidden(); // just one player: straight to Home

    await h.addPlayer(page, "Mom");
    await page.reload();
    await expect(page.locator("#players-page")).toBeVisible();
    await expect(page.locator(".player-tile.is-active")).toContainText("Mom"); // last player is marked
    await page.locator("#players-page .page-back").click(); // Back keeps the last player
    await expect(page.locator("#player-entry-name")).toHaveText("Mom");

    await page.reload();
    await page.locator(".player-pick", { hasText: "Player" }).click();
    await expect(page.locator("#player-entry-name")).toHaveText("Player");
  });

  test("deleting a player removes everything saved for them", async ({ page }) => {
    await h.addPlayer(page, "Guest");
    await playOneRound(page, 6);
    const guestId = await page.evaluate(() => JSON.parse(localStorage.getItem("bibleTrivia_players")).activeId);

    // Delete the current player: the app switches to the other player first.
    page.once("dialog", (dialog) => dialog.accept());
    await h.openPlayerSheet(page);
    await expect(page.locator("#player-reset-btn")).toBeHidden(); // with others, it's Delete
    await page.locator("#player-delete-btn").click();
    await expect(page.locator("#player-sheet")).toBeHidden();
    await expect(page.locator(".player-tile")).toHaveCount(2);
    await expect(page.locator(".player-tile.is-active")).toContainText("Player");
    await h.backToHome(page);
    await expect(page.locator("#player-entry-name")).toHaveText("Player");

    const leftovers = await page.evaluate(async (id) => ({
      keys: Object.keys(localStorage).filter((key) => key.includes(`_${id}_`)),
      databases: (await indexedDB.databases()).map((db) => db.name).filter((name) => name.endsWith(id)),
      players: JSON.parse(localStorage.getItem("bibleTrivia_players")).ids,
    }), guestId);
    expect(leftovers).toEqual({ keys: [], databases: [], players: ["primary"] });

    // The only player left can be reset, not deleted.
    await h.openPlayerSheet(page);
    await expect(page.locator("#player-delete-btn")).toBeHidden();
    await expect(page.locator("#player-reset-btn")).toBeVisible();
  });

  test("editing another player's name doesn't change who's playing", async ({ page }) => {
    await h.addPlayer(page, "Mom");
    await h.openWhosPlaying(page);
    const playerTile = page.locator(".player-tile", { hasText: "Player" });
    await playerTile.locator(".player-edit").click();
    await page.locator("#player-name-input").fill("Dad");
    await page.locator("#player-save-btn").click();
    await expect(page.locator(".player-tile", { hasText: "Dad" })).toBeVisible();
    await expect(page.locator(".player-tile.is-active")).toContainText("Mom");
    await h.backToHome(page);
    await expect(page.locator("#player-entry-name")).toHaveText("Mom");
  });

  test("Scores has Me / Everyone once a second player joins", async ({ page }) => {
    await playOneRound(page, 9);
    await h.openScores(page);
    await expect(page.locator(".scores-tab")).toHaveCount(0); // one player: no tabs
    await h.backToHome(page);

    await h.addPlayer(page, "Mom");
    await playOneRound(page, 10);
    await h.openScores(page);
    await page.locator('.scores-tab[data-view="everyone"]').click();
    const rows = page.locator(".everyone-row");
    await expect(rows).toHaveCount(2);
    await expect(rows.nth(0)).toContainText("Mom (you)"); // 10/10 beats 9/10
    await expect(rows.nth(0)).toContainText("🥇");
    await expect(rows.nth(1)).toContainText("Player");
    await expect(rows.nth(1)).toContainText("1 game");

    // A mode nobody has played yet.
    await page.locator('.mode-switch-btn[data-mode="hard"]').click();
    await expect(page.locator("#scores-everyone-title")).toHaveText("Best Hard score");
    await expect(rows.nth(0).locator(".everyone-best")).toHaveText("–");
  });

  test("a device holds up to 8 players", async ({ page }) => {
    for (let i = 2; i <= 8; i++) await h.addPlayer(page, `Kid ${i}`);
    await h.openWhosPlaying(page);
    await expect(page.locator(".player-pick")).toHaveCount(8);
    await expect(page.locator("#player-add-btn")).toHaveCount(0);
  });
});

test("light/dark saved by the previous version moves to the shared setting", async ({ page }) => {
  await page.addInitScript(() => {
    if (!sessionStorage.getItem("seeded")) {
      localStorage.setItem("bibleTriviaPlayer_primary_theme", "dark");
      sessionStorage.setItem("seeded", "1");
    }
  });
  await h.openApp(page);
  expect(await page.evaluate(() => document.documentElement.dataset.theme)).toBe("dark");
  expect(await page.evaluate(() => [localStorage.getItem("bibleTrivia_theme"), localStorage.getItem("bibleTriviaPlayer_primary_theme")]))
    .toEqual(["dark", null]);
  await page.reload();
  await h.waitForReady(page);
  expect(await page.evaluate(() => document.documentElement.dataset.theme)).toBe("dark");
});
