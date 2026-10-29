import { test, expect } from "@playwright/test";
import * as h from "./helpers.js";

test("How to Play opens by itself the first time, then only from Help", async ({ page }) => {
  await h.openApp(page, { firstRunHelp: true });
  const howTo = page.locator("#how-to-play-overlay");
  await expect(howTo).toBeVisible();
  await expect(howTo.locator(".howto-section").first()).toHaveAttribute("open", "");
  await page.keyboard.press("Escape");
  await expect(howTo).toBeHidden();

  await page.reload();
  await h.waitForReady(page);
  await expect(howTo).toBeHidden(); // only the first time

  await page.locator("#how-to-play-link").click();
  await expect(howTo).toBeVisible();
});

test("players who already have games don't get How to Play after updating", async ({ page }) => {
  // A player from before this version: they have a level counter but no "seen" flag.
  await page.addInitScript(() => {
    if (!localStorage.getItem("bibleTriviaPlayer_primary_profile")) {
      localStorage.setItem("bibleTriviaPlayer_primary_profile",
        JSON.stringify({ id: "primary", name: "Dad", avatarId: "emoji-cool", nonDailyCorrectAnswers: 30, levelCountVersion: 2 }));
    }
  });
  await h.openApp(page, { firstRunHelp: true });
  await expect(page.locator("#player-entry-name")).toHaveText("Dad");
  await expect(page.locator("#how-to-play-overlay")).toBeHidden();
});

test("a newly added player sees How to Play once; switching back doesn't show it again", async ({ page }) => {
  await h.openApp(page);
  await h.addPlayer(page, "Mom"); // checks that How to Play opens for Mom

  await h.openWhosPlaying(page);
  await page.locator(".player-pick", { hasText: "Player" }).click();
  await expect(page.locator("#how-to-play-overlay")).toBeHidden();
  await h.openWhosPlaying(page);
  await page.locator(".player-pick", { hasText: "Mom" }).click();
  await expect(page.locator("#how-to-play-overlay")).toBeHidden();
});
