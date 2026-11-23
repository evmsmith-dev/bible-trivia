// Play online: up to 8 players on their own phones answer the same questions at the same time.
// The first right answer gets the point (or, with "Everyone scores", 2 for first and 1 for any
// other right answer), and the most points wins the round.
//
// One player creates a game and shares its code or a link; the others join with it. The host's
// phone picks the questions and moves the game on; every phone works out the scores itself from
// the answers stored on the server (src/lib/race.js), so they always agree. If the host's phone
// goes offline, the next player takes over. Only avatars and answers are shared: no names, no chat.
import { CATEGORY_EMOJIS, DIFFICULTY_LABELS, MODES, MODE_KEYS } from "../config.js";
import { questionResult, resultOf, roundWinners, standings, usedIds, roundsWon } from "../lib/race.js";
import { rememberQuestion, selectQuestionsForMode } from "../lib/selection.js";
import { splitBlank } from "../lib/blank.js";
import { getAvatar, normalizeMode } from "../lib/records.js";
import { bibleGatewayUrl, createSeededRandom, escapeHtml, hasScriptureReference, shuffled } from "../lib/utils.js";
import {
  answersFor, avatarAt, avatarIndex, bankFingerprint, cleanCode, isHost, isOnline, MAX_SEATS, REACTION_GAP_MS, roundNumber,
  REACTIONS, roundIds, ROUND_LENGTHS, SCORING, seatNumber, seatOf, seatsTaken, SEATS, timing,
} from "../online/common.js";
import { getBackend, onlineConfigured } from "../online/backend.js";
import { state } from "../state.js";
import { saveProfile, saveRecentQuestionIds } from "../storage/store.js";
import { byId } from "../ui/dom.js";
import { closeOverlay, isOverlayOpen, openOverlay } from "../ui/overlay.js";
import { fireConfetti } from "../ui/celebrate.js";
import { showToast } from "../ui/toast.js";
import { vibrate, VIBRATION } from "../ui/haptics.js";
import { avatarHtml, renderPlayerCards } from "./player.js";

const SAVED_GAME_KEY = "bibleTrivia_onlineGame"; // the game this device is in, to rejoin it
const SETTINGS_KEY = "bibleTrivia_onlineSettings"; // the last settings used to create a game

let M = null; // the game on screen: { backend, code, seat, game, … }
let bankPrint = null;
let joinError = "";
let busy = false;

const body = () => byId("mp-body");
const myBank = () => (bankPrint ||= bankFingerprint(state.questions));
const myAvatar = () => avatarIndex(state.profile.avatarId);
const readJson = (key) => { try { return JSON.parse(localStorage.getItem(key)); } catch { return null; } };
const writeJson = (key, value) => { try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* storage full or blocked */ } };
export const joinLink = (code) => `${location.origin}${location.pathname}?join=${code}`;

function draftSettings() {
  const saved = readJson(SETTINGS_KEY) || {};
  return {
    m: MODE_KEYS.includes(saved.m) ? saved.m : normalizeMode(state.difficultyMode),
    n: ROUND_LENGTHS.includes(saved.n) ? saved.n : 10,
    s: SCORING[saved.s] ? saved.s : "first",
  };
}

// ---------- Small pieces of markup ----------

const seatAvatar = (game, seat) => avatarHtml(avatarAt(game.p?.[seat]?.a));
const seatName = (seat) => (seat === M?.seat ? "You" : `Player ${seatNumber(seat)}`);
const questionOf = (id) => state.questionsById.get(id);

function questionTextHtml(text, filled = null) {
  const parts = splitBlank(text);
  if (!parts) return escapeHtml(text);
  const blank = filled === null ? '<span class="blank"><span class="visually-hidden">blank</span></span>' : `<span class="blank is-filled">${escapeHtml(filled)}</span>`;
  return `${escapeHtml(parts[0])}${blank}${escapeHtml(parts[1])}`;
}

function settingsHtml(set, editable) {
  if (!editable) {
    const mode = MODES[set.m];
    return `<p class="mp-settings-line">${mode.emoji} ${escapeHtml(mode.label)} · ${set.n} questions · ${escapeHtml(SCORING[set.s].label)}</p>`;
  }
  const seg = (key, value, label, pressed, extra = "") => `<button type="button" class="mp-seg-btn${pressed ? " active" : ""}" data-setting="${key}" data-value="${value}" aria-pressed="${pressed}">${label}${extra}</button>`;
  return `
    <fieldset class="mp-field"><legend>Difficulty</legend><div class="mp-seg">
      ${MODE_KEYS.map((m) => seg("m", m, `${MODES[m].emoji} ${escapeHtml(MODES[m].shortLabel)}`, set.m === m)).join("")}
    </div></fieldset>
    <fieldset class="mp-field"><legend>Questions</legend><div class="mp-seg">
      ${ROUND_LENGTHS.map((n) => seg("n", n, String(n), set.n === n)).join("")}
    </div></fieldset>
    <fieldset class="mp-field"><legend>Scoring</legend><div class="mp-seg mp-seg-wide">
      ${Object.entries(SCORING).map(([s, info]) => seg("s", s, `<strong>${escapeHtml(info.label)}</strong>`, set.s === s, `<span class="mp-seg-detail">${escapeHtml(info.detail)}</span>`)).join("")}
    </div></fieldset>`;
}

function reactionsHtml() {
  return `<div class="mp-reactions" role="group" aria-label="Send a reaction">${REACTIONS.map((emoji, e) => `<button type="button" class="mp-react" data-react="${e}" aria-label="Send ${emoji}">${emoji}</button>`).join("")}</div>`;
}

function playersHtml(game, { answered = null } = {}) {
  return `<ul class="mp-players">${seatsTaken(game).map((seat) => {
    const done = answered?.has(seat);
    const classes = ["mp-player", seat === M.seat ? "is-me" : "", isOnline(game, seat) ? "" : "is-away", done ? "is-done" : ""].filter(Boolean).join(" ");
    const note = [game.hs === seat ? "host" : "", isOnline(game, seat) ? "" : "offline", done ? "answered" : ""].filter(Boolean).join(", ");
    return `<li class="${classes}" data-seat="${seat}" aria-label="${seatName(seat)}${note ? `, ${note}` : ""}">
      <span class="mp-player-avatar">${seatAvatar(game, seat)}${game.hs === seat ? '<span class="mp-crown" aria-hidden="true">👑</span>' : ""}${done ? '<span class="mp-check" aria-hidden="true">✓</span>' : ""}</span>
      <span class="mp-player-name">${seatName(seat)}</span></li>`;
  }).join("")}</ul>`;
}

function scoreboardHtml(game, rows, { limit = 5 } = {}) {
  const shown = rows.slice(0, limit);
  const mine = rows.find((row) => row.seat === M.seat);
  if (mine && !shown.includes(mine)) shown.push(mine);
  return `<ol class="mp-board">${shown.map((row) => `
    <li class="mp-board-row${row.seat === M.seat ? " is-me" : ""}" data-seat="${row.seat}">
      <span class="mp-board-rank">${row.rank}</span>
      <span class="mp-board-avatar" aria-hidden="true">${seatAvatar(game, row.seat)}</span>
      <span class="mp-board-name">${seatName(row.seat)}</span>
      <span class="mp-board-points" data-points="${row.points}">${row.points} ${row.points === 1 ? "pt" : "pts"}</span>
    </li>`).join("")}</ol>`;
}

const namesList = (seats) => {
  const names = seats.map((seat) => (seat === M.seat ? "you" : seatName(seat)));
  if (names.length <= 1) return names.join("");
  return `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`;
};
const capital = (text) => text.charAt(0).toUpperCase() + text.slice(1);

// ---------- Before a game: create or join ----------

function renderSetup() {
  setCodeChip(null);
  if (!onlineConfigured()) {
    body().innerHTML = `<section class="mp-card mp-not-set-up"><h3>Online play isn't set up yet</h3>
      <p>It needs a free Firebase project connected to the app. The steps are in <code>docs/firebase-setup.md</code>.</p></section>`;
    return;
  }
  const saved = readJson(SAVED_GAME_KEY);
  const draft = draftSettings();
  const avatar = getAvatar(state.profile.avatarId);
  body().innerHTML = `
    ${saved?.code ? `<button type="button" id="mp-rejoin" class="mp-rejoin" data-code="${escapeHtml(saved.code)}">↩ Rejoin game <strong>${escapeHtml(saved.code)}</strong></button>` : ""}
    <section class="mp-card">
      <h3>Start a game</h3>
      <p class="mp-hint">Up to ${MAX_SEATS} players, each on their own phone. Everyone gets the same questions, and the first right answer gets the point.</p>
      <div id="mp-settings">${settingsHtml(draft, true)}</div>
      <button type="button" id="mp-create" class="mp-primary">Create game</button>
    </section>
    <section class="mp-card">
      <h3>Join a game</h3>
      <label class="mp-label" for="mp-code-input">Game code</label>
      <div class="mp-join-row">
        <input id="mp-code-input" type="text" inputmode="text" autocapitalize="characters" autocomplete="off" spellcheck="false" maxlength="8" placeholder="K7QF2M" aria-describedby="mp-join-error">
        <button type="button" id="mp-join" class="mp-primary">Join</button>
      </div>
      <p id="mp-join-error" class="field-error" aria-live="polite">${escapeHtml(joinError)}</p>
    </section>
    <p class="mp-you"><span class="mp-you-avatar" aria-hidden="true">${avatarHtml(avatar)}</span> Others see your picture, never your name.</p>`;
}

function setCodeChip(code) {
  const chip = byId("mp-code-chip");
  chip.hidden = !code;
  chip.textContent = code ? `Code ${code}` : "";
}

const joinMessages = {
  "not-found": "There's no game with that code. Check it and try again.",
  full: `That game is full (${MAX_SEATS} players).`,
  version: "That game is on a different version of Bible Trivia. Both phones need the latest version: tap Update on Home, or close and reopen the app.",
  offline: "Couldn't connect. Check your internet connection and try again.",
  "slow-down": "You just made a game. Wait a few seconds and try again.",
};

async function withBackend(task) {
  if (busy) return;
  busy = true;
  try {
    const backend = await getBackend();
    if (!backend) throw new Error("offline");
    await task(backend);
  } catch (error) {
    joinError = joinMessages[error?.message] || joinMessages.offline;
    if (!M) renderSetup();
    else showToast(joinError);
  } finally {
    busy = false;
  }
}

function createGame() {
  withBackend(async (backend) => {
    const settings = draftSettings();
    const code = await backend.create({ avatar: myAvatar(), bank: myBank(), settings });
    await enterGame(backend, code, "s0");
  });
}

function joinGame(rawCode) {
  const code = cleanCode(rawCode);
  if (!code) {
    joinError = "A game code has 6 letters and numbers.";
    renderSetup();
    byId("mp-code-input").value = rawCode || "";
    return;
  }
  withBackend(async (backend) => {
    const game = await backend.read(code);
    if (!game || game.expires < backend.serverNow()) {
      if (readJson(SAVED_GAME_KEY)?.code === code) writeJson(SAVED_GAME_KEY, null);
      throw new Error("not-found");
    }
    if (game.bank !== myBank()) throw new Error("version");
    const { seat } = await backend.join(code, myAvatar());
    await enterGame(backend, code, seat);
  });
}

// ---------- In a game ----------

async function enterGame(backend, code, seat) {
  if (M) leaveGame();
  joinError = "";
  writeJson(SAVED_GAME_KEY, { code });
  M = { backend, code, seat, game: null, view: "", seenRx: null, credited: new Set(), revealUntil: {}, advancing: "", hostGoneSince: 0 };
  setCodeChip(code);
  body().innerHTML = '<p class="mp-status">Connecting…</p>';
  const mine = M;
  mine.unwatch = backend.watch(code, (game) => { if (M === mine) update(game); });
  mine.stopPresence = backend.setPresence(code, seat);
  mine.ticker = setInterval(() => { if (M === mine) tick(); }, 100);
  backend.sweep?.();
}

/** Stops listening to the game (it can be rejoined). `forget` also forgets it on this device. */
function leaveGame({ forget = false } = {}) {
  if (forget) writeJson(SAVED_GAME_KEY, null);
  if (!M) return;
  clearInterval(M.ticker);
  M.unwatch?.();
  M.stopPresence?.();
  M = null;
  setCodeChip(null);
  renderPlayerCards(); // levels may have moved on
}

function update(game) {
  if (!game) {
    leaveGame({ forget: true });
    body().innerHTML = `<section class="mp-card"><h3>This game has ended</h3><p>Online games are removed after a day.</p>
      <button type="button" id="mp-back-setup" class="mp-primary">Start or join another</button></section>`;
    return;
  }
  const first = !M.game;
  M.game = game;
  const seat = seatOf(game, M.backend.uid);
  if (seat) M.seat = seat;
  else retakeSeat();
  showBursts(game, first);
  render(true);
}

/**
 * This phone's anonymous id changed (Firebase's clean-up removed the old account and the app
 * signed in again), so its old seat isn't its own any more: take a new one, once per id.
 */
function retakeSeat() {
  const uid = M.backend.uid;
  if (M.retookFor === uid) return;
  M.retookFor = uid;
  const mine = M;
  M.backend.join(M.code, myAvatar()).then(({ seat }) => {
    if (M !== mine) return;
    M.seat = seat;
    M.stopPresence?.();
    M.stopPresence = M.backend.setPresence(M.code, seat);
    showToast("You were reconnected to the game as a new player.");
  }).catch((error) => {
    if (M === mine) showToast(joinMessages[error?.message] || joinMessages.offline);
  });
}

const now = () => M.backend.serverNow();

function phaseOf(game, at = now()) {
  if (game.st === "lobby") return "lobby";
  if (game.st === "over") return "podium";
  if (at < game.q.at) return "lead";
  return isClosed(game, at) ? "reveal" : "question";
}

function isClosed(game, at = now()) {
  const t = timing(game.set.m);
  if (at >= game.q.at + t.lockMs + t.answerMs) return true;
  const answers = answersFor(game, game.q.r, game.q.i);
  const here = seatsTaken(game).filter((seat) => isOnline(game, seat) || answers[seat]);
  return here.length > 0 && here.every((seat) => answers[seat]);
}

const currentId = (game) => roundIds(game, game.q.r)[game.q.n];
const viewKey = (game, phase) => (phase === "lobby" || phase === "podium" ? phase : `${phase}:${game.q.r}:${game.q.i}`);

/** Draws the current phase. `changed` is true when new data arrived (not just time passing). */
function render(changed = false) {
  const game = M.game;
  if (!game) return;
  const phase = phaseOf(game);
  const key = viewKey(game, phase);
  const fresh = key !== M.view;
  M.view = key;
  if (phase === "question") {
    if (fresh) buildQuestion(game);
    updateQuestion(game);
  } else if (phase === "lead") {
    if (fresh) buildLead(game);
    updateLead(game);
  } else if (fresh || changed) {
    if (phase === "lobby") renderLobby(game);
    else if (phase === "reveal") renderReveal(game, fresh);
    else renderPodium(game, fresh);
  }
}

function tick() {
  const game = M.game;
  if (!game) return;
  render(false);
  const phase = phaseOf(game);
  if (isHost(game, M.backend.uid)) hostDuties(game, phase);
  else watchHost(game);
}

// ---------- The host's phone moves the game on ----------

function pickQuestions(game) {
  const used = new Set(usedIds(game));
  const fresh = state.questions.filter((question) => !used.has(question.id));
  const pool = fresh.length >= game.set.n * 4 ? fresh : state.questions;
  return selectQuestionsForMode(pool, game.set.m, Math.random, game.set.n, state.recentQuestionIds).map((question) => question.id);
}

function startRound() {
  const game = M.game;
  if (!isHost(game, M.backend.uid) || busy) return;
  if (seatsTaken(game).length < 2) { showToast("Wait for at least one more player to join."); return; }
  const ids = pickQuestions(game);
  if (ids.length !== game.set.n) { showToast("Couldn't pick the questions. Try again."); return; }
  M.backend.start(M.code, ids).then((ok) => { if (!ok) showToast(joinMessages.offline); });
}

function advance() {
  const game = M.game;
  const key = `${game.q.r}:${game.q.i}`;
  if (M.advancing === key) return;
  M.advancing = key;
  const last = game.q.n >= game.set.n - 1;
  (last ? M.backend.finish(M.code) : M.backend.next(M.code)).then((ok) => { if (!ok && M) M.advancing = ""; });
}

function hostDuties(game, phase) {
  if (phase !== "reveal") return;
  const key = `${game.q.r}:${game.q.i}`;
  M.revealUntil[key] ||= now() + timing(game.set.m).revealMs;
  if (now() >= M.revealUntil[key]) advance();
}

/** If the host's phone has gone offline for a while, the first player still here takes over. */
function watchHost(game) {
  if (isOnline(game, game.hs)) { M.hostGoneSince = 0; return; }
  M.hostGoneSince ||= now();
  const firstHere = SEATS.find((seat) => game.p?.[seat] && isOnline(game, seat));
  if (firstHere === M.seat && now() - M.hostGoneSince >= timing(game.set.m).hostGoneMs) {
    M.hostGoneSince = now(); // don't ask again straight away
    M.backend.claimHost(M.code, M.seat).then((ok) => { if (ok) showToast("The host left, so you're the host now."); });
  }
}

// ---------- Lobby ----------

function renderLobby(game) {
  const host = isHost(game, M.backend.uid);
  const count = seatsTaken(game).length;
  body().innerHTML = `
    <section class="mp-card mp-lobby">
      <p class="mp-hint">Friends join with this code:</p>
      <p class="mp-big-code" aria-label="Game code ${[...M.code].join(" ")}">${escapeHtml(M.code)}</p>
      <button type="button" id="mp-share" class="mp-secondary">📤 Share invite</button>
      <h3 class="mp-subhead">Players (${count} of ${MAX_SEATS})</h3>
      ${playersHtml(game)}
    </section>
    <section class="mp-card">
      <h3>Game settings</h3>
      <div id="mp-settings">${settingsHtml(game.set, host)}</div>
      ${host
        ? `<button type="button" id="mp-start" class="mp-primary"${count < 2 ? " disabled" : ""}>${count < 2 ? "Waiting for players…" : `Start (${count} players)`}</button>`
        : '<p class="mp-status">Waiting for the host to start…</p>'}
    </section>
    ${reactionsHtml()}
    <button type="button" id="mp-leave" class="link-button mp-leave">Leave game</button>`;
}

// ---------- 3-2-1 before each question ----------

function buildLead(game) {
  body().innerHTML = `<section class="mp-lead" aria-live="polite">
    <p class="mp-lead-title">Question ${game.q.n + 1} of ${game.set.n}</p>
    <p id="mp-lead-count" class="mp-lead-count"></p>
    <p class="mp-hint">Get ready!</p></section>`;
}

function updateLead(game) {
  const count = byId("mp-lead-count");
  if (count) count.textContent = String(Math.max(1, Math.ceil((game.q.at - now()) / 1000)));
}

// ---------- A question ----------

function buildQuestion(game) {
  const id = currentId(game);
  const question = questionOf(id);
  M.picked = null;
  M.unlockedAt = null;
  if (!question) {
    body().innerHTML = `<p class="mp-status">${escapeHtml(joinMessages.version)}</p>`;
    return;
  }
  state.recentQuestionIds = rememberQuestion(state.recentQuestionIds, id, state.questions.length);
  saveRecentQuestionIds(state.recentQuestionIds);
  const difficulty = DIFFICULTY_LABELS[question.difficulty] || { emoji: "", label: question.difficulty };
  // The same order on this phone every time it's drawn, but different from other phones.
  const order = shuffled([0, 1, 2, 3], createSeededRandom(`${M.code}|${game.q.r}|${game.q.i}|${M.backend.uid}`));
  body().innerHTML = `
    <section class="mp-question-card">
      <div class="mp-qtop"><span class="mp-qnum">Question ${game.q.n + 1} of ${game.set.n}</span><span id="mp-timer" class="mp-timer">${MODES[game.set.m].seconds}</span></div>
      <div class="mp-timerbar" aria-hidden="true"><div id="mp-timer-fill"></div></div>
      <div class="question-meta mp-meta">
        <span class="tag difficulty ${escapeHtml(question.difficulty)}">${difficulty.emoji} ${escapeHtml(difficulty.label)}</span>
        <span class="tag category">${CATEGORY_EMOJIS[question.category] || ""} ${escapeHtml(question.category)}</span>
      </div>
      <div id="mp-question" class="mp-question">${questionTextHtml(question.q)}</div>
      <div id="mp-options" class="mp-options is-reading" role="group" aria-label="Answer options">
        ${order.map((choice, place) => `<button type="button" class="option" data-choice="${choice}" disabled>${"ABCD"[place]}) ${escapeHtml(question.opts[choice])}</button>`).join("")}
      </div>
      <p id="mp-status" class="mp-status" aria-live="polite"></p>
      <div id="mp-seats"></div>
    </section>`;
}

function updateQuestion(game) {
  const t = timing(game.set.m);
  const opens = game.q.at + t.lockMs;
  const at = now();
  const options = byId("mp-options");
  if (!options) return;
  if (at >= opens && M.unlockedAt === null) {
    // When the answers unlocked, on this phone's own clock (a late tick doesn't count against you).
    M.unlockedAt = performance.now() - (at - opens);
    options.classList.remove("is-reading");
    if (M.picked === null) options.querySelectorAll(".option").forEach((button) => { button.disabled = false; });
  }
  const left = at < opens ? t.answerMs : Math.max(0, opens + t.answerMs - at);
  const seconds = Math.ceil(left / 1000 / (t.answerMs / 1000 / MODES[game.set.m].seconds));
  const timer = byId("mp-timer");
  timer.textContent = String(seconds);
  const fraction = left / t.answerMs;
  timer.className = `mp-timer ${fraction <= 0.18 ? "red" : fraction <= 0.35 ? "yellow" : "green"}`;
  const fill = byId("mp-timer-fill");
  fill.style.width = `${fraction * 100}%`;
  fill.className = fraction <= 0.18 ? "danger" : fraction <= 0.35 ? "warning" : "";

  const answers = answersFor(game, game.q.r, game.q.i);
  const answered = new Set(Object.keys(answers));
  const here = seatsTaken(game).filter((seat) => isOnline(game, seat) || answered.has(seat));
  const status = at < opens ? "Read the question…"
    : M.picked !== null || answers[M.seat] ? `Locked in! Waiting for others (${answered.size} of ${here.length} answered)`
      : "Tap your answer. One try!";
  const statusEl = byId("mp-status");
  if (statusEl.textContent !== status) statusEl.textContent = status;
  const seatsHtml = playersHtml(game, { answered });
  const seatsEl = byId("mp-seats");
  if (seatsEl.dataset.html !== seatsHtml) { seatsEl.innerHTML = seatsHtml; seatsEl.dataset.html = seatsHtml; }
}

function pickAnswer(button) {
  const game = M?.game;
  if (!game || phaseOf(game) !== "question" || M.picked !== null || M.unlockedAt === null || button.disabled) return;
  const choice = Number(button.dataset.choice);
  M.picked = choice;
  const ms = performance.now() - M.unlockedAt;
  byId("mp-options").querySelectorAll(".option").forEach((b) => { b.disabled = true; b.classList.toggle("is-picked", b === button); });
  const { r, i } = game.q;
  M.backend.answer(M.code, { r, i, seat: M.seat, choice, ms }).then((ok) => {
    if (!ok && M?.game?.q?.i === i) showToast("Your answer didn't reach the game in time.");
  });
  render(false);
}

// ---------- Between questions ----------

function renderReveal(game, fresh) {
  const id = currentId(game);
  const question = questionOf(id);
  if (!question) return;
  const result = resultOf(game, state.questionsById, game.q.r, game.q.n) || questionResult({}, question.ans, NaN);
  const mine = result.bySeat[M.seat];
  if (fresh) creditMe(game, mine, result);

  let headline;
  if (!result.firsts.length) headline = "Nobody got that one.";
  else if (result.firsts.length === 1) headline = result.firsts[0] === M.seat ? "You got it first! 🎉" : `${seatName(result.firsts[0])} got it first!`;
  else headline = `${capital(namesList(result.firsts))} tied for first!`;
  const myLine = !mine ? "You didn't answer in time."
    : mine.points ? `+${mine.points} for you`
      : mine.correct ? "Right, but someone was faster." : "Not quite this time.";

  const pickers = (choice) => Object.entries(result.bySeat).filter(([, a]) => a.choice === choice).map(([seat]) => seat);
  const host = isHost(game, M.backend.uid);
  const last = game.q.n >= game.set.n - 1;
  const ref = String(question.ref || "").trim();
  body().innerHTML = `
    <section class="mp-question-card mp-reveal">
      <p class="mp-qnum">Question ${game.q.n + 1} of ${game.set.n}</p>
      <p class="mp-reveal-headline" aria-live="polite">${escapeHtml(headline)}</p>
      <p class="mp-reveal-mine${mine?.points ? " is-good" : ""}">${escapeHtml(myLine)}</p>
      <div class="mp-question">${questionTextHtml(question.q, question.opts[question.ans])}</div>
      <ul class="mp-reveal-options">
        ${[0, 1, 2, 3].filter((choice) => choice === question.ans || pickers(choice).length).sort((a, b) => (b === question.ans) - (a === question.ans)).map((choice) => `
          <li class="option ${choice === question.ans ? "correct" : mine?.choice === choice ? "incorrect" : "grayed"}">
            <span>${choice === question.ans ? "✅ " : ""}${escapeHtml(question.opts[choice])}</span>
            <span class="mp-pickers">${pickers(choice).map((seat) => `<span class="mp-picker" title="${seatName(seat)}">${seatAvatar(game, seat)}</span>`).join("")}</span>
          </li>`).join("")}
      </ul>
      ${hasScriptureReference(ref) ? `<p class="mp-ref"><a href="${escapeHtml(bibleGatewayUrl(ref))}" target="_blank" rel="noopener">📖 ${escapeHtml(ref)}</a></p>` : ""}
    </section>
    <section class="mp-card">
      <h3 class="mp-subhead">Scores</h3>
      ${scoreboardHtml(game, standings(game, state.questionsById))}
      ${host ? `<button type="button" id="mp-next" class="mp-primary">${last ? "See results ›" : "Next question ›"}</button>`
        : `<p class="mp-status">${last ? "Results in a moment…" : "Next question in a moment…"}</p>`}
    </section>
    ${reactionsHtml()}`;
}

/** Right answers count toward this player's level, as in a normal game (weighted by mode). */
function creditMe(game, mine, result) {
  const key = `${M.code}:${game.q.r}:${game.q.i}`;
  if (M.credited.has(key) || !mine) return;
  M.credited.add(key);
  if (mine.correct) {
    state.profile.nonDailyCorrectAnswers += 1;
    state.profile.levelPoints += MODES[game.set.m].levelWeight;
    saveProfile(state.profile);
  }
  if (result.firsts.includes(M.seat)) {
    vibrate(VIBRATION.correct);
    fireConfetti({ particleCount: 70, spread: 70, origin: { y: 0.5 } });
  } else if (!mine.correct) {
    vibrate(VIBRATION.wrong);
  }
}

// ---------- End of a round ----------

function renderPodium(game, fresh) {
  const rows = standings(game, state.questionsById);
  const winners = roundWinners(game, state.questionsById, game.q.r);
  const wins = roundsWon(game, state.questionsById); // rounds won in this game, across every Play again
  const host = isHost(game, M.backend.uid);
  const headline = !winners.length ? "Nobody scored this round."
    : winners.length === 1 ? (winners[0] === M.seat ? "You won the round! 🏆" : `${seatName(winners[0])} won the round!`)
      : `${capital(namesList(winners))} share the win!`;
  if (fresh && winners.includes(M.seat)) fireConfetti({ particleCount: 140, spread: 90, origin: { y: 0.4 } });
  const podium = rows.filter((row) => row.rank <= 3);
  const rest = rows.filter((row) => row.rank > 3);
  const medal = (rank) => ["🥇", "🥈", "🥉"][rank - 1];
  const rounds = roundNumber(game.q.r) + 1; // rounds played in this game (shown from the second one on)
  body().innerHTML = `
    <section class="mp-card mp-podium">
      <p class="mp-reveal-headline" aria-live="polite">${escapeHtml(headline)}</p>
      <ol class="mp-board mp-podium-list">${podium.map((row) => `
        <li class="mp-board-row${row.seat === M.seat ? " is-me" : ""}" data-seat="${row.seat}">
          <span class="mp-board-rank" aria-label="Place ${row.rank}">${medal(row.rank)}</span>
          <span class="mp-board-avatar" aria-hidden="true">${seatAvatar(game, row.seat)}</span>
          <span class="mp-board-name">${seatName(row.seat)}</span>
          <span class="mp-board-points" data-points="${row.points}">${row.points} ${row.points === 1 ? "pt" : "pts"} · ${row.correct} right</span>
        </li>`).join("")}</ol>
      ${rest.length ? `<p class="mp-rest">Also playing: ${rest.map((row) => `<span class="mp-picker" title="${seatName(row.seat)}">${seatAvatar(game, row.seat)}</span>`).join("")}</p>` : ""}
      ${rounds > 1 ? `<p class="mp-wins">Rounds won: ${seatsTaken(game).map((seat) => `<span class="mp-win" data-seat="${seat}" aria-label="${seatName(seat)}: ${wins[seat] || 0}">${seatAvatar(game, seat)} ${wins[seat] || 0}</span>`).join(" ")}</p>` : ""}
    </section>
    <section class="mp-card">
      ${host ? `<h3>Play again?</h3><div id="mp-settings">${settingsHtml(game.set, true)}</div>
        <button type="button" id="mp-start" class="mp-primary">Play again</button>`
        : '<p class="mp-status">Waiting for the host to start another round…</p>'}
    </section>
    ${reactionsHtml()}
    <button type="button" id="mp-leave" class="link-button mp-leave">Leave game</button>`;
}

// ---------- Reactions ----------

function showBursts(game, first) {
  const rx = game.rx || {};
  if (first || !M.seenRx) { M.seenRx = Object.fromEntries(Object.entries(rx).map(([seat, r]) => [seat, r.at])); return; }
  const layer = byId("mp-bursts");
  for (const [seat, r] of Object.entries(rx)) {
    if (M.seenRx[seat] === r.at || !REACTIONS[r.e]) continue;
    M.seenRx[seat] = r.at;
    const burst = document.createElement("span");
    burst.className = "mp-burst";
    burst.textContent = REACTIONS[r.e];
    burst.style.left = `${10 + ((SEATS.indexOf(seat) * 37) % 80)}%`;
    layer.appendChild(burst);
    setTimeout(() => burst.remove(), 2200);
  }
}

let lastReaction = -Infinity;
function sendReaction(e) {
  if (!M || performance.now() - lastReaction < REACTION_GAP_MS) return;
  lastReaction = performance.now();
  M.backend.react(M.code, e, M.seat);
}

// ---------- Settings, sharing, opening ----------

function changeSetting(key, value) {
  const parse = key === "n" ? Number(value) : value;
  if (!M) {
    writeJson(SETTINGS_KEY, { ...draftSettings(), [key]: parse });
    byId("mp-settings").innerHTML = settingsHtml(draftSettings(), true);
    return;
  }
  const next = { ...M.game.set, [key]: parse };
  writeJson(SETTINGS_KEY, next);
  M.backend.setSettings(M.code, next).then((ok) => { if (!ok) showToast(joinMessages.offline); });
}

async function shareInvite() {
  const url = joinLink(M.code);
  const text = `Play Bible Trivia with me! Game code ${M.code}`;
  try {
    if (navigator.share) { await navigator.share({ title: "Bible Trivia", text, url }); return; }
    await navigator.clipboard.writeText(`${text}: ${url}`);
    showToast("Invite link copied");
  } catch (error) {
    if (error?.name !== "AbortError") showToast(`Game code: ${M.code}`);
  }
}

/** Opens Play online. With `code`, joins that game straight away (from a join link). */
export function openMultiplayer({ code = null } = {}) {
  if (!state.questions.length) return;
  joinError = "";
  if (!isOverlayOpen("mp-page")) openOverlay("mp-page", { onClose: () => leaveGame() });
  if (M) { render(true); return; }
  renderSetup();
  if (code && onlineConfigured()) joinGame(code);
}

export function initMultiplayer() {
  byId("home-online-btn").addEventListener("click", () => openMultiplayer());
  const page = byId("mp-page");
  page.addEventListener("click", (event) => {
    const target = event.target.closest("button");
    if (!target || target.disabled) return;
    if (target.classList.contains("option") && target.dataset.choice !== undefined) pickAnswer(target);
    else if (target.dataset.setting) changeSetting(target.dataset.setting, target.dataset.value);
    else if (target.dataset.react !== undefined) sendReaction(Number(target.dataset.react));
    else if (target.id === "mp-create") createGame();
    else if (target.id === "mp-join") joinGame(byId("mp-code-input").value);
    else if (target.id === "mp-rejoin") joinGame(target.dataset.code);
    else if (target.id === "mp-start") startRound();
    else if (target.id === "mp-next") advance();
    else if (target.id === "mp-share") shareInvite();
    else if (target.id === "mp-leave") { leaveGame({ forget: true }); renderSetup(); }
    else if (target.id === "mp-back-setup") renderSetup();
  });
  page.addEventListener("keydown", (event) => {
    if (event.target.id === "mp-code-input" && event.key === "Enter") { event.preventDefault(); joinGame(event.target.value); return; }
    if (event.ctrlKey || event.metaKey || event.altKey || event.target instanceof HTMLInputElement) return;
    const index = "1234".indexOf(event.key) >= 0 ? "1234".indexOf(event.key) : "abcd".indexOf(event.key.toLowerCase());
    if (event.key.length !== 1 || index < 0) return;
    const button = byId("mp-options")?.querySelectorAll(".option")[index];
    if (button) pickAnswer(button);
  });

  // A join link (…/?join=K7QF2M) opens Play online with that game.
  const params = new URLSearchParams(location.search);
  const code = params.get("join");
  if (code) {
    params.delete("join");
    const rest = params.toString();
    history.replaceState(history.state, "", `${location.pathname}${rest ? `?${rest}` : ""}${location.hash}`);
    openMultiplayer({ code });
  }
}
