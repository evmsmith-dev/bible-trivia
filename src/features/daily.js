// Daily Challenge: one shared question set per day, completion at 70%+, a daily streak,
// and a +5% base-point bonus for normal games after passing.
import { DAILY, QUESTIONS_PER_GAME } from "../config.js";
import { applyDailyCompletion, createDailySeed, sanitizeDailyRecord } from "../lib/records.js";
import { selectQuestionsForMode } from "../lib/selection.js";
import { createSeededRandom, escapeHtml, getLocalDateKey } from "../lib/utils.js";
import { state } from "../state.js";
import { KEYS, readLocal, save, writeLocal } from "../storage/store.js";
import { byId } from "../ui/dom.js";
import { openOverlay } from "../ui/overlay.js";

export const getDailyRecord = (dateKey = getLocalDateKey()) => state.dailyChallenges[dateKey] || null;

export const isDailyBonusActive = (dateKey = getLocalDateKey()) => Boolean(getDailyRecord(dateKey)?.completed);

function selectDailyQuestions(seed) {
  return selectQuestionsForMode(state.questions, DAILY.difficultyMode, createSeededRandom(seed), QUESTIONS_PER_GAME);
}

/** Today's record and questions. Throws if today's challenge is already completed. */
export async function prepareDailyChallenge() {
  const dateKey = getLocalDateKey();
  let record = getDailyRecord(dateKey);
  if (!record) {
    const seed = createDailySeed(dateKey);
    record = sanitizeDailyRecord({ dateKey, seed, questionIds: selectDailyQuestions(seed).map((q) => q.id), modeVersion: DAILY.modeVersion });
    state.dailyChallenges[dateKey] = record;
    await save({ dailyRecord: record });
  }
  if (record.completed) {
    throw new Error("Today's daily challenge has already been completed.");
  }

  // Saved question ids are permanent; fill any gap (e.g. a removed question) from the day's seed.
  const questions = [];
  const seen = new Set();
  const add = (question) => {
    if (question && !seen.has(question.id) && questions.length < QUESTIONS_PER_GAME) {
      seen.add(question.id);
      questions.push(question);
    }
  };
  record.questionIds.forEach((id) => add(state.questionsById.get(id)));
  if (questions.length < QUESTIONS_PER_GAME) selectDailyQuestions(record.seed || createDailySeed(dateKey)).forEach(add);
  if (questions.length < QUESTIONS_PER_GAME) throw new Error("Unable to build a full daily challenge");
  return { record, questions };
}

/** Records a finished daily round. Returns what the summary needs. */
export function recordDailyResult({ dateKey, score, percent }) {
  const passed = percent >= DAILY.successPercent;
  const record = sanitizeDailyRecord(getDailyRecord(dateKey) || { dateKey, seed: createDailySeed(dateKey) });
  const firstCompletion = passed && !record.completed;
  record.attempts += 1;
  record.lastScore = score;
  record.bestScore = Math.max(record.bestScore, score);
  if (passed) {
    record.completed = true;
    record.completedAt = record.completedAt || new Date().toISOString();
  }
  state.dailyChallenges[dateKey] = record;
  state.dailyStats = applyDailyCompletion({ ...state.dailyStats, totalDailyAttempts: state.dailyStats.totalDailyAttempts + 1 }, dateKey, firstCompletion);
  return { record, passed };
}

// ---------- Welcome-screen link and overlay ----------

const statusText = (record) => {
  if (!record) return "Not started";
  if (record.completed) return "Completed";
  return record.attempts > 0 ? "In progress" : "Not started";
};

/** The Daily Challenge link pulses until the player opens it (once per day) or completes the day. */
export function renderDailyCard() {
  const today = getLocalDateKey();
  const record = getDailyRecord(today);
  const shouldPulse = readLocal(KEYS.dailyPulseAckDate) !== today && !record?.completed;
  byId("daily-challenge-link").classList.toggle("daily-link-pulse", shouldPulse);
  byId("daily-challenge-new-badge").classList.toggle("is-visible", shouldPulse);

  byId("daily-challenge-status").innerHTML = `${escapeHtml(statusText(record))}<br>`
    + `Point Bonus: ${isDailyBonusActive(today) ? "Active (+5% base/question)" : "Inactive"}`;
  const startButton = byId("daily-start-btn");
  startButton.disabled = Boolean(record?.completed);
  startButton.textContent = record?.completed ? "Completed for Today" : "Start Today's Challenge";
}

function scheduleMidnightRefresh() {
  const now = new Date();
  const nextDay = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0, 250);
  setTimeout(() => {
    renderDailyCard();
    scheduleMidnightRefresh();
  }, Math.max(1000, nextDay - now));
}

export function initDaily({ startDaily }) {
  byId("daily-challenge-link").addEventListener("click", () => {
    writeLocal(KEYS.dailyPulseAckDate, getLocalDateKey());
    renderDailyCard();
    openOverlay("daily-challenge-overlay");
  });
  byId("daily-start-btn").addEventListener("click", () => {
    if (byId("daily-start-btn").disabled || state.celebrationActive) return;
    startDaily();
  });
  renderDailyCard();
  scheduleMidnightRefresh();
}
