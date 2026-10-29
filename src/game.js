// The game loop: countdown → questions (timer, answers, scoring) → review → summary.
import {
  CATEGORIES, CATEGORY_EMOJIS, DAILY, DIFFICULTY_LABELS, GAME_MODE_DAILY, GAME_MODE_NORMAL,
  INCORRECT_MESSAGES, MODES, QUESTIONS_PER_GAME, RECENT_QUESTION_MEMORY, TIMING,
} from "./config.js";
import { buildDailyShareText } from "./lib/share.js";
import { getTopScores, normalizeMode, trimHighScores } from "./lib/records.js";
import { calculatePoints, getNextStreakBonusLabel, getStreakBonus } from "./lib/scoring.js";
import { selectQuestionsForMode } from "./lib/selection.js";
import { bibleGatewayUrl, escapeHtml, getLocalDateKey, hasScriptureReference, pickRandom, shuffled } from "./lib/utils.js";
import { state } from "./state.js";
import { save, saveProfile, saveRecentQuestionIds } from "./storage/store.js";
import { byId, replayAnimation, setVisible, showScreen } from "./ui/dom.js";
import { celebrateDailyCompletion, celebrateHighScore, celebrateLevel, fireConfetti } from "./ui/celebrate.js";
import { anyOverlayOpen, closeOverlay, openOverlay } from "./ui/overlay.js";
import { isDailyBonusActive, prepareDailyChallenge, recordDailyResult, renderDailyCard } from "./features/daily.js";
import { getPlayerLevel, openPlayerOverlay, renderPlayerCards } from "./features/player.js";
import { showUpdateBannerIfReady } from "./ui/update-banner.js";
import { vibrate, VIBRATION } from "./ui/haptics.js";

const el = {};
let timerHandle = null;
let advanceHandle = null;
let secondsLeft = 0;
let answerLocked = true;
let pendingCelebrations = null;

const activeMode = () => (state.game.mode === GAME_MODE_DAILY ? DAILY.difficultyMode : normalizeMode(state.difficultyMode));

// ---------- streak HUD ----------

function updateStreakHud({ animate = false } = {}) {
  el.streakCount.textContent = `Streak: ${state.bonusStreak}`;
  el.streakBonus.textContent = `Bonus: +${getStreakBonus(state.bonusStreak)}`;
  el.streakNext.textContent = getNextStreakBonusLabel(state.bonusStreak);
  if (animate) replayAnimation(el.streakHud, "bump");
}

function resetBonusStreak() {
  state.bonusStreak = 0;
  updateStreakHud();
}

// ---------- starting a round ----------

/** 3-2-1 before a round. A tap anywhere on the countdown starts the round straight away. */
function runCountdown(onDone) {
  let count = TIMING.countdownSeconds;
  let finished = false;
  el.countdownNumber.textContent = count;
  setVisible(el.countdownOverlay, true, "flex");
  const finish = () => {
    if (finished) return;
    finished = true;
    clearInterval(interval);
    el.countdownOverlay.onclick = null;
    setVisible(el.countdownOverlay, false);
    onDone();
  };
  el.countdownOverlay.onclick = finish;
  const interval = setInterval(() => {
    count -= 1;
    if (count > 0) {
      el.countdownNumber.textContent = count;
      el.countdownNumber.style.animation = "none";
      void el.countdownNumber.offsetWidth; // restart the pop-in animation
      el.countdownNumber.style.animation = "";
      return;
    }
    finish();
  }, 1000);
}

function showQuestionLayout(visible) {
  el.header.style.display = visible ? "" : "none";
  setVisible(el.question, visible);
  setVisible(el.questionMeta, visible, "flex");
  setVisible(el.options, visible, "grid");
  setVisible(el.feedback, visible);
}

function beginRound({ mode, questions, dailyRecord = null, attemptNumber = 1 }) {
  Object.assign(state.game, {
    mode,
    dailyRecord,
    attemptNumber,
    questions: questions.slice(0, QUESTIONS_PER_GAME),
    index: 0,
    correct: 0,
    score: 0,
    streak: 0,
    maxStreak: 0,
    review: [],
    startLevel: getPlayerLevel(),
    active: true,
  });
  setVisible(el.summary, false);
  setVisible(el.review, false);
  clearPause();
  showQuestionLayout(true);
  updateStreakHud();
  showQuestion();
}

/** Starts a normal round. `keepStreak` is true for "Play" from the summary. */
export function startNormalGame({ keepStreak = false } = {}) {
  if (state.celebrationActive || !state.questions.length) return;
  if (!keepStreak) resetBonusStreak();
  showScreen("game");
  runCountdown(() => beginRound({
    mode: GAME_MODE_NORMAL,
    questions: selectQuestionsForMode(state.questions, normalizeMode(state.difficultyMode), Math.random, QUESTIONS_PER_GAME, state.recentQuestionIds),
  }));
}

export function startDailyGame() {
  if (state.celebrationActive) return;
  resetBonusStreak();
  closeOverlay("daily-challenge-overlay");
  showScreen("game");
  runCountdown(async () => {
    try {
      const { record, questions, attemptNumber } = await prepareDailyChallenge();
      beginRound({ mode: GAME_MODE_DAILY, questions, dailyRecord: record, attemptNumber });
    } catch (error) {
      alert(/already been completed/i.test(error.message)
        ? "Today's Daily Challenge is already completed. Come back tomorrow."
        : "Could not load today's challenge. Please try again.");
      goHome();
    }
  });
}

// ---------- questions ----------

function renderProgress() {
  const { game } = state;
  const prefix = game.mode === GAME_MODE_DAILY ? "Daily | " : "";
  el.progress.textContent = `${prefix}Question ${Math.min(game.index + 1, QUESTIONS_PER_GAME)} of ${QUESTIONS_PER_GAME} | Correct: ${game.correct} | Score: ${game.score}`;
  el.scoreDisplay.textContent = `⭐ ${game.score.toLocaleString()}`;
  setVisible(el.dailyTag, game.mode === GAME_MODE_DAILY, "inline-flex");
  // Answered questions show ✅ (correct) or ❌ (wrong or timed out) as soon as they're answered.
  el.progressDots.innerHTML = Array.from({ length: QUESTIONS_PER_GAME }, (_, i) => {
    const answered = game.review[i];
    if (answered) return answered.isCorrect ? '<span class="done">✅</span>' : '<span class="missed">❌</span>';
    return i === game.index ? '<span class="current">🔵</span>' : '<span class="pending">⚪</span>';
  }).join("");
  const wrong = game.review.filter((entry) => !entry.isCorrect).length;
  el.progressDots.setAttribute("aria-label", `Question ${Math.min(game.index + 1, QUESTIONS_PER_GAME)} of ${QUESTIONS_PER_GAME}: ${game.correct} correct, ${wrong} wrong`);
}

function showQuestion() {
  const { game } = state;
  if (game.index >= game.questions.length) {
    endGame();
    return;
  }
  const question = game.questions[game.index];
  const correctText = question.opts[question.ans];
  rememberSeen(question.id);

  el.question.textContent = question.q;
  const difficulty = DIFFICULTY_LABELS[question.difficulty] || { emoji: "", label: question.difficulty };
  el.difficultyTag.textContent = `${difficulty.emoji} ${difficulty.label}`;
  el.difficultyTag.className = `tag difficulty ${question.difficulty}`;
  el.categoryTag.textContent = `${CATEGORY_EMOJIS[question.category] || ""} ${question.category}`;

  el.options.innerHTML = "";
  shuffled(question.opts).forEach((option, i) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "option";
    button.textContent = `${"ABCD"[i]}) ${option}`;
    button.dataset.correct = String(option === correctText);
    button.dataset.answer = option;
    el.options.appendChild(button);
  });

  answerLocked = false;
  renderProgress();
  startTimer();
}

/** Remembers shown questions so later rounds can prefer ones the player hasn't seen recently. */
function rememberSeen(id) {
  const recent = state.recentQuestionIds.filter((recentId) => recentId !== id);
  recent.push(id);
  state.recentQuestionIds = recent.slice(-RECENT_QUESTION_MEMORY);
  saveRecentQuestionIds(state.recentQuestionIds);
}

// Time left is computed from a deadline, so it stays accurate when the browser throttles
// timers. When the app goes to the background the timer pauses instead (see pauseRound),
// and `fromSeconds` restarts it with the time that was left.
function startTimer(fromSeconds = null) {
  const limit = MODES[activeMode()].seconds;
  const start = fromSeconds ?? limit;
  const deadline = performance.now() + start * 1000;
  secondsLeft = start;
  stopTimer();
  const tick = () => {
    secondsLeft = Math.max(0, (deadline - performance.now()) / 1000);
    el.timerDisplay.textContent = Math.ceil(secondsLeft);
    el.timerFill.style.width = `${(secondsLeft / limit) * 100}%`;
    const danger = secondsLeft <= TIMING.timerDangerSeconds;
    const warning = !danger && secondsLeft <= TIMING.timerWarningSeconds;
    el.timerFill.className = danger ? "danger" : warning ? "warning" : "";
    el.timerDisplay.className = danger ? "red" : warning ? "yellow" : "green";
    if (secondsLeft <= 0) handleAnswer(null);
  };
  tick();
  timerHandle = setInterval(tick, 100);
}

function stopTimer() {
  clearInterval(timerHandle);
  timerHandle = null;
}

// ---------- pausing when the app goes to the background ----------

let pausedSecondsLeft = null;

/** Stops the clock on an unanswered question and covers it until the player taps Resume. */
function pauseRound() {
  if (!timerHandle || answerLocked) return;
  stopTimer();
  pausedSecondsLeft = secondsLeft;
  answerLocked = true;
  setVisible(el.pauseOverlay, true, "flex");
}

function resumeRound() {
  if (pausedSecondsLeft === null) return;
  setVisible(el.pauseOverlay, false);
  const remaining = pausedSecondsLeft;
  pausedSecondsLeft = null;
  answerLocked = false;
  startTimer(remaining);
}

// ---------- ending a round early ----------

let endRoundRequested = false;

/** The ✕ in the header. Stops the clock while the player decides; Keep Playing picks up where it left off. */
function askToEndRound() {
  if (!state.game.active) return;
  let resume = () => {};
  if (timerHandle && !answerLocked) {
    stopTimer();
    const remaining = secondsLeft;
    answerLocked = true;
    resume = () => {
      answerLocked = false;
      startTimer(remaining);
    };
  } else if (advanceHandle) {
    clearTimeout(advanceHandle);
    advanceHandle = null;
    resume = () => {
      state.game.index += 1;
      showQuestion();
    };
  }
  endRoundRequested = false;
  openOverlay("quit-overlay", {
    initialFocus: "#quit-keep-btn",
    onClose: () => {
      if (!endRoundRequested) resume();
    },
  });
}

function clearPause() {
  pausedSecondsLeft = null;
  setVisible(el.pauseOverlay, false);
}

function showFeedback(message, type, detail = "") {
  el.feedback.innerHTML = "";
  const line = document.createElement("div");
  line.className = "feedback-main";
  line.textContent = message;
  el.feedback.appendChild(line);
  if (detail) {
    const detailLine = document.createElement("div");
    detailLine.className = "feedback-detail";
    detailLine.textContent = detail;
    el.feedback.appendChild(detailLine);
  }
  el.feedback.className = type;
  void el.feedback.offsetHeight;
  el.feedback.classList.add("visible");
  setTimeout(() => {
    el.feedback.classList.remove("visible");
    el.feedback.classList.add("fading");
  }, TIMING.feedbackShowMs);
}

function recordCorrectAnswer(question, elapsedSeconds) {
  const { game, playerStats } = state;
  const mode = activeMode();
  playerStats.totalCorrectClicks += 1;
  playerStats.correctCountByMode[mode] += 1;
  playerStats.correctSecondsByMode[mode] += Math.max(0, Math.round(elapsedSeconds));
  if (playerStats.correctByCategory[question.category] !== undefined) playerStats.correctByCategory[question.category] += 1;
  playerStats.currentStreak += 1;
  playerStats.allTimeBestStreak = Math.max(playerStats.allTimeBestStreak, playerStats.currentStreak);

  if (game.mode !== GAME_MODE_DAILY) {
    // Levels count normal-game answers only. Saved right away so progress survives closing the app.
    state.profile.nonDailyCorrectAnswers += 1;
    saveProfile(state.profile);
  }
  game.streak += 1;
  game.maxStreak = Math.max(game.maxStreak, game.streak);
  state.bonusStreak += 1;
}

function recordIncorrectAnswer() {
  state.playerStats.currentStreak = 0;
  state.game.streak = 0;
  resetBonusStreak();
}

/** `selectedButton` is null when time runs out. */
function handleAnswer(selectedButton) {
  if (answerLocked) return;
  answerLocked = true;
  stopTimer();

  const { game } = state;
  const question = game.questions[game.index];
  const isCorrect = selectedButton?.dataset.correct === "true";
  const buttons = [...el.options.querySelectorAll(".option")];
  buttons.forEach((button) => {
    button.disabled = true;
    if (button.dataset.correct === "true") button.classList.add("correct");
    else button.classList.add("grayed");
  });

  if (isCorrect) {
    recordCorrectAnswer(question, MODES[activeMode()].seconds - secondsLeft);
    const points = calculatePoints({
      mode: activeMode(),
      secondsLeft,
      streak: state.bonusStreak,
      dailyBonusActive: isDailyBonusActive(),
      dailyBonusMultiplier: DAILY.baseBonusMultiplier,
    });
    game.score += points.total;
    game.correct += 1;
    const parts = [`+${points.base} base`];
    if (points.speedBonus) parts.push(`+${points.speedBonus} speed`);
    if (points.streakBonus) parts.push(`+${points.streakBonus} streak`);
    if (points.dailyBonus) parts.push(`+${points.dailyBonus} daily`);
    showFeedback(`+${points.total} pts`, "correct", parts.join(" · "));
    updateStreakHud({ animate: true });
    vibrate(VIBRATION.correct);
    fireConfetti({ particleCount: 80, spread: 70, origin: { y: 0.6 } });
  } else {
    recordIncorrectAnswer();
    vibrate(VIBRATION.wrong);
    if (selectedButton) {
      selectedButton.classList.remove("grayed");
      selectedButton.classList.add("incorrect");
    }
    showFeedback(
      selectedButton ? pickRandom(INCORRECT_MESSAGES) : "Time's up!",
      selectedButton ? "incorrect" : "timeout",
      `Answer: ${question.opts[question.ans]}`,
    );
  }

  game.review.push({
    question: question.q,
    selectedAnswer: selectedButton ? selectedButton.dataset.answer : "No answer selected (timed out)",
    isCorrect,
    correctAnswer: question.opts[question.ans],
    scriptureRef: String(question.ref || "").trim(),
  });
  renderProgress();

  advanceHandle = setTimeout(() => {
    advanceHandle = null;
    game.index += 1;
    showQuestion();
  }, isCorrect ? TIMING.autoAdvanceCorrectMs : TIMING.autoAdvanceWrongMs);
}

// ---------- end of round ----------

async function endGame() {
  const { game } = state;
  game.active = false;
  showQuestionLayout(false);

  const percent = Math.round((game.correct / QUESTIONS_PER_GAME) * 100);
  const isDaily = game.mode === GAME_MODE_DAILY;
  const mode = activeMode();
  state.playerStats.lastGameMaxStreak = game.maxStreak;

  let isNewHighScore = false;
  let dailyResult = null;
  const changes = { playerStats: state.playerStats };

  if (isDaily) {
    const dateKey = game.dailyRecord?.dateKey || getLocalDateKey();
    dailyResult = recordDailyResult({ dateKey, score: game.score, percent });
    Object.assign(changes, { dailyRecord: dailyResult.record, dailyStats: state.dailyStats });
  } else {
    const record = {
      timestamp: new Date().toISOString(),
      correct: game.correct,
      total: QUESTIONS_PER_GAME,
      score: game.score,
      percent,
      difficultyMode: mode,
      categories: Object.fromEntries(CATEGORIES.map((category) => [
        category, game.questions.filter((question) => question.category === category).length,
      ])),
    };
    const previousBest = getTopScores(state.highScores, mode, 1)[0]?.score;
    isNewHighScore = game.score > 0 && (previousBest === undefined || game.score > previousBest);
    state.highScores = trimHighScores([...state.highScores, {
      score: game.score, timestamp: record.timestamp, correct: game.correct, total: QUESTIONS_PER_GAME, difficultyMode: mode,
    }]);
    state.history.push(record);
    Object.assign(changes, { addHistory: record, highScores: state.highScores });
  }

  const historyId = await save(changes);
  if (changes.addHistory && historyId !== undefined) changes.addHistory.id = historyId;

  renderSummary({ percent, isDaily, dailyResult });

  // Celebrations play when the player reaches the summary (after the review, if any).
  pendingCelebrations = {
    highScore: isNewHighScore ? game.score : null,
    level: !isDaily && getPlayerLevel() > game.startLevel ? getPlayerLevel() : null,
    dailyCompleted: Boolean(dailyResult?.passed),
  };
  showSummary(pendingCelebrations);
}

function showReview() {
  const cards = state.game.review.map((entry, index) => `
    <article class="review-card">
      <div class="review-header">
        <h3 class="review-question-title">Q${index + 1}. ${escapeHtml(entry.question)}</h3>
        <span class="review-result-badge ${entry.isCorrect ? "correct" : "incorrect"}">${entry.isCorrect ? "Correct" : "Incorrect"}</span>
      </div>
      <p class="review-row"><strong>Your answer:</strong> ${escapeHtml(entry.selectedAnswer)}</p>
      <p class="review-row"><strong>Correct answer:</strong> ${escapeHtml(entry.correctAnswer)}</p>
      <p class="review-row"><strong>Verse(s):</strong> ${escapeHtml(entry.scriptureRef || "No scripture reference provided")}</p>
      ${hasScriptureReference(entry.scriptureRef)
        ? `<a class="review-link" href="${escapeHtml(bibleGatewayUrl(entry.scriptureRef))}" target="_blank" rel="noopener noreferrer">Open in Bible Gateway (NIV)</a>`
        : ""}
    </article>`).join("");

  el.review.innerHTML = `
    <h2>Round Review</h2>
    <p id="round-review-subtitle">Review the questions from your last completed round.</p>
    <section id="review-questions-list">${cards}</section>
    <div id="round-review-actions"><button type="button" id="review-continue">Back to Results</button></div>`;
  byId("review-continue").addEventListener("click", () => {
    showSummary(null);
    byId("summary-review-btn")?.focus({ preventScroll: true });
  });
  setVisible(el.summary, false);
  setVisible(el.review, true);
  el.review.scrollTop = 0;
  byId("review-continue").focus({ preventScroll: true });
}

function renderSummary({ percent, isDaily, dailyResult }) {
  const { game } = state;
  let dailyHtml = "";
  if (isDaily) {
    const record = dailyResult.record;
    dailyHtml = `
      <p class="summary-daily-best"><strong>Today's Best: ${record.bestScore}</strong> • Attempts: ${record.attempts}</p>
      <p class="summary-daily-status"><strong>${dailyResult.passed
        ? `Daily challenge complete (${DAILY.successPercent}%+).`
        : `Daily challenge not completed. Reach ${DAILY.successPercent}% or higher to complete.`}</strong></p>
      <p class="summary-daily-streak"><strong>Daily Streak:</strong> ${state.dailyStats.currentDailyStreak} (Best ${state.dailyStats.bestDailyStreak})</p>`;
  }
  const carryBonus = getStreakBonus(state.bonusStreak);
  const carryBanner = !isDaily && carryBonus > 0
    ? `<div class="streak-carryover-banner" role="status">
         <span class="streak-carryover-badge">Hot Streak</span>
         <span><strong>Current Bonus: +${carryBonus}.</strong> Keep playing now to keep your streak bonus active.</span>
       </div>`
    : "";

  el.summary.innerHTML = `
    <h2>${isDaily ? "Daily Challenge Summary" : "Game Summary"}</h2>
    <div class="summary-stats">
      <p>You got <strong>${game.correct}</strong> right out of ${QUESTIONS_PER_GAME} (${percent}%).</p>
      <p><strong>Total Score: ${game.score} points</strong></p>
      ${dailyHtml}
    </div>
    <button type="button" id="summary-review-btn">📖 Review Answers</button>
    <div class="summary-player-wrap">
      <button id="summary-player-btn" type="button" aria-label="Open player profile"></button>
      <span id="summary-player-name" class="summary-player-name"></span>
      <span id="summary-player-level" class="summary-player-level"></span>
    </div>
    ${carryBanner}
    <div class="summary-actions">
      ${isDaily ? '<button type="button" id="share-daily-btn">📤 Share Result</button><p id="share-status" class="share-status" role="status"></p>' : ""}
      ${isDaily ? "" : '<button type="button" id="restart-same">&#9654; Play</button>'}
      <button type="button" id="restart-change">&#x1F3E0; Home</button>
    </div>`;
  renderPlayerCards();

  byId("restart-same")?.addEventListener("click", () => {
    if (!state.celebrationActive) startNormalGame({ keepStreak: true });
  });
  byId("restart-change").addEventListener("click", () => {
    if (!state.celebrationActive) goHome();
  });
  byId("summary-player-btn").addEventListener("click", openPlayerOverlay);
  byId("summary-review-btn").addEventListener("click", () => {
    if (!state.celebrationActive) showReview();
  });
  byId("share-daily-btn")?.addEventListener("click", () => shareDailyResult(dailyResult.record.dateKey));
}

async function shareDailyResult(dateKey) {
  const { game } = state;
  const text = buildDailyShareText({
    dateKey,
    results: game.review.map((entry) => entry.isCorrect),
    score: game.score,
    attemptNumber: game.attemptNumber,
    url: location.href.split(/[?#]/)[0].replace(/index\.html$/, ""),
  });
  const status = byId("share-status");
  if (navigator.share) {
    try {
      await navigator.share({ text });
      return;
    } catch (error) {
      if (error?.name === "AbortError") return; // player closed the share sheet
    }
  }
  try {
    await navigator.clipboard.writeText(text);
    status.textContent = "Result copied — paste it anywhere to share.";
  } catch {
    status.textContent = text;
  }
}

function showSummary(celebrations) {
  setVisible(el.review, false);
  setVisible(el.summary, true, ""); // "" lets the stylesheet choose block or grid (landscape)
  pendingCelebrations = null;
  if (celebrations?.highScore !== null && celebrations?.highScore !== undefined) celebrateHighScore(celebrations.highScore);
  if (celebrations?.level) {
    setTimeout(() => celebrateLevel(celebrations.level), celebrations.highScore ? 3800 : 0);
  }
  if (celebrations?.dailyCompleted) celebrateDailyCompletion();
}

export function goHome() {
  clearTimeout(advanceHandle);
  stopTimer();
  clearPause();
  state.game.active = false;
  resetBonusStreak();
  showScreen("welcome");
  renderPlayerCards();
  renderDailyCard();
  showUpdateBannerIfReady();
}

// ---------- setup ----------

export function initGame() {
  Object.assign(el, {
    header: document.querySelector("#question-container > header"),
    progress: byId("progress"),
    progressDots: byId("progress-dots"),
    streakHud: byId("streak-hud"),
    streakCount: byId("streak-hud-count"),
    streakBonus: byId("streak-hud-bonus"),
    streakNext: byId("streak-hud-next"),
    timerDisplay: byId("timer-display"),
    timerFill: byId("timer-fill"),
    question: byId("question"),
    questionMeta: document.querySelector(".question-meta"),
    scoreDisplay: byId("score-display"),
    dailyTag: byId("daily-tag"),
    difficultyTag: byId("difficulty-tag"),
    categoryTag: byId("category-tag"),
    options: byId("options"),
    feedback: byId("feedback"),
    summary: byId("summary"),
    pauseOverlay: byId("pause-overlay"),
    review: byId("round-review"),
    countdownOverlay: byId("countdown-overlay"),
    countdownNumber: byId("countdown-number"),
  });

  el.options.addEventListener("click", (event) => {
    const button = event.target.closest(".option");
    if (button && !button.disabled) handleAnswer(button);
  });

  // Keys 1–4 or A–D answer the current question (the answers are labelled A–D).
  document.addEventListener("keydown", (event) => {
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    const index = "1234".indexOf(event.key) >= 0 ? "1234".indexOf(event.key) : "abcd".indexOf(event.key.toLowerCase());
    if (event.key.length !== 1 || index < 0 || answerLocked || anyOverlayOpen()) return;
    if (event.target instanceof HTMLInputElement) return;
    const button = el.options.querySelectorAll(".option")[index];
    if (button && !button.disabled) handleAnswer(button);
  });

  byId("start-btn").addEventListener("click", () => startNormalGame());
  byId("pause-resume-btn").addEventListener("click", resumeRound);
  byId("quit-btn").addEventListener("click", askToEndRound);
  byId("quit-confirm-btn").addEventListener("click", () => {
    endRoundRequested = true;
    closeOverlay("quit-overlay");
    goHome();
  });
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") pauseRound();
  });
  updateStreakHud();
}
