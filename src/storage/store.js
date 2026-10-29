// Persistence. IndexedDB is used when available, with localStorage as a fallback.
// Database name, store names and localStorage keys are unchanged from earlier versions,
// so existing players keep their progress. The profile has always lived in localStorage.
import { DAILY } from "../config.js";
import {
  createDefaultProfile, normalizeMode, normalizeReviewPreference, sanitizeDailyMap, sanitizeDailyStats,
  sanitizeHistory, sanitizePlayerStats, sanitizeProfile, trimHighScores,
} from "../lib/records.js";
import { log } from "../lib/debug.js";

const DB_NAME = "BibleTriviaDB_player_primary";
const DB_VERSION = 1;
const STORES = {
  history: "gameHistory",
  scores: "highScores",
  settings: "settings",
  stats: "playerStats",
  daily: "dailyChallenges",
  dailyStats: "dailyStats",
};

const PREFIX = "bibleTriviaPlayer_primary_";
export const KEYS = {
  profile: `${PREFIX}profile`,
  history: `${PREFIX}history`,
  highScores: `${PREFIX}highScores`,
  difficultyMode: `${PREFIX}difficultyMode`,
  roundReviewPreference: `${PREFIX}roundReviewPreference`,
  playerStats: `${PREFIX}playerStats`,
  dailyStats: `${PREFIX}dailyStats`,
  dailyChallenges: `${PREFIX}dailyChallenges`,
  dailyPulseAckDate: `${PREFIX}dailyPulseAckDate`,
  recentQuestions: `${PREFIX}recentQuestionIds`,
};

// ---------- small localStorage helpers (never throw) ----------

export function readLocal(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function writeLocal(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch (error) {
    log("localStorage write failed", key, error);
  }
}

function readLocalJson(key, fallback) {
  try {
    const raw = readLocal(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

// ---------- IndexedDB helpers ----------

const promisify = (request) => new Promise((resolve, reject) => {
  request.onsuccess = () => resolve(request.result);
  request.onerror = () => reject(request.error);
});

const transactionDone = (tx) => new Promise((resolve, reject) => {
  tx.oncomplete = () => resolve();
  tx.onerror = () => reject(tx.error);
  tx.onabort = () => reject(tx.error || new Error("Transaction aborted"));
});

function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORES.history)) {
        db.createObjectStore(STORES.history, { keyPath: "id", autoIncrement: true }).createIndex("timestamp", "timestamp");
      }
      if (!db.objectStoreNames.contains(STORES.scores)) {
        db.createObjectStore(STORES.scores, { keyPath: "id", autoIncrement: true }).createIndex("score", "score");
      }
      if (!db.objectStoreNames.contains(STORES.settings)) {
        db.createObjectStore(STORES.settings, { keyPath: "key" });
      }
      if (!db.objectStoreNames.contains(STORES.stats)) {
        db.createObjectStore(STORES.stats, { keyPath: "key" }).createIndex("key", "key", { unique: true });
      }
      if (!db.objectStoreNames.contains(STORES.daily)) {
        const daily = db.createObjectStore(STORES.daily, { keyPath: "dateKey" });
        daily.createIndex("completedAt", "completedAt");
        daily.createIndex("bestScore", "bestScore");
      }
      if (!db.objectStoreNames.contains(STORES.dailyStats)) {
        db.createObjectStore(STORES.dailyStats, { keyPath: "key" }).createIndex("key", "key", { unique: true });
      }
    };
    request.onsuccess = () => {
      const db = request.result;
      // Let a newer version of the app (in another tab) upgrade the database.
      db.onversionchange = () => db.close();
      resolve(db);
    };
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error("IndexedDB open blocked"));
  });
}

// ---------- snapshot shape ----------

function emptySnapshot() {
  return {
    profile: createDefaultProfile(),
    history: [],
    highScores: [],
    difficultyMode: "medium",
    roundReviewPreference: "ask",
    playerStats: sanitizePlayerStats(null),
    dailyStats: sanitizeDailyStats(null),
    dailyChallenges: {},
  };
}

/** Question ids shown recently, oldest first (kept in localStorage; small and per device). */
export function loadRecentQuestionIds() {
  const ids = readLocalJson(KEYS.recentQuestions, []);
  return Array.isArray(ids) ? ids.filter(Number.isInteger) : [];
}

export function saveRecentQuestionIds(ids) {
  writeLocal(KEYS.recentQuestions, JSON.stringify(ids));
}

function loadProfile() {
  const raw = readLocalJson(KEYS.profile, null);
  return raw ? sanitizeProfile(raw) : createDefaultProfile();
}

function recentDaily(records) {
  const sorted = Object.values(sanitizeDailyMap(Object.fromEntries(records.map((record) => [record?.dateKey, record]))))
    .sort((a, b) => b.dateKey.localeCompare(a.dateKey))
    .slice(0, DAILY.recentLimit);
  return Object.fromEntries(sorted.map((record) => [record.dateKey, record]));
}

// ---------- backends ----------

function createIndexedDbBackend(db) {
  return {
    name: "indexedDB",

    async load() {
      const names = Object.values(STORES);
      const tx = db.transaction(names, "readonly");
      const [history, scores, mode, review, stats, daily, dailyStats] = await Promise.all([
        promisify(tx.objectStore(STORES.history).getAll()),
        promisify(tx.objectStore(STORES.scores).getAll()),
        promisify(tx.objectStore(STORES.settings).get("difficultyMode")),
        promisify(tx.objectStore(STORES.settings).get("roundReviewPreference")),
        promisify(tx.objectStore(STORES.stats).get("lifetime")),
        promisify(tx.objectStore(STORES.daily).getAll()),
        promisify(tx.objectStore(STORES.dailyStats).get("lifetime")),
      ]);
      return {
        profile: loadProfile(),
        history: sanitizeHistory(history),
        highScores: trimHighScores(scores || []),
        difficultyMode: normalizeMode(mode?.value),
        roundReviewPreference: normalizeReviewPreference(review?.value),
        playerStats: sanitizePlayerStats(stats),
        dailyStats: sanitizeDailyStats(dailyStats),
        dailyChallenges: recentDaily(daily || []),
      };
    },

    /** Applies all changes in a single transaction. Returns the new history record id, if any. */
    async save(changes) {
      const storeNames = new Set();
      if (changes.addHistory) storeNames.add(STORES.history);
      if (changes.highScores) storeNames.add(STORES.scores);
      if (changes.settings) storeNames.add(STORES.settings);
      if (changes.playerStats) storeNames.add(STORES.stats);
      if (changes.dailyRecord) storeNames.add(STORES.daily);
      if (changes.dailyStats) storeNames.add(STORES.dailyStats);
      if (!storeNames.size) return undefined;

      const tx = db.transaction([...storeNames], "readwrite");
      let historyId;
      if (changes.addHistory) {
        const { id, ...record } = changes.addHistory;
        tx.objectStore(STORES.history).add(record).onsuccess = (event) => { historyId = event.target.result; };
      }
      if (changes.highScores) {
        const store = tx.objectStore(STORES.scores);
        store.clear();
        changes.highScores.forEach(({ id, ...record }) => store.add(record));
      }
      if (changes.settings) {
        Object.entries(changes.settings).forEach(([key, value]) => tx.objectStore(STORES.settings).put({ key, value }));
      }
      if (changes.playerStats) tx.objectStore(STORES.stats).put({ ...changes.playerStats, key: "lifetime" });
      if (changes.dailyRecord) tx.objectStore(STORES.daily).put(changes.dailyRecord);
      if (changes.dailyStats) tx.objectStore(STORES.dailyStats).put({ ...changes.dailyStats, key: "lifetime" });
      await transactionDone(tx);
      return historyId;
    },

    async reset() {
      const tx = db.transaction(Object.values(STORES), "readwrite");
      Object.values(STORES).forEach((name) => tx.objectStore(name).clear());
      await transactionDone(tx);
    },
  };
}

function createLocalStorageBackend() {
  let snapshot = emptySnapshot();
  return {
    name: "localStorage",

    async load() {
      const dailyMap = readLocalJson(KEYS.dailyChallenges, {});
      snapshot = {
        profile: loadProfile(),
        history: sanitizeHistory(readLocalJson(KEYS.history, [])),
        highScores: trimHighScores(readLocalJson(KEYS.highScores, []) || []),
        difficultyMode: normalizeMode(readLocal(KEYS.difficultyMode)),
        roundReviewPreference: normalizeReviewPreference(readLocal(KEYS.roundReviewPreference)),
        playerStats: sanitizePlayerStats(readLocalJson(KEYS.playerStats, null)),
        dailyStats: sanitizeDailyStats(readLocalJson(KEYS.dailyStats, null)),
        dailyChallenges: recentDaily(Object.values(dailyMap && typeof dailyMap === "object" ? dailyMap : {})),
      };
      return structuredClone(snapshot);
    },

    async save(changes) {
      if (changes.addHistory) {
        snapshot.history.push(changes.addHistory);
        writeLocal(KEYS.history, JSON.stringify(snapshot.history));
      }
      if (changes.highScores) writeLocal(KEYS.highScores, JSON.stringify(changes.highScores));
      if (changes.settings?.difficultyMode) writeLocal(KEYS.difficultyMode, changes.settings.difficultyMode);
      if (changes.settings?.roundReviewPreference) writeLocal(KEYS.roundReviewPreference, changes.settings.roundReviewPreference);
      if (changes.playerStats) writeLocal(KEYS.playerStats, JSON.stringify(changes.playerStats));
      if (changes.dailyStats) writeLocal(KEYS.dailyStats, JSON.stringify(changes.dailyStats));
      if (changes.dailyRecord) {
        snapshot.dailyChallenges[changes.dailyRecord.dateKey] = changes.dailyRecord;
        writeLocal(KEYS.dailyChallenges, JSON.stringify(snapshot.dailyChallenges));
      }
      return undefined;
    },

    async reset() {
      snapshot = emptySnapshot();
      [KEYS.history, KEYS.highScores, KEYS.difficultyMode, KEYS.roundReviewPreference, KEYS.playerStats, KEYS.dailyStats, KEYS.dailyChallenges]
        .forEach((key) => { try { localStorage.removeItem(key); } catch { /* ignore */ } });
    },
  };
}

// ---------- public API ----------

let backend = createLocalStorageBackend();

export async function initStore() {
  try {
    if (typeof indexedDB !== "undefined") {
      backend = createIndexedDbBackend(await openDatabase());
    }
  } catch (error) {
    log("IndexedDB unavailable, using localStorage", error);
  }
  // Ask the browser not to evict saved progress under storage pressure (best effort).
  navigator.storage?.persist?.().catch(() => {});
  return backend.name;
}

export async function loadAll() {
  try {
    return await backend.load();
  } catch (error) {
    log("Load failed, falling back to localStorage", error);
    backend = createLocalStorageBackend();
    return backend.load();
  }
}

export async function save(changes) {
  try {
    return await backend.save(changes);
  } catch (error) {
    log("Save failed", error);
    return undefined;
  }
}

export function saveProfile(profile) {
  writeLocal(KEYS.profile, JSON.stringify(profile));
}

export async function resetAll() {
  try {
    localStorage.removeItem(KEYS.recentQuestions);
  } catch {
    // ignore
  }
  try {
    await backend.reset();
  } catch (error) {
    log("Reset failed", error);
  }
}
