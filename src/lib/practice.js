// Practice list: the questions a player has got wrong, kept until they get each one right.
// Pure functions; the list is saved per player (storage/store.js) as { [questionId]: entry }.
//   entry = { misses: how many times it was missed, lastMissed: ISO time of the latest miss }
import { PRACTICE } from "../config.js";
import { shuffled } from "./utils.js";

/** Cleans a saved list and keeps it to the most recent PRACTICE.maxSaved misses. */
export function sanitizePractice(raw) {
  const entries = Object.entries(raw && typeof raw === "object" ? raw : {})
    .filter(([id]) => /^\d+$/.test(id))
    .map(([id, entry]) => [id, {
      misses: Math.max(1, Math.floor(Number(entry?.misses) || 1)),
      lastMissed: typeof entry?.lastMissed === "string" ? entry.lastMissed : "",
    }])
    .sort((a, b) => b[1].lastMissed.localeCompare(a[1].lastMissed))
    .slice(0, PRACTICE.maxSaved);
  return Object.fromEntries(entries);
}

/** A wrong answer (or running out of time) puts the question on the list. */
export function recordMiss(list, id, when = new Date().toISOString()) {
  const entry = list[id];
  return sanitizePractice({ ...list, [id]: { misses: (entry?.misses || 0) + 1, lastMissed: when } });
}

/** A right answer takes it off. */
export function recordRight(list, id) {
  if (!(id in list)) return list;
  const next = { ...list };
  delete next[id];
  return next;
}

/** Questions on the list that are still in the question bank. */
export function practiceQuestions(list, questionsById) {
  return Object.keys(list).map((id) => questionsById.get(Number(id))).filter(Boolean);
}

/** A practice round: the most recently missed questions (up to PRACTICE.roundSize), in a random order. */
export function pickPracticeRound(list, questionsById, random = Math.random) {
  const recentFirst = Object.entries(list)
    .sort((a, b) => b[1].lastMissed.localeCompare(a[1].lastMissed))
    .map(([id]) => questionsById.get(Number(id)))
    .filter(Boolean)
    .slice(0, PRACTICE.roundSize);
  return shuffled(recentFirst, random);
}
