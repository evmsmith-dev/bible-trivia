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

test("each How to Play heading keeps its +/− on its own row, even when the heading wraps", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 700 }); // narrow enough for long headings to wrap
  await h.openApp(page);
  await page.locator("#how-to-play-link").click();
  const summaries = page.locator("#how-to-play-overlay .howto-section summary");
  const count = await summaries.count();
  expect(count).toBeGreaterThan(5);
  for (let i = 0; i < count; i++) {
    const summary = summaries.nth(i);
    // The heading's text must leave room on its right for the sign; when it didn't, the sign
    // dropped onto a line of its own below the heading.
    const room = await summary.evaluate((el) => {
      const range = document.createRange();
      range.selectNodeContents(el);
      const textRight = Math.max(...[...range.getClientRects()].map((r) => r.right));
      return el.getBoundingClientRect().right - parseFloat(getComputedStyle(el).paddingRight) - textRight;
    });
    expect(room, await summary.textContent()).toBeGreaterThanOrEqual(30);
  }
  const online = page.locator("#how-to-play-overlay .howto-section", { hasText: "Play Online" });
  await online.locator("summary").click();
  expect(await online.locator("summary").evaluate((el) => getComputedStyle(el, "::after").content)).toBe('"−"');
});
