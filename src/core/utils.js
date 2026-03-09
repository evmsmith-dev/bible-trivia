import {
  DAILY_CHALLENGE_MODE_VERSION,
  DIFFICULTY_MODE_KEYS,
  STREAK_BONUS_CAP,
  STREAK_BONUS_TABLE,
} from "./constants.js";

export function normalizeDifficultyMode(mode) {
  if (typeof mode !== "string") return "medium";

  const trimmed = mode.trim();
  const lower = trimmed.toLowerCase();

  if (lower === "easy") return "easy";
  if (lower === "medium") return "medium";
  if (lower === "hard") return "hard";
  if (lower === "super hard" || lower === "superhard") return "superHard";

  return "medium";
}

export function normalizeRoundReviewPreference(value) {
  if (typeof value !== "string") return "ask";

  const normalized = value.trim().toLowerCase();
  if (normalized === "alwaysreview" || normalized === "always review") return "alwaysReview";
  if (normalized === "alwaysskip" || normalized === "always skip") return "alwaysSkip";
  if (normalized === "ask") return "ask";

  return "ask";
}

export function isValidHighScoreRecord(record) {
  const required = ["score", "timestamp", "correct", "total"];
  return !!record && typeof record === "object" && required.every((k) => k in record && typeof record[k] !== "undefined");
}

export function compareScoresDescending(a, b) {
  const scoreDiff = Number(b.score) - Number(a.score);
  if (scoreDiff !== 0) return scoreDiff;

  const timeA = Date.parse(a.timestamp);
  const timeB = Date.parse(b.timestamp);
  const safeA = Number.isNaN(timeA) ? 0 : timeA;
  const safeB = Number.isNaN(timeB) ? 0 : timeB;
  return safeB - safeA;
}

export function getTopScoresByMode(scores, mode, limit = 5) {
  const normalizedMode = normalizeDifficultyMode(mode);
  return (Array.isArray(scores) ? scores : [])
    .filter(isValidHighScoreRecord)
    .map((record) => ({
      ...record,
      difficultyMode: normalizeDifficultyMode(record.difficultyMode),
    }))
    .filter((record) => record.difficultyMode === normalizedMode)
    .sort(compareScoresDescending)
    .slice(0, limit);
}

export function normalizeAndTrimHighScores(scores, maxPerMode = 5) {
  const sanitized = (Array.isArray(scores) ? scores : [])
    .filter(isValidHighScoreRecord)
    .map((record) => ({
      ...record,
      difficultyMode: normalizeDifficultyMode(record.difficultyMode),
    }));

  return DIFFICULTY_MODE_KEYS.flatMap((mode) => getTopScoresByMode(sanitized, mode, maxPerMode));
}

export function createZeroedModeMap() {
  return {
    easy: 0,
    medium: 0,
    hard: 0,
    superHard: 0,
  };
}

export function createDefaultPlayerStats() {
  return {
    key: "lifetime",
    totalCorrectClicks: 0,
    correctSecondsByMode: createZeroedModeMap(),
    correctCountByMode: createZeroedModeMap(),
    correctByCategory: {
      "Old Testament": 0,
      "New Testament": 0,
      General: 0,
    },
    currentStreak: 0,
    allTimeBestStreak: 0,
    lastGameMaxStreak: 0,
  };
}

export function sanitizePlayerStats(rawStats) {
  const defaults = createDefaultPlayerStats();
  const raw = rawStats && typeof rawStats === "object" ? rawStats : {};
  const sanitized = {
    key: "lifetime",
    totalCorrectClicks: Number.isFinite(raw.totalCorrectClicks) ? Math.max(0, Math.round(raw.totalCorrectClicks)) : 0,
    correctSecondsByMode: createZeroedModeMap(),
    correctCountByMode: createZeroedModeMap(),
    correctByCategory: {
      "Old Testament": 0,
      "New Testament": 0,
      General: 0,
    },
    currentStreak: Number.isFinite(raw.currentStreak) ? Math.max(0, Math.round(raw.currentStreak)) : 0,
    allTimeBestStreak: Number.isFinite(raw.allTimeBestStreak) ? Math.max(0, Math.round(raw.allTimeBestStreak)) : 0,
    lastGameMaxStreak: Number.isFinite(raw.lastGameMaxStreak) ? Math.max(0, Math.round(raw.lastGameMaxStreak)) : 0,
  };

  DIFFICULTY_MODE_KEYS.forEach((mode) => {
    const seconds = raw.correctSecondsByMode?.[mode];
    const count = raw.correctCountByMode?.[mode];
    sanitized.correctSecondsByMode[mode] = Number.isFinite(seconds) ? Math.max(0, Math.round(seconds)) : defaults.correctSecondsByMode[mode];
    sanitized.correctCountByMode[mode] = Number.isFinite(count) ? Math.max(0, Math.round(count)) : defaults.correctCountByMode[mode];
  });

  ["Old Testament", "New Testament", "General"].forEach((category) => {
    const value = raw.correctByCategory?.[category];
    sanitized.correctByCategory[category] = Number.isFinite(value) ? Math.max(0, Math.round(value)) : 0;
  });

  if (sanitized.allTimeBestStreak < sanitized.currentStreak) {
    sanitized.allTimeBestStreak = sanitized.currentStreak;
  }

  return sanitized;
}

export function createDefaultDailyStats() {
  return {
    key: "lifetime",
    currentDailyStreak: 0,
    bestDailyStreak: 0,
    lastCompletedDateKey: null,
    totalDailyCompletions: 0,
    totalDailyAttempts: 0,
  };
}

export function sanitizeDailyStats(rawStats) {
  const raw = rawStats && typeof rawStats === "object" ? rawStats : {};
  const sanitized = {
    key: "lifetime",
    currentDailyStreak: Number.isFinite(raw.currentDailyStreak) ? Math.max(0, Math.round(raw.currentDailyStreak)) : 0,
    bestDailyStreak: Number.isFinite(raw.bestDailyStreak) ? Math.max(0, Math.round(raw.bestDailyStreak)) : 0,
    lastCompletedDateKey: typeof raw.lastCompletedDateKey === "string" && raw.lastCompletedDateKey ? raw.lastCompletedDateKey : null,
    totalDailyCompletions: Number.isFinite(raw.totalDailyCompletions) ? Math.max(0, Math.round(raw.totalDailyCompletions)) : 0,
    totalDailyAttempts: Number.isFinite(raw.totalDailyAttempts) ? Math.max(0, Math.round(raw.totalDailyAttempts)) : 0,
  };

  if (sanitized.bestDailyStreak < sanitized.currentDailyStreak) {
    sanitized.bestDailyStreak = sanitized.currentDailyStreak;
  }

  return sanitized;
}

export function sanitizeDailyChallengeRecord(rawRecord) {
  const raw = rawRecord && typeof rawRecord === "object" ? rawRecord : {};
  const questionIds = Array.isArray(raw.questionIds)
    ? raw.questionIds.filter((id) => Number.isFinite(id)).map((id) => Math.round(id))
    : [];

  return {
    dateKey: String(raw.dateKey || "").trim(),
    seed: String(raw.seed || ""),
    questionIds,
    attempts: Number.isFinite(raw.attempts) ? Math.max(0, Math.round(raw.attempts)) : 0,
    bestScore: Number.isFinite(raw.bestScore) ? Math.max(0, Math.round(raw.bestScore)) : 0,
    lastScore: Number.isFinite(raw.lastScore) ? Math.max(0, Math.round(raw.lastScore)) : 0,
    completed: Boolean(raw.completed),
    completedAt: raw.completedAt ? String(raw.completedAt) : null,
    modeVersion: String(raw.modeVersion || DAILY_CHALLENGE_MODE_VERSION),
  };
}

export function sanitizeDailyChallengeMap(rawMap) {
  const map = rawMap && typeof rawMap === "object" ? rawMap : {};
  const sanitized = {};
  Object.keys(map).forEach((dateKey) => {
    const record = sanitizeDailyChallengeRecord(map[dateKey]);
    if (record.dateKey) {
      sanitized[record.dateKey] = record;
    }
  });
  return sanitized;
}

export function getLocalDateKey(dateInput = new Date()) {
  const date = dateInput instanceof Date ? dateInput : new Date(dateInput);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function getDateKeyOffset(dateKey, dayOffset) {
  if (typeof dateKey !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) {
    return null;
  }

  const [year, month, day] = dateKey.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  date.setDate(date.getDate() + dayOffset);
  return getLocalDateKey(date);
}

export function createDailySeed(dateKey, modeVersion = DAILY_CHALLENGE_MODE_VERSION) {
  return `${dateKey}|${modeVersion}|daily`;
}

export function createSeededRandom(seedText) {
  let hash = 2166136261;
  const text = String(seedText || "daily-seed");
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }

  let state = hash >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

export function shuffleWithRandom(array, randomFn = Math.random) {
  const copy = Array.isArray(array) ? [...array] : [];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(randomFn() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export function getCappedStreak(streak) {
  return Math.min(Math.max(0, Math.round(streak || 0)), STREAK_BONUS_CAP);
}

export function getStreakBonus(streak) {
  const capped = getCappedStreak(streak);
  if (capped < 3) return 0;
  return STREAK_BONUS_TABLE[capped] || 0;
}

export function getNextStreakBonusInfo(streak) {
  const current = Math.max(0, Math.round(streak || 0));
  if (current >= STREAK_BONUS_CAP) {
    return { label: `Cap reached at ${STREAK_BONUS_CAP}` };
  }

  const nextStreak = current + 1;
  const nextBonus = getStreakBonus(nextStreak);
  if (nextBonus <= 0) {
    return { label: "Next bonus at 3" };
  }

  return { label: `Next: +${nextBonus} at ${nextStreak}` };
}
