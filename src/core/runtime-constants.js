(function attachBibleTriviaConstants(globalScope) {
  const constants = {
    DIFFICULTY_MODE_KEYS: ["easy", "medium", "hard", "superHard"],
    ROUND_REVIEW_PREFERENCE_KEYS: ["ask", "alwaysReview", "alwaysSkip"],
    GAME_MODE_NORMAL: "normal",
    GAME_MODE_DAILY: "daily",
    DAILY_CHALLENGE_MODE_VERSION: "v1",
    DAILY_CHALLENGE_DIFFICULTY_MODE: "medium",
    DAILY_CHALLENGE_RECENT_LIMIT: 30,
    AUTO_ADVANCE_CORRECT_MS: 2200,
    AUTO_ADVANCE_WRONG_MS: 2800,
    QUESTIONS_PER_GAME: 10,
    MAX_HIGH_SCORES_SHOWN: 5,
    FEEDBACK_SHOW_MS: 2200,
    DAILY_SUCCESS_PERCENT: 70,
    DAILY_BASE_BONUS_MULTIPLIER: 0.05,
    PLAYER_LEVEL_THRESHOLDS: [0, 25, 60, 110, 180, 270, 390, 540, 730, 970, 1270, 1640],
    STREAK_BONUS_CAP: 10,
    STREAK_BONUS_TABLE: {
      3: 25,
      4: 50,
      5: 80,
      6: 115,
      7: 150,
      8: 185,
      9: 220,
      10: 260,
    },
  };

  globalScope.BibleTriviaConstants = Object.assign({}, globalScope.BibleTriviaConstants, constants);
})(window);
