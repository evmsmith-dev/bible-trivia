(function attachBibleTriviaStorage(globalScope) {
  function createDBManager(options) {
    const config = options && typeof options === "object" ? options : {};
    const coreUtils = config.CoreUtils && typeof config.CoreUtils === "object" ? config.CoreUtils : {};
    const difficultyModeKeys = Array.isArray(config.DIFFICULTY_MODE_KEYS) && config.DIFFICULTY_MODE_KEYS.length
      ? config.DIFFICULTY_MODE_KEYS
      : ["easy", "medium", "hard", "superHard"];
    const roundReviewPreferenceKeys = Array.isArray(config.ROUND_REVIEW_PREFERENCE_KEYS) && config.ROUND_REVIEW_PREFERENCE_KEYS.length
      ? config.ROUND_REVIEW_PREFERENCE_KEYS
      : ["ask", "alwaysReview", "alwaysSkip"];

    const normalizeDifficultyMode = typeof config.normalizeDifficultyMode === "function"
      ? config.normalizeDifficultyMode
      : function fallbackNormalizeDifficultyMode(mode) {
        if (typeof mode !== "string") return "medium";
        const trimmed = mode.trim();
        const lower = trimmed.toLowerCase();

        if (lower === "easy") return "easy";
        if (lower === "medium") return "medium";
        if (lower === "hard") return "hard";
        if (lower === "super hard" || lower === "superhard") return "superHard";

        return "medium";
      };

    const normalizeRoundReviewPreference = typeof config.normalizeRoundReviewPreference === "function"
      ? config.normalizeRoundReviewPreference
      : function fallbackNormalizeRoundReviewPreference(value) {
        if (typeof value !== "string") return "ask";

        const normalized = value.trim().toLowerCase();
        if (normalized === "alwaysreview" || normalized === "always review") return "alwaysReview";
        if (normalized === "alwaysskip" || normalized === "always skip") return "alwaysSkip";
        if (normalized === "ask") return "ask";

        return "ask";
      };

    const storageKeys = config.storageKeys && typeof config.storageKeys === "object" ? config.storageKeys : {};

    const DB_NAME = "BibleTriviaDB_player_primary";
    const DB_VERSION = 1;
    const STORE_HISTORY = "gameHistory";
    const STORE_SCORES = "highScores";
    const STORE_SETTINGS = "settings";
    const STORE_STATS = "playerStats";
    const STORE_DAILY_CHALLENGES = "dailyChallenges";
    const STORE_DAILY_STATS = "dailyStats";

    let db = null;
    let useIndexedDB = true;
    let dbReady = false;

    const log = (action, data) => {
      const timestamp = new Date().toISOString();
      console.log(`[DBManager ${timestamp}] ${action}`, data || "");
    };

    const validators = {
      gameRecord: (record) => {
        if (typeof coreUtils.isValidGameRecord === "function") {
          return coreUtils.isValidGameRecord(record, difficultyModeKeys, normalizeDifficultyMode);
        }

        const required = ["timestamp", "correct", "total", "score", "percent"];
        if (!record || typeof record !== "object") return false;
        if (!required.every((k) => k in record && typeof record[k] !== "undefined")) return false;
        record.difficultyMode = normalizeDifficultyMode(record.difficultyMode);
        return difficultyModeKeys.includes(record.difficultyMode);
      },
      highScore: (record) => {
        if (typeof coreUtils.isValidHighScore === "function") {
          return coreUtils.isValidHighScore(record, difficultyModeKeys, normalizeDifficultyMode);
        }

        const required = ["score", "timestamp", "correct", "total"];
        if (!record || typeof record !== "object") return false;
        if (!required.every((k) => k in record && typeof record[k] !== "undefined")) return false;
        record.difficultyMode = normalizeDifficultyMode(record.difficultyMode);
        return difficultyModeKeys.includes(record.difficultyMode);
      },
      setting: (key, value) => {
        if (typeof coreUtils.isValidSetting === "function") {
          return coreUtils.isValidSetting(
            key,
            value,
            difficultyModeKeys,
            roundReviewPreferenceKeys,
            normalizeDifficultyMode,
            normalizeRoundReviewPreference
          );
        }

        if (key === "difficultyMode") return difficultyModeKeys.includes(normalizeDifficultyMode(value));
        if (key === "roundReviewPreference") return roundReviewPreferenceKeys.includes(normalizeRoundReviewPreference(value));
        return false;
      },
      playerStats: (record) => {
        if (typeof coreUtils.isValidPlayerStatsRecord === "function") {
          return coreUtils.isValidPlayerStatsRecord(record);
        }

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
      },
      dailyChallenge: (record) => {
        if (typeof coreUtils.isValidDailyChallengeRecord === "function") {
          return coreUtils.isValidDailyChallengeRecord(record);
        }

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
      },
      dailyStats: (record) => {
        if (typeof coreUtils.isValidDailyStatsRecord === "function") {
          return coreUtils.isValidDailyStatsRecord(record);
        }

        if (!record || typeof record !== "object") return false;
        if (record.key !== "lifetime") return false;
        if (typeof record.currentDailyStreak !== "number") return false;
        if (typeof record.bestDailyStreak !== "number") return false;
        if (!(record.lastCompletedDateKey === null || typeof record.lastCompletedDateKey === "string")) return false;
        if (typeof record.totalDailyCompletions !== "number") return false;
        if (typeof record.totalDailyAttempts !== "number") return false;
        return true;
      }
    };

    const checkIndexedDBAvailable = async () => {
      try {
        const test = indexedDB.open("__test__");
        return new Promise((resolve) => {
          test.onsuccess = () => {
            indexedDB.deleteDatabase("__test__");
            resolve(true);
          };
          test.onerror = () => resolve(false);
        });
      } catch (e) {
        log("IndexedDB availability check failed", e.message);
        return false;
      }
    };

    const openDatabase = () => {
      return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onerror = () => {
          log("Database open failed", request.error);
          useIndexedDB = false;
          reject(request.error);
        };

        request.onsuccess = () => {
          db = request.result;
          log("Database opened successfully");
          dbReady = true;
          resolve(db);
        };

        request.onupgradeneeded = (event) => {
          const database = event.target.result;
          log("Database upgrade needed");

          if (!database.objectStoreNames.contains(STORE_HISTORY)) {
            const historyStore = database.createObjectStore(STORE_HISTORY, { keyPath: "id", autoIncrement: true });
            historyStore.createIndex("timestamp", "timestamp", { unique: false });
            log("Created object store: gameHistory");
          }

          if (!database.objectStoreNames.contains(STORE_SCORES)) {
            const scoresStore = database.createObjectStore(STORE_SCORES, { keyPath: "id", autoIncrement: true });
            scoresStore.createIndex("score", "score", { unique: false });
            log("Created object store: highScores");
          }

          if (!database.objectStoreNames.contains(STORE_SETTINGS)) {
            database.createObjectStore(STORE_SETTINGS, { keyPath: "key" });
            log("Created object store: settings");
          }

          if (!database.objectStoreNames.contains(STORE_STATS)) {
            const statsStore = database.createObjectStore(STORE_STATS, { keyPath: "key" });
            statsStore.createIndex("key", "key", { unique: true });
            log("Created object store: playerStats");
          }

          if (!database.objectStoreNames.contains(STORE_DAILY_CHALLENGES)) {
            const dailyChallengesStore = database.createObjectStore(STORE_DAILY_CHALLENGES, { keyPath: "dateKey" });
            dailyChallengesStore.createIndex("completedAt", "completedAt", { unique: false });
            dailyChallengesStore.createIndex("bestScore", "bestScore", { unique: false });
            log("Created object store: dailyChallenges");
          }

          if (!database.objectStoreNames.contains(STORE_DAILY_STATS)) {
            const dailyStatsStore = database.createObjectStore(STORE_DAILY_STATS, { keyPath: "key" });
            dailyStatsStore.createIndex("key", "key", { unique: true });
            log("Created object store: dailyStats");
          }
        };
      });
    };

    const migrateFromLocalStorage = async () => {
      try {
        const lsHistory = storageKeys.history ? localStorage.getItem(storageKeys.history) : null;
        const lsScores = storageKeys.highScores ? localStorage.getItem(storageKeys.highScores) : null;
        const lsHard = storageKeys.includeHardLegacy ? localStorage.getItem(storageKeys.includeHardLegacy) : null;

        let migrated = false;

        if (lsHistory) {
          try {
            const historicalData = JSON.parse(lsHistory);
            if (Array.isArray(historicalData) && historicalData.length > 0) {
              for (const record of historicalData) {
                if (!record.difficultyMode) {
                  record.difficultyMode = "medium";
                }
                if (validators.gameRecord(record)) {
                  await addGameRecord(record);
                }
              }
              migrated = true;
              log("Migrated game history from localStorage", `${historicalData.length} records`);
            }
          } catch (e) {
            log("Failed to parse game history from localStorage", e.message);
          }
        }

        if (lsScores) {
          try {
            const scoresData = JSON.parse(lsScores);
            if (Array.isArray(scoresData) && scoresData.length > 0) {
              for (const record of scoresData) {
                if (!record.difficultyMode) {
                  record.difficultyMode = "medium";
                }
                if (validators.highScore(record)) {
                  await addHighScore(record);
                }
              }
              migrated = true;
              log("Migrated high scores from localStorage", `${scoresData.length} records`);
            }
          } catch (e) {
            log("Failed to parse high scores from localStorage", e.message);
          }
        }

        if (lsHard !== null) {
          try {
            const newValue = "medium";
            await saveSetting("difficultyMode", newValue);
            migrated = true;
            log("Migrated includeHard boolean to difficultyMode string", { oldValue: lsHard, newValue });
          } catch (e) {
            log("Failed to migrate difficulty setting from localStorage", e.message);
          }
        }

        if (migrated) {
          log("Migration from localStorage complete");
        }

        return migrated;
      } catch (e) {
        log("Migration failed with error", e.message);
        throw e;
      }
    };

    const addGameRecord = (record) => {
      return new Promise((resolve, reject) => {
        if (!useIndexedDB || !dbReady) {
          reject(new Error("Database not available"));
          return;
        }

        if (!validators.gameRecord(record)) {
          log("Invalid game record rejected", record);
          reject(new Error("Invalid game record"));
          return;
        }

        const transaction = db.transaction([STORE_HISTORY], "readwrite");
        const store = transaction.objectStore(STORE_HISTORY);
        const request = store.add(record);

        request.onsuccess = () => {
          log("Game record added", { id: request.result });
          resolve(request.result);
        };

        request.onerror = () => {
          log("Failed to add game record", request.error);
          reject(request.error);
        };
      });
    };

    const loadGameHistory = () => {
      return new Promise((resolve, reject) => {
        if (!useIndexedDB || !dbReady) {
          reject(new Error("Database not available"));
          return;
        }

        const transaction = db.transaction([STORE_HISTORY], "readonly");
        const store = transaction.objectStore(STORE_HISTORY);
        const request = store.getAll();

        request.onsuccess = () => {
          const results = request.result.filter((r) => validators.gameRecord(r));
          log("Game history loaded", `${results.length} records`);
          resolve(results);
        };

        request.onerror = () => {
          log("Failed to load game history", request.error);
          reject(request.error);
        };
      });
    };

    const clearGameHistory = () => {
      return new Promise((resolve, reject) => {
        if (!useIndexedDB || !dbReady) {
          reject(new Error("Database not available"));
          return;
        }

        const transaction = db.transaction([STORE_HISTORY], "readwrite");
        const store = transaction.objectStore(STORE_HISTORY);
        const request = store.clear();

        request.onsuccess = () => {
          log("Game history cleared");
          resolve();
        };

        request.onerror = () => {
          log("Failed to clear game history", request.error);
          reject(request.error);
        };
      });
    };

    const addHighScore = (scoreRecord) => {
      return new Promise((resolve, reject) => {
        if (!useIndexedDB || !dbReady) {
          reject(new Error("Database not available"));
          return;
        }

        if (!validators.highScore(scoreRecord)) {
          log("Invalid high score rejected", scoreRecord);
          reject(new Error("Invalid high score"));
          return;
        }

        scoreRecord.difficultyMode = normalizeDifficultyMode(scoreRecord.difficultyMode);

        const transaction = db.transaction([STORE_SCORES], "readwrite");
        const store = transaction.objectStore(STORE_SCORES);
        const request = store.add(scoreRecord);

        request.onsuccess = () => {
          log("High score added", { id: request.result, score: scoreRecord.score });
          resolve(request.result);
        };

        request.onerror = () => {
          log("Failed to add high score", request.error);
          reject(request.error);
        };
      });
    };

    const loadHighScores = () => {
      return new Promise((resolve, reject) => {
        if (!useIndexedDB || !dbReady) {
          reject(new Error("Database not available"));
          return;
        }

        const transaction = db.transaction([STORE_SCORES], "readonly");
        const store = transaction.objectStore(STORE_SCORES);
        const request = store.getAll();

        request.onsuccess = () => {
          const results = request.result
            .filter((r) => validators.highScore(r))
            .map((record) => ({
              ...record,
              difficultyMode: normalizeDifficultyMode(record.difficultyMode),
            }));
          log("High scores loaded", `${results.length} records`);
          resolve(results);
        };

        request.onerror = () => {
          log("Failed to load high scores", request.error);
          reject(request.error);
        };
      });
    };

    const clearHighScores = () => {
      return new Promise((resolve, reject) => {
        if (!useIndexedDB || !dbReady) {
          reject(new Error("Database not available"));
          return;
        }

        const transaction = db.transaction([STORE_SCORES], "readwrite");
        const store = transaction.objectStore(STORE_SCORES);
        const request = store.clear();

        request.onsuccess = () => {
          log("High scores cleared");
          resolve();
        };

        request.onerror = () => {
          log("Failed to clear high scores", request.error);
          reject(request.error);
        };
      });
    };

    const replaceHighScores = (scoreRecords) => {
      return new Promise((resolve, reject) => {
        if (!useIndexedDB || !dbReady) {
          reject(new Error("Database not available"));
          return;
        }

        if (!Array.isArray(scoreRecords)) {
          reject(new Error("Invalid high score list"));
          return;
        }

        const sanitizedScores = scoreRecords.map((record) => ({
          ...record,
          difficultyMode: normalizeDifficultyMode(record.difficultyMode),
        }));

        if (!sanitizedScores.every((record) => validators.highScore(record))) {
          reject(new Error("Invalid high score list"));
          return;
        }

        const transaction = db.transaction([STORE_SCORES], "readwrite");
        const store = transaction.objectStore(STORE_SCORES);
        const clearRequest = store.clear();

        clearRequest.onerror = () => {
          log("Failed to replace high scores while clearing", clearRequest.error);
          reject(clearRequest.error);
        };

        clearRequest.onsuccess = () => {
          sanitizedScores.forEach((record) => {
            const scoreToStore = { ...record };
            delete scoreToStore.id;
            store.add(scoreToStore);
          });
        };

        transaction.oncomplete = () => {
          log("High scores replaced", `${sanitizedScores.length} records`);
          resolve();
        };

        transaction.onerror = () => {
          log("Failed to replace high scores", transaction.error);
          reject(transaction.error);
        };
      });
    };

    const saveSetting = (key, value) => {
      return new Promise((resolve, reject) => {
        if (!useIndexedDB || !dbReady) {
          reject(new Error("Database not available"));
          return;
        }

        const normalizedValue = key === "difficultyMode" ? normalizeDifficultyMode(value) : value;

        if (!validators.setting(key, normalizedValue)) {
          log("Invalid setting rejected", { key, value });
          reject(new Error("Invalid setting"));
          return;
        }

        const transaction = db.transaction([STORE_SETTINGS], "readwrite");
        const store = transaction.objectStore(STORE_SETTINGS);
        const request = store.put({ key, value: normalizedValue });

        request.onsuccess = () => {
          log("Setting saved", { key, value: normalizedValue });
          resolve();
        };

        request.onerror = () => {
          log("Failed to save setting", request.error);
          reject(request.error);
        };
      });
    };

    const loadSetting = (key) => {
      return new Promise((resolve, reject) => {
        if (!useIndexedDB || !dbReady) {
          reject(new Error("Database not available"));
          return;
        }

        const transaction = db.transaction([STORE_SETTINGS], "readonly");
        const store = transaction.objectStore(STORE_SETTINGS);
        const request = store.get(key);

        request.onsuccess = () => {
          const result = request.result;
          const normalizedValue = result ? (key === "difficultyMode" ? normalizeDifficultyMode(result.value) : result.value) : null;
          log("Setting loaded", { key, value: normalizedValue || "not found" });
          resolve(normalizedValue);
        };

        request.onerror = () => {
          log("Failed to load setting", request.error);
          reject(request.error);
        };
      });
    };

    const clearSettings = () => {
      return new Promise((resolve, reject) => {
        if (!useIndexedDB || !dbReady) {
          reject(new Error("Database not available"));
          return;
        }

        const transaction = db.transaction([STORE_SETTINGS], "readwrite");
        const store = transaction.objectStore(STORE_SETTINGS);
        const request = store.clear();

        request.onsuccess = () => {
          log("Settings cleared");
          resolve();
        };

        request.onerror = () => {
          log("Failed to clear settings", request.error);
          reject(request.error);
        };
      });
    };

    const savePlayerStats = (statsRecord) => {
      return new Promise((resolve, reject) => {
        if (!useIndexedDB || !dbReady) {
          reject(new Error("Database not available"));
          return;
        }

        if (!validators.playerStats(statsRecord)) {
          log("Invalid player stats rejected", statsRecord);
          reject(new Error("Invalid player stats"));
          return;
        }

        const transaction = db.transaction([STORE_STATS], "readwrite");
        const store = transaction.objectStore(STORE_STATS);
        const request = store.put(statsRecord);

        request.onsuccess = () => {
          log("Player stats saved", { key: statsRecord.key });
          resolve();
        };

        request.onerror = () => {
          log("Failed to save player stats", request.error);
          reject(request.error);
        };
      });
    };

    const loadPlayerStats = () => {
      return new Promise((resolve, reject) => {
        if (!useIndexedDB || !dbReady) {
          reject(new Error("Database not available"));
          return;
        }

        const transaction = db.transaction([STORE_STATS], "readonly");
        const store = transaction.objectStore(STORE_STATS);
        const request = store.get("lifetime");

        request.onsuccess = () => {
          const result = request.result || null;
          if (result && !validators.playerStats(result)) {
            log("Invalid player stats found in database", result);
            resolve(null);
            return;
          }
          log("Player stats loaded", result ? "found" : "not found");
          resolve(result);
        };

        request.onerror = () => {
          log("Failed to load player stats", request.error);
          reject(request.error);
        };
      });
    };

    const saveDailyChallenge = (record) => {
      return new Promise((resolve, reject) => {
        if (!useIndexedDB || !dbReady) {
          reject(new Error("Database not available"));
          return;
        }

        if (!validators.dailyChallenge(record)) {
          log("Invalid daily challenge rejected", record);
          reject(new Error("Invalid daily challenge"));
          return;
        }

        const transaction = db.transaction([STORE_DAILY_CHALLENGES], "readwrite");
        const store = transaction.objectStore(STORE_DAILY_CHALLENGES);
        const request = store.put(record);

        request.onsuccess = () => {
          log("Daily challenge saved", { dateKey: record.dateKey });
          resolve();
        };

        request.onerror = () => {
          log("Failed to save daily challenge", request.error);
          reject(request.error);
        };
      });
    };

    const loadDailyChallenge = (dateKey) => {
      return new Promise((resolve, reject) => {
        if (!useIndexedDB || !dbReady) {
          reject(new Error("Database not available"));
          return;
        }

        const transaction = db.transaction([STORE_DAILY_CHALLENGES], "readonly");
        const store = transaction.objectStore(STORE_DAILY_CHALLENGES);
        const request = store.get(dateKey);

        request.onsuccess = () => {
          const result = request.result || null;
          if (result && !validators.dailyChallenge(result)) {
            log("Invalid daily challenge found in database", result);
            resolve(null);
            return;
          }
          log("Daily challenge loaded", { dateKey, found: Boolean(result) });
          resolve(result);
        };

        request.onerror = () => {
          log("Failed to load daily challenge", request.error);
          reject(request.error);
        };
      });
    };

    const listRecentDailyChallenges = (limit) => {
      return new Promise((resolve, reject) => {
        if (!useIndexedDB || !dbReady) {
          reject(new Error("Database not available"));
          return;
        }

        const transaction = db.transaction([STORE_DAILY_CHALLENGES], "readonly");
        const store = transaction.objectStore(STORE_DAILY_CHALLENGES);
        const request = store.getAll();

        request.onsuccess = () => {
          const sanitized = request.result
            .filter((record) => validators.dailyChallenge(record))
            .sort((a, b) => String(b.dateKey).localeCompare(String(a.dateKey)))
            .slice(0, Math.max(1, Math.round(limit || 30)));
          log("Recent daily challenges loaded", `${sanitized.length} records`);
          resolve(sanitized);
        };

        request.onerror = () => {
          log("Failed to list daily challenges", request.error);
          reject(request.error);
        };
      });
    };

    const saveDailyStats = (record) => {
      return new Promise((resolve, reject) => {
        if (!useIndexedDB || !dbReady) {
          reject(new Error("Database not available"));
          return;
        }

        if (!validators.dailyStats(record)) {
          log("Invalid daily stats rejected", record);
          reject(new Error("Invalid daily stats"));
          return;
        }

        const transaction = db.transaction([STORE_DAILY_STATS], "readwrite");
        const store = transaction.objectStore(STORE_DAILY_STATS);
        const request = store.put(record);

        request.onsuccess = () => {
          log("Daily stats saved", { key: record.key });
          resolve();
        };

        request.onerror = () => {
          log("Failed to save daily stats", request.error);
          reject(request.error);
        };
      });
    };

    const loadDailyStats = () => {
      return new Promise((resolve, reject) => {
        if (!useIndexedDB || !dbReady) {
          reject(new Error("Database not available"));
          return;
        }

        const transaction = db.transaction([STORE_DAILY_STATS], "readonly");
        const store = transaction.objectStore(STORE_DAILY_STATS);
        const request = store.get("lifetime");

        request.onsuccess = () => {
          const result = request.result || null;
          if (result && !validators.dailyStats(result)) {
            log("Invalid daily stats found in database", result);
            resolve(null);
            return;
          }
          log("Daily stats loaded", result ? "found" : "not found");
          resolve(result);
        };

        request.onerror = () => {
          log("Failed to load daily stats", request.error);
          reject(request.error);
        };
      });
    };

    const clearDailyChallenges = () => {
      return new Promise((resolve, reject) => {
        if (!useIndexedDB || !dbReady) {
          reject(new Error("Database not available"));
          return;
        }

        const transaction = db.transaction([STORE_DAILY_CHALLENGES], "readwrite");
        const store = transaction.objectStore(STORE_DAILY_CHALLENGES);
        const request = store.clear();

        request.onsuccess = () => {
          log("Daily challenges cleared");
          resolve();
        };

        request.onerror = () => {
          log("Failed to clear daily challenges", request.error);
          reject(request.error);
        };
      });
    };

    const init = async () => {
      try {
        const available = await checkIndexedDBAvailable();
        if (!available) {
          log("IndexedDB not available, using localStorage fallback");
          useIndexedDB = false;
          return false;
        }

        await openDatabase();

        log("Skipped localStorage migration for scoped player data");

        return true;
      } catch (e) {
        log("Database initialization failed, falling back to localStorage", e.message);
        useIndexedDB = false;
        return false;
      }
    };

    const isReady = () => dbReady && useIndexedDB;

    return {
      init,
      isReady,
      addGameRecord,
      loadGameHistory,
      clearGameHistory,
      addHighScore,
      loadHighScores,
      clearHighScores,
      replaceHighScores,
      saveSetting,
      loadSetting,
      clearSettings,
      savePlayerStats,
      loadPlayerStats,
      saveDailyChallenge,
      loadDailyChallenge,
      listRecentDailyChallenges,
      saveDailyStats,
      loadDailyStats,
      clearDailyChallenges,
      log,
      migrateFromLocalStorage,
    };
  }

  globalScope.BibleTriviaStorage = Object.assign({}, globalScope.BibleTriviaStorage, {
    createDBManager,
  });
})(window);
