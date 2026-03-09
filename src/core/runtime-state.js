(function attachBibleTriviaState(globalScope) {
  function createAppState(initialState) {
    const defaults = {
      gameQuestions: [],
      timerInterval: null,
      timeLeftAtAnswer: 0,
      currentIndex: 0,
      correctCount: 0,
      totalScore: 0,
      currentGameStreak: 0,
      currentGameMaxStreak: 0,
      bonusCarryStreak: 0,
      activeDailyChallengeDateKey: null,
      activeDailyChallengeRecord: null,
      lastRoundReview: [],
      pendingHighScoreCelebrationScore: null,
      pendingLevelCelebrationLevel: null,
      pendingDailyCompletionCelebration: false,
      isHighScoreCelebrationActive: false,
      gameHistory: [],
      highScores: [],
      playerProfile: null,
      currentGameMode: "normal",
      difficultyMode: "medium",
      roundReviewPreference: "ask",
      playerStats: null,
      dailyStats: null,
      dailyChallengeMap: {},
    };

    const state = Object.assign({}, defaults, initialState || {});

    function getCurrentGameMode() {
      return state.currentGameMode;
    }

    function getGameQuestions() {
      return state.gameQuestions;
    }

    function setGameQuestions(questions) {
      state.gameQuestions = Array.isArray(questions) ? questions : [];
      return state.gameQuestions;
    }

    function getTimerInterval() {
      return state.timerInterval;
    }

    function setTimerInterval(interval) {
      state.timerInterval = interval || null;
      return state.timerInterval;
    }

    function getTimeLeftAtAnswer() {
      return state.timeLeftAtAnswer;
    }

    function setTimeLeftAtAnswer(seconds) {
      const value = Number.isFinite(seconds) ? Math.max(0, seconds) : 0;
      state.timeLeftAtAnswer = value;
      return state.timeLeftAtAnswer;
    }

    function getCurrentIndex() {
      return state.currentIndex;
    }

    function setCurrentIndex(index) {
      const value = Number.isFinite(index) ? Math.max(0, Math.round(index)) : 0;
      state.currentIndex = value;
      return state.currentIndex;
    }

    function getCorrectCount() {
      return state.correctCount;
    }

    function setCorrectCount(count) {
      const value = Number.isFinite(count) ? Math.max(0, Math.round(count)) : 0;
      state.correctCount = value;
      return state.correctCount;
    }

    function getTotalScore() {
      return state.totalScore;
    }

    function setTotalScore(score) {
      const value = Number.isFinite(score) ? Math.max(0, Math.round(score)) : 0;
      state.totalScore = value;
      return state.totalScore;
    }

    function getCurrentGameStreak() {
      return state.currentGameStreak;
    }

    function setCurrentGameStreak(streak) {
      const value = Number.isFinite(streak) ? Math.max(0, Math.round(streak)) : 0;
      state.currentGameStreak = value;
      return state.currentGameStreak;
    }

    function getCurrentGameMaxStreak() {
      return state.currentGameMaxStreak;
    }

    function setCurrentGameMaxStreak(streak) {
      const value = Number.isFinite(streak) ? Math.max(0, Math.round(streak)) : 0;
      state.currentGameMaxStreak = value;
      return state.currentGameMaxStreak;
    }

    function getBonusCarryStreak() {
      return state.bonusCarryStreak;
    }

    function setBonusCarryStreak(streak) {
      const value = Number.isFinite(streak) ? Math.max(0, Math.round(streak)) : 0;
      state.bonusCarryStreak = value;
      return state.bonusCarryStreak;
    }

    function getActiveDailyChallengeDateKey() {
      return state.activeDailyChallengeDateKey;
    }

    function setActiveDailyChallengeDateKey(dateKey) {
      state.activeDailyChallengeDateKey = dateKey === null ? null : String(dateKey || "");
      return state.activeDailyChallengeDateKey;
    }

    function getActiveDailyChallengeRecord() {
      return state.activeDailyChallengeRecord;
    }

    function setActiveDailyChallengeRecord(record) {
      state.activeDailyChallengeRecord = record || null;
      return state.activeDailyChallengeRecord;
    }

    function getLastRoundReview() {
      return state.lastRoundReview;
    }

    function setLastRoundReview(reviewEntries) {
      state.lastRoundReview = Array.isArray(reviewEntries) ? reviewEntries : [];
      return state.lastRoundReview;
    }

    function getPendingHighScoreCelebrationScore() {
      return state.pendingHighScoreCelebrationScore;
    }

    function setPendingHighScoreCelebrationScore(score) {
      state.pendingHighScoreCelebrationScore = score === null ? null : Number(score);
      return state.pendingHighScoreCelebrationScore;
    }

    function getPendingLevelCelebrationLevel() {
      return state.pendingLevelCelebrationLevel;
    }

    function setPendingLevelCelebrationLevel(level) {
      state.pendingLevelCelebrationLevel = level === null ? null : Number(level);
      return state.pendingLevelCelebrationLevel;
    }

    function getPendingDailyCompletionCelebration() {
      return state.pendingDailyCompletionCelebration;
    }

    function setPendingDailyCompletionCelebration(isPending) {
      state.pendingDailyCompletionCelebration = Boolean(isPending);
      return state.pendingDailyCompletionCelebration;
    }

    function getIsHighScoreCelebrationActive() {
      return state.isHighScoreCelebrationActive;
    }

    function setIsHighScoreCelebrationActive(isActive) {
      state.isHighScoreCelebrationActive = Boolean(isActive);
      return state.isHighScoreCelebrationActive;
    }

    function getGameHistory() {
      return state.gameHistory;
    }

    function setGameHistory(history) {
      state.gameHistory = Array.isArray(history) ? history : [];
      return state.gameHistory;
    }

    function getHighScores() {
      return state.highScores;
    }

    function setHighScores(scores) {
      state.highScores = Array.isArray(scores) ? scores : [];
      return state.highScores;
    }

    function getPlayerProfile() {
      return state.playerProfile;
    }

    function setPlayerProfile(profile) {
      state.playerProfile = profile;
      return state.playerProfile;
    }

    function setCurrentGameMode(mode) {
      state.currentGameMode = String(mode || defaults.currentGameMode);
      return state.currentGameMode;
    }

    function getDifficultyMode() {
      return state.difficultyMode;
    }

    function setDifficultyMode(mode) {
      state.difficultyMode = String(mode || defaults.difficultyMode);
      return state.difficultyMode;
    }

    function getRoundReviewPreference() {
      return state.roundReviewPreference;
    }

    function setRoundReviewPreference(preference) {
      state.roundReviewPreference = String(preference || defaults.roundReviewPreference);
      return state.roundReviewPreference;
    }

    function getPlayerStats() {
      return state.playerStats;
    }

    function setPlayerStats(stats) {
      state.playerStats = stats;
      return state.playerStats;
    }

    function getDailyStats() {
      return state.dailyStats;
    }

    function setDailyStats(stats) {
      state.dailyStats = stats;
      return state.dailyStats;
    }

    function getDailyChallengeMap() {
      return state.dailyChallengeMap;
    }

    function setDailyChallengeMap(map) {
      state.dailyChallengeMap = map && typeof map === "object" ? map : {};
      return state.dailyChallengeMap;
    }

    function snapshot() {
      return {
        currentGameMode: state.currentGameMode,
        gameQuestions: state.gameQuestions,
        timerInterval: state.timerInterval,
        timeLeftAtAnswer: state.timeLeftAtAnswer,
        currentIndex: state.currentIndex,
        correctCount: state.correctCount,
        totalScore: state.totalScore,
        currentGameStreak: state.currentGameStreak,
        currentGameMaxStreak: state.currentGameMaxStreak,
        bonusCarryStreak: state.bonusCarryStreak,
        activeDailyChallengeDateKey: state.activeDailyChallengeDateKey,
        activeDailyChallengeRecord: state.activeDailyChallengeRecord,
        lastRoundReview: state.lastRoundReview,
        pendingHighScoreCelebrationScore: state.pendingHighScoreCelebrationScore,
        pendingLevelCelebrationLevel: state.pendingLevelCelebrationLevel,
        pendingDailyCompletionCelebration: state.pendingDailyCompletionCelebration,
        isHighScoreCelebrationActive: state.isHighScoreCelebrationActive,
        gameHistory: state.gameHistory,
        highScores: state.highScores,
        playerProfile: state.playerProfile,
        difficultyMode: state.difficultyMode,
        roundReviewPreference: state.roundReviewPreference,
        playerStats: state.playerStats,
        dailyStats: state.dailyStats,
        dailyChallengeMap: state.dailyChallengeMap,
      };
    }

    return {
      getCurrentGameMode,
      getGameQuestions,
      setGameQuestions,
      getTimerInterval,
      setTimerInterval,
      getTimeLeftAtAnswer,
      setTimeLeftAtAnswer,
      getCurrentIndex,
      setCurrentIndex,
      getCorrectCount,
      setCorrectCount,
      getTotalScore,
      setTotalScore,
      getCurrentGameStreak,
      setCurrentGameStreak,
      getCurrentGameMaxStreak,
      setCurrentGameMaxStreak,
      getBonusCarryStreak,
      setBonusCarryStreak,
      getActiveDailyChallengeDateKey,
      setActiveDailyChallengeDateKey,
      getActiveDailyChallengeRecord,
      setActiveDailyChallengeRecord,
      getLastRoundReview,
      setLastRoundReview,
      getPendingHighScoreCelebrationScore,
      setPendingHighScoreCelebrationScore,
      getPendingLevelCelebrationLevel,
      setPendingLevelCelebrationLevel,
      getPendingDailyCompletionCelebration,
      setPendingDailyCompletionCelebration,
      getIsHighScoreCelebrationActive,
      setIsHighScoreCelebrationActive,
      getGameHistory,
      setGameHistory,
      getHighScores,
      setHighScores,
      getPlayerProfile,
      setPlayerProfile,
      setCurrentGameMode,
      getDifficultyMode,
      setDifficultyMode,
      getRoundReviewPreference,
      setRoundReviewPreference,
      getPlayerStats,
      setPlayerStats,
      getDailyStats,
      setDailyStats,
      getDailyChallengeMap,
      setDailyChallengeMap,
      snapshot,
    };
  }

  globalScope.BibleTriviaState = Object.assign({}, globalScope.BibleTriviaState, {
    createAppState,
  });
})(window);
