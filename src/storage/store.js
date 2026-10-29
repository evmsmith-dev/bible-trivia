// Persistence. IndexedDB is used when available, with localStorage as a fallback.
//
// Each player on the device has their own database (BibleTriviaDB_player_<id>) and their own
// localStorage keys (bibleTriviaPlayer_<id>_...). The player who existed before multiple
// players were added has the id "primary", so their names are unchanged and their progress
// simply becomes the first player. The list of players and the active one live under
// DEVICE_KEYS.players. Light/dark and vibration are device settings, shared by everyone.
import { DAILY } from "../config.js";
import {
  createDefaultProfile, normalizeMode, sanitizeDailyMap, sanitizeDailyStats,
  sanitizeHistory, sanitizePlayerStats, sanitizeProfile, trimHighScores,
} from "../lib/records.js";
import { log } from "../lib/debug.js";

const PRIMARY_ID = "primary";
const MAX_PLAYERS = 8;
const dbName = (id) => `BibleTriviaDB_player_${id}`;
const DB_VERSION = 1;
const STORES = {
  history: "gameHistory",
  scores: "highScores",
  settings: "settings",
  stats: "playerStats",
  daily: "dailyChallenges",
  dailyStats: "dailyStats",
};

const playerPrefix = (id) => `bibleTriviaPlayer_${id}_`;

function playerKeys(id) {
  const prefix = playerPrefix(id);
  return {
    profile: `${prefix}profile`,
    history: `${prefix}history`,
    highScores: `${prefix}highScores`,
    difficultyMode: `${prefix}difficultyMode`,
    playerStats: `${prefix}playerStats`,
    dailyStats: `${prefix}dailyStats`,
    dailyChallenges: `${prefix}dailyChallenges`,
    dailyPulseAckDate: `${prefix}dailyPulseAckDate`,
    recentQuestions: `${prefix}recentQuestionIds`,
    howToPlaySeen: `${prefix}howToPlaySeen`,
  };
}

/** Keys for the active player. Reassigned when the player changes (imports see the new value). */
export let KEYS = playerKeys(PRIMARY_ID);

/** Device-wide keys, shared by every player. Keep `theme` in step with the script in index.html. */
export const DEVICE_KEYS = {
  players: "bibleTrivia_players",
  theme: "bibleTrivia_theme",
  vibration: "bibleTrivia_vibration",
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

function openDatabase(id) {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(dbName(id), DB_VERSION);
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

function emptySnapshot(id) {
  return {
    profile: createDefaultProfile(id),
    history: [],
    highScores: [],
    difficultyMode: "medium",
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

/** Any player's profile (name, picture, level counter), straight from localStorage. */
export function readProfile(id) {
  const raw = readLocalJson(playerKeys(id).profile, null);
  return raw ? sanitizeProfile(raw, id) : createDefaultProfile(id);
}

export function writeProfile(id, profile) {
  writeLocal(playerKeys(id).profile, JSON.stringify({ ...profile, id }));
}

function recentDaily(records) {
  const sorted = Object.values(sanitizeDailyMap(Object.fromEntries(records.map((record) => [record?.dateKey, record]))))
    .sort((a, b) => b.dateKey.localeCompare(a.dateKey))
    .slice(0, DAILY.recentLimit);
  return Object.fromEntries(sorted.map((record) => [record.dateKey, record]));
}

// ---------- backends ----------

function createIndexedDbBackend(db, id) {
  return {
    name: "indexedDB",
    id,
    close: () => db.close(),

    async load() {
      const names = Object.values(STORES);
      const tx = db.transaction(names, "readonly");
      const [history, scores, mode, stats, daily, dailyStats] = await Promise.all([
        promisify(tx.objectStore(STORES.history).getAll()),
        promisify(tx.objectStore(STORES.scores).getAll()),
        promisify(tx.objectStore(STORES.settings).get("difficultyMode")),
        promisify(tx.objectStore(STORES.stats).get("lifetime")),
        promisify(tx.objectStore(STORES.daily).getAll()),
        promisify(tx.objectStore(STORES.dailyStats).get("lifetime")),
      ]);
      return {
        profile: readProfile(id),
        history: sanitizeHistory(history),
        highScores: trimHighScores(scores || []),
        difficultyMode: normalizeMode(mode?.value),
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

    removeSettings(keys) {
      try {
        const tx = db.transaction(STORES.settings, "readwrite");
        keys.forEach((key) => tx.objectStore(STORES.settings).delete(key));
      } catch {
        // ignore
      }
    },

    async reset() {
      const tx = db.transaction(Object.values(STORES), "readwrite");
      Object.values(STORES).forEach((name) => tx.objectStore(name).clear());
      await transactionDone(tx);
    },
  };
}

function createLocalStorageBackend(id) {
  const keys = playerKeys(id);
  let snapshot = emptySnapshot(id);
  return {
    name: "localStorage",
    id,
    close: () => {},

    async load() {
      const dailyMap = readLocalJson(keys.dailyChallenges, {});
      snapshot = {
        profile: readProfile(id),
        history: sanitizeHistory(readLocalJson(keys.history, [])),
        highScores: trimHighScores(readLocalJson(keys.highScores, []) || []),
        difficultyMode: normalizeMode(readLocal(keys.difficultyMode)),
        playerStats: sanitizePlayerStats(readLocalJson(keys.playerStats, null)),
        dailyStats: sanitizeDailyStats(readLocalJson(keys.dailyStats, null)),
        dailyChallenges: recentDaily(Object.values(dailyMap && typeof dailyMap === "object" ? dailyMap : {})),
      };
      return structuredClone(snapshot);
    },

    async save(changes) {
      if (changes.addHistory) {
        snapshot.history.push(changes.addHistory);
        writeLocal(keys.history, JSON.stringify(snapshot.history));
      }
      if (changes.highScores) writeLocal(keys.highScores, JSON.stringify(changes.highScores));
      if (changes.settings?.difficultyMode) writeLocal(keys.difficultyMode, changes.settings.difficultyMode);
      if (changes.playerStats) writeLocal(keys.playerStats, JSON.stringify(changes.playerStats));
      if (changes.dailyStats) writeLocal(keys.dailyStats, JSON.stringify(changes.dailyStats));
      if (changes.dailyRecord) {
        snapshot.dailyChallenges[changes.dailyRecord.dateKey] = changes.dailyRecord;
        writeLocal(keys.dailyChallenges, JSON.stringify(snapshot.dailyChallenges));
      }
      return undefined;
    },

    async reset() {
      snapshot = emptySnapshot(id);
      [keys.history, keys.highScores, keys.difficultyMode, keys.playerStats, keys.dailyStats, keys.dailyChallenges]
        .forEach((key) => { try { localStorage.removeItem(key); } catch { /* ignore */ } });
    },
  };
}

// ---------- players ----------

function readPlayers() {
  const raw = readLocalJson(DEVICE_KEYS.players, null);
  const ids = Array.isArray(raw?.ids) ? raw.ids.filter((id) => typeof id === "string" && /^[a-z0-9]+$/i.test(id)) : [];
  const unique = [...new Set(ids)];
  if (!unique.length) unique.push(PRIMARY_ID); // a device from before multiple players
  const activeId = unique.includes(raw?.activeId) ? raw.activeId : unique[0];
  return { ids: unique, activeId };
}

function writePlayers(players) {
  writeLocal(DEVICE_KEYS.players, JSON.stringify(players));
}

/** Everyone on this device, in the order they were added: [{ id, profile }]. */
export function listPlayers() {
  return readPlayers().ids.map((id) => ({ id, profile: readProfile(id) }));
}

export const getActivePlayerId = () => readPlayers().activeId;
export const canAddPlayer = () => readPlayers().ids.length < MAX_PLAYERS;
export { MAX_PLAYERS };

const newPlayerId = () => `p${Date.now().toString(36)}${Math.floor(Math.random() * 1296).toString(36)}`;

/** Adds a player (not made active). Returns their id, or null when the device is full. */
export function createPlayer({ name, avatarId }) {
  const players = readPlayers();
  if (players.ids.length >= MAX_PLAYERS) return null;
  let id = newPlayerId();
  while (players.ids.includes(id)) id = newPlayerId();
  writeProfile(id, { ...createDefaultProfile(id), name, avatarId });
  writePlayers({ ...players, ids: [...players.ids, id] });
  return id;
}

// ---------- backends for a player ----------

let backend = createLocalStorageBackend(PRIMARY_ID);

async function openBackend(id) {
  if (typeof indexedDB !== "undefined") {
    try {
      return createIndexedDbBackend(await openDatabase(id), id);
    } catch (error) {
      log("IndexedDB unavailable, using localStorage", error);
    }
  }
  return createLocalStorageBackend(id);
}

// Settings that no longer exist (the post-round review choice moved onto the summary).
const RETIRED_SETTINGS = ["roundReviewPreference"];

/** Deletes saved values for retired settings. Best effort; nothing reads them any more. */
function removeRetiredSettings() {
  RETIRED_SETTINGS.forEach((key) => { try { localStorage.removeItem(`${playerPrefix(backend.id)}${key}`); } catch { /* ignore */ } });
  if (backend.name !== "indexedDB") return;
  backend.removeSettings?.(RETIRED_SETTINGS);
}

/** Light/dark and vibration used to be saved for the first player; they're device settings now.
 *  Runs first thing at startup, before the theme is read. */
export function moveDeviceSettings() {
  const old = playerPrefix(PRIMARY_ID);
  [["theme", DEVICE_KEYS.theme], ["vibration", DEVICE_KEYS.vibration]].forEach(([name, key]) => {
    const value = readLocal(`${old}${name}`);
    if (value !== null && readLocal(key) === null) writeLocal(key, value);
    try { localStorage.removeItem(`${old}${name}`); } catch { /* ignore */ }
  });
}

/** Opens the active player's saved data. Call once at startup, then loadAll(). */
export async function initStore() {
  moveDeviceSettings();
  const players = readPlayers();
  writePlayers(players); // records the list on devices from before multiple players
  KEYS = playerKeys(players.activeId);
  backend = await openBackend(players.activeId);
  removeRetiredSettings();
  // Ask the browser not to evict saved progress under storage pressure (best effort).
  navigator.storage?.persist?.().catch(() => {});
  return backend.name;
}

/** Makes another player active and returns their saved data (a snapshot, like loadAll). */
export async function switchPlayer(id) {
  const players = readPlayers();
  if (!players.ids.includes(id)) throw new Error(`Unknown player ${id}`);
  writePlayers({ ...players, activeId: id });
  if (backend.id !== id) {
    backend.close();
    KEYS = playerKeys(id);
    backend = await openBackend(id);
  }
  return loadAll();
}

/** Reads another player's saved data without switching to them (for the Everyone scores). */
export async function loadPlayerSnapshot(id) {
  if (id === backend.id) return loadAll();
  const other = await openBackend(id);
  try {
    return await other.load();
  } catch (error) {
    log("Could not read player", id, error);
    return emptySnapshot(id);
  } finally {
    other.close();
  }
}

/** Removes a player and everything saved for them. Switch away first if they're active. */
export async function deletePlayer(id) {
  const players = readPlayers();
  if (players.ids.length <= 1 || !players.ids.includes(id)) return false;
  if (backend.id === id) throw new Error("Switch to another player before deleting this one");
  const ids = players.ids.filter((playerId) => playerId !== id);
  writePlayers({ ids, activeId: ids.includes(players.activeId) ? players.activeId : ids[0] });
  const prefix = playerPrefix(id);
  try {
    Object.keys(localStorage).filter((key) => key.startsWith(prefix)).forEach((key) => localStorage.removeItem(key));
  } catch {
    // ignore
  }
  if (typeof indexedDB !== "undefined") {
    await new Promise((resolve) => {
      const request = indexedDB.deleteDatabase(dbName(id));
      request.onsuccess = request.onerror = request.onblocked = () => resolve();
    });
  }
  return true;
}

// ---------- the active player's data ----------

export async function loadAll() {
  try {
    return await backend.load();
  } catch (error) {
    log("Load failed, falling back to localStorage", error);
    backend = createLocalStorageBackend(backend.id);
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
  writeProfile(backend.id, profile);
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
