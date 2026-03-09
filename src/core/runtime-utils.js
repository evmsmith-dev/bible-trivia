(function attachBibleTriviaCore(globalScope) {
  function normalizeDifficultyMode(mode) {
    if (typeof mode !== "string") return "medium";

    const trimmed = mode.trim();
    const lower = trimmed.toLowerCase();

    if (lower === "easy") return "easy";
    if (lower === "medium") return "medium";
    if (lower === "hard") return "hard";
    if (lower === "super hard" || lower === "superhard") return "superHard";

    return "medium";
  }

  function normalizeRoundReviewPreference(value) {
    if (typeof value !== "string") return "ask";

    const normalized = value.trim().toLowerCase();
    if (normalized === "alwaysreview" || normalized === "always review") return "alwaysReview";
    if (normalized === "alwaysskip" || normalized === "always skip") return "alwaysSkip";
    if (normalized === "ask") return "ask";

    return "ask";
  }

  function isValidHighScoreRecord(record) {
    const required = ["score", "timestamp", "correct", "total"];
    return !!record && typeof record === "object" && required.every((k) => k in record && typeof record[k] !== "undefined");
  }

  function compareScoresDescending(a, b) {
    const scoreDiff = Number(b.score) - Number(a.score);
    if (scoreDiff !== 0) return scoreDiff;

    const timeA = Date.parse(a.timestamp);
    const timeB = Date.parse(b.timestamp);
    const safeA = Number.isNaN(timeA) ? 0 : timeA;
    const safeB = Number.isNaN(timeB) ? 0 : timeB;
    return safeB - safeA;
  }

  function getTopScoresByMode(scores, mode, limit) {
    const safeLimit = Number.isFinite(limit) ? Math.max(1, Math.round(limit)) : 5;
    const normalizedMode = normalizeDifficultyMode(mode);

    return (Array.isArray(scores) ? scores : [])
      .filter(isValidHighScoreRecord)
      .map((record) => ({
        ...record,
        difficultyMode: normalizeDifficultyMode(record.difficultyMode),
      }))
      .filter((record) => record.difficultyMode === normalizedMode)
      .sort(compareScoresDescending)
      .slice(0, safeLimit);
  }

  function normalizeAndTrimHighScores(scores, maxPerMode) {
    const safeMax = Number.isFinite(maxPerMode) ? Math.max(1, Math.round(maxPerMode)) : 5;
    const modeKeys = ["easy", "medium", "hard", "superHard"];
    const sanitized = (Array.isArray(scores) ? scores : [])
      .filter(isValidHighScoreRecord)
      .map((record) => ({
        ...record,
        difficultyMode: normalizeDifficultyMode(record.difficultyMode),
      }));

    return modeKeys.flatMap((mode) => getTopScoresByMode(sanitized, mode, safeMax));
  }

  function getLocalDateKey(dateInput) {
    const input = typeof dateInput === "undefined" ? new Date() : dateInput;
    const date = input instanceof Date ? input : new Date(input);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  function getDateKeyOffset(dateKey, dayOffset) {
    if (typeof dateKey !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) {
      return null;
    }

    const [year, month, day] = dateKey.split("-").map(Number);
    const date = new Date(year, month - 1, day);
    date.setDate(date.getDate() + dayOffset);
    return getLocalDateKey(date);
  }

  function createDailySeed(dateKey, modeVersion) {
    const safeVersion = String(modeVersion || "v1");
    return `${dateKey}|${safeVersion}|daily`;
  }

  function createSeededRandom(seedText) {
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

  function shuffleWithRandom(array, randomFn) {
    const random = typeof randomFn === "function" ? randomFn : Math.random;
    const copy = Array.isArray(array) ? [...array] : [];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }

  function getCappedStreak(streak, cap) {
    const maxCap = Number.isFinite(cap) ? Math.max(1, Math.round(cap)) : 10;
    return Math.min(Math.max(0, Math.round(streak || 0)), maxCap);
  }

  function getStreakBonus(streak, bonusTable, cap) {
    const table = bonusTable && typeof bonusTable === "object" ? bonusTable : {};
    const capped = getCappedStreak(streak, cap);
    if (capped < 3) return 0;
    return Number(table[capped] || 0);
  }

  function getNextStreakBonusInfo(streak, bonusTable, cap) {
    const table = bonusTable && typeof bonusTable === "object" ? bonusTable : {};
    const maxCap = Number.isFinite(cap) ? Math.max(1, Math.round(cap)) : 10;
    const current = Math.max(0, Math.round(streak || 0));

    if (current >= maxCap) {
      return { label: `Cap reached at ${maxCap}` };
    }

    const nextStreak = current + 1;
    const nextBonus = getStreakBonus(nextStreak, table, maxCap);
    if (nextBonus <= 0) {
      return { label: "Next bonus at 3" };
    }

    return { label: `Next: +${nextBonus} at ${nextStreak}` };
  }

  function createZeroedModeMap() {
    return {
      easy: 0,
      medium: 0,
      hard: 0,
      superHard: 0,
    };
  }

  function createDefaultPlayerStats() {
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

  function sanitizePlayerStats(rawStats, difficultyModeKeys) {
    const modeKeys = Array.isArray(difficultyModeKeys) && difficultyModeKeys.length
      ? difficultyModeKeys
      : ["easy", "medium", "hard", "superHard"];

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

    modeKeys.forEach((mode) => {
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

  function createDefaultDailyStats() {
    return {
      key: "lifetime",
      currentDailyStreak: 0,
      bestDailyStreak: 0,
      lastCompletedDateKey: null,
      totalDailyCompletions: 0,
      totalDailyAttempts: 0,
    };
  }

  function sanitizeDailyStats(rawStats) {
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

  function sanitizeDailyChallengeRecord(rawRecord, modeVersion) {
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
      modeVersion: String(raw.modeVersion || modeVersion || "v1"),
    };
  }

  function sanitizeDailyChallengeMap(rawMap, modeVersion) {
    const map = rawMap && typeof rawMap === "object" ? rawMap : {};
    const sanitized = {};
    Object.keys(map).forEach((dateKey) => {
      const record = sanitizeDailyChallengeRecord(map[dateKey], modeVersion);
      if (record.dateKey) {
        sanitized[record.dateKey] = record;
      }
    });
    return sanitized;
  }

  function isValidGameRecord(record, difficultyModeKeys, normalizeDifficultyModeFn) {
    const required = ["timestamp", "correct", "total", "score", "percent"];
    if (!record || typeof record !== "object") return false;
    if (!required.every((k) => k in record && typeof record[k] !== "undefined")) return false;

    const normalize = typeof normalizeDifficultyModeFn === "function" ? normalizeDifficultyModeFn : normalizeDifficultyMode;
    const modes = Array.isArray(difficultyModeKeys) && difficultyModeKeys.length
      ? difficultyModeKeys
      : ["easy", "medium", "hard", "superHard"];

    record.difficultyMode = normalize(record.difficultyMode);
    return modes.includes(record.difficultyMode);
  }

  function isValidHighScore(record, difficultyModeKeys, normalizeDifficultyModeFn) {
    const required = ["score", "timestamp", "correct", "total"];
    if (!record || typeof record !== "object") return false;
    if (!required.every((k) => k in record && typeof record[k] !== "undefined")) return false;

    const normalize = typeof normalizeDifficultyModeFn === "function" ? normalizeDifficultyModeFn : normalizeDifficultyMode;
    const modes = Array.isArray(difficultyModeKeys) && difficultyModeKeys.length
      ? difficultyModeKeys
      : ["easy", "medium", "hard", "superHard"];

    record.difficultyMode = normalize(record.difficultyMode);
    return modes.includes(record.difficultyMode);
  }

  function isValidSetting(
    key,
    value,
    difficultyModeKeys,
    roundReviewPreferenceKeys,
    normalizeDifficultyModeFn,
    normalizeRoundReviewPreferenceFn
  ) {
    const modeKeys = Array.isArray(difficultyModeKeys) && difficultyModeKeys.length
      ? difficultyModeKeys
      : ["easy", "medium", "hard", "superHard"];
    const reviewKeys = Array.isArray(roundReviewPreferenceKeys) && roundReviewPreferenceKeys.length
      ? roundReviewPreferenceKeys
      : ["ask", "alwaysReview", "alwaysSkip"];

    const normalizeMode = typeof normalizeDifficultyModeFn === "function" ? normalizeDifficultyModeFn : normalizeDifficultyMode;
    const normalizeReview = typeof normalizeRoundReviewPreferenceFn === "function"
      ? normalizeRoundReviewPreferenceFn
      : normalizeRoundReviewPreference;

    if (key === "difficultyMode") return modeKeys.includes(normalizeMode(value));
    if (key === "roundReviewPreference") return reviewKeys.includes(normalizeReview(value));
    return false;
  }

  function isValidPlayerStatsRecord(record) {
    if (!record || typeof record !== "object") return false;
    if (record.key !== "lifetime") return false;
    if (typeof record.totalCorrectClicks !== "number") return false;
    if (typeof record.currentStreak !== "number") return false;
    if (typeof record.allTimeBestStreak !== "number") return false;
    if (typeof record.lastGameMaxStreak !== "number") return false;
    if (!record.correctSecondsByMode || typeof record.correctSecondsByMode !== "object") return false;
    if (!record.correctCountByMode || typeof record.correctCountByMode !== "object") return false;
    if (!record.correctByCategory || typeof record.correctByCategory !== "object") return false;
    return true;
  }

  function isValidDailyChallengeRecord(record) {
    if (!record || typeof record !== "object") return false;
    if (typeof record.dateKey !== "string" || !record.dateKey.trim()) return false;
    if (typeof record.seed !== "string") return false;
    if (!Array.isArray(record.questionIds)) return false;
    if (typeof record.attempts !== "number") return false;
    if (typeof record.bestScore !== "number") return false;
    if (typeof record.lastScore !== "number") return false;
    if (typeof record.completed !== "boolean") return false;
    if (!(record.completedAt === null || typeof record.completedAt === "string")) return false;
    if (typeof record.modeVersion !== "string") return false;
    return true;
  }

  function isValidDailyStatsRecord(record) {
    if (!record || typeof record !== "object") return false;
    if (record.key !== "lifetime") return false;
    if (typeof record.currentDailyStreak !== "number") return false;
    if (typeof record.bestDailyStreak !== "number") return false;
    if (!(record.lastCompletedDateKey === null || typeof record.lastCompletedDateKey === "string")) return false;
    if (typeof record.totalDailyCompletions !== "number") return false;
    if (typeof record.totalDailyAttempts !== "number") return false;
    return true;
  }

  globalScope.BibleTriviaCore = Object.assign({}, globalScope.BibleTriviaCore, {
    normalizeDifficultyMode,
    normalizeRoundReviewPreference,
    isValidHighScoreRecord,
    compareScoresDescending,
    getTopScoresByMode,
    normalizeAndTrimHighScores,
    getLocalDateKey,
    getDateKeyOffset,
    createDailySeed,
    createSeededRandom,
    shuffleWithRandom,
    getCappedStreak,
    getStreakBonus,
    getNextStreakBonusInfo,
    createZeroedModeMap,
    createDefaultPlayerStats,
    sanitizePlayerStats,
    createDefaultDailyStats,
    sanitizeDailyStats,
    sanitizeDailyChallengeRecord,
    sanitizeDailyChallengeMap,
    isValidGameRecord,
    isValidHighScore,
    isValidSetting,
    isValidPlayerStatsRecord,
    isValidDailyChallengeRecord,
    isValidDailyStatsRecord,
  });
})(window);
