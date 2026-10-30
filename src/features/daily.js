// Daily Challenge: one question set per player per day, completion at 70%+, a daily streak,
// and a +5% base-point bonus for normal games after passing. Each player's set skips the
// questions they've seen recently, so the daily doesn't repeat what they just played.
import { DAILY, QUESTIONS_PER_GAME } from "../config.js";
import { applyDailyCompletion, createDailySeed, sanitizeDailyRecord } from "../lib/records.js";
import { selectQuestionsForMode } from "../lib/selection.js";
import { createSeededRandom, getDateKeyOffset, getLocalDateKey } from "../lib/utils.js";
import { state } from "../state.js";
import { KEYS, readLocal, save, writeLocal } from "../storage/store.js";
import { byId } from "../ui/dom.js";
import { showToast } from "../ui/toast.js";

export const getDailyRecord = (dateKey = getLocalDateKey()) => state.dailyChallenges[dateKey] || null;

export const isDailyBonusActive = (dateKey = getLocalDateKey()) => Boolean(getDailyRecord(dateKey)?.completed);

function selectDailyQuestions(seed) {
  return selectQuestionsForMode(state.questions, DAILY.difficultyMode, createSeededRandom(seed), QUESTIONS_PER_GAME, state.recentQuestionIds);
}

/**
 * The questions for a given attempt at a day's challenge. The first attempt uses the set saved
 * when the player first opened today's challenge (picked from the day's seed, skipping what
 * they'd seen recently). Each retry gets a different set, so a retry can't be passed just by
 * remembering the answers.
 */
export function getDailyAttemptQuestions(record, attemptIndex) {
  const used = new Set();
  let questions = [];
  for (let attempt = 0; attempt <= attemptIndex; attempt++) {
    if (attempt === 0) {
      questions = [];
      const add = (question) => {
        if (question && !questions.some((q) => q.id === question.id) && questions.length < QUESTIONS_PER_GAME) questions.push(question);
      };
      // Saved ids are permanent; fill any gap (e.g. a removed question) from the day's seed.
      record.questionIds.forEach((id) => add(state.questionsById.get(id)));
      if (questions.length < QUESTIONS_PER_GAME) selectDailyQuestions(record.seed).forEach(add);
    } else {
      const unused = state.questions.filter((question) => !used.has(question.id));
      const pool = unused.length >= state.questions.length / 2 ? unused : state.questions;
      questions = selectQuestionsForMode(pool, DAILY.difficultyMode, createSeededRandom(`${record.seed}|retry${attempt}`), QUESTIONS_PER_GAME, state.recentQuestionIds);
    }
    questions.forEach((question) => used.add(question.id));
  }
  return questions;
}

/** Today's record and questions for the next attempt. Throws if today is already completed. */
export async function prepareDailyChallenge() {
  const dateKey = getLocalDateKey();
  let record = getDailyRecord(dateKey);
  if (!record) {
    const seed = createDailySeed(dateKey);
    record = sanitizeDailyRecord({ dateKey, seed, questionIds: selectDailyQuestions(seed).map((q) => q.id), modeVersion: DAILY.modeVersion });
  }
  if (record.completed) {
    throw new Error("Today's daily challenge has already been completed.");
  }
  record.seed = record.seed || createDailySeed(dateKey);

  const attemptIndex = record.startedAttempts;
  const questions = getDailyAttemptQuestions(record, attemptIndex);
  if (questions.length < QUESTIONS_PER_GAME) throw new Error("Unable to build a full daily challenge");

  // Count the attempt as soon as it starts, so quitting mid-round can't be used to preview questions.
  record.startedAttempts += 1;
  state.dailyChallenges[dateKey] = record;
  await save({ dailyRecord: record });
  return { record, questions, attemptNumber: attemptIndex + 1 };
}

/** Records a finished daily round. Returns what the summary needs. */
export function recordDailyResult({ dateKey, score, percent, correct = 0 }) {
  const passed = percent >= DAILY.successPercent;
  const record = sanitizeDailyRecord(getDailyRecord(dateKey) || { dateKey, seed: createDailySeed(dateKey) });
  const firstCompletion = passed && !record.completed;
  record.attempts += 1;
  record.lastScore = score;
  record.bestScore = Math.max(record.bestScore, score);
  record.bestCorrect = Math.max(record.bestCorrect, correct);
  if (passed) {
    record.completed = true;
    record.completedAt = record.completedAt || new Date().toISOString();
  }
  state.dailyChallenges[dateKey] = record;
  state.dailyStats = applyDailyCompletion({ ...state.dailyStats, totalDailyAttempts: state.dailyStats.totalDailyAttempts + 1 }, dateKey, firstCompletion);
  return { record, passed };
}

// ---------- Home's Daily Challenge card ----------

/** The streak as of today: it only counts if the last completed day was today or yesterday. */
export function currentDailyStreak(today = getLocalDateKey()) {
  const { currentDailyStreak: streak, lastCompletedDateKey: last } = state.dailyStats;
  return last === today || last === getDateKeyOffset(today, -1) ? streak : 0;
}

/** Home's Daily Challenge card. Tapping it starts today's challenge; once it's complete the
 *  card turns green and says the +5% bonus is on. Shows "New" until today's is started. */
export function renderDailyCard() {
  const today = getLocalDateKey();
  const record = getDailyRecord(today);
  const shouldPulse = readLocal(KEYS.dailyPulseAckDate) !== today && !record?.completed;
  const card = byId("daily-challenge-link");
  card.classList.toggle("daily-link-pulse", shouldPulse);
  card.classList.toggle("is-complete", Boolean(record?.completed));
  byId("daily-challenge-new-badge").classList.toggle("is-visible", shouldPulse);

  const streak = currentDailyStreak(today);
  const streakText = streak ? `🔥 ${streak}-day streak` : "Start a streak today";
  let status;
  let label;
  if (record?.completed) {
    status = `Done for today · +${Math.round(DAILY.baseBonusMultiplier * 100)}% points on today's rounds`;
    label = `Today's Daily Challenge: done. Plus ${Math.round(DAILY.baseBonusMultiplier * 100)} percent points on today's rounds. ${streak}-day streak`;
  } else if (record?.attempts > 0) {
    const tries = `${record.attempts} ${record.attempts === 1 ? "try" : "tries"}`;
    status = `${tries} · best ${record.bestScore.toLocaleString()} · ${DAILY.successPercent}% needed`;
    label = `Today's Daily Challenge: ${tries}, best ${record.bestScore}, ${DAILY.successPercent} percent needed. Start`;
  } else {
    status = `Not started · ${streakText}`;
    label = `Today's Daily Challenge: not started, ${streak ? `${streak}-day streak` : "no streak yet"}. Start`;
  }
  byId("daily-card-status").textContent = status;
  card.setAttribute("aria-label", label);
  card.querySelector(".daily-card-go").textContent = record?.completed ? "✓" : "›";
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
  // Tapping the card starts today's challenge (the countdown says what it is). Once it's
  // done, a short message says when the next one is ready.
  byId("daily-challenge-link").addEventListener("click", () => {
    if (state.celebrationActive) return;
    const today = getLocalDateKey();
    if (getDailyRecord(today)?.completed) {
      showToast("Today's challenge is done. A new one is ready tomorrow.");
      return;
    }
    writeLocal(KEYS.dailyPulseAckDate, today);
    startDaily();
  });
  renderDailyCard();
  scheduleMidnightRefresh();
}
