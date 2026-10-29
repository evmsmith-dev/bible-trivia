// Picks a balanced set of questions for a mode: guaranteed picks from each mode's
// matrix, then the rest by category/difficulty targets, then anything eligible.
// Uses only the `random` function passed in, so a seeded random gives repeatable results.
// `recentIds` (oldest first) makes questions the player saw recently the last to be picked.
import { CATEGORIES, CATEGORY_TARGETS, MODES, QUESTIONS_PER_GAME } from "../config.js";
import { shuffleInPlace } from "./utils.js";

export function selectQuestionsForMode(allQuestions, modeKey, random = Math.random, count = QUESTIONS_PER_GAME, recentIds = []) {
  // Unseen questions rank first, then seen ones from longest ago to most recent.
  const recency = new Map(recentIds.map((id, index) => [id, index]));
  const rank = (question) => recency.get(question.id) ?? -1;
  const freshestFirst = (list) => shuffleInPlace(list, random).sort((a, b) => rank(a) - rank(b));
  const mix = (MODES[modeKey] || MODES.medium).mix;
  const catRemaining = { ...CATEGORY_TARGETS };
  const diffRemaining = { ...mix.difficultyTargets };
  const available = allQuestions.filter((question) => mix.difficulties.includes(question.difficulty));

  const pools = {};
  for (const difficulty of mix.difficulties) {
    for (const category of CATEGORIES) pools[`${difficulty}|${category}`] = [];
  }
  for (const question of available) {
    pools[`${question.difficulty}|${question.category}`]?.push(question);
  }
  Object.values(pools).forEach(freshestFirst);

  const selected = new Set();
  const take = (question) => {
    selected.add(question.id);
    catRemaining[question.category] = (catRemaining[question.category] || 0) - 1;
    diffRemaining[question.difficulty] = (diffRemaining[question.difficulty] || 0) - 1;
  };

  for (const difficulty of mix.difficulties) {
    for (const category of CATEGORIES) {
      const needed = mix.matrix[difficulty]?.[category] ?? 0;
      pools[`${difficulty}|${category}`].slice(0, needed).forEach(take);
    }
  }

  // Fill the remaining slots with whatever brings the round closest to its category and
  // difficulty targets (e.g. 4/4/2 categories and 5/5 easy/medium in Medium mode).
  let remaining = freshestFirst(available.filter((question) => !selected.has(question.id)));
  while (selected.size < count) {
    const candidates = remaining
      .filter((q) => (catRemaining[q.category] || 0) > 0 && (diffRemaining[q.difficulty] || 0) > 0)
      .sort((a, b) =>
        (catRemaining[b.category] || 0) - (catRemaining[a.category] || 0)
        || (diffRemaining[b.difficulty] || 0) - (diffRemaining[a.difficulty] || 0)
        || rank(a) - rank(b));
    if (!candidates.length) break;
    take(candidates[0]);
    remaining = remaining.filter((question) => question.id !== candidates[0].id);
  }

  const result = shuffleInPlace(available.filter((question) => selected.has(question.id)), random);
  if (result.length < count) {
    for (const question of freshestFirst(available.filter((q) => !selected.has(q.id)))) {
      if (result.length >= count) break;
      selected.add(question.id);
      result.push(question);
    }
  }
  return result.slice(0, count);
}
