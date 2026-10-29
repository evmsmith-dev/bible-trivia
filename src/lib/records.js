// Shapes of everything the app saves, plus sanitizers that repair or default bad data.
// Field names match what earlier versions stored, so existing players keep their progress.
import { AVATARS, CATEGORIES, DAILY, DEFAULT_MODE, MAX_HIGH_SCORES_PER_MODE, MODE_KEYS, PLAYER_NAME, REVIEW_PREFERENCE_KEYS } from "../config.js";
import { getDateKeyOffset, toCount } from "./utils.js";

export function normalizeMode(mode) {
  if (typeof mode !== "string") return DEFAULT_MODE;
  const lower = mode.trim().toLowerCase();
  if (lower === "super hard" || lower === "superhard") return "superHard";
  return MODE_KEYS.includes(lower) ? lower : DEFAULT_MODE;
}

export function normalizeReviewPreference(value) {
  if (typeof value !== "string") return "ask";
  const lower = value.trim().toLowerCase().replace(/\s+/g, "");
  return REVIEW_PREFERENCE_KEYS.find((key) => key.toLowerCase() === lower) || "ask";
}

// ---------- Player profile ----------

/** Trimmed name if it's 2–15 characters, otherwise null. */
export function sanitizePlayerName(name) {
  const trimmed = String(name ?? "").trim();
  return trimmed.length >= PLAYER_NAME.min && trimmed.length <= PLAYER_NAME.max ? trimmed : null;
}

export const getAvatar = (avatarId) => AVATARS.find((avatar) => avatar.id === avatarId) || AVATARS[0];

export function createDefaultProfile() {
  return { id: "primary", name: PLAYER_NAME.default, avatarId: AVATARS[0].id, nonDailyCorrectAnswers: 0, levelCountVersion: 2 };
}

export function sanitizeProfile(raw) {
  const value = raw && typeof raw === "object" ? raw : {};
  return {
    id: "primary",
    name: sanitizePlayerName(value.name) || PLAYER_NAME.default,
    avatarId: AVATARS.some((avatar) => avatar.id === value.avatarId) ? value.avatarId : AVATARS[0].id,
    nonDailyCorrectAnswers: toCount(value.nonDailyCorrectAnswers),
    // 2 = nonDailyCorrectAnswers excludes Daily Challenge answers (older versions mixed them in).
    levelCountVersion: value.levelCountVersion === 2 ? 2 : 1,
  };
}

/**
 * Older versions copied lifetime correct answers (including Daily Challenge answers) into the
 * level counter. Rebuild it once from normal-game history, which never contains daily games.
 */
export function reconcileLevelCounter(profile, history) {
  if (profile.levelCountVersion === 2) return profile;
  const fromHistory = history.reduce((sum, game) => sum + toCount(Number(game?.correct)), 0);
  return {
    ...profile,
    nonDailyCorrectAnswers: history.length > 0 ? fromHistory : profile.nonDailyCorrectAnswers,
    levelCountVersion: 2,
  };
}

// ---------- Lifetime stats ----------

const zeroByMode = () => Object.fromEntries(MODE_KEYS.map((mode) => [mode, 0]));
const zeroByCategory = () => Object.fromEntries(CATEGORIES.map((category) => [category, 0]));

export function sanitizePlayerStats(raw) {
  const value = raw && typeof raw === "object" ? raw : {};
  const stats = {
    key: "lifetime",
    totalCorrectClicks: toCount(value.totalCorrectClicks),
    correctSecondsByMode: zeroByMode(),
    correctCountByMode: zeroByMode(),
    correctByCategory: zeroByCategory(),
    currentStreak: toCount(value.currentStreak),
    allTimeBestStreak: toCount(value.allTimeBestStreak),
    lastGameMaxStreak: toCount(value.lastGameMaxStreak),
  };
  for (const mode of MODE_KEYS) {
    stats.correctSecondsByMode[mode] = toCount(value.correctSecondsByMode?.[mode]);
    stats.correctCountByMode[mode] = toCount(value.correctCountByMode?.[mode]);
  }
  for (const category of CATEGORIES) {
    stats.correctByCategory[category] = toCount(value.correctByCategory?.[category]);
  }
  stats.allTimeBestStreak = Math.max(stats.allTimeBestStreak, stats.currentStreak);
  return stats;
}

export function getAverageCorrectSeconds(stats, mode) {
  const count = stats.correctCountByMode[mode] || 0;
  return count === 0 ? null : Math.round((stats.correctSecondsByMode[mode] || 0) / count);
}

// ---------- Daily challenge ----------

export function sanitizeDailyStats(raw) {
  const value = raw && typeof raw === "object" ? raw : {};
  const stats = {
    key: "lifetime",
    currentDailyStreak: toCount(value.currentDailyStreak),
    bestDailyStreak: toCount(value.bestDailyStreak),
    lastCompletedDateKey: typeof value.lastCompletedDateKey === "string" && value.lastCompletedDateKey ? value.lastCompletedDateKey : null,
    totalDailyCompletions: toCount(value.totalDailyCompletions),
    totalDailyAttempts: toCount(value.totalDailyAttempts),
  };
  stats.bestDailyStreak = Math.max(stats.bestDailyStreak, stats.currentDailyStreak);
  return stats;
}

export function sanitizeDailyRecord(raw) {
  const value = raw && typeof raw === "object" ? raw : {};
  return {
    dateKey: String(value.dateKey || "").trim(),
    seed: String(value.seed || ""),
    questionIds: Array.isArray(value.questionIds) ? value.questionIds.filter(Number.isFinite).map(Math.round) : [],
    attempts: toCount(value.attempts), // finished attempts
    // Started attempts decide which question set a retry gets (older records didn't store it).
    startedAttempts: Math.max(toCount(value.startedAttempts), toCount(value.attempts)),
    bestScore: toCount(value.bestScore),
    lastScore: toCount(value.lastScore),
    completed: Boolean(value.completed),
    completedAt: value.completedAt ? String(value.completedAt) : null,
    modeVersion: String(value.modeVersion || DAILY.modeVersion),
  };
}

export function sanitizeDailyMap(raw) {
  const map = {};
  for (const record of Object.values(raw && typeof raw === "object" ? raw : {})) {
    const clean = sanitizeDailyRecord(record);
    if (clean.dateKey) map[clean.dateKey] = clean;
  }
  return map;
}

export const createDailySeed = (dateKey) => `${dateKey}|${DAILY.modeVersion}|daily`;

/** Updates the daily streak when a day is completed for the first time. */
export function applyDailyCompletion(stats, dateKey, firstCompletionForDay) {
  const next = { ...stats };
  if (!firstCompletionForDay || !dateKey || next.lastCompletedDateKey === dateKey) return next;
  next.totalDailyCompletions += 1;
  next.currentDailyStreak = next.lastCompletedDateKey === getDateKeyOffset(dateKey, -1) ? next.currentDailyStreak + 1 : 1;
  next.bestDailyStreak = Math.max(next.bestDailyStreak, next.currentDailyStreak);
  next.lastCompletedDateKey = dateKey;
  return next;
}

// ---------- Scores and history ----------

const hasFields = (record, fields) => Boolean(record) && typeof record === "object" && fields.every((key) => record[key] !== undefined);

export const isValidHighScore = (record) => hasFields(record, ["score", "timestamp", "correct", "total"]);
export const isValidGameRecord = (record) => hasFields(record, ["timestamp", "correct", "total", "score", "percent"]);

function compareScores(a, b) {
  const byScore = Number(b.score) - Number(a.score);
  if (byScore) return byScore;
  return (Date.parse(b.timestamp) || 0) - (Date.parse(a.timestamp) || 0);
}

export function getTopScores(scores, mode, limit = MAX_HIGH_SCORES_PER_MODE) {
  return scores
    .filter(isValidHighScore)
    .map((record) => ({ ...record, difficultyMode: normalizeMode(record.difficultyMode) }))
    .filter((record) => record.difficultyMode === mode)
    .sort(compareScores)
    .slice(0, limit);
}

/** Keeps the top scores for every mode. */
export function trimHighScores(scores) {
  return MODE_KEYS.flatMap((mode) => getTopScores(scores, mode));
}

export function sanitizeHistory(history) {
  return (Array.isArray(history) ? history : [])
    .filter(isValidGameRecord)
    .map((record) => ({ ...record, difficultyMode: normalizeMode(record.difficultyMode) }));
}
