(function attachBibleTriviaFallbackStore(globalScope) {
  function createFallbackStore(options) {
    const config = options && typeof options === "object" ? options : {};
    const storageKeys = config.storageKeys && typeof config.storageKeys === "object" ? config.storageKeys : {};

    const normalizeAndTrimHighScores = config.normalizeAndTrimHighScores;
    const normalizeDifficultyMode = config.normalizeDifficultyMode;
    const normalizeRoundReviewPreference = config.normalizeRoundReviewPreference;
    const sanitizePlayerStats = config.sanitizePlayerStats;
    const createDefaultPlayerStats = config.createDefaultPlayerStats;
    const sanitizeDailyStats = config.sanitizeDailyStats;
    const createDefaultDailyStats = config.createDefaultDailyStats;
    const sanitizeDailyChallengeMap = config.sanitizeDailyChallengeMap;

    function getRaw(storageKey) {
      return localStorage.getItem(storageKey);
    }

    function setRaw(storageKey, value) {
      localStorage.setItem(storageKey, value);
    }

    function parseJson(storageKey, fallbackValue) {
      const raw = getRaw(storageKey);
      if (!raw) return fallbackValue;
      try {
        return JSON.parse(raw);
      } catch (_error) {
        return fallbackValue;
      }
    }

    function load() {
      const rawHistory = parseJson(storageKeys.history, []);
      const gameHistory = Array.isArray(rawHistory) ? rawHistory : [];
      const rawScores = parseJson(storageKeys.highScores, []);
      const highScores = typeof normalizeAndTrimHighScores === "function"
        ? normalizeAndTrimHighScores(Array.isArray(rawScores) ? rawScores : [])
        : (Array.isArray(rawScores) ? rawScores : []);

      const savedMode = getRaw(storageKeys.difficultyMode);
      const savedHard = getRaw(storageKeys.includeHardLegacy);
      const difficultyMode = savedMode
        ? (typeof normalizeDifficultyMode === "function" ? normalizeDifficultyMode(savedMode) : String(savedMode))
        : (savedHard !== null ? "medium" : "medium");

      const savedReviewPref = getRaw(storageKeys.roundReviewPreference);
      const roundReviewPreference = savedReviewPref
        ? (typeof normalizeRoundReviewPreference === "function" ? normalizeRoundReviewPreference(savedReviewPref) : String(savedReviewPref))
        : "ask";

      const rawPlayerStats = parseJson(storageKeys.playerStats, null);
      const playerStats = rawPlayerStats
        ? (typeof sanitizePlayerStats === "function" ? sanitizePlayerStats(rawPlayerStats) : rawPlayerStats)
        : (typeof createDefaultPlayerStats === "function" ? createDefaultPlayerStats() : {});

      const rawDailyStats = parseJson(storageKeys.dailyStats, null);
      const dailyStats = rawDailyStats
        ? (typeof sanitizeDailyStats === "function" ? sanitizeDailyStats(rawDailyStats) : rawDailyStats)
        : (typeof createDefaultDailyStats === "function" ? createDefaultDailyStats() : {});

      const rawDailyChallengeMap = parseJson(storageKeys.dailyChallenges, {});
      const dailyChallengeMap = typeof sanitizeDailyChallengeMap === "function"
        ? sanitizeDailyChallengeMap(rawDailyChallengeMap)
        : (rawDailyChallengeMap && typeof rawDailyChallengeMap === "object" ? rawDailyChallengeMap : {});

      return {
        gameHistory,
        highScores,
        difficultyMode,
        roundReviewPreference,
        playerStats,
        dailyStats,
        dailyChallengeMap,
      };
    }

    function save(snapshot) {
      const data = snapshot && typeof snapshot === "object" ? snapshot : {};
      setRaw(storageKeys.history, JSON.stringify(Array.isArray(data.gameHistory) ? data.gameHistory : []));
      setRaw(storageKeys.highScores, JSON.stringify(Array.isArray(data.highScores) ? data.highScores : []));
      setRaw(storageKeys.difficultyMode, String(data.difficultyMode || "medium"));
      setRaw(storageKeys.roundReviewPreference, String(data.roundReviewPreference || "ask"));
      setRaw(storageKeys.playerStats, JSON.stringify(data.playerStats && typeof data.playerStats === "object" ? data.playerStats : {}));
      setRaw(storageKeys.dailyStats, JSON.stringify(data.dailyStats && typeof data.dailyStats === "object" ? data.dailyStats : {}));
      setRaw(storageKeys.dailyChallenges, JSON.stringify(data.dailyChallengeMap && typeof data.dailyChallengeMap === "object" ? data.dailyChallengeMap : {}));
      if (data.playerProfile && typeof data.playerProfile === "object") {
        setRaw(storageKeys.profile, JSON.stringify(data.playerProfile));
      }
    }

    return {
      load,
      save,
    };
  }

  globalScope.BibleTriviaStorage = Object.assign({}, globalScope.BibleTriviaStorage, {
    createFallbackStore,
  });
})(window);
