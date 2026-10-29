// The app's single in-memory state. Saved data is loaded into it at startup and
// written back through storage/store.js; everything else is per-session.
import { GAME_MODE_NORMAL } from "./config.js";
import { createDefaultProfile, sanitizeDailyStats, sanitizePlayerStats } from "./lib/records.js";

export const state = {
  // Saved data
  questions: [],
  questionsById: new Map(),
  profile: createDefaultProfile(),
  history: [],
  highScores: [],
  difficultyMode: "medium",
  roundReviewPreference: "ask",
  playerStats: sanitizePlayerStats(null),
  dailyStats: sanitizeDailyStats(null),
  dailyChallenges: {},
  recentQuestionIds: [], // oldest first; see config.RECENT_QUESTION_MEMORY

  // Current round
  game: {
    mode: GAME_MODE_NORMAL, // "normal" | "daily"
    dailyRecord: null,
    questions: [],
    index: 0,
    correct: 0,
    score: 0,
    streak: 0, // in this round
    maxStreak: 0,
    review: [],
    startLevel: 1,
    active: false,
  },
  // Streak used for the bonus; carries across "Play" rounds, resets on a miss or Home.
  bonusStreak: 0,
  celebrationActive: false,
};

export function applySnapshot(snapshot) {
  Object.assign(state, {
    profile: snapshot.profile,
    history: snapshot.history,
    highScores: snapshot.highScores,
    difficultyMode: snapshot.difficultyMode,
    roundReviewPreference: snapshot.roundReviewPreference,
    playerStats: snapshot.playerStats,
    dailyStats: snapshot.dailyStats,
    dailyChallenges: snapshot.dailyChallenges,
  });
}
