// Badges: what they are, how close a player is, and which ones they've earned.
// Pure functions. Everything is worked out from saved data (history, lifetime stats, Daily
// Challenge records, level), so existing players are credited for what they've already done.
// A badge with several goals has levels (bronze, silver, gold); once earned, a level is kept
// even if the data it came from is later trimmed (Daily records only keep the last 30 days).
import { CATEGORIES, LEVEL_THRESHOLDS, QUESTIONS_PER_GAME } from "../config.js";
import { getLevel } from "./scoring.js";
import { normalizeMode } from "./records.js";

export const TIER_NAMES = ["Bronze", "Silver", "Gold"];

const rounds = (data) => data.history;
const best = (values) => values.reduce((max, value) => Math.max(max, Number(value) || 0), 0);
const roundsIn = (data, modes) => rounds(data).filter((game) => modes.includes(normalizeMode(game.difficultyMode)));
const dailyBestCorrect = (data) => best(Object.values(data.dailyChallenges || {}).map((record) => record?.bestCorrect));

export const BADGE_GROUPS = ["Getting started", "Skill", "Knowledge", "Daily Challenge"];

/**
 * Each badge: `goals` (one per level) and `value(data)`, the number compared against them.
 * `how(goal)` says what to do, shown under locked badges and as each level's description.
 */
export const BADGES = [
  {
    id: "first-steps", group: "Getting started", emoji: "🌱", name: "First Steps", goals: [1],
    how: () => "Finish your first round.",
    value: (data) => rounds(data).length + (data.dailyStats?.totalDailyAttempts || 0),
  },
  {
    id: "faithful-reader", group: "Getting started", emoji: "📖", name: "Faithful Reader", goals: [10, 50, 100],
    // Only rounds with at least 5 right count, so tapping through rounds at random doesn't earn it.
    how: (goal) => `Play ${goal} rounds with at least 5 right.`,
    value: (data) => rounds(data).filter((game) => game.correct >= 5).length,
  },
  {
    id: "level", group: "Getting started", emoji: "🎓", name: "Climbing Higher", goals: [5, 10, LEVEL_THRESHOLDS.length],
    how: (goal) => (goal === LEVEL_THRESHOLDS.length ? `Reach the top level (Level ${goal}).` : `Reach Level ${goal}.`),
    value: (data) => getLevel(data.profile?.nonDailyCorrectAnswers),
  },
  {
    id: "perfect-round", group: "Skill", emoji: "💯", name: "Perfect Round", goals: [1],
    how: () => `Get all ${QUESTIONS_PER_GAME} right in a round.`,
    value: (data) => Number(rounds(data).some((game) => game.correct >= game.total) || dailyBestCorrect(data) >= QUESTIONS_PER_GAME),
  },
  {
    id: "on-fire", group: "Skill", emoji: "🔥", name: "On Fire", goals: [10],
    how: (goal) => `Get ${goal} right answers in a row.`,
    value: (data) => data.playerStats?.allTimeBestStreak || 0,
  },
  {
    id: "hard-hitter", group: "Skill", emoji: "🧗", name: "Hard Hitter", goals: [8],
    how: (goal) => `Get ${goal} or more right in a Hard or Super Hard round.`,
    value: (data) => best(roundsIn(data, ["hard", "superHard"]).map((game) => game.correct)),
  },
  {
    id: "super-scholar", group: "Skill", emoji: "👑", name: "Super Scholar", goals: [1],
    how: () => "Get a perfect round on Super Hard.",
    value: (data) => Number(roundsIn(data, ["superHard"]).some((game) => game.correct >= game.total)),
  },
  {
    id: "high-scorer", group: "Skill", emoji: "⭐", name: "High Scorer", goals: [1500, 2500, 4000],
    how: (goal) => `Score ${goal.toLocaleString("en-US")} points in one round.`,
    value: (data) => best(rounds(data).map((game) => game.score)),
  },
  {
    id: "ot-scholar", group: "Knowledge", emoji: "📜", name: "Old Testament Scholar", goals: [50, 150, 300],
    how: (goal) => `Get ${goal} Old Testament questions right.`,
    value: (data) => data.playerStats?.correctByCategory?.["Old Testament"] || 0,
  },
  {
    id: "nt-scholar", group: "Knowledge", emoji: "✝️", name: "New Testament Scholar", goals: [50, 150, 300],
    how: (goal) => `Get ${goal} New Testament questions right.`,
    value: (data) => data.playerStats?.correctByCategory?.["New Testament"] || 0,
  },
  {
    id: "well-rounded", group: "Knowledge", emoji: "📚", name: "Well Rounded", goals: [25],
    how: (goal) => `Get ${goal} right in each of Old Testament, New Testament and General.`,
    value: (data) => Math.min(...CATEGORIES.map((category) => data.playerStats?.correctByCategory?.[category] || 0)),
  },
  {
    id: "daily-starter", group: "Daily Challenge", emoji: "🎯", name: "Daily Starter", goals: [1],
    how: () => "Complete a Daily Challenge.",
    value: (data) => data.dailyStats?.totalDailyCompletions || 0,
  },
  {
    id: "week-streak", group: "Daily Challenge", emoji: "📅", name: "Daily Devotion", goals: [7, 30],
    how: (goal) => `Complete the Daily Challenge ${goal} days in a row.`,
    value: (data) => data.dailyStats?.bestDailyStreak || 0,
  },
  {
    id: "daily-ace", group: "Daily Challenge", emoji: "🏅", name: "Daily Ace", goals: [1],
    how: () => `Get all ${QUESTIONS_PER_GAME} right in a Daily Challenge.`,
    value: (data) => Number(dailyBestCorrect(data) >= QUESTIONS_PER_GAME),
  },
];

export const BADGE_IDS = BADGES.map((badge) => badge.id);
export const TOTAL_BADGE_LEVELS = BADGES.reduce((sum, badge) => sum + badge.goals.length, 0);

/** Name of a level: "Bronze"…"Gold" for three levels, "Bronze"/"Gold" for two, "" for one. */
export function tierName(badge, tier) {
  if (badge.goals.length === 1 || tier < 1) return "";
  if (badge.goals.length === 2) return tier === 1 ? TIER_NAMES[0] : TIER_NAMES[2];
  return TIER_NAMES[tier - 1] || "";
}

/** Cleans a saved { [id]: { tier, earnedAt } } map. */
export function sanitizeEarned(raw) {
  const earned = {};
  if (!raw || typeof raw !== "object") return earned;
  for (const badge of BADGES) {
    const entry = raw[badge.id];
    const tier = Math.min(badge.goals.length, Math.max(0, Math.floor(Number(entry?.tier) || 0)));
    if (!tier) continue;
    earned[badge.id] = { tier, earnedAt: typeof entry.earnedAt === "string" ? entry.earnedAt : null };
  }
  return earned;
}

/** Every badge with its progress: { badge, value, tier, nextGoal, earnedAt }. */
export function badgeProgress(data, earned = {}) {
  return BADGES.map((badge) => {
    const value = Math.max(0, Number(badge.value(data)) || 0);
    const reached = badge.goals.filter((goal) => value >= goal).length;
    const tier = Math.max(reached, earned[badge.id]?.tier || 0);
    return {
      badge,
      value,
      tier,
      nextGoal: badge.goals[tier] ?? null, // null once every level is earned
      earnedAt: earned[badge.id]?.earnedAt ?? null,
    };
  });
}

/**
 * Compares progress with what was saved. Returns the updated map and the newly earned levels
 * ([{ badge, tier }]). `when` is stamped on new levels (null when crediting existing players,
 * whose dates aren't known).
 */
export function updateEarned(data, earned, when = new Date().toISOString()) {
  const next = { ...earned };
  const newlyEarned = [];
  for (const { badge, tier } of badgeProgress(data, earned)) {
    if (tier > (earned[badge.id]?.tier || 0)) {
      next[badge.id] = { tier, earnedAt: when };
      newlyEarned.push({ badge, tier });
    }
  }
  return { earned: next, newlyEarned };
}

/** How many badge levels are earned (each level counts once). */
export const countEarned = (earned) => Object.values(earned).reduce((sum, entry) => sum + (entry?.tier || 0), 0);
