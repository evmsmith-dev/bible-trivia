// Picks a balanced set of questions for a mode: guaranteed picks from each mode's
// matrix, then the rest by category/difficulty targets, then anything eligible.
// Uses only the `random` function passed in, so a seeded random gives repeatable results.
// `recentIds` (oldest first) makes questions the player saw recently the last to be picked.
// Within a round, questions avoid sharing a correct answer or an opening ("Which Gospel
// contains the story…", "Who was the apostle who…") so a round doesn't feel repetitive;
// a clash is only allowed when nothing else fits.
import { CATEGORIES, CATEGORY_TARGETS, MODES, QUESTIONS_PER_GAME } from "../config.js";
import { shuffleInPlace } from "./utils.js";

const normalize = (text) => String(text).toLowerCase().replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();
/** The correct answer, normalized ("Paul", "paul." and "Paul " are the same answer). */
export const answerKey = (question) => normalize(question.opts?.[question.ans] ?? "");
/** The first five words, which identify look-alike questions ("which gospel contains the story"). */
export const openingKey = (question) => normalize(question.q).split(" ").slice(0, 5).join(" ");

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
  const usedAnswers = new Set();
  const usedOpenings = new Set();
  const clashes = (question) => usedAnswers.has(answerKey(question)) || usedOpenings.has(openingKey(question));
  /** First question in `list` that doesn't clash with the round so far (or the first one, if all clash). */
  const pickFrom = (list) => list.find((question) => !clashes(question)) || list[0];
  const take = (question) => {
    selected.add(question.id);
    usedAnswers.add(answerKey(question));
    usedOpenings.add(openingKey(question));
    catRemaining[question.category] = (catRemaining[question.category] || 0) - 1;
    diffRemaining[question.difficulty] = (diffRemaining[question.difficulty] || 0) - 1;
  };

  for (const difficulty of mix.difficulties) {
    for (const category of CATEGORIES) {
      const needed = mix.matrix[difficulty]?.[category] ?? 0;
      const pool = pools[`${difficulty}|${category}`];
      for (let i = 0; i < needed; i++) {
        const question = pickFrom(pool.filter((q) => !selected.has(q.id)));
        if (question) take(question);
      }
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
        || Number(clashes(a)) - Number(clashes(b))
        || rank(a) - rank(b));
    if (!candidates.length) break;
    take(candidates[0]);
    remaining = remaining.filter((question) => question.id !== candidates[0].id);
  }

  const result = shuffleInPlace(available.filter((question) => selected.has(question.id)), random);
  if (result.length < count) {
    const rest = freshestFirst(available.filter((q) => !selected.has(q.id)));
    while (result.length < count && rest.length) {
      const question = pickFrom(rest);
      rest.splice(rest.indexOf(question), 1);
      take(question);
      result.push(question);
    }
  }
  return result.slice(0, count);
}
