// Play online, with several tabs playing each other through the local test backend (localStorage +
// BroadcastChannel stand in for Firebase; src/online/local-backend.js applies the same checks as
// the server rules). window.__TRIVIA_FAST runs every online timing at a tenth of its real length.
import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import * as h from "./helpers.js";

const QUESTIONS = new Map(JSON.parse(readFileSync(new URL("../../data/questions.json", import.meta.url), "utf8")).map((q) => [q.id, q]));
const STORE = "bibleTrivia_localServer";

async function setUp(context, { backend = "local" } = {}) {
  await context.addInitScript((kind) => {
    window.__TRIVIA_BACKEND = kind;
    window.__TRIVIA_FAST = true;
  }, backend);
}

async function newPlayer(context, path = "index.html") {
  const page = await context.newPage();
  await h.skipFirstRunHelp(page);
  await page.goto(path);
  await h.waitForReady(page);
  return page;
}

async function openOnline(page) {
  await page.locator("#home-online-btn").click();
  await expect(page.locator("#mp-page")).toBeVisible();
}

/** Creates a game from Home with the given settings; returns its code. */
async function createGame(page, { questions = 5, scoring = "first" } = {}) {
  await openOnline(page);
  await page.locator(`[data-setting="n"][data-value="${questions}"]`).click();
  await page.locator(`[data-setting="s"][data-value="${scoring}"]`).click();
  await page.locator("#mp-create").click();
  const code = page.locator(".mp-big-code");
  await expect(code).toHaveText(/^[A-HJKMNP-Z2-9]{6}$/);
  return code.textContent();
}

async function joinGame(page, code) {
  await openOnline(page);
  await page.locator("#mp-code-input").fill(code.toLowerCase());
  await page.locator("#mp-join").click();
  await expect(page.locator(".mp-lobby")).toBeVisible();
}

const readGame = (page, code) => page.evaluate(([key, c]) => JSON.parse(localStorage.getItem(key))[c], [STORE, code]);

/** The current question's record from the server, once its answers can be tapped on `page`. */
async function openQuestion(page, code) {
  await expect(page.locator("#mp-options .option").first()).toBeEnabled();
  const game = await readGame(page, code);
  const id = Number(game.qs[game.q.r].split(",")[game.q.n]);
  return { game, question: QUESTIONS.get(id) };
}

async function answer(page, code, { correct }) {
  const { question } = await openQuestion(page, code);
  const choice = correct ? question.ans : (question.ans + 1) % 4;
  await page.locator(`#mp-options .option[data-choice="${choice}"]`).click();
}

const headline = (page) => page.locator(".mp-reveal-headline");

test("three players: same questions, the first right answer scores, and the most points wins", async ({ context }) => {
  await setUp(context);
  const host = await newPlayer(context);
  const code = await createGame(host);
  const p2 = await newPlayer(context);
  await joinGame(p2, code);
  const p3 = await newPlayer(context, `index.html?join=${code}`); // a join link opens the game at once
  await expect(p3.locator(".mp-lobby")).toBeVisible();
  await expect(host.locator(".mp-lobby .mp-player")).toHaveCount(3);
  await expect(p2.locator("#mp-start")).toHaveCount(0); // only the host can start
  await expect(p2.locator(".mp-status")).toHaveText("Waiting for the host to start…");

  await host.locator("#mp-start").click();
  // Everyone sees the same question (each phone shuffles the answers its own way).
  await expect(p3.locator("#mp-options .option").first()).toBeEnabled();
  const text = await host.locator("#mp-question").textContent();
  await expect(p2.locator("#mp-question")).toHaveText(text);
  await expect(p3.locator("#mp-question")).toHaveText(text);

  // Question 1: Player 2 is right first, Player 3 right later, the host is wrong.
  await answer(p2, code, { correct: true });
  await expect(p2.locator("#mp-status")).toContainText("Locked in!");
  await p3.waitForTimeout(400);
  await answer(p3, code, { correct: true });
  await answer(host, code, { correct: false });
  await expect(headline(p2)).toHaveText("You got it first! 🎉");
  await expect(headline(p3)).toHaveText("Player 2 got it first!");
  await expect(p3.locator(".mp-reveal-mine")).toHaveText("Right, but someone was faster.");
  await expect(host.locator(".mp-reveal-mine")).toHaveText("Not quite this time.");
  await expect(p2.locator(".mp-board-row.is-me .mp-board-points")).toHaveText("1 pt");

  // Questions 2–5: only the host is right.
  for (let n = 2; n <= 5; n++) {
    await expect(host.locator(".mp-qnum")).toHaveText(`Question ${n} of 5`);
    await answer(host, code, { correct: true });
    await answer(p2, code, { correct: false });
    await answer(p3, code, { correct: false });
    await expect(headline(host)).toHaveText("You got it first! 🎉");
  }
  await expect(headline(host)).toHaveText("You won the round! 🏆");
  await expect(headline(p2)).toHaveText("Player 1 won the round!");
  await expect(p2.locator(".mp-podium-list .mp-board-row").first()).toHaveAttribute("data-seat", "s0");
  await expect(p2.locator("#mp-start")).toHaveCount(0);

  // Right answers count toward the player's level. (The three tabs share one saved player, and
  // the host's tab saved last: its 4 right answers.)
  const profile = await h.readProfile(host);
  expect(profile.nonDailyCorrectAnswers).toBe(4);

  // Play again: everyone moves into a new round together, with none of the same questions.
  await host.locator("#mp-start").click();
  await expect(p2.locator("#mp-options .option").first()).toBeEnabled();
  const game = await readGame(host, code);
  const first = game.qs.r0.split(",");
  expect(game.qs.r1.split(",").some((id) => first.includes(id))).toBe(false);
  await expect(p3.locator(".mp-qnum")).toHaveText("Question 1 of 5");
});

test("a wrong tap locks you out, and the question closes when time runs out", async ({ context }) => {
  await setUp(context);
  const host = await newPlayer(context);
  const code = await createGame(host);
  const p2 = await newPlayer(context);
  await joinGame(p2, code);
  await host.locator("#mp-start").click();
  await answer(host, code, { correct: false });
  await expect(host.locator("#mp-options .option:enabled")).toHaveCount(0);
  await expect(host.locator("#mp-options .option.is-picked")).toHaveCount(1);
  // Player 2 never answers: the question waits for them until time is up.
  await expect(p2.locator("#mp-status")).toHaveText("Tap your answer. One try!");
  await expect(headline(host)).toHaveText("Nobody got that one.", { timeout: 8000 });
  await expect(p2.locator(".mp-reveal-mine")).toHaveText("You didn't answer in time.");
  await expect(p2.locator(".mp-reveal-options .option.correct")).toHaveCount(1);
});

test("Everyone scores: 2 points for first and 1 for another right answer", async ({ context }) => {
  await setUp(context);
  const host = await newPlayer(context);
  const code = await createGame(host, { scoring: "everyone" });
  const p2 = await newPlayer(context);
  await joinGame(p2, code);
  await expect(p2.locator(".mp-settings-line")).toContainText("Everyone scores");
  await host.locator("#mp-start").click();
  await answer(host, code, { correct: true });
  await p2.waitForTimeout(500);
  await answer(p2, code, { correct: true });
  await expect(headline(p2)).toHaveText("Player 1 got it first!");
  await expect(p2.locator(".mp-reveal-mine")).toHaveText("+1 for you");
  await expect(host.locator(".mp-reveal-mine")).toHaveText("+2 for you");

  // Near-ties (right within 250 ms) are checked in tests/unit/race.test.js: two browser tabs can't
  // reliably tap that close together.
});

test("the host leaving hands the game to the next player", async ({ context }) => {
  await setUp(context);
  const host = await newPlayer(context);
  const code = await createGame(host);
  const p2 = await newPlayer(context);
  await joinGame(p2, code);
  const p3 = await newPlayer(context);
  await joinGame(p3, code);
  await expect(p2.locator(".mp-player.is-me .mp-crown")).toHaveCount(0);
  await host.close();
  await expect(p2.locator("#mp-start")).toBeVisible({ timeout: 5000 });
  await expect(p2.locator(".mp-player.is-me .mp-crown")).toHaveCount(1);
  await expect(p3.locator("#mp-start")).toHaveCount(0);
  await p2.locator("#mp-start").click();
  await expect(p3.locator("#mp-options .option").first()).toBeEnabled();
});

test("leaving and coming back rejoins the same seat", async ({ context }) => {
  await setUp(context);
  const host = await newPlayer(context);
  const code = await createGame(host);
  const p2 = await newPlayer(context);
  await joinGame(p2, code);
  await p2.keyboard.press("Escape");
  await expect(p2.locator("#mp-page")).toBeHidden();
  await expect(host.locator('.mp-player[data-seat="s1"]')).toHaveClass(/is-away/);
  await openOnline(p2);
  await p2.locator("#mp-rejoin").click();
  await expect(p2.locator(".mp-lobby")).toBeVisible();
  await expect(host.locator(".mp-player")).toHaveCount(2);
  await expect(host.locator('.mp-player[data-seat="s1"]')).not.toHaveClass(/is-away/);
});

test("a player whose anonymous account was replaced takes a new seat", async ({ context }) => {
  await setUp(context);
  const host = await newPlayer(context);
  const code = await createGame(host);
  const p2 = await newPlayer(context);
  await joinGame(p2, code);
  await expect(p2.locator('.mp-player.is-me')).toHaveAttribute("data-seat", "s1");
  // Firebase's clean-up removed Player 2's account; the app signed in again with a new id.
  await p2.evaluate(() => window.__triviaNewUid());
  await host.locator('[data-setting="m"][data-value="easy"]').click(); // any change reaches Player 2
  await expect(p2.locator(".toast")).toHaveText("You were reconnected to the game as a new player.");
  await expect(p2.locator('.mp-player.is-me')).toHaveAttribute("data-seat", "s2");
  await expect(host.locator(".mp-lobby .mp-player")).toHaveCount(3);
});

test("reactions float up on everyone's screen", async ({ context }) => {
  await setUp(context);
  const host = await newPlayer(context);
  const code = await createGame(host);
  const p2 = await newPlayer(context);
  await joinGame(p2, code);
  await p2.locator('.mp-react[data-react="0"]').click();
  await expect(host.locator(".mp-burst")).toHaveText("👏");
});

test("wrong codes, other app versions and the host's settings are explained", async ({ context }) => {
  await setUp(context);
  const host = await newPlayer(context);
  const code = await createGame(host, { questions: 10 });
  const p2 = await newPlayer(context);
  await openOnline(p2);
  await p2.locator("#mp-code-input").fill("ABC");
  await p2.locator("#mp-join").click();
  await expect(p2.locator("#mp-join-error")).toHaveText("A game code has 6 letters and numbers.");
  await p2.locator("#mp-code-input").fill(code === "ZZZZZZ" ? "YYYYYY" : "ZZZZZZ");
  await p2.locator("#mp-join").click();
  await expect(p2.locator("#mp-join-error")).toHaveText("There's no game with that code. Check it and try again.");

  // A game made with a different question bank (another version of the app) can't be joined.
  await p2.evaluate(([key, c]) => {
    const all = JSON.parse(localStorage.getItem(key));
    all[c].bank = "0000000000000000";
    localStorage.setItem(key, JSON.stringify(all));
  }, [STORE, code]);
  await p2.reload();
  await h.waitForReady(p2);
  await openOnline(p2);
  await p2.locator("#mp-code-input").fill(code);
  await p2.locator("#mp-join").click();
  await expect(p2.locator("#mp-join-error")).toContainText("different version of Bible Trivia");
});

test("the host can change the settings in the lobby, and everyone sees them", async ({ context }) => {
  await setUp(context);
  const host = await newPlayer(context);
  const code = await createGame(host);
  const p2 = await newPlayer(context);
  await joinGame(p2, code);
  await host.locator('[data-setting="m"][data-value="hard"]').click();
  await expect(p2.locator(".mp-settings-line")).toHaveText("🔴 Hard · 5 questions · First correct");
  await host.locator("#mp-start").click();
  await expect(p2.locator(".mp-meta .tag.difficulty")).toHaveText(/Medium|Hard/); // Hard mode mixes 🟠 and 🔴
});

test("making games back to back is slowed down", async ({ context }) => {
  await setUp(context);
  const host = await newPlayer(context);
  await createGame(host);
  await host.locator("#mp-leave").click();
  await host.locator("#mp-create").click();
  await expect(host.locator("#mp-join-error")).toHaveText("You just made a game. Wait a few seconds and try again.");
  await host.waitForTimeout(1100); // the tests run timings at a tenth: 10 s → 1 s
  await host.locator("#mp-create").click();
  await expect(host.locator(".mp-big-code")).toHaveText(/^[A-HJKMNP-Z2-9]{6}$/);
});

test("without Firebase set up, Play online says so", async ({ context }) => {
  await setUp(context, { backend: "off" });
  const page = await newPlayer(context);
  await openOnline(page);
  await expect(page.locator(".mp-not-set-up h3")).toHaveText("Online play isn't set up yet");
  await page.keyboard.press("Escape");
  await expect(page.locator("#start-btn")).toBeVisible();
});

test("online play keeps to the Content Security Policy", async ({ context }) => {
  await setUp(context);
  const violations = [];
  context.on("console", (message) => { if (/Content Security Policy/i.test(message.text())) violations.push(message.text()); });
  context.on("weberror", (error) => violations.push(String(error.error())));
  const host = await newPlayer(context);
  const code = await createGame(host);
  const p2 = await newPlayer(context);
  await joinGame(p2, code);
  await host.locator("#mp-start").click();
  await answer(host, code, { correct: true });
  await answer(p2, code, { correct: true });
  await expect(headline(host)).toBeVisible();
  expect(violations).toEqual([]);
});
