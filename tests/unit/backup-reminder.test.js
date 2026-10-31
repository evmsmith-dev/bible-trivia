import assert from "node:assert/strict";
import { beforeEach, test } from "node:test";

// A small localStorage for Node (the app reads its device settings from it).
const store = new Map();
globalThis.localStorage = {
  getItem: (key) => (store.has(key) ? store.get(key) : null),
  setItem: (key, value) => store.set(key, String(value)),
  removeItem: (key) => store.delete(key),
};
const { backupReminderDue } = await import("../../src/features/backup.js");
const { state } = await import("../../src/state.js");

const DAY = 24 * 60 * 60 * 1000;
const now = Date.parse("2026-10-31T12:00:00Z");
const games = (n) => Array.from({ length: n }, () => ({ correct: 5 }));

beforeEach(() => store.clear());

test("the reminder waits until a player has 20 games", () => {
  state.history = games(19);
  assert.equal(backupReminderDue(now), false);
  state.history = games(20);
  assert.equal(backupReminderDue(now), true); // never backed up on this device
});

test("it comes back a month after the last backup", () => {
  state.history = games(30);
  store.set("bibleTrivia_lastBackup", new Date(now - 29 * DAY).toISOString());
  assert.equal(backupReminderDue(now), false);
  store.set("bibleTrivia_lastBackup", new Date(now - 30 * DAY).toISOString());
  assert.equal(backupReminderDue(now), true);
});

test("Not now hides it for a week", () => {
  state.history = games(30);
  store.set("bibleTrivia_backupSnooze", new Date(now + 7 * DAY).toISOString());
  assert.equal(backupReminderDue(now), false);
  assert.equal(backupReminderDue(now + 7 * DAY), true);
});
