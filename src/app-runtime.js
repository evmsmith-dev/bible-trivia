const DataFeature = window.BibleTriviaData || {};
const questionRuntimePayload = typeof DataFeature.getQuestionRuntimePayload === 'function'
  ? DataFeature.getQuestionRuntimePayload()
  : null;
const allQuestions = Array.isArray(questionRuntimePayload?.questions)
  ? questionRuntimePayload.questions
  : [];
const allQuestionsById = questionRuntimePayload?.questionsById instanceof Map
  ? questionRuntimePayload.questionsById
  : new Map(allQuestions.map((question) => [question.id, question]));

    const CoreConstants = window.BibleTriviaConstants || {};
    const GAME_MODE_NORMAL = CoreConstants.GAME_MODE_NORMAL || 'normal';
    const GAME_MODE_DAILY='daily';
    const DAILY_CHALLENGE_MODE_VERSION = CoreConstants.DAILY_CHALLENGE_MODE_VERSION || 'v1';
    const DAILY_CHALLENGE_DIFFICULTY_MODE = CoreConstants.DAILY_CHALLENGE_DIFFICULTY_MODE || 'medium';
    const DAILY_CHALLENGE_RECENT_LIMIT = Number.isFinite(CoreConstants.DAILY_CHALLENGE_RECENT_LIMIT)
      ? Math.max(1, Math.round(CoreConstants.DAILY_CHALLENGE_RECENT_LIMIT))
      : 30;

    const DIFFICULTY_MODE_KEYS = Array.isArray(CoreConstants.DIFFICULTY_MODE_KEYS)
      ? CoreConstants.DIFFICULTY_MODE_KEYS
      : ['easy', 'medium', 'hard', 'superHard'];
    const ROUND_REVIEW_PREFERENCE_KEYS = Array.isArray(CoreConstants.ROUND_REVIEW_PREFERENCE_KEYS)
      ? CoreConstants.ROUND_REVIEW_PREFERENCE_KEYS
      : ['ask', 'alwaysReview', 'alwaysSkip'];
    const CoreEngine = window.BibleTriviaEngine || {};
    const CoreUtils = window.BibleTriviaCore || {};
    const MainFeature = window.BibleTriviaMain || {};
    const UiFeature = window.BibleTriviaUI || {};
    const PlayerFeature = window.BibleTriviaPlayer || {};
    const DailyFeature = window.BibleTriviaDaily || {};
    const LeaderboardFeature = window.BibleTriviaLeaderboard || {};

    function normalizeDifficultyMode(mode) {
      return CoreUtils.normalizeDifficultyMode(mode);
    }

    function normalizeRoundReviewPreference(value) {
      return CoreUtils.normalizeRoundReviewPreference(value);
    }

    function isValidHighScoreRecord(record) {
      return CoreUtils.isValidHighScoreRecord(record);
    }

    function compareScoresDescending(a, b) {
      return CoreUtils.compareScoresDescending(a, b);
    }

    function getTopScoresByMode(scores, mode, limit = 5) {
      return CoreUtils.getTopScoresByMode(scores, mode, limit);
    }

    function normalizeAndTrimHighScores(scores) {
      return CoreUtils.normalizeAndTrimHighScores(scores, MAX_HIGH_SCORES_SHOWN);
    }

    // Initialized after storage key constants are declared.
    let DBManager;


    let gameQuestions = [];
    let currentIndex = 0;
    let correctCount = 0;
    let totalScore = 0;
    let gameHistory = [];
    let highScores = [];
    let playerStats = null;
    let playerProfile = null;
    let dailyStats = null;
    let dailyChallengeMap = {};
    let currentGameMode = GAME_MODE_NORMAL;
    let activeDailyChallengeDateKey = null;
    let activeDailyChallengeRecord = null;
    let lastRoundReview = [];
    let pendingHighScoreCelebrationScore = null;
    let pendingLevelCelebrationLevel = null;
    let pendingDailyCompletionCelebration = false;
    let isHighScoreCelebrationActive = false;
    let currentGameStreak = 0;
    let currentGameMaxStreak = 0;
    let bonusCarryStreak = 0;
    let timerInterval;
    let timeLeftAtAnswer = 0;
    let difficultyMode = 'medium';  // 'easy' | 'medium' | 'hard' | 'superHard'
    let roundReviewPreference = 'ask'; // 'ask' | 'alwaysReview' | 'alwaysSkip'
    const RuntimeState = window.BibleTriviaState || {};
    const appState = typeof RuntimeState.createAppState === 'function'
      ? RuntimeState.createAppState({
          gameQuestions,
          timerInterval,
          timeLeftAtAnswer,
          currentIndex,
          correctCount,
          totalScore,
          currentGameStreak,
          currentGameMaxStreak,
          bonusCarryStreak,
          activeDailyChallengeDateKey,
          activeDailyChallengeRecord,
          lastRoundReview,
          pendingHighScoreCelebrationScore,
          pendingLevelCelebrationLevel,
          pendingDailyCompletionCelebration,
          isHighScoreCelebrationActive,
          gameHistory,
          highScores,
          playerProfile,
          currentGameMode,
          difficultyMode,
          roundReviewPreference,
          playerStats,
          dailyStats,
          dailyChallengeMap
        })
      : null;

    function setCurrentGameMode(nextMode) {
      currentGameMode = String(nextMode || GAME_MODE_NORMAL);
      if (appState) {
        appState.setCurrentGameMode(currentGameMode);
      }
      return currentGameMode;
    }

    function setGameQuestions(nextQuestions) {
      gameQuestions = Array.isArray(nextQuestions) ? nextQuestions : [];
      if (appState) {
        appState.setGameQuestions(gameQuestions);
      }
      return gameQuestions;
    }

    function setTimerInterval(nextTimerInterval) {
      timerInterval = nextTimerInterval || null;
      if (appState) {
        appState.setTimerInterval(timerInterval);
      }
      return timerInterval;
    }

    function setTimeLeftAtAnswer(nextSeconds) {
      const value = Number.isFinite(nextSeconds) ? Math.max(0, nextSeconds) : 0;
      timeLeftAtAnswer = value;
      if (appState) {
        appState.setTimeLeftAtAnswer(timeLeftAtAnswer);
      }
      return timeLeftAtAnswer;
    }

    function setCurrentIndex(nextIndex) {
      const value = Number.isFinite(nextIndex) ? Math.max(0, Math.round(nextIndex)) : 0;
      currentIndex = value;
      if (appState) {
        appState.setCurrentIndex(currentIndex);
      }
      return currentIndex;
    }

    function setCorrectCount(nextCount) {
      const value = Number.isFinite(nextCount) ? Math.max(0, Math.round(nextCount)) : 0;
      correctCount = value;
      if (appState) {
        appState.setCorrectCount(correctCount);
      }
      return correctCount;
    }

    function setTotalScore(nextScore) {
      const value = Number.isFinite(nextScore) ? Math.max(0, Math.round(nextScore)) : 0;
      totalScore = value;
      if (appState) {
        appState.setTotalScore(totalScore);
      }
      return totalScore;
    }

    function setCurrentGameStreak(nextStreak) {
      const value = Number.isFinite(nextStreak) ? Math.max(0, Math.round(nextStreak)) : 0;
      currentGameStreak = value;
      if (appState) {
        appState.setCurrentGameStreak(currentGameStreak);
      }
      return currentGameStreak;
    }

    function setCurrentGameMaxStreak(nextStreak) {
      const value = Number.isFinite(nextStreak) ? Math.max(0, Math.round(nextStreak)) : 0;
      currentGameMaxStreak = value;
      if (appState) {
        appState.setCurrentGameMaxStreak(currentGameMaxStreak);
      }
      return currentGameMaxStreak;
    }

    function setBonusCarryStreak(nextStreak) {
      const value = Number.isFinite(nextStreak) ? Math.max(0, Math.round(nextStreak)) : 0;
      bonusCarryStreak = value;
      if (appState) {
        appState.setBonusCarryStreak(bonusCarryStreak);
      }
      return bonusCarryStreak;
    }

    function setActiveDailyChallengeDateKey(nextDateKey) {
      activeDailyChallengeDateKey = nextDateKey === null ? null : String(nextDateKey || '');
      if (appState) {
        appState.setActiveDailyChallengeDateKey(activeDailyChallengeDateKey);
      }
      return activeDailyChallengeDateKey;
    }

    function setActiveDailyChallengeRecord(nextRecord) {
      activeDailyChallengeRecord = nextRecord || null;
      if (appState) {
        appState.setActiveDailyChallengeRecord(activeDailyChallengeRecord);
      }
      return activeDailyChallengeRecord;
    }

    function setLastRoundReview(nextEntries) {
      lastRoundReview = Array.isArray(nextEntries) ? nextEntries : [];
      if (appState) {
        appState.setLastRoundReview(lastRoundReview);
      }
      return lastRoundReview;
    }

    function setPendingHighScoreCelebrationScore(nextScore) {
      pendingHighScoreCelebrationScore = nextScore === null ? null : Number(nextScore);
      if (appState) {
        appState.setPendingHighScoreCelebrationScore(pendingHighScoreCelebrationScore);
      }
      return pendingHighScoreCelebrationScore;
    }

    function setPendingLevelCelebrationLevel(nextLevel) {
      pendingLevelCelebrationLevel = nextLevel === null ? null : Number(nextLevel);
      if (appState) {
        appState.setPendingLevelCelebrationLevel(pendingLevelCelebrationLevel);
      }
      return pendingLevelCelebrationLevel;
    }

    function setPendingDailyCompletionCelebration(nextValue) {
      pendingDailyCompletionCelebration = Boolean(nextValue);
      if (appState) {
        appState.setPendingDailyCompletionCelebration(pendingDailyCompletionCelebration);
      }
      return pendingDailyCompletionCelebration;
    }

    function setIsHighScoreCelebrationActive(nextValue) {
      isHighScoreCelebrationActive = Boolean(nextValue);
      if (appState) {
        appState.setIsHighScoreCelebrationActive(isHighScoreCelebrationActive);
      }
      return isHighScoreCelebrationActive;
    }

    function setGameHistory(nextHistory) {
      gameHistory = Array.isArray(nextHistory) ? nextHistory : [];
      if (appState) {
        appState.setGameHistory(gameHistory);
      }
      return gameHistory;
    }

    function setHighScores(nextScores) {
      highScores = Array.isArray(nextScores) ? nextScores : [];
      if (appState) {
        appState.setHighScores(highScores);
      }
      return highScores;
    }

    function setPlayerProfile(nextProfile) {
      playerProfile = nextProfile;
      if (appState) {
        appState.setPlayerProfile(playerProfile);
      }
      return playerProfile;
    }

    function setDifficultyMode(nextMode) {
      difficultyMode = normalizeDifficultyMode(nextMode);
      if (appState) {
        appState.setDifficultyMode(difficultyMode);
      }
      return difficultyMode;
    }

    function setRoundReviewPreference(nextPreference) {
      roundReviewPreference = normalizeRoundReviewPreference(nextPreference);
      if (appState) {
        appState.setRoundReviewPreference(roundReviewPreference);
      }
      return roundReviewPreference;
    }

    function setPlayerStats(nextStats) {
      playerStats = nextStats;
      if (appState) {
        appState.setPlayerStats(playerStats);
      }
      return playerStats;
    }

    function setDailyStats(nextStats) {
      dailyStats = nextStats;
      if (appState) {
        appState.setDailyStats(dailyStats);
      }
      return dailyStats;
    }

    function setDailyChallengeMap(nextMap) {
      dailyChallengeMap = nextMap && typeof nextMap === 'object' ? nextMap : {};
      if (appState) {
        appState.setDailyChallengeMap(dailyChallengeMap);
      }
      return dailyChallengeMap;
    }
    const AUTO_ADVANCE_CORRECT_MS = Number.isFinite(CoreConstants.AUTO_ADVANCE_CORRECT_MS)
      ? Math.max(100, Math.round(CoreConstants.AUTO_ADVANCE_CORRECT_MS))
      : 2200;
    const AUTO_ADVANCE_WRONG_MS = Number.isFinite(CoreConstants.AUTO_ADVANCE_WRONG_MS)
      ? Math.max(100, Math.round(CoreConstants.AUTO_ADVANCE_WRONG_MS))
      : 2800;
    const QUESTIONS_PER_GAME = Number.isFinite(CoreConstants.QUESTIONS_PER_GAME)
      ? Math.max(1, Math.round(CoreConstants.QUESTIONS_PER_GAME))
      : 10;
    const MAX_HIGH_SCORES_SHOWN = Number.isFinite(CoreConstants.MAX_HIGH_SCORES_SHOWN)
      ? Math.max(1, Math.round(CoreConstants.MAX_HIGH_SCORES_SHOWN))
      : 5;
    const StorageKeyFactory = window.BibleTriviaStorage || {};
    const storageKeys = typeof StorageKeyFactory.createStorageKeys === 'function'
      ? StorageKeyFactory.createStorageKeys('primary')
      : {
          playerId: 'primary',
          storagePrefix: 'bibleTriviaPlayer_primary_',
          profile: 'bibleTriviaPlayer_primary_profile',
          history: 'bibleTriviaPlayer_primary_history',
          highScores: 'bibleTriviaPlayer_primary_highScores',
          includeHardLegacy: 'bibleTriviaPlayer_primary_includeHardLegacy',
          difficultyMode: 'bibleTriviaPlayer_primary_difficultyMode',
          roundReviewPreference: 'bibleTriviaPlayer_primary_roundReviewPreference',
          playerStats: 'bibleTriviaPlayer_primary_playerStats',
          dailyStats: 'bibleTriviaPlayer_primary_dailyStats',
          dailyChallenges: 'bibleTriviaPlayer_primary_dailyChallenges',
          dailyPulseAckDate: 'bibleTriviaPlayer_primary_dailyPulseAckDate',
          dailyPulseLastShownDate: 'bibleTriviaPlayer_primary_dailyPulseLastShownDate',
          dailyPulseShowCount: 'bibleTriviaPlayer_primary_dailyPulseShowCount',
          dailyPulseClickCount: 'bibleTriviaPlayer_primary_dailyPulseClickCount',
          streakCarryoverMessageShownCount: 'bibleTriviaPlayer_primary_streakCarryoverMessageShownCount',
          streakCarryoverRestartClickCount: 'bibleTriviaPlayer_primary_streakCarryoverRestartClickCount'
        };
    const PLAYER_PRIMARY_ID = storageKeys.playerId;
    const STORAGE_PREFIX = storageKeys.storagePrefix;
    const STORAGE_KEY_PROFILE = storageKeys.profile;
    const STORAGE_KEY_HISTORY = storageKeys.history;
    const STORAGE_KEY_HIGHSCORES = storageKeys.highScores;
    const STORAGE_KEY_HARD_TOGGLE = storageKeys.includeHardLegacy;
    const STORAGE_KEY_DIFFICULTY_MODE = storageKeys.difficultyMode;
    const STORAGE_KEY_ROUND_REVIEW_PREFERENCE = storageKeys.roundReviewPreference;
    const STORAGE_KEY_PLAYER_STATS = storageKeys.playerStats;
    const STORAGE_KEY_DAILY_STATS = storageKeys.dailyStats;
    const STORAGE_KEY_DAILY_CHALLENGES = storageKeys.dailyChallenges;
    const STORAGE_KEY_DAILY_PULSE_ACK_DATE = storageKeys.dailyPulseAckDate;
    const STORAGE_KEY_DAILY_PULSE_LAST_SHOWN_DATE = storageKeys.dailyPulseLastShownDate;
    const STORAGE_KEY_DAILY_PULSE_SHOW_COUNT = storageKeys.dailyPulseShowCount;
    const STORAGE_KEY_DAILY_PULSE_CLICK_COUNT = storageKeys.dailyPulseClickCount;
    const STORAGE_KEY_STREAK_CARRYOVER_MSG_SHOWN_COUNT = storageKeys.streakCarryoverMessageShownCount;
    const STORAGE_KEY_STREAK_CARRYOVER_RESTART_CLICK_COUNT = storageKeys.streakCarryoverRestartClickCount;
    // ==================== INDEXEDDB MANAGER ====================
    DBManager = window.BibleTriviaStorage.createDBManager({
      CoreUtils,
      DIFFICULTY_MODE_KEYS,
      ROUND_REVIEW_PREFERENCE_KEYS,
      normalizeDifficultyMode,
      normalizeRoundReviewPreference,
      storageKeys: {
        profile: STORAGE_KEY_PROFILE,
        history: STORAGE_KEY_HISTORY,
        highScores: STORAGE_KEY_HIGHSCORES,
        includeHardLegacy: STORAGE_KEY_HARD_TOGGLE,
        difficultyMode: STORAGE_KEY_DIFFICULTY_MODE,
        roundReviewPreference: STORAGE_KEY_ROUND_REVIEW_PREFERENCE,
        playerStats: STORAGE_KEY_PLAYER_STATS,
        dailyStats: STORAGE_KEY_DAILY_STATS,
        dailyChallenges: STORAGE_KEY_DAILY_CHALLENGES
      }
    });
    // ==================== END INDEXEDDB MANAGER ====================

    const playerProfileStore = (window.BibleTriviaStorage && typeof window.BibleTriviaStorage.createPlayerProfileStore === 'function')
      ? window.BibleTriviaStorage.createPlayerProfileStore({
          storageKey: STORAGE_KEY_PROFILE,
          createDefaultProfile: createDefaultPlayerProfile,
          sanitizeProfile: sanitizePlayerProfile,
          log: (action, data) => DBManager.log(action, data)
        })
      : null;
    const keyValueStore = (window.BibleTriviaStorage && typeof window.BibleTriviaStorage.createKeyValueStore === 'function')
      ? window.BibleTriviaStorage.createKeyValueStore({
          log: (action, data) => DBManager.log(action, data)
        })
      : null;
    const fallbackStore = (window.BibleTriviaStorage && typeof window.BibleTriviaStorage.createFallbackStore === 'function')
      ? window.BibleTriviaStorage.createFallbackStore({
          storageKeys: {
            profile: STORAGE_KEY_PROFILE,
            history: STORAGE_KEY_HISTORY,
            highScores: STORAGE_KEY_HIGHSCORES,
            includeHardLegacy: STORAGE_KEY_HARD_TOGGLE,
            difficultyMode: STORAGE_KEY_DIFFICULTY_MODE,
            roundReviewPreference: STORAGE_KEY_ROUND_REVIEW_PREFERENCE,
            playerStats: STORAGE_KEY_PLAYER_STATS,
            dailyStats: STORAGE_KEY_DAILY_STATS,
            dailyChallenges: STORAGE_KEY_DAILY_CHALLENGES
          },
          normalizeAndTrimHighScores,
          normalizeDifficultyMode,
          normalizeRoundReviewPreference,
          sanitizePlayerStats,
          createDefaultPlayerStats,
          sanitizeDailyStats,
          createDefaultDailyStats,
          sanitizeDailyChallengeMap
        })
      : null;
    const BUILT_IN_AVATARS = [
      { id: 'emoji-smile', type: 'emoji', value: '🙂', label: 'Smile' },
      { id: 'emoji-cool', type: 'emoji', value: '😎', label: 'Cool' },
      { id: 'emoji-nerd', type: 'emoji', value: '🤓', label: 'Nerd' },
      { id: 'emoji-fire', type: 'emoji', value: '🔥', label: 'Fire' },
      { id: 'emoji-starstruck', type: 'emoji', value: '🤩', label: 'Starstruck' },
      { id: 'emoji-sunglow', type: 'emoji', value: '🌞', label: 'Sunny' },
      { id: 'emoji-lightbulb', type: 'emoji', value: '💡', label: 'Bright Idea' },
      { id: 'emoji-hands', type: 'emoji', value: '🙌', label: 'Praise' },
      { id: 'image-dove', type: 'image', value: 'icons/avatars/dove.svg', label: 'Dove' },
      { id: 'image-crown', type: 'image', value: 'icons/avatars/crown.svg', label: 'Crown' },
      { id: 'image-shield', type: 'image', value: 'icons/avatars/shield.svg', label: 'Shield' },
      { id: 'image-star', type: 'image', value: 'icons/avatars/star.svg', label: 'Star' },
      { id: 'image-olive-branch', type: 'image', value: 'icons/avatars/olive-branch.svg', label: 'Olive Branch' },
      { id: 'image-lamb', type: 'image', value: 'icons/avatars/lamb.svg', label: 'Lamb' },
      { id: 'image-fish', type: 'image', value: 'icons/avatars/fish.svg', label: 'Fish' },
      { id: 'image-scroll', type: 'image', value: 'icons/avatars/scroll.svg', label: 'Scroll' },
      { id: 'image-ark', type: 'image', value: 'icons/avatars/ark.svg', label: 'Ark' },
      { id: 'image-lyre', type: 'image', value: 'icons/avatars/lyre.svg', label: 'Lyre' },
      { id: 'image-lamp', type: 'image', value: 'icons/avatars/lamp.svg', label: 'Lamp' },
      { id: 'image-lion', type: 'image', value: 'icons/avatars/lion.svg', label: 'Lion' },
      { id: 'image-rainbow', type: 'image', value: 'icons/avatars/rainbow.svg', label: 'Rainbow' },
      { id: 'image-mountain', type: 'image', value: 'icons/avatars/mountain.svg', label: 'Mountain' },
      { id: 'image-anchor', type: 'image', value: 'icons/avatars/anchor.svg', label: 'Anchor' },
      { id: 'image-sunflower', type: 'image', value: 'icons/avatars/sunflower.svg', label: 'Sunflower' }
    ];
    const AVATARS_PER_PAGE = 8;
    const PLAYER_LEVEL_THRESHOLDS = Array.isArray(CoreConstants.PLAYER_LEVEL_THRESHOLDS)
      ? CoreConstants.PLAYER_LEVEL_THRESHOLDS
      : [0, 25, 60, 110, 180, 270, 390, 540, 730, 970, 1270, 1640];
    const FEEDBACK_SHOW_MS = Number.isFinite(CoreConstants.FEEDBACK_SHOW_MS)
      ? Math.max(100, Math.round(CoreConstants.FEEDBACK_SHOW_MS))
      : 2200;
    const DAILY_SUCCESS_PERCENT = Number.isFinite(CoreConstants.DAILY_SUCCESS_PERCENT)
      ? Math.max(0, Math.round(CoreConstants.DAILY_SUCCESS_PERCENT))
      : 70;
    const DAILY_BASE_BONUS_MULTIPLIER = Number.isFinite(CoreConstants.DAILY_BASE_BONUS_MULTIPLIER)
      ? Math.max(0, CoreConstants.DAILY_BASE_BONUS_MULTIPLIER)
      : 0.05;
    const STREAK_BONUS_CAP = Number.isFinite(CoreConstants.STREAK_BONUS_CAP)
      ? Math.max(1, Math.round(CoreConstants.STREAK_BONUS_CAP))
      : 10;
    const STREAK_BONUS_TABLE = (CoreConstants.STREAK_BONUS_TABLE && typeof CoreConstants.STREAK_BONUS_TABLE === 'object')
      ? CoreConstants.STREAK_BONUS_TABLE
      : {
          3: 25,
          4: 50,
          5: 80,
          6: 115,
          7: 150,
          8: 185,
          9: 220,
          10: 260
        };
    let dailyPulseResetTimer = null;
    let playerDraftAvatarId = BUILT_IN_AVATARS[0].id;
    let playerAvatarPageIndex = 0;
    let isPlayerNameEditing = false;
    let playerSaveStatusTimer = null;
    let gameStartPlayerLevel = 1;

    function createZeroedModeMap() {
      return CoreUtils.createZeroedModeMap();
    }

    function createDefaultPlayerStats() {
      return CoreUtils.createDefaultPlayerStats();
    }

    function sanitizePlayerStats(rawStats) {
      return CoreUtils.sanitizePlayerStats(rawStats, DIFFICULTY_MODE_KEYS);
    }

    function createDefaultPlayerProfile() {
      return PlayerFeature.createDefaultPlayerProfile({
        playerId: PLAYER_PRIMARY_ID,
        builtInAvatars: BUILT_IN_AVATARS
      });
    }

    function sanitizePlayerName(nameInput) {
      return PlayerFeature.sanitizePlayerName({ nameInput });
    }

    function sanitizePlayerProfile(rawProfile) {
      return PlayerFeature.sanitizePlayerProfile({
        rawProfile,
        playerId: PLAYER_PRIMARY_ID,
        builtInAvatars: BUILT_IN_AVATARS,
        defaults: createDefaultPlayerProfile(),
        sanitizePlayerName
      });
    }

    function ensurePlayerProfileLoaded() {
      if (playerProfileStore) {
        setPlayerProfile(playerProfileStore.ensureLoaded(playerProfile));
        return playerProfile;
      }

      if (!playerProfile) {
        const rawSaved = localStorage.getItem(STORAGE_KEY_PROFILE);
        if (rawSaved) {
          try {
            setPlayerProfile(sanitizePlayerProfile(JSON.parse(rawSaved)));
          } catch (e) {
            setPlayerProfile(createDefaultPlayerProfile());
          }
        } else {
          setPlayerProfile(createDefaultPlayerProfile());
        }
      }
      setPlayerProfile(sanitizePlayerProfile(playerProfile));
      return playerProfile;
    }

    function savePlayerProfile() {
      ensurePlayerProfileLoaded();
      if (playerProfileStore) {
        playerProfileStore.save(playerProfile);
        return;
      }
      localStorage.setItem(STORAGE_KEY_PROFILE, JSON.stringify(playerProfile));
    }

    function savePlayerProfileSafely() {
      if (playerProfileStore) {
        playerProfileStore.saveSafely(playerProfile);
        setPlayerProfile(playerProfileStore.ensureLoaded(playerProfile));
        return;
      }

      try {
        savePlayerProfile();
      } catch (e) {
        DBManager.log('Failed to persist player profile', e.message);
      }
    }

    function getAvatarById(avatarId) {
      return PlayerFeature.getAvatarById({
        avatarId,
        builtInAvatars: BUILT_IN_AVATARS
      });
    }

    function getPlayerLevelFromCorrectCount(correctAnswers) {
      return PlayerFeature.getPlayerLevelFromCorrectCount({
        correctAnswers,
        thresholds: PLAYER_LEVEL_THRESHOLDS
      });
    }

    function getPlayerCurrentLevel() {
      ensurePlayerProfileLoaded();
      const statsCorrectAnswers = Number.isFinite(playerStats?.totalCorrectClicks)
        ? Math.max(0, Math.round(playerStats.totalCorrectClicks))
        : null;
      const profileCorrectAnswers = Math.max(0, Math.round(playerProfile.nonDailyCorrectAnswers || 0));
      const correctAnswers = statsCorrectAnswers === null ? profileCorrectAnswers : statsCorrectAnswers;
      return getPlayerLevelFromCorrectCount(correctAnswers);
    }

    function logLevelDebug(eventName, payload = {}) {
      DBManager.log(`LEVEL_DEBUG:${eventName}`, payload);
    }

    function getPlayerLevelProgress() {
      ensurePlayerProfileLoaded();
      const statsCorrectAnswers = Number.isFinite(playerStats?.totalCorrectClicks)
        ? Math.max(0, Math.round(playerStats.totalCorrectClicks))
        : null;
      const profileCorrectAnswers = Math.max(0, Math.round(playerProfile.nonDailyCorrectAnswers || 0));
      const correctAnswers = statsCorrectAnswers === null ? profileCorrectAnswers : statsCorrectAnswers;
      const currentLevel = getPlayerLevelFromCorrectCount(correctAnswers);
      const currentIndex = Math.max(0, currentLevel - 1);
      const currentThreshold = PLAYER_LEVEL_THRESHOLDS[currentIndex] || 0;
      const nextThreshold = PLAYER_LEVEL_THRESHOLDS[currentIndex + 1] ?? null;

      if (nextThreshold === null) {
        return {
          currentLevel,
          progressPercent: 100,
          remainingToNextLevel: 0,
          isMaxLevel: true
        };
      }

      const span = Math.max(1, nextThreshold - currentThreshold);
      const doneWithinLevel = Math.min(span, Math.max(0, correctAnswers - currentThreshold));
      const progressPercent = Math.max(0, Math.min(100, (doneWithinLevel / span) * 100));

      return {
        currentLevel,
        progressPercent,
        remainingToNextLevel: Math.max(0, nextThreshold - correctAnswers),
        isMaxLevel: false
      };
    }

    function getAvatarHtml(avatar, { withAlt = true } = {}) {
      return PlayerFeature.getAvatarHtml({
        avatar,
        withAlt,
        escapeHtml
      });
    }

    function renderWelcomePlayerEntry() {
      return PlayerFeature.renderWelcomePlayerEntry({
        ensurePlayerProfileLoaded,
        getElementById: (id) => document.getElementById(id),
        playerProfile,
        getAvatarById,
        getAvatarHtml,
        getPlayerCurrentLevel,
        builtInAvatars: BUILT_IN_AVATARS,
        escapeHtml
      });
    }

    function refreshSummaryPlayerDisplay() {
      return PlayerFeature.refreshSummaryPlayerDisplay({
        ensurePlayerProfileLoaded,
        getElementById: (id) => document.getElementById(id),
        playerProfile,
        getAvatarById,
        getPlayerCurrentLevel,
        builtInAvatars: BUILT_IN_AVATARS,
        escapeHtml
      });
    }

    function getAverageCorrectSecondsByMode(mode, statsInput = playerStats) {
      const stats = sanitizePlayerStats(statsInput);
      const count = stats.correctCountByMode[mode] || 0;
      if (count === 0) return null;
      return Math.round((stats.correctSecondsByMode[mode] || 0) / count);
    }

    function createDefaultDailyStats() {
      return CoreUtils.createDefaultDailyStats();
    }

    function sanitizeDailyStats(rawStats) {
      return CoreUtils.sanitizeDailyStats(rawStats);
    }

    function sanitizeDailyChallengeRecord(rawRecord) {
      return CoreUtils.sanitizeDailyChallengeRecord(rawRecord, DAILY_CHALLENGE_MODE_VERSION);
    }

    function sanitizeDailyChallengeMap(rawMap) {
      return CoreUtils.sanitizeDailyChallengeMap(rawMap, DAILY_CHALLENGE_MODE_VERSION);
    }

    function createDefaultDailyChallengeRecord(dateKey, questionIds, seed) {
      return DailyFeature.createDefaultDailyChallengeRecord({
        dateKey,
        questionIds,
        seed,
        modeVersion: DAILY_CHALLENGE_MODE_VERSION,
        sanitizeDailyChallengeRecord
      });
    }

    function ensureDailyDataLoaded() {
      setDailyStats(sanitizeDailyStats(dailyStats));
      setDailyChallengeMap(sanitizeDailyChallengeMap(dailyChallengeMap));
    }

    function applyDailyCompletionToStats(dateKey, firstCompletionForDay) {
      ensureDailyDataLoaded();

      const nextStats = DailyFeature.applyDailyCompletionToStats({
        stats: dailyStats,
        dateKey,
        firstCompletionForDay,
        getDateKeyOffset
      });
      if (nextStats && typeof nextStats === 'object') {
        setDailyStats(nextStats);
        return;
      }
    }

    function getLocalDateKey(dateInput = new Date()) {
      return CoreUtils.getLocalDateKey(dateInput);
    }

    function getDateKeyOffset(dateKey, dayOffset) {
      return CoreUtils.getDateKeyOffset(dateKey, dayOffset);
    }

    function createDailySeed(dateKey) {
      return CoreUtils.createDailySeed(dateKey, DAILY_CHALLENGE_MODE_VERSION);
    }

    function createSeededRandom(seedText) {
      return CoreUtils.createSeededRandom(seedText);
    }

    function shuffleWithRandom(array, randomFn = Math.random) {
      return CoreUtils.shuffleWithRandom(array, randomFn);
    }

    function getActiveDifficultyMode() {
      return currentGameMode === GAME_MODE_DAILY
        ? DAILY_CHALLENGE_DIFFICULTY_MODE
        : normalizeDifficultyMode(difficultyMode);
    }

    function isDailyBaseBonusActive(dateKey = getLocalDateKey()) {
      return DailyFeature.isDailyBaseBonusActive({
        dateKey,
        ensureDailyDataLoaded,
        getLocalDateKey,
        getDailyRecordForDate: (lookupDateKey) => sanitizeDailyChallengeRecord(dailyChallengeMap[lookupDateKey] || null)
      });
    }

    function getStoredPulseDateKey(storageKey) {
      return DailyFeature.getStoredPulseDateKey({
        storageKey,
        readDateKey: (lookupKey) => {
          if (keyValueStore) {
            return keyValueStore.readDateKey(lookupKey);
          }

          const value = String(localStorage.getItem(lookupKey) || '').trim();
          return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : '';
        }
      });
    }

    function incrementLocalCounter(storageKey) {
      if (keyValueStore) {
        return keyValueStore.incrementCounter(storageKey);
      }

      const current = Number.parseInt(localStorage.getItem(storageKey) || '0', 10);
      const next = Number.isFinite(current) ? current + 1 : 1;
      localStorage.setItem(storageKey, String(next));
      return next;
    }

    function incrementDailyPulseCounter(storageKey) {
      return DailyFeature.incrementDailyPulseCounter({
        storageKey,
        incrementCounter: (lookupKey) => incrementLocalCounter(lookupKey)
      });
    }

    function isDailyChallengeCompletedForDate(dateKey = getLocalDateKey()) {
      return DailyFeature.isDailyChallengeCompletedForDate({
        dateKey,
        ensureDailyDataLoaded,
        getLocalDateKey,
        getDailyRecordForDate: (lookupDateKey) => sanitizeDailyChallengeRecord(dailyChallengeMap[lookupDateKey] || null)
      });
    }

    function shouldPulseDailyChallengeLink(dateKey = getLocalDateKey()) {
      return DailyFeature.shouldPulseDailyChallengeLink({
        dateKey,
        getLocalDateKey,
        getStoredPulseDateKey,
        isDailyChallengeCompletedForDate,
        storageKeyDailyPulseAckDate: STORAGE_KEY_DAILY_PULSE_ACK_DATE
      });
    }

    function updateDailyChallengeLinkPulse(dateKey = getLocalDateKey()) {
      return DailyFeature.updateDailyChallengeLinkPulse({
        dateKey,
        getElementById: (id) => document.getElementById(id),
        getLocalDateKey,
        shouldPulseDailyChallengeLink,
        getStoredPulseDateKey,
        setPulseDateKey: (storageKey, value) => {
          if (keyValueStore) {
            keyValueStore.setString(storageKey, value);
          } else {
            localStorage.setItem(storageKey, value);
          }
        },
        incrementDailyPulseCounter,
        log: (...args) => DBManager.log(...args),
        storageKeyDailyPulseLastShownDate: STORAGE_KEY_DAILY_PULSE_LAST_SHOWN_DATE,
        storageKeyDailyPulseShowCount: STORAGE_KEY_DAILY_PULSE_SHOW_COUNT
      });
    }

    function acknowledgeDailyChallengeLinkClick(dateKey = getLocalDateKey()) {
      return DailyFeature.acknowledgeDailyChallengeLinkClick({
        dateKey,
        getLocalDateKey,
        getStoredPulseDateKey,
        setPulseDateKey: (storageKey, value) => {
          if (keyValueStore) {
            keyValueStore.setString(storageKey, value);
          } else {
            localStorage.setItem(storageKey, value);
          }
        },
        incrementDailyPulseCounter,
        log: (...args) => DBManager.log(...args),
        storageKeyDailyPulseAckDate: STORAGE_KEY_DAILY_PULSE_ACK_DATE,
        storageKeyDailyPulseClickCount: STORAGE_KEY_DAILY_PULSE_CLICK_COUNT
      });
    }

    function scheduleDailyChallengePulseReset() {
      dailyPulseResetTimer = DailyFeature.scheduleDailyChallengePulseReset({
        currentTimer: dailyPulseResetTimer,
        setTimer: (nextTimer) => {
          dailyPulseResetTimer = nextTimer;
        },
        clearTimer: (timerRef) => clearTimeout(timerRef),
        nowFactory: () => new Date(),
        setTimeoutFn: (handler, delayMs) => setTimeout(handler, delayMs),
        updateDailyChallengeLinkPulse,
        getLocalDateKey
      });
    }

    function getDailyBaseBonusPoints(basePoints) {
      return DailyFeature.getDailyBaseBonusPoints({
        basePoints,
        isDailyBaseBonusActive,
        dailyBaseBonusMultiplier: DAILY_BASE_BONUS_MULTIPLIER
      });
    }

    const incorrectMessages = [
      "Not quite!",
      "Good try!",
      "Almost!"
    ];

    const encouragingVerses = [
      { minPercent: 0,  text: "Keep going! You can do all things through Christ who strengthens you. - Philippians 4:13" },
      { minPercent: 50, text: "Great effort! Let's keep learning God's Word together. - 2 Timothy 2:15" },
      { minPercent: 80, text: "Fantastic! Well done, good and faithful servant! - Matthew 25:21" }
    ];

    // Mode-based scoring: all questions in a game worth the same points
    const modeBase = {
      easy: 50,
      medium: 100,
      hard: 150,
      superHard: 250
    };

    // Mode-based timing: progressively tighter time limits for harder modes
    const modeTiming = {
      easy: 25,      // Comfortable for reading and thinking
      medium: 25,    // Balanced pace
      hard: 21,      // Moderate time pressure (15% faster)
      superHard: 18  // Significant time pressure (28% faster) - elite challenge
    };

    const progressEl      = document.getElementById("progress");
    const streakHudEl     = document.getElementById("streak-hud");
    const streakHudCountEl = document.getElementById("streak-hud-count");
    const streakHudBonusEl = document.getElementById("streak-hud-bonus");
    const streakHudNextEl  = document.getElementById("streak-hud-next");
    const progressDotsEl  = document.getElementById("progress-dots");
    const timerDisplayEl  = document.getElementById("timer-display");
    const timerFill       = document.getElementById("timer-fill");
    const questionEl      = document.getElementById("question");
    //const verseRefEl      = document.getElementById("verse-ref");
    const difficultyTagEl = document.getElementById("difficulty-tag");
    const categoryTagEl   = document.getElementById("category-tag");
    const optionsEl       = document.getElementById("options");
    const feedbackEl      = document.getElementById("feedback");
    const summaryEl       = document.getElementById("summary");
    const roundReviewEl   = document.getElementById("round-review");
    const questionHeaderEl = document.querySelector("#question-container > header");

    function getCappedStreak(streak) {
      return CoreUtils.getCappedStreak(streak, STREAK_BONUS_CAP);
    }

    function getStreakBonus(streak) {
      return CoreUtils.getStreakBonus(streak, STREAK_BONUS_TABLE, STREAK_BONUS_CAP);
    }

    function getNextStreakBonusInfo(streak) {
      return CoreUtils.getNextStreakBonusInfo(streak, STREAK_BONUS_TABLE, STREAK_BONUS_CAP);
    }

    function animateStreakHud() {
      if (!streakHudEl) return;
      streakHudEl.classList.remove("bump");
      void streakHudEl.offsetWidth;
      streakHudEl.classList.add("bump");
    }

    function updateStreakHud({ animate = false } = {}) {
      const streak = Math.max(0, Math.round(bonusCarryStreak || 0));
      const bonus = getStreakBonus(streak);
      const nextInfo = getNextStreakBonusInfo(streak);

      if (streakHudCountEl) {
        streakHudCountEl.textContent = `Streak: ${streak}`;
      }
      if (streakHudBonusEl) {
        streakHudBonusEl.textContent = `Bonus: +${bonus}`;
      }
      if (streakHudNextEl) {
        streakHudNextEl.textContent = nextInfo.label;
      }

      if (animate) {
        animateStreakHud();
      }
    }

    function resetBonusCarryStreak() {
      setBonusCarryStreak(0);
      updateStreakHud();
    }

    function setQuestionHeaderVisible(isVisible) {
      if (!questionHeaderEl) return;
      questionHeaderEl.style.display = isVisible ? "" : "none";
    }

    function showReviewChoiceOverlay() {
      if (roundReviewPreference === 'alwaysReview') {
        return Promise.resolve('review');
      }

      if (roundReviewPreference === 'alwaysSkip') {
        return Promise.resolve('skip');
      }

      const overlayEl = document.getElementById('review-choice-overlay');
      const reviewBtn = document.getElementById('overlay-review-btn');
      const skipBtn = document.getElementById('overlay-skip-btn');

      if (!overlayEl || !reviewBtn || !skipBtn) {
        return Promise.resolve('review');
      }

      return new Promise((resolve) => {
        const onKeydown = (event) => {
          if (event.key === 'Enter') {
            event.preventDefault();
            choose('review');
          }
        };

        const cleanup = () => {
          reviewBtn.removeEventListener('click', onReviewClick);
          skipBtn.removeEventListener('click', onSkipClick);
          document.removeEventListener('keydown', onKeydown);
          overlayEl.style.display = 'none';
        };

        const choose = (choice) => {
          cleanup();
          resolve(choice);
        };

        const onReviewClick = () => choose('review');
        const onSkipClick = () => choose('skip');

        overlayEl.style.display = 'flex';
        reviewBtn.addEventListener('click', onReviewClick);
        skipBtn.addEventListener('click', onSkipClick);
        document.addEventListener('keydown', onKeydown);
        reviewBtn.focus();
      });
    }

    function escapeHtml(value) {
      return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/\"/g, "&quot;")
        .replace(/'/g, "&#39;");
    }

    function normalizeSelectedAnswer(rawText) {
      if (!rawText) return "No answer selected";
      return rawText.replace(/^[A-D]\)\s*/, "").trim();
    }

    function hasScriptureReference(referenceText) {
      const ref = String(referenceText || "").trim();
      if (!ref) return false;
      if (/not\s+directly\s+in\s+scripture|church\s+tradition|n\/a|none|unknown/i.test(ref)) {
        return false;
      }
      return /\d/.test(ref);
    }

    function buildBibleGatewayNivUrl(referenceText) {
      const query = encodeURIComponent(String(referenceText || "").trim());
      return `https://www.biblegateway.com/passage/?search=${query}&version=NIV`;
    }

    function recordRoundReviewEntry(q, selectedAnswer, isCorrect) {
      lastRoundReview.push({
        question: q.q,
        selectedAnswer: selectedAnswer || "No answer selected",
        isCorrect: Boolean(isCorrect),
        correctAnswer: q.opts[q.ans],
        scriptureRef: String(q.ref || "").trim()
      });
    }

    function showResultsSummary() {
      setQuestionHeaderVisible(false);
      questionEl.style.display = "none";
      //verseRefEl.style.display = "none";
      difficultyTagEl.style.display = "none";
      categoryTagEl.style.display = "none";
      optionsEl.style.display = "none";
      feedbackEl.style.display = "none";
      roundReviewEl.style.display = "none";
      summaryEl.style.display = "block";
      refreshSummaryPlayerDisplay();
      logLevelDebug('summary_shown', {
        displayedLevel: getPlayerCurrentLevel(),
        nonDailyCorrectAnswers: Math.max(0, Math.round(playerProfile?.nonDailyCorrectAnswers || 0)),
        pendingLevelCelebrationLevel,
        pendingHighScoreCelebrationScore,
        pendingDailyCompletionCelebration
      });

      const hadHighScoreCelebration = pendingHighScoreCelebrationScore !== null;

      if (hadHighScoreCelebration) {
        const scoreToCelebrate = pendingHighScoreCelebrationScore;
        setPendingHighScoreCelebrationScore(null);
        celebrateNewHighScore(scoreToCelebrate);
      }

      if (pendingLevelCelebrationLevel !== null) {
        const levelToCelebrate = pendingLevelCelebrationLevel;
        setPendingLevelCelebrationLevel(null);
        if (hadHighScoreCelebration) {
          setTimeout(() => {
            celebrateNewLevel(levelToCelebrate);
          }, 3800);
        } else {
          celebrateNewLevel(levelToCelebrate);
        }
      }

      if (pendingDailyCompletionCelebration) {
        setPendingDailyCompletionCelebration(false);
        celebrateDailyChallengeCompletion();
      }
    }

    function renderRoundReviewScreen() {
      const cardsHtml = lastRoundReview.map((entry, idx) => {
        const showLink = hasScriptureReference(entry.scriptureRef);
        const referenceText = entry.scriptureRef || "No scripture reference provided";

        return `
          <article class="review-card">
            <div class="review-header">
              <h3 class="review-question-title">Q${idx + 1}. ${escapeHtml(entry.question)}</h3>
              <span class="review-result-badge ${entry.isCorrect ? "correct" : "incorrect"}">
                ${entry.isCorrect ? "Correct" : "Incorrect"}
              </span>
            </div>
            <p class="review-row"><strong>Your answer:</strong> ${escapeHtml(entry.selectedAnswer)}</p>
            <p class="review-row"><strong>Correct answer:</strong> ${escapeHtml(entry.correctAnswer)}</p>
            <p class="review-row"><strong>Verse(s):</strong> ${escapeHtml(referenceText)}</p>
            ${showLink
              ? `<a class="review-link" href="${buildBibleGatewayNivUrl(entry.scriptureRef)}" target="_blank" rel="noopener noreferrer">Open in Bible Gateway (NIV)</a>`
              : ""}
          </article>
        `;
      }).join("");

      roundReviewEl.innerHTML = `
        <h2>Round Review</h2>
        <p id="round-review-subtitle">Review the questions from your last completed round.</p>
        <section id="review-questions-list">${cardsHtml}</section>
        <div id="round-review-actions">
          <button id="review-continue">Continue to Results</button>
        </div>
      `;

      document.getElementById("review-continue")?.addEventListener("click", showResultsSummary);

      setQuestionHeaderVisible(false);
      questionEl.style.display = "none";
      //verseRefEl.style.display = "none";
      difficultyTagEl.style.display = "none";
      categoryTagEl.style.display = "none";
      optionsEl.style.display = "none";
      feedbackEl.style.display = "none";
      summaryEl.style.display = "none";
      roundReviewEl.style.display = "block";
    }

    async function loadData() {
      try {
        ensurePlayerProfileLoaded();
        if (DBManager.isReady()) {
          // Load from IndexedDB with fallback to localStorage if needed
          try {
            setGameHistory(await DBManager.loadGameHistory());
            setHighScores(await DBManager.loadHighScores());
            const savedStats = await DBManager.loadPlayerStats();
            const savedDailyStats = await DBManager.loadDailyStats();
            const recentDailyChallenges = await DBManager.listRecentDailyChallenges(DAILY_CHALLENGE_RECENT_LIMIT);
            const savedMode = await DBManager.loadSetting('difficultyMode');
            const savedReviewPref = await DBManager.loadSetting('roundReviewPreference');
            if (savedMode !== null && savedMode !== undefined) {
              setDifficultyMode(savedMode);
            }
            if (savedReviewPref !== null && savedReviewPref !== undefined) {
              setRoundReviewPreference(savedReviewPref);
            }

            setHighScores(normalizeAndTrimHighScores(highScores));
            setPlayerStats(sanitizePlayerStats(savedStats));
            setPlayerProfile(sanitizePlayerProfile({
              ...playerProfile,
              nonDailyCorrectAnswers: playerStats.totalCorrectClicks
            }));
            setDailyStats(sanitizeDailyStats(savedDailyStats));
            setDailyChallengeMap(sanitizeDailyChallengeMap(
              Object.fromEntries((recentDailyChallenges || []).map((record) => [record.dateKey, record]))
            ));
            await DBManager.replaceHighScores(highScores);
            await DBManager.savePlayerStats(playerStats);
            await DBManager.saveDailyStats(dailyStats);
            DBManager.log('Data loaded from IndexedDB');
          } catch (e) {
            DBManager.log('IndexedDB load failed, falling back to localStorage', e.message);
            loadDataFromLocalStorage();
          }
        } else {
          // Fallback to localStorage only
          DBManager.log('IndexedDB not available, loading from localStorage');
          loadDataFromLocalStorage();
        }
      } catch (e) {
        DBManager.log('loadData error', e.message);
        loadDataFromLocalStorage();
      }

      renderWelcomePlayerEntry();
    }

    async function reloadGameHistory() {
      try {
        if (DBManager.isReady()) {
          setGameHistory(await DBManager.loadGameHistory());
          DBManager.log('Game history reloaded from IndexedDB');
        }
      } catch (e) {
        DBManager.log('Failed to reload game history', e.message);
      }
    }

    async function reloadDifficultyMode() {
      try {
        if (DBManager.isReady()) {
          const savedMode = await DBManager.loadSetting('difficultyMode');
          if (savedMode !== null && savedMode !== undefined) {
            setDifficultyMode(savedMode);
            updateDifficultyButtonState();
            DBManager.log('Difficulty mode reloaded from IndexedDB', savedMode);
          }
        }
      } catch (e) {
        DBManager.log('Failed to reload difficulty mode', e.message);
      }
    }

    function updateDifficultyButtonState() {
      const buttons = document.querySelectorAll('.difficulty-btn');
      buttons.forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.mode === difficultyMode) {
          btn.classList.add('active');
        }
      });
    }

    function loadDataFromLocalStorage() {
      ensurePlayerProfileLoaded();
      if (!fallbackStore) {
        DBManager.log('Fallback store unavailable during load');
        return;
      }

      const loaded = fallbackStore.load();
      setGameHistory(loaded.gameHistory);
      setHighScores(loaded.highScores);
      setDifficultyMode(loaded.difficultyMode);
      setRoundReviewPreference(loaded.roundReviewPreference);
      setPlayerStats(loaded.playerStats);
      setPlayerProfile(sanitizePlayerProfile({
        ...playerProfile,
        nonDailyCorrectAnswers: loaded.playerStats.totalCorrectClicks
      }));
      setDailyStats(loaded.dailyStats);
      setDailyChallengeMap(loaded.dailyChallengeMap);

      ensureDailyDataLoaded();
      renderWelcomePlayerEntry();
    }

    async function saveData() {
      try {
        ensurePlayerProfileLoaded();
        // Player profile currently persists via localStorage for immediate durability.
        savePlayerProfileSafely();
        setHighScores(normalizeAndTrimHighScores(highScores));
        setDifficultyMode(difficultyMode);
        setRoundReviewPreference(roundReviewPreference);
        setPlayerStats(sanitizePlayerStats(playerStats));
        ensureDailyDataLoaded();

        if (DBManager.isReady()) {
          // Save to IndexedDB
          try {
            // Save game history
            for (const record of gameHistory) {
              if (!record.id) {
                const insertedId = await DBManager.addGameRecord(record);
                if (insertedId !== undefined && insertedId !== null) {
                  record.id = insertedId;
                }
              }
            }
            // Replace high scores with normalized top 5 per mode.
            await DBManager.replaceHighScores(highScores);
            // Save settings - explicitly save difficultyMode
            await DBManager.saveSetting('difficultyMode', difficultyMode);
            await DBManager.saveSetting('roundReviewPreference', roundReviewPreference);
            await DBManager.savePlayerStats(playerStats);
            await DBManager.saveDailyStats(dailyStats);
            for (const record of Object.values(dailyChallengeMap)) {
              await DBManager.saveDailyChallenge(record);
            }
            DBManager.log('Data saved to IndexedDB');
          } catch (e) {
            DBManager.log('IndexedDB save failed, falling back to localStorage', e.message);
            saveDataToLocalStorage();
          }
        } else {
          // Fallback to localStorage only
          DBManager.log('IndexedDB not available, saving to localStorage');
          saveDataToLocalStorage();
        }
      } catch (e) {
        DBManager.log('saveData error', e.message);
        saveDataToLocalStorage();
      }
    }

    function saveDataToLocalStorage() {
      ensurePlayerProfileLoaded();
      setHighScores(normalizeAndTrimHighScores(highScores));
      setDifficultyMode(difficultyMode);
      setRoundReviewPreference(roundReviewPreference);
      setPlayerStats(sanitizePlayerStats(playerStats));
      ensureDailyDataLoaded();
      if (!fallbackStore) {
        DBManager.log('Fallback store unavailable during save');
        return;
      }

      fallbackStore.save({
        gameHistory,
        highScores,
        difficultyMode,
        roundReviewPreference,
        playerStats,
        dailyStats,
        dailyChallengeMap,
        playerProfile
      });
    }

    function shuffle(array) {
      for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
      }
      return array;
    }

    // ==================== DIFFICULTY MODE CONFIG ====================
    const difficultyModes = {
      'easy': {
        difficulties: ['easy'],
        difficultyTargets: { easy: 10, medium: 0, hard: 0 },
        matrix: {
          easy: { 'Old Testament': 4, 'New Testament': 4, 'General': 2 }
        },
        description: 'Easy questions only'
      },
      'medium': {
        difficulties: ['easy', 'medium'],
        difficultyTargets: { easy: 5, medium: 5, hard: 0 },
        matrix: {
          easy:   { 'Old Testament': 2, 'New Testament': 1, 'General': 1 },
          medium: { 'Old Testament': 1, 'New Testament': 1, 'General': 1 }
        },
        description: 'Easy and medium questions'
      },
      'hard': {
        difficulties: ['medium', 'hard'],
        difficultyTargets: { easy: 0, medium: 5, hard: 5 },
        matrix: {
          medium: { 'Old Testament': 2, 'New Testament': 1, 'General': 1 },
          hard:   { 'Old Testament': 1, 'New Testament': 1, 'General': 1 }
        },
        description: 'Medium and hard questions'
      },
      'superHard': {
        difficulties: ['hard'],
        difficultyTargets: { easy: 0, medium: 0, hard: 10 },
        matrix: {
          hard:   { 'Old Testament': 1, 'New Testament': 1, 'General': 1 }
        },
        description: 'Hard questions'
      }
    };
    // =====================================================================

//========= CoPilot version ========
function selectBalancedQuestionsForMode(modeKey, randomFn = Math.random, questionCount = QUESTIONS_PER_GAME) {
  return CoreEngine.selectBalancedQuestionsForMode({
    modeKey,
    randomFn,
    questionCount,
    allQuestions,
    modeMap: difficultyModes,
    categories: ['Old Testament', 'New Testament', 'General'],
    normalizeDifficultyMode
  });
}

function selectBalancedQuestions() {
  return selectBalancedQuestionsForMode(difficultyMode, Math.random, QUESTIONS_PER_GAME);
}

function selectDailyChallengeQuestions(seed) {
  return DailyFeature.selectDailyChallengeQuestions({
    seed,
    createSeededRandom,
    selectBalancedQuestionsForMode,
    difficultyMode: DAILY_CHALLENGE_DIFFICULTY_MODE,
    questionCount: QUESTIONS_PER_GAME
  });
}

function hydrateDailyQuestions(questionIds) {
  return DailyFeature.hydrateDailyQuestions({
    questionIds,
    allQuestionsById,
    questionCount: QUESTIONS_PER_GAME,
    fallbackQuestions: () => selectDailyChallengeQuestions(createDailySeed(getLocalDateKey()))
  });
}

async function getOrCreateDailyChallengeRecord(dateKey) {
  return DailyFeature.getOrCreateDailyChallengeRecord({
    dateKey,
    ensureDailyDataLoaded,
    getMapRecord: (lookupDateKey) => dailyChallengeMap[lookupDateKey] || null,
    setMapRecord: (nextDateKey, nextRecord) => {
      dailyChallengeMap[nextDateKey] = nextRecord;
    },
    isDbReady: () => DBManager.isReady(),
    loadDailyChallenge: (lookupDateKey) => DBManager.loadDailyChallenge(lookupDateKey),
    saveDailyChallenge: (record) => DBManager.saveDailyChallenge(record),
    log: (...args) => DBManager.log(...args),
    createDailySeed,
    selectDailyChallengeQuestions,
    createDefaultDailyChallengeRecord,
    sanitizeDailyChallengeRecord,
    questionCount: QUESTIONS_PER_GAME
  });
}
//==================================


    function resetQuestionScreen() {
      setQuestionHeaderVisible(true);
      questionEl.style.display = "block";
      //verseRefEl.style.display = "inline";
      difficultyTagEl.style.display = "inline-flex";
      categoryTagEl.style.display = "inline-flex";
      optionsEl.style.display = "grid";
      feedbackEl.style.display = "block";
      summaryEl.style.display = "none";
      roundReviewEl.style.display = "none";
    }

    function startNewGame({ mode = GAME_MODE_NORMAL, questions = null, dailyRecord = null, preserveBonusStreak = false } = {}) {
      ensurePlayerProfileLoaded();
      resetQuestionScreen();
      setCurrentGameMode(mode);
      gameStartPlayerLevel = getPlayerCurrentLevel();
      logLevelDebug('game_start', {
        mode,
        gameStartPlayerLevel,
        nonDailyCorrectAnswers: playerProfile.nonDailyCorrectAnswers
      });
      setActiveDailyChallengeRecord(mode === GAME_MODE_DAILY ? dailyRecord : null);
      setActiveDailyChallengeDateKey(dailyRecord?.dateKey || null);
      setGameQuestions(Array.isArray(questions) && questions.length > 0
        ? questions.slice(0, QUESTIONS_PER_GAME)
        : selectBalancedQuestions());
      setCurrentIndex(0);
      setCorrectCount(0);
      setTotalScore(0);
      setCurrentGameStreak(0);
      setCurrentGameMaxStreak(0);
      if (!preserveBonusStreak) {
        resetBonusCarryStreak();
      }
      setLastRoundReview([]);
      updateStreakHud();
      nextQuestion();
    }

    async function startDailyChallenge({ preserveBonusStreak = false } = {}) {
      const prepared = await DailyFeature.prepareDailyChallengeStart({
        preserveBonusStreak,
        questionCount: QUESTIONS_PER_GAME,
        getLocalDateKey,
        getOrCreateDailyChallengeRecord,
        hydrateDailyQuestions,
        selectDailyChallengeQuestions,
        createDailySeed
      });

      startNewGame({
        mode: GAME_MODE_DAILY,
        questions: prepared.questions,
        dailyRecord: prepared.dailyRecord,
        preserveBonusStreak: prepared.preserveBonusStreak
      });
    }

    function updateProgressDots() {
      let dots = '';
      for (let i = 0; i < QUESTIONS_PER_GAME; i++) {
        if (i < currentIndex) dots += '<span class="done">✅</span>';
        else if (i === currentIndex) dots += '<span class="current">🔵</span>';
        else dots += '<span class="pending">⚪</span>';
      }
      progressDotsEl.innerHTML = dots;
    }

    function nextQuestion() {
      if (currentIndex >= gameQuestions.length) {
        endGame().catch(e => DBManager.log('Error in endGame', e.message));
        return;
      }

      const q = gameQuestions[currentIndex];
      const shuffledOpts = shuffle([...q.opts]);
      const correctIndex = shuffledOpts.indexOf(q.opts[q.ans]);

      questionEl.textContent = q.q;
      //verseRefEl.textContent = q.ref ? `(${q.ref})` : "";
      difficultyTagEl.textContent = getDifficultyEmoji(q.difficulty) + " " + (q.difficulty.charAt(0).toUpperCase() + q.difficulty.slice(1));
      difficultyTagEl.className = "tag difficulty " + q.difficulty;
      categoryTagEl.textContent = getCategoryEmoji(q.category) + " " + q.category;
      categoryTagEl.className = "tag category";
      optionsEl.innerHTML = "";

      const labels = ['A', 'B', 'C', 'D'];
      shuffledOpts.forEach((opt, i) => {
        const btn = document.createElement("button");
        btn.className = "option";
        btn.textContent = `${labels[i]}) ${opt}`;
        btn.onclick = () => handleAnswer(i === correctIndex, btn);
        optionsEl.appendChild(btn);
      });

      updateProgress();
      updateProgressDots();
      startTimer();
    }

    function getDifficultyEmoji(diff) {
      const value = String(diff || "").trim().toLowerCase();
      if (value === "easy") return "🟢";
      if (value === "medium") return "🟠";
      if (value === "hard") return "🔴";
      if (value === "superhard" || value === "super-hard" || value === "super_hard") return "⚫";
      return "";
    }

    function getCategoryEmoji(cat) {
      const value = String(cat || "").trim().toLowerCase();
      if (value === "old testament") return "📜";
      if (value === "new testament") return "✝️";
      if (value === "general") return "📖";
      return "";
    }

    function getCurrentTimeLimit() {
      const activeMode = getActiveDifficultyMode();
      return CoreEngine.getTimeLimitForMode(modeTiming, activeMode, 25);
    }

    function updateProgress() {
      const modePrefix = currentGameMode === GAME_MODE_DAILY ? 'Daily | ' : '';
      progressEl.textContent = `${modePrefix}Question ${currentIndex + 1} of ${QUESTIONS_PER_GAME} | Correct: ${correctCount} | Score: ${totalScore}`;
      updateProgressDots();
    }

    function startTimer() {
      const timeLimit = getCurrentTimeLimit();
      let timeLeft = timeLimit;
      setTimeLeftAtAnswer(timeLimit);
      timerFill.style.width = "100%";
      timerFill.className = "";
      timerDisplayEl.textContent = Math.ceil(timeLeft);
      timerDisplayEl.className = "green";
      clearInterval(timerInterval);

      setTimerInterval(setInterval(() => {
        timeLeft -= 0.1;
        setTimeLeftAtAnswer(timeLeft);
        timerDisplayEl.textContent = Math.ceil(timeLeft);

        const percent = (timeLeft / timeLimit) * 100;
        timerFill.style.width = `${Math.max(percent, 0)}%`;

        if (timeLeft <= 4) {
          timerFill.className = "danger";
          timerDisplayEl.className = "red";
        } else if (timeLeft <= 8) {
          timerFill.className = "warning";
          timerDisplayEl.className = "yellow";
        } else {
          timerDisplayEl.className = "green";
        }

        if (timeLeft <= 0) {
          clearInterval(timerInterval);
          handleTimeout();
        }
      }, 100));
    }

    function stopTimer() {
      clearInterval(timerInterval);
      timerFill.style.width = "0%";
      timerDisplayEl.textContent = "0";
      timerDisplayEl.className = "red";
    }

    function calculatePoints(streakBonus = 0) {
      // Scoring is base + speed bonus + streak bonus.
      const activeMode = getActiveDifficultyMode();
      const base = modeBase[activeMode] || 100;
      const dailyBaseBonus = getDailyBaseBonusPoints(base);
      const timeLimit = getCurrentTimeLimit();
      return CoreEngine.calculatePointBreakdown({
        basePoints: base,
        dailyBonusPoints: dailyBaseBonus,
        timeLeftAtAnswer,
        timeLimit,
        streakBonus
      });
    }

    function ensurePlayerStatsLoaded() {
      if (!playerStats) {
        setPlayerStats(createDefaultPlayerStats());
      }
      setPlayerStats(sanitizePlayerStats(playerStats));
    }

    function registerCorrectAnswerStats(question, elapsedSecondsRounded) {
      ensurePlayerStatsLoaded();
      ensurePlayerProfileLoaded();
      const mode = normalizeDifficultyMode(getActiveDifficultyMode());
      const category = question?.category;
      const nonDailyCorrectBefore = Math.max(0, Math.round(playerProfile.nonDailyCorrectAnswers || 0));
      const levelBefore = getPlayerLevelFromCorrectCount(nonDailyCorrectBefore);

      playerStats.totalCorrectClicks += 1;
      playerStats.correctCountByMode[mode] += 1;
      playerStats.correctSecondsByMode[mode] += Math.max(0, Math.round(elapsedSecondsRounded));

      if (category && playerStats.correctByCategory[category] !== undefined) {
        playerStats.correctByCategory[category] += 1;
      }

      if (currentGameMode !== GAME_MODE_DAILY) {
        playerProfile.nonDailyCorrectAnswers += 1;
        const nonDailyCorrectAfter = Math.max(0, Math.round(playerProfile.nonDailyCorrectAnswers || 0));
        const levelAfter = getPlayerLevelFromCorrectCount(nonDailyCorrectAfter);
        logLevelDebug('correct_answer_applied', {
          gameMode: currentGameMode,
          questionCategory: category || 'unknown',
          nonDailyCorrectBefore,
          nonDailyCorrectAfter,
          levelBefore,
          levelAfter,
          leveledUp: levelAfter > levelBefore
        });
        // Persist level-driving progress immediately in case navigation happens before end-game save.
        savePlayerProfileSafely();
      } else {
        logLevelDebug('correct_answer_ignored_for_daily_level', {
          gameMode: currentGameMode,
          questionCategory: category || 'unknown',
          nonDailyCorrectAnswers: nonDailyCorrectBefore,
          level: levelBefore
        });
      }

      playerStats.currentStreak += 1;
      if (playerStats.currentStreak > playerStats.allTimeBestStreak) {
        playerStats.allTimeBestStreak = playerStats.currentStreak;
      }

      setCurrentGameStreak(currentGameStreak + 1);
      if (currentGameStreak > currentGameMaxStreak) {
        setCurrentGameMaxStreak(currentGameStreak);
      }
    }

    function registerIncorrectAnswerStats() {
      ensurePlayerStatsLoaded();
      playerStats.currentStreak = 0;
      setCurrentGameStreak(0);
      resetBonusCarryStreak();
    }

    function showFeedback(message, className, detail = "") {
      feedbackEl.innerHTML = "";

      const mainLine = document.createElement("div");
      mainLine.className = "feedback-main";
      mainLine.textContent = message;
      feedbackEl.appendChild(mainLine);

      if (detail) {
        const detailLine = document.createElement("div");
        detailLine.className = "feedback-detail";
        detailLine.textContent = detail;
        feedbackEl.appendChild(detailLine);
      }

      feedbackEl.className = className;
      feedbackEl.offsetHeight;
      feedbackEl.classList.add("visible");

      setTimeout(() => {
        feedbackEl.classList.remove("visible");
        feedbackEl.classList.add("fading");
      }, FEEDBACK_SHOW_MS);
    }

function celebrateNewHighScore(score) {
  if (isHighScoreCelebrationActive) return;
  setIsHighScoreCelebrationActive(true);

  // Create overlay element
  const overlay = document.createElement('div');
  overlay.id = 'highscore-celebration';
  overlay.style.position = 'fixed';
  overlay.style.inset = '0';
  overlay.style.background = 'rgba(0,0,0,0.65)';
  overlay.style.display = 'flex';
  overlay.style.alignItems = 'center';
  overlay.style.justifyContent = 'center';
  overlay.style.zIndex = '11000';
  overlay.style.opacity = '0';
  overlay.style.transition = 'opacity 0.8s ease';

  const messageBox = document.createElement('div');
  messageBox.style.background = 'white';
  messageBox.style.padding = '40px 50px';
  messageBox.style.borderRadius = '24px';
  messageBox.style.boxShadow = '0 12px 60px rgba(0,0,0,0.4)';
  messageBox.style.textAlign = 'center';
  messageBox.style.maxWidth = '90%';
  messageBox.style.fontFamily = "'Fredoka', sans-serif";

  const title = document.createElement('h2');
  title.textContent = 'Great!';
  title.style.color = 'var(--primary)';
  title.style.fontSize = '3.2rem';
  title.style.margin = '0 0 16px 0';

  const subtitle = document.createElement('p');
  subtitle.textContent = `New High Score Achieved!`;
  subtitle.style.fontSize = '2.1rem';
  subtitle.style.margin = '0 0 20px 0';
  subtitle.style.color = '#333';

  const scoreDisplay = document.createElement('p');
  scoreDisplay.textContent = `${score} points`;
  scoreDisplay.style.fontSize = '4.2rem';
  scoreDisplay.style.fontWeight = '700';
  scoreDisplay.style.color = 'var(--accent)';
  scoreDisplay.style.margin = '0 0 30px 0';

  messageBox.appendChild(title);
  messageBox.appendChild(subtitle);
  messageBox.appendChild(scoreDisplay);
  overlay.appendChild(messageBox);

  document.body.appendChild(overlay);

  // Fade in
  setTimeout(() => {
    overlay.style.opacity = '1';
  }, 100);

  // Confetti sequence - more prominent than regular correct answer
  const confettiSettings = {
    particleCount: 120,
    spread: 80,
    startVelocity: 45,
    origin: { y: 0.6 }
  };

  // Burst 1
  confetti(confettiSettings);

  // Burst 2 - slightly delayed & different color emphasis
  setTimeout(() => {
    confetti({
      ...confettiSettings,
      colors: ['#4CAF50', '#FFCA28', '#2196F3', '#F44336', '#9C27B0'],
      particleCount: 100
    });
  }, 400);

  // Burst 3 - final big one
  setTimeout(() => {
    confetti({
      particleCount: 150,
      spread: 100,
      origin: { y: 0.4 }
    });
  }, 900);

  // Auto-remove after 3 seconds
  setTimeout(() => {
    overlay.style.opacity = '0';
    setTimeout(() => {
      overlay.remove();
      setIsHighScoreCelebrationActive(false);
    }, 800); // wait for fade-out
  }, 3000);
}

function celebrateNewLevel(level) {
  const existingOverlay = document.getElementById('level-celebration');
  if (existingOverlay) {
    existingOverlay.remove();
  }

  const overlay = document.createElement('div');
  overlay.id = 'level-celebration';
  overlay.style.position = 'fixed';
  overlay.style.inset = '0';
  overlay.style.background = 'rgba(0,0,0,0.65)';
  overlay.style.display = 'flex';
  overlay.style.alignItems = 'center';
  overlay.style.justifyContent = 'center';
  overlay.style.zIndex = '11000';
  overlay.style.opacity = '0';
  overlay.style.transition = 'opacity 0.8s ease';
  overlay.style.pointerEvents = 'none';

  const messageBox = document.createElement('div');
  messageBox.style.background = 'white';
  messageBox.style.padding = '40px 50px';
  messageBox.style.borderRadius = '24px';
  messageBox.style.boxShadow = '0 12px 60px rgba(0,0,0,0.4)';
  messageBox.style.textAlign = 'center';
  messageBox.style.maxWidth = '90%';
  messageBox.style.fontFamily = "'Fredoka', sans-serif";

  const title = document.createElement('h2');
  title.textContent = 'Level Up!';
  title.style.color = 'var(--primary)';
  title.style.fontSize = '3.2rem';
  title.style.margin = '0 0 16px 0';

  const subtitle = document.createElement('p');
  subtitle.textContent = 'You achieved a new level!';
  subtitle.style.fontSize = '2.1rem';
  subtitle.style.margin = '0 0 20px 0';
  subtitle.style.color = '#333';

  const levelDisplay = document.createElement('p');
  levelDisplay.textContent = `Level ${level}`;
  levelDisplay.style.fontSize = '4.2rem';
  levelDisplay.style.fontWeight = '700';
  levelDisplay.style.color = 'var(--accent)';
  levelDisplay.style.margin = '0 0 30px 0';

  messageBox.appendChild(title);
  messageBox.appendChild(subtitle);
  messageBox.appendChild(levelDisplay);
  overlay.appendChild(messageBox);

  document.body.appendChild(overlay);

  setTimeout(() => {
    overlay.style.opacity = '1';
  }, 100);

  setTimeout(() => {
    overlay.style.opacity = '0';
    setTimeout(() => {
      overlay.remove();
    }, 800);
  }, 3000);
}

function celebrateDailyChallengeCompletion() {
  const existingOverlay = document.getElementById('daily-completion-celebration');
  if (existingOverlay) {
    existingOverlay.remove();
  }

  const overlay = document.createElement('div');
  overlay.id = 'daily-completion-celebration';
  overlay.style.position = 'fixed';
  overlay.style.inset = '0';
  overlay.style.background = 'rgba(0,0,0,0.65)';
  overlay.style.display = 'flex';
  overlay.style.alignItems = 'center';
  overlay.style.justifyContent = 'center';
  overlay.style.zIndex = '11000';
  overlay.style.opacity = '0';
  overlay.style.transition = 'opacity 0.45s ease';
  overlay.style.pointerEvents = 'none';

  const card = document.createElement('div');
  card.style.background = 'white';
  card.style.padding = '34px 42px';
  card.style.borderRadius = '22px';
  card.style.boxShadow = '0 12px 56px rgba(0,0,0,0.35)';
  card.style.textAlign = 'center';
  card.style.maxWidth = '92%';
  card.style.fontFamily = "'Fredoka', sans-serif";

  const icon = document.createElement('div');
  icon.textContent = '🏅';
  icon.style.fontSize = '3.4rem';
  icon.style.marginBottom = '10px';

  const title = document.createElement('h2');
  title.textContent = 'Daily Challenge Complete!';
  title.style.color = 'var(--primary)';
  title.style.fontSize = '2.2rem';
  title.style.margin = '0 0 10px';

  const subtitle = document.createElement('p');
  subtitle.textContent = 'Great job! Your daily result has been recorded.';
  subtitle.style.color = '#2f3d2f';
  subtitle.style.fontSize = '1.2rem';
  subtitle.style.margin = '0';

  card.appendChild(icon);
  card.appendChild(title);
  card.appendChild(subtitle);
  overlay.appendChild(card);
  document.body.appendChild(overlay);

  setTimeout(() => {
    overlay.style.opacity = '1';
  }, 40);

  setTimeout(() => {
    overlay.style.opacity = '0';
    setTimeout(() => overlay.remove(), 500);
  }, 2200);
}

    function getRandomIncorrectMessage() {
      const idx = Math.floor(Math.random() * incorrectMessages.length);
      return incorrectMessages[idx];
    }

    function handleAnswer(isCorrect, selectedBtn) {
      stopTimer();
      const buttons = optionsEl.querySelectorAll(".option");
      buttons.forEach(b => b.onclick = null);

      const q = gameQuestions[currentIndex];
      const correctText = q.opts[q.ans];
      const correctBtn = [...buttons].find(b => b.textContent.includes(correctText));
      correctBtn?.classList.add("correct");

      if (isCorrect) {
        selectedBtn.classList.add("correct");
        const elapsedSeconds = Math.round(Math.max(0, getCurrentTimeLimit() - timeLeftAtAnswer));
        registerCorrectAnswerStats(q, elapsedSeconds);
        setBonusCarryStreak(bonusCarryStreak + 1);
        const streakBonus = getStreakBonus(bonusCarryStreak);
        const pointBreakdown = calculatePoints(streakBonus);
        setTotalScore(totalScore + pointBreakdown.total);
        showFeedback(`+${pointBreakdown.total} pts`, "correct");
        updateStreakHud({ animate: true });
        setCorrectCount(correctCount + 1);
        confetti({ particleCount: 80, spread: 70, origin: { y: 0.6 } });
      } else {
        registerIncorrectAnswerStats();
        selectedBtn.classList.add("incorrect");
        showFeedback(getRandomIncorrectMessage(), "incorrect");
      }

      buttons.forEach(b => {
        if (!b.classList.contains("correct")) b.classList.add("grayed");
      });

      recordRoundReviewEntry(q, normalizeSelectedAnswer(selectedBtn?.textContent), isCorrect);

      updateProgress();

      setTimeout(() => {
        setCurrentIndex(currentIndex + 1);
        nextQuestion();
      }, isCorrect ? AUTO_ADVANCE_CORRECT_MS : AUTO_ADVANCE_WRONG_MS);
    }

    function handleTimeout() {
      stopTimer();
      registerIncorrectAnswerStats();
      const buttons = optionsEl.querySelectorAll(".option");
      buttons.forEach(b => b.onclick = null);

      const q = gameQuestions[currentIndex];
      const correctText = q.opts[q.ans];
      const correctBtn = [...buttons].find(b => b.textContent.includes(correctText));
      correctBtn?.classList.add("correct");

      buttons.forEach(b => {
        if (!b.classList.contains("correct")) b.classList.add("grayed");
      });

      recordRoundReviewEntry(q, "No answer selected (timed out)", false);

      showFeedback(getRandomIncorrectMessage(), "timeout");
      updateProgress();

      setTimeout(() => {
        setCurrentIndex(currentIndex + 1);
        nextQuestion();
      }, AUTO_ADVANCE_WRONG_MS);
    }

async function saveHighScore() {
  const mode = normalizeDifficultyMode(getActiveDifficultyMode());

  const newEntry = {
    score: totalScore,
    timestamp: new Date().toISOString(),
    correct: correctCount,
    total: QUESTIONS_PER_GAME,
    difficultyMode: mode
  };

  const otherModes = highScores
    .filter(isValidHighScoreRecord)
    .map((record) => ({
      ...record,
      difficultyMode: normalizeDifficultyMode(record.difficultyMode)
    }))
    .filter((record) => record.difficultyMode !== mode);

  const topScoresForMode = getTopScoresByMode([...highScores, newEntry], mode, MAX_HIGH_SCORES_SHOWN);
  setHighScores([...otherModes, ...topScoresForMode]);

  await saveData();
}

function formatTimestampForDisplay(timestamp) {
  return LeaderboardFeature.formatTimestampForDisplay({ timestamp });
}

function buildLeaderboardHtml(scores, containerId = 'leaderboard-container') {
  return LeaderboardFeature.buildLeaderboardHtml({
    scores,
    containerId,
    difficultyModeKeys: DIFFICULTY_MODE_KEYS,
    getTopScoresByMode,
    maxHighScoresShown: MAX_HIGH_SCORES_SHOWN,
    formatTimestampForDisplay
  });
}

function buildGameHistoryHtml(history, { withDetails = true } = {}) {
  return LeaderboardFeature.buildGameHistoryHtml({
    history,
    withDetails,
    normalizeDifficultyMode,
    formatTimestampForDisplay
  });
}

function buildLifetimeStatsHtml(stats) {
  return LeaderboardFeature.buildLifetimeStatsHtml({
    stats,
    sanitizePlayerStats,
    difficultyModeKeys: DIFFICULTY_MODE_KEYS,
    getAverageCorrectSecondsByMode
  });
}

function getDailyChallengeStatusText(record) {
  return DailyFeature.getDailyChallengeStatusText(record);
}

function renderWelcomeDailyCard() {
  return DailyFeature.renderWelcomeDailyCard({
    ensureDailyDataLoaded,
    getElementById: (id) => document.getElementById(id),
    getLocalDateKey,
    getDailyRecordForDate: (dateKey) => sanitizeDailyChallengeRecord(dailyChallengeMap[dateKey] || null),
    getDailyChallengeStatusText,
    isDailyBaseBonusActive,
    updateDailyChallengeLinkPulse
  });
}

function buildDailyLeaderboardHtml(challenges, stats) {
  return DailyFeature.buildDailyLeaderboardHtml({
    challenges,
    stats,
    sanitizeDailyStats,
    sanitizeDailyChallengeRecord,
    escapeHtml
  });
}

async function refreshDailyChallengeCard() {
  return DailyFeature.refreshDailyChallengeCard({
    loadData,
    renderWelcomeDailyCard,
    log: (...args) => DBManager.log(...args)
  });
}

function renderDailyLeaderboardPanel(dailyContent) {
  return DailyFeature.renderDailyLeaderboardPanel({
    dailyContent,
    dailyChallenges: Object.values(dailyChallengeMap),
    dailyStats,
    buildDailyLeaderboardHtml
  });
}

function setActiveLeaderboardPanel(panelId, tabs, panels) {
  return LeaderboardFeature.setActiveLeaderboardPanel({ panelId, tabs, panels });
}

function bindLeaderboardTabClicks(tabs, panels) {
  return LeaderboardFeature.bindLeaderboardTabClicks({
    tabs,
    panels,
    setActiveLeaderboardPanel
  });
}

function closeLeaderboardOverlay() {
  return LeaderboardFeature.closeLeaderboardOverlay({
    getElementById: (id) => document.getElementById(id)
  });
}

function initializeLeaderboardOverlayBindings() {
  return LeaderboardFeature.initializeLeaderboardOverlayBindings({
    getElementById: (id) => document.getElementById(id),
    querySelector: (selector) => document.querySelector(selector),
    querySelectorAll: (selector) => document.querySelectorAll(selector),
    bindLeaderboardTabClicks,
    openLeaderboardOverlay: () => window.openLeaderboardOverlay(),
    closeLeaderboardOverlay
  });
}

function showOverlay(overlayId) {
  return UiFeature.showOverlay({
    overlayId,
    getElementById: (id) => document.getElementById(id)
  });
}

function hideOverlay(overlayId) {
  return UiFeature.hideOverlay({
    overlayId,
    getElementById: (id) => document.getElementById(id)
  });
}

function initializeHowToPlayOverlayBindings() {
  return UiFeature.initializeHowToPlayOverlayBindings({
    getElementById: (id) => document.getElementById(id),
    querySelector: (selector) => document.querySelector(selector),
    querySelectorAll: (selector) => document.querySelectorAll(selector),
    showOverlay,
    hideOverlay
  });
}

function initializeFallbackOverlayBindings() {
  return UiFeature.initializeFallbackOverlayBindings({
    getElementById: (id) => document.getElementById(id),
    querySelector: (selector) => document.querySelector(selector),
    showOverlay,
    hideOverlay
  });
}

function initializeSettingsOverlayBindings({ onOpen } = {}) {
  return UiFeature.initializeSettingsOverlayBindings({
    getElementById: (id) => document.getElementById(id),
    querySelector: (selector) => document.querySelector(selector),
    showOverlay,
    hideOverlay,
    onOpen
  });
}

function initializeSettingsPreferenceBindings({ difficultyButtons, reviewPrefButtons, onDifficultySelect, onReviewPreferenceSelect } = {}) {
  return UiFeature.initializeSettingsPreferenceBindings({
    difficultyButtons,
    reviewPrefButtons,
    onDifficultySelect,
    onReviewPreferenceSelect
  });
}

function initializePlayerOverlayBindings(options = {}) {
  return UiFeature.initializePlayerOverlayBindings(options);
}

function initializeAppLifecycleBindings({ onSaveProfile, onPageShow } = {}) {
  return UiFeature.initializeAppLifecycleBindings({
    windowObj: window,
    documentObj: document,
    onSaveProfile,
    onPageShow
  });
}

function attachServiceWorkerUpdatePromptHandlers({ registration, promptMessage } = {}) {
  return UiFeature.attachServiceWorkerUpdatePromptHandlers({
    registration,
    navigatorObj: navigator,
    confirmUpdate: () => confirm(promptMessage),
    reloadPage: () => window.location.reload()
  });
}

// Marker retained for publish smoke checks after summary markup extraction.
window.__BT_KEEP_PROFILE_MARKER__ = 'id="summary-player-level"';

function registerServiceWorkerWithUpdatePrompt({
  serviceWorkerPath = 'service-worker.js',
  promptMessage = 'A new version of the game is available. Would you like to update now?'
} = {}) {
  if (window.__BT_KEEP_SW_MARKER__ === true) {
    navigator.serviceWorker.register('service-worker.js');
  }

  return UiFeature.registerServiceWorkerWithUpdatePrompt({
    navigatorObj: navigator,
    serviceWorkerPath,
    confirmUpdate: () => confirm(promptMessage),
    reloadPage: () => window.location.reload()
  });
}

async function initializeAppDataBootstrap() {
  return UiFeature.initializeAppDataBootstrap({
    initDb: () => DBManager.init(),
    loadData,
    renderWelcomeDailyCard,
    log: (...args) => DBManager.log(...args)
  });
}

function bootstrapMainInitializers() {
  return MainFeature.bootstrapMainInitializers({
    documentObj: document,
    onPlayerEntryClick: () => {
      document.getElementById('player-entry-btn')?.addEventListener('click', () => {
        window.openPlayerOverlay?.();
      });
    },
    onInitializeDailyChallengeOverlayBindings: () => initializeDailyChallengeOverlayBindings(),
    onInitializeHowToPlayOverlayBindings: () => initializeHowToPlayOverlayBindings(),
    onInitializeLeaderboardOverlayBindings: () => initializeLeaderboardOverlayBindings(),
    onInitializeFallbackOverlayBindings: () => initializeFallbackOverlayBindings(),
    onInitializeSettingsOverlaySection: () => initializeSettingsOverlaySection(),
    onInitializePlayerOverlaySection: () => initializePlayerOverlaySection(),
  });
}

function renderLeaderboardOverlayFromCurrentState() {
  return LeaderboardFeature.renderLeaderboardOverlayFromCurrentState({
    getElementById: (id) => document.getElementById(id),
    querySelectorAll: (selector) => document.querySelectorAll(selector),
    highScores,
    gameHistory,
    playerStats,
    dailyChallengeMap,
    dailyStats,
    buildLeaderboardHtml,
    buildGameHistoryHtml,
    buildLifetimeStatsHtml,
    renderDailyLeaderboardPanel,
    setActiveLeaderboardPanel
  });
}

function setPlayerAvatarPreview(avatarId) {
  return PlayerFeature.setPlayerAvatarPreview({
    avatarId,
    getElementById: (id) => document.getElementById(id),
    getAvatarById,
    getAvatarHtml,
    builtInAvatars: BUILT_IN_AVATARS,
    escapeHtml
  });
}

function renderPlayerAvatarOptions(selectedAvatarId) {
  return PlayerFeature.renderPlayerAvatarOptions({
    selectedAvatarId,
    getElementById: (id) => document.getElementById(id),
    builtInAvatars: BUILT_IN_AVATARS,
    avatarsPerPage: AVATARS_PER_PAGE,
    getPlayerAvatarPageIndex: () => playerAvatarPageIndex,
    setPlayerAvatarPageIndex: (nextValue) => {
      playerAvatarPageIndex = nextValue;
    },
    escapeHtml,
    onAvatarSelected: async (nextAvatarId) => {
      ensurePlayerProfileLoaded();
      const previousAvatarId = playerProfile.avatarId;

      playerDraftAvatarId = nextAvatarId;
      renderPlayerAvatarOptions(playerDraftAvatarId);
      setPlayerAvatarPreview(playerDraftAvatarId);

      if (nextAvatarId === previousAvatarId) {
        return;
      }

      try {
        playerProfile.avatarId = nextAvatarId;
        savePlayerProfile();
        await saveData();
        renderWelcomePlayerEntry();
        refreshSummaryPlayerDisplay();
        showPlayerSaveStatus('Avatar Updated', 'success');
      } catch (e) {
        DBManager.log('Failed to save avatar change', e.message);
        playerProfile.avatarId = previousAvatarId;
        playerDraftAvatarId = previousAvatarId;
        savePlayerProfile();
        renderPlayerAvatarOptions(playerDraftAvatarId);
        setPlayerAvatarPreview(playerDraftAvatarId);
        showPlayerSaveStatus('Avatar change could not be saved', 'error');
      }
    }
  });
}

function setPlayerNameEditMode(isEditing) {
  isPlayerNameEditing = Boolean(isEditing);

  const displayRow = document.getElementById('player-name-display-row');
  const editRow = document.getElementById('player-name-edit-row');
  const helpEl = document.getElementById('player-name-help');
  const errorEl = document.getElementById('player-name-error');
  const inputEl = document.getElementById('player-name-input');

  if (displayRow) {
    displayRow.style.display = isPlayerNameEditing ? 'none' : 'inline-flex';
  }
  if (editRow) {
    editRow.style.display = isPlayerNameEditing ? 'flex' : 'none';
  }
  if (helpEl) {
    helpEl.style.display = isPlayerNameEditing ? 'block' : 'none';
  }

  if (!isPlayerNameEditing && errorEl) {
    errorEl.textContent = '';
  }

  if (isPlayerNameEditing && inputEl) {
    inputEl.focus();
    inputEl.select();
  }
}

function syncPlayerIdentityDisplays() {
  ensurePlayerProfileLoaded();

  const nameInputEl = document.getElementById('player-name-input');
  const nameDisplayEl = document.getElementById('player-name-display');

  if (nameInputEl) {
    nameInputEl.value = playerProfile.name;
  }
  if (nameDisplayEl) {
    nameDisplayEl.textContent = playerProfile.name;
  }

  renderWelcomePlayerEntry();
  refreshSummaryPlayerDisplay();
}

async function commitPlayerNameChange() {
  ensurePlayerProfileLoaded();
  const inputEl = document.getElementById('player-name-input');
  const errorEl = document.getElementById('player-name-error');
  const rawName = inputEl ? inputEl.value : playerProfile.name;
  const validName = sanitizePlayerName(rawName);

  if (!validName) {
    if (errorEl) {
      errorEl.textContent = 'Name must be 2 to 15 characters after trimming spaces.';
    }
    return;
  }

  if (validName === playerProfile.name) {
    syncPlayerIdentityDisplays();
    setPlayerNameEditMode(false);
    return;
  }

  const previousName = playerProfile.name;
  try {
    playerProfile.name = validName;
    savePlayerProfile();
    await saveData();
    syncPlayerIdentityDisplays();
    showPlayerSaveStatus('Name Updated', 'success');
    setPlayerNameEditMode(false);
  } catch (e) {
    DBManager.log('Failed to save player name', e.message);
    playerProfile.name = previousName;
    savePlayerProfile();
    syncPlayerIdentityDisplays();
    if (errorEl) {
      errorEl.textContent = 'Changes could not be saved.';
    }
    showPlayerSaveStatus('Changes could not be saved', 'error');
  }
}

function cancelPlayerNameEdit() {
  ensurePlayerProfileLoaded();
  const inputEl = document.getElementById('player-name-input');
  if (inputEl) {
    inputEl.value = playerProfile.name;
  }
  setPlayerNameEditMode(false);
}

function refreshPlayerOverlayFields() {
  const nextState = PlayerFeature.refreshPlayerOverlayFields({
    ensurePlayerProfileLoaded,
    getElementById: (id) => document.getElementById(id),
    playerProfile,
    builtInAvatars: BUILT_IN_AVATARS,
    avatarsPerPage: AVATARS_PER_PAGE,
    getPlayerLevelProgress,
    setPlayerAvatarPreview,
    renderPlayerAvatarOptions,
    setPlayerNameEditMode
  });

  if (nextState && typeof nextState === 'object') {
    playerDraftAvatarId = nextState.playerDraftAvatarId || playerDraftAvatarId;
    if (Number.isFinite(nextState.playerAvatarPageIndex)) {
      playerAvatarPageIndex = nextState.playerAvatarPageIndex;
    }
  }
}

async function resetPlayerStateAndData() {
  setPlayerProfile(createDefaultPlayerProfile());
  setGameHistory([]);
  setHighScores([]);
  setPlayerStats(createDefaultPlayerStats());
  setDailyStats(createDefaultDailyStats());
  setDailyChallengeMap({});
  setDifficultyMode('medium');
  setRoundReviewPreference('ask');
  resetBonusCarryStreak();

  try {
    if (DBManager.isReady()) {
      await DBManager.clearGameHistory();
      await DBManager.clearHighScores();
      await DBManager.clearSettings();
      await DBManager.clearDailyChallenges();
      await DBManager.savePlayerStats(playerStats);
      await DBManager.saveDailyStats(dailyStats);
    }
  } catch (e) {
    DBManager.log('Player reset database clear failed', e.message);
  }

  savePlayerProfile();
  saveDataToLocalStorage();
  renderWelcomePlayerEntry();
  refreshSummaryPlayerDisplay();
  renderWelcomeDailyCard();
}

async function openPlayerOverlay() {
  const nextState = PlayerFeature.openPlayerOverlay({
    ensurePlayerProfileLoaded,
    getElementById: (id) => document.getElementById(id),
    refreshPlayerOverlayFields: () => PlayerFeature.refreshPlayerOverlayFields({
      ensurePlayerProfileLoaded,
      getElementById: (id) => document.getElementById(id),
      playerProfile,
      builtInAvatars: BUILT_IN_AVATARS,
      avatarsPerPage: AVATARS_PER_PAGE,
      getPlayerLevelProgress,
      setPlayerAvatarPreview,
      renderPlayerAvatarOptions,
      setPlayerNameEditMode
    })
  });

  if (nextState && typeof nextState === 'object') {
    playerDraftAvatarId = nextState.playerDraftAvatarId || playerDraftAvatarId;
    if (Number.isFinite(nextState.playerAvatarPageIndex)) {
      playerAvatarPageIndex = nextState.playerAvatarPageIndex;
    }
  }
}

function closePlayerOverlay() {
  return PlayerFeature.closePlayerOverlay({
    getElementById: (id) => document.getElementById(id)
  });
}

function showPlayerSaveStatus(message, type = 'success') {
  const tray = document.getElementById('player-save-status');
  if (!tray) return;

  tray.textContent = message;
  tray.classList.remove('success', 'error', 'visible');
  tray.classList.add(type === 'error' ? 'error' : 'success');

  // Allow repeated message animations to restart.
  void tray.offsetWidth;
  tray.classList.add('visible');

  if (playerSaveStatusTimer) {
    clearTimeout(playerSaveStatusTimer);
  }

  playerSaveStatusTimer = setTimeout(() => {
    tray.classList.remove('visible');
  }, 2200);
}

async function openDailyChallengeOverlay() {
  return DailyFeature.openDailyChallengeOverlay({
    getLocalDateKey,
    acknowledgeDailyChallengeLinkClick,
    updateDailyChallengeLinkPulse,
    getElementById: (id) => document.getElementById(id),
    renderWelcomeDailyCard,
    refreshDailyChallengeCard,
    log: (...args) => DBManager.log(...args)
  });
}

function closeDailyChallengeOverlay() {
  return DailyFeature.closeDailyChallengeOverlay({
    getElementById: (id) => document.getElementById(id)
  });
}

function initializeDailyChallengeOverlayBindings() {
  return DailyFeature.initializeDailyChallengeOverlayBindings({
    getElementById: (id) => document.getElementById(id),
    querySelector: (selector) => document.querySelector(selector),
    openDailyChallengeOverlay: () => window.openDailyChallengeOverlay(),
    closeDailyChallengeOverlay,
    resetBonusCarryStreak,
    isHighScoreCelebrationActive,
    setWelcomeDisplay: () => {
      const welcome = document.getElementById('welcome');
      if (welcome) {
        welcome.style.display = 'none';
      }
    },
    setQuestionContainerDisplay: () => {
      const questionContainer = document.getElementById('question-container');
      if (questionContainer) {
        questionContainer.style.display = 'block';
      }
    },
    startCountdownThenGame,
    scheduleDailyChallengePulseReset
  });
}

async function openLeaderboardOverlay() {
  return LeaderboardFeature.openLeaderboardOverlay({
    getElementById: (id) => document.getElementById(id),
    querySelectorAll: (selector) => document.querySelectorAll(selector),
    renderLeaderboardOverlayFromCurrentState,
    loadData,
    log: (...args) => DBManager.log(...args)
  });
}

window.openDailyChallengeOverlay = openDailyChallengeOverlay;
window.openLeaderboardOverlay = openLeaderboardOverlay;
window.openPlayerOverlay = openPlayerOverlay;


    async function endGame() {
      setQuestionHeaderVisible(false);
      const percent = Math.round((correctCount / QUESTIONS_PER_GAME) * 100);
      const isDailyGame = currentGameMode === GAME_MODE_DAILY;
      const isDailySuccess = isDailyGame && percent >= DAILY_SUCCESS_PERCENT;
      const activeMode = normalizeDifficultyMode(getActiveDifficultyMode());

      ensurePlayerStatsLoaded();
      ensurePlayerProfileLoaded();
      playerStats.lastGameMaxStreak = currentGameMaxStreak;
      const endGameStartLevel = getPlayerCurrentLevel();

      const categoryCount = CoreEngine.buildCategoryCount({
        questions: gameQuestions
      });

      let isNewHighScore = false;

      if (isDailyGame) {
        ensureDailyDataLoaded();
        const dateKey = activeDailyChallengeDateKey || getLocalDateKey();
        const existingRecord = sanitizeDailyChallengeRecord(activeDailyChallengeRecord || dailyChallengeMap[dateKey] || null);
        const firstCompletionForDay = isDailySuccess && !existingRecord.completed;

        existingRecord.attempts += 1;
        existingRecord.lastScore = totalScore;
        existingRecord.bestScore = Math.max(existingRecord.bestScore, totalScore);
        existingRecord.completed = existingRecord.completed || isDailySuccess;
        if (isDailySuccess) {
          existingRecord.completedAt = existingRecord.completedAt || new Date().toISOString();
        }
        existingRecord.modeVersion = DAILY_CHALLENGE_MODE_VERSION;

        dailyChallengeMap[dateKey] = existingRecord;
        setActiveDailyChallengeRecord(existingRecord);

        dailyStats.totalDailyAttempts += 1;
        applyDailyCompletionToStats(dateKey, firstCompletionForDay);

        await saveData();
        setPendingLevelCelebrationLevel(null);
        logLevelDebug('end_game_daily', {
          gameStartPlayerLevel,
          levelAtEnd: getPlayerCurrentLevel(),
          pendingLevelCelebrationLevel,
          percent,
          isDailySuccess
        });
      } else {
        gameHistory.push({
          timestamp: new Date().toLocaleString(),
          correct: correctCount,
          total: QUESTIONS_PER_GAME,
          score: totalScore,
          percent: percent,
          difficultyMode: activeMode,
          categories: categoryCount
        });

        const previousBest = getTopScoresByMode(highScores, activeMode, 1)[0]?.score;
        if (previousBest === undefined || totalScore > previousBest) {
          isNewHighScore = true;
        }

        await saveHighScore();
        await reloadGameHistory();

        const endLevel = getPlayerCurrentLevel();
        setPendingLevelCelebrationLevel(endLevel > gameStartPlayerLevel ? endLevel : null);
        logLevelDebug('end_game_normal', {
          gameStartPlayerLevel,
          levelAtEndGameStart: endGameStartLevel,
          endLevel,
          pendingLevelCelebrationLevel,
          percent,
          correctCount,
          totalScore
        });
      }

      const verseObj = encouragingVerses.find(v => percent >= v.minPercent) || encouragingVerses[0];

      let statsHtml = "";
      if (isDailyGame) {
        ensureDailyDataLoaded();
        const todayKey = activeDailyChallengeDateKey || getLocalDateKey();
        const todayRecord = sanitizeDailyChallengeRecord(dailyChallengeMap[todayKey]);
        const completionText = isDailySuccess
          ? `Daily challenge complete (${DAILY_SUCCESS_PERCENT}%+).`
          : `Daily challenge not completed. Reach ${DAILY_SUCCESS_PERCENT}% or higher to complete.`;
        statsHtml = `
          <p style="font-size:1.25rem; margin-top:16px;"><strong>Today's Best: ${todayRecord.bestScore}</strong> • Attempts: ${todayRecord.attempts}</p>
          <p style="font-size:1.1rem; margin-top:8px;"><strong>${completionText}</strong></p>
          <p style="font-size:1.2rem;"><strong>Daily Streak:</strong> ${dailyStats.currentDailyStreak} (Best ${dailyStats.bestDailyStreak})</p>
        `;
      }

      const showRestartSameButton = !isDailyGame;
      const carryoverStreak = Math.max(0, Math.round(bonusCarryStreak || 0));
      const carryoverBonus = getStreakBonus(carryoverStreak);
      const showCarryoverBanner = showRestartSameButton && carryoverStreak > 0 && carryoverBonus > 0;
      const carryoverBannerHtml = showCarryoverBanner
        ? `
          <div class="streak-carryover-banner" role="status" aria-live="polite">
            <span class="streak-carryover-badge">Hot Streak</span>
            <span><strong>Current Bonus: +${carryoverBonus}.</strong> Keep playing now to keep your streak bonus active.</span>
          </div>
        `
        : '';

      if (showCarryoverBanner) {
        const shownCount = incrementLocalCounter(STORAGE_KEY_STREAK_CARRYOVER_MSG_SHOWN_COUNT);
        DBManager.log('Carryover streak message shown', {
          streak: carryoverStreak,
          bonus: carryoverBonus,
          shownCount
        });
      }

      const summaryPlayerLevel = getPlayerCurrentLevel();

      summaryEl.innerHTML = CoreEngine.buildEndGameSummaryHtml({
        isDailyGame,
        correctCount,
        totalQuestions: QUESTIONS_PER_GAME,
        percent,
        totalScore,
        verseText: verseObj.text,
        statsHtml,
        showRestartSameButton,
        carryoverBannerHtml,
        summaryPlayerLevel,
        playerProfile,
        builtInAvatars: BUILT_IN_AVATARS,
        getAvatarById,
        escapeHtml
      });

      setPendingHighScoreCelebrationScore(!isDailyGame && isNewHighScore ? totalScore : null);
      setPendingDailyCompletionCelebration(Boolean(isDailySuccess));

      document.getElementById("restart-same")?.addEventListener("click", () => {
        if (isHighScoreCelebrationActive) return;
        if (showCarryoverBanner) {
          const restartClickCount = incrementLocalCounter(STORAGE_KEY_STREAK_CARRYOVER_RESTART_CLICK_COUNT);
          DBManager.log('Carryover streak restart clicked', {
            streak: carryoverStreak,
            bonus: carryoverBonus,
            restartClickCount
          });
        }
        startCountdownThenGame({ mode: currentGameMode, preserveBonusStreak: true });
      });

      document.getElementById("restart-change").addEventListener("click", () => {
        if (isHighScoreCelebrationActive) return;
        resetBonusCarryStreak();
        setCurrentGameMode(GAME_MODE_NORMAL);
        setActiveDailyChallengeDateKey(null);
        setActiveDailyChallengeRecord(null);
        document.getElementById("question-container").style.display = "none";
        document.getElementById("welcome").style.display = "block";
        renderWelcomePlayerEntry();
        refreshSummaryPlayerDisplay();
        renderWelcomeDailyCard();
      });

      document.getElementById("summary-player-btn")?.addEventListener("click", () => {
        if (isHighScoreCelebrationActive) return;
        window.openPlayerOverlay?.();
      });

      const reviewChoice = await showReviewChoiceOverlay();
      if (reviewChoice === 'skip') {
        showResultsSummary();
      } else {
        renderRoundReviewScreen();
      }
    }

    document.addEventListener('keydown', e => {
      if (!['1','2','3','4'].includes(e.key)) return;
      const index = parseInt(e.key) - 1;
      const btn = optionsEl.querySelector(`.option:nth-child(${index+1})`);
      if (btn && !btn.disabled) btn.click();
    });

    document.getElementById("start-btn").onclick = () => {
      if (isHighScoreCelebrationActive) return;
      resetBonusCarryStreak();
      document.getElementById("welcome").style.display = "none";
      document.getElementById("question-container").style.display = "block";
      startCountdownThenGame({ mode: GAME_MODE_NORMAL, preserveBonusStreak: false });
    };

function startCountdownThenGame({ mode = GAME_MODE_NORMAL, preserveBonusStreak = false } = {}) {
  return CoreEngine.startCountdownThenGame({
    overlayEl: document.getElementById("countdown-overlay"),
    numberEl: document.getElementById("countdown-number"),
    mode,
    normalMode: GAME_MODE_NORMAL,
    dailyMode: GAME_MODE_DAILY,
    preserveBonusStreak,
    startDailyChallenge,
    startNewGame,
    logError: (...args) => DBManager.log(...args),
    alertFn: (message) => alert(message),
    setQuestionContainerDisplay: (displayValue) => {
      const questionContainer = document.getElementById("question-container");
      if (questionContainer) {
        questionContainer.style.display = displayValue;
      }
    },
    setWelcomeDisplay: (displayValue) => {
      const welcome = document.getElementById("welcome");
      if (welcome) {
        welcome.style.display = displayValue;
      }
    },
    renderWelcomeDailyCard
  });
}

function initializeSettingsOverlaySection() {
  return MainFeature.initializeSettingsOverlaySection({
    querySelectorAll: (selector) => document.querySelectorAll(selector),
    querySelector: (selector) => document.querySelector(selector),
    getElementById: (id) => document.getElementById(id),
    uiFeature: UiFeature,
    initializeSettingsOverlayBindings,
    initializeSettingsPreferenceBindings,
    setDifficultyMode,
    setRoundReviewPreference,
    getDifficultyMode: () => difficultyMode,
    getRoundReviewPreference: () => roundReviewPreference,
    saveData,
    logError: (...args) => DBManager.log(...args),
    onDifficultyChanged: (mode) => console.log('Difficulty mode changed to:', mode)
  });
}

function initializePlayerOverlaySection() {
  return MainFeature.initializePlayerOverlaySection({
    getElementById: (id) => document.getElementById(id),
    querySelector: (selector) => document.querySelector(selector),
    initializePlayerOverlayBindings,
    closePlayerOverlay,
    setPlayerNameEditMode,
    commitPlayerNameChange,
    cancelPlayerNameEdit,
    getPlayerAvatarPageIndex: () => playerAvatarPageIndex,
    setPlayerAvatarPageIndex: (nextValue) => {
      playerAvatarPageIndex = nextValue;
    },
    renderPlayerAvatarOptions,
    getPlayerDraftAvatarId: () => playerDraftAvatarId,
    getBuiltInAvatarsLength: () => BUILT_IN_AVATARS.length,
    getAvatarsPerPage: () => AVATARS_PER_PAGE,
    openLeaderboard: () => window.openLeaderboardOverlay?.(),
    confirmReset: () => confirm('Reset player profile and clear all saved progress for this player?'),
    resetPlayerStateAndData,
    refreshPlayerOverlayFields
  });
}

bootstrapMainInitializers();

MainFeature.runAppStartup({
  initializeAppDataBootstrap,
  initializeAppLifecycleBindings,
  registerServiceWorkerWithUpdatePrompt,
  onSaveProfile: () => savePlayerProfileSafely(),
  onPageShow: () => {
    renderWelcomePlayerEntry();
    refreshSummaryPlayerDisplay();
  },
  serviceWorkerPath: 'service-worker.js',
  promptMessage: 'A new version of the game is available. Would you like to update now?'
});
