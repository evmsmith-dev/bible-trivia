(function attachBibleTriviaMainRuntime(globalScope) {
  function getMissingRuntimeDependencies() {
    const required = [
      { owner: "BibleTriviaCore", fn: "normalizeDifficultyMode" },
      { owner: "BibleTriviaCore", fn: "normalizeRoundReviewPreference" },
      { owner: "BibleTriviaCore", fn: "isValidHighScoreRecord" },
      { owner: "BibleTriviaCore", fn: "compareScoresDescending" },
      { owner: "BibleTriviaCore", fn: "getTopScoresByMode" },
      { owner: "BibleTriviaCore", fn: "normalizeAndTrimHighScores" },
      { owner: "BibleTriviaCore", fn: "createZeroedModeMap" },
      { owner: "BibleTriviaCore", fn: "createDefaultPlayerStats" },
      { owner: "BibleTriviaCore", fn: "sanitizePlayerStats" },
      { owner: "BibleTriviaCore", fn: "createDefaultDailyStats" },
      { owner: "BibleTriviaCore", fn: "sanitizeDailyStats" },
      { owner: "BibleTriviaCore", fn: "sanitizeDailyChallengeRecord" },
      { owner: "BibleTriviaCore", fn: "sanitizeDailyChallengeMap" },
      { owner: "BibleTriviaCore", fn: "getLocalDateKey" },
      { owner: "BibleTriviaCore", fn: "getDateKeyOffset" },
      { owner: "BibleTriviaCore", fn: "createDailySeed" },
      { owner: "BibleTriviaCore", fn: "createSeededRandom" },
      { owner: "BibleTriviaCore", fn: "shuffleWithRandom" },
      { owner: "BibleTriviaCore", fn: "getCappedStreak" },
      { owner: "BibleTriviaCore", fn: "getStreakBonus" },
      { owner: "BibleTriviaCore", fn: "getNextStreakBonusInfo" },
      { owner: "BibleTriviaEngine", fn: "getTimeLimitForMode" },
      { owner: "BibleTriviaEngine", fn: "calculatePointBreakdown" },
      { owner: "BibleTriviaEngine", fn: "selectBalancedQuestionsForMode" },
      { owner: "BibleTriviaEngine", fn: "startCountdownThenGame" },
      { owner: "BibleTriviaEngine", fn: "buildCategoryCount" },
      { owner: "BibleTriviaEngine", fn: "buildEndGameSummaryHtml" },
    ];

    return required
      .filter(({ owner, fn }) => typeof globalScope?.[owner]?.[fn] !== "function")
      .map(({ owner, fn }) => `${owner}.${fn}`);
  }

  function validateRuntimeDependencies() {
    const missing = getMissingRuntimeDependencies();
    if (!missing.length) {
      return true;
    }

    console.error("Bible Trivia runtime modules missing required APIs", missing);
    return false;
  }

  function initializeSettingsOverlaySection(input) {
    const payload = input && typeof input === "object" ? input : {};
    const querySelectorAll = typeof payload.querySelectorAll === "function" ? payload.querySelectorAll : (() => []);
    const querySelector = typeof payload.querySelector === "function" ? payload.querySelector : (() => null);
    const getElementById = typeof payload.getElementById === "function" ? payload.getElementById : (() => null);
    const uiFeature = payload.uiFeature && typeof payload.uiFeature === "object" ? payload.uiFeature : {};
    const initializeSettingsOverlayBindings = typeof payload.initializeSettingsOverlayBindings === "function"
      ? payload.initializeSettingsOverlayBindings
      : (() => false);
    const initializeSettingsPreferenceBindings = typeof payload.initializeSettingsPreferenceBindings === "function"
      ? payload.initializeSettingsPreferenceBindings
      : (() => false);
    const setDifficultyMode = typeof payload.setDifficultyMode === "function" ? payload.setDifficultyMode : (() => {});
    const setRoundReviewPreference = typeof payload.setRoundReviewPreference === "function"
      ? payload.setRoundReviewPreference
      : (() => {});
    const getDifficultyMode = typeof payload.getDifficultyMode === "function" ? payload.getDifficultyMode : (() => "medium");
    const getRoundReviewPreference = typeof payload.getRoundReviewPreference === "function"
      ? payload.getRoundReviewPreference
      : (() => "ask");
    const saveData = typeof payload.saveData === "function" ? payload.saveData : (async () => {});
    const logError = typeof payload.logError === "function" ? payload.logError : (() => {});
    const onDifficultyChanged = typeof payload.onDifficultyChanged === "function" ? payload.onDifficultyChanged : (() => {});

    const difficultyButtons = querySelectorAll(".difficulty-btn");
    const modeDescriptionEl = querySelector(".setting-description");
    const reviewPrefButtons = querySelectorAll(".review-pref-btn");
    const reviewPrefDescriptionEl = getElementById("review-pref-description");

    if (!difficultyButtons || typeof difficultyButtons.length !== "number" || difficultyButtons.length === 0) {
      return false;
    }

    const modeDescriptions = {
      easy: "<b>🟢 Easy:</b> 🟢 questions • 50 pts • 25 sec • Max 500 per game",
      medium: "<b>🟠 Medium:</b> 🟢 & 🟠 questions • 100 pts • 25 sec • Max 1000 per game",
      hard: "<b>🔴 Hard:</b> 🟠 & 🔴 questions • 150 pts • 21 sec • Max 1500 per game",
      superHard: "<b>⚫ Super Hard:</b> 🔴 questions only • 250 pts • 18 sec • Max 2500 per game — Elite Challenge!",
    };

    const reviewPreferenceDescriptions = {
      ask: "Ask each round whether to review or skip (recommended).",
      alwaysReview: "Always show the Round Review after each game.",
      alwaysSkip: "Always go straight to the summary results.",
    };

    function updateModeDescription(mode) {
      if (typeof uiFeature.updateSettingsModeDescription === "function") {
        return uiFeature.updateSettingsModeDescription({
          mode,
          modeDescriptionEl,
          modeDescriptions,
        });
      }

      if (modeDescriptionEl && Object.prototype.hasOwnProperty.call(modeDescriptions, mode)) {
        modeDescriptionEl.innerHTML = modeDescriptions[mode];
      }
      return true;
    }

    function syncDifficultyButtons() {
      const difficultyMode = getDifficultyMode();
      if (typeof uiFeature.syncDifficultyButtonsUI === "function") {
        return uiFeature.syncDifficultyButtonsUI({
          difficultyButtons,
          difficultyMode,
          updateModeDescription,
        });
      }

      difficultyButtons.forEach((button) => {
        button.classList.remove("active");
        if (button.dataset.mode === difficultyMode) {
          button.classList.add("active");
        }
      });
      updateModeDescription(difficultyMode);
      return true;
    }

    function syncReviewPreferenceButtons() {
      const roundReviewPreference = getRoundReviewPreference();
      if (typeof uiFeature.syncReviewPreferenceButtonsUI === "function") {
        return uiFeature.syncReviewPreferenceButtonsUI({
          reviewPrefButtons,
          roundReviewPreference,
          reviewPrefDescriptionEl,
          reviewPreferenceDescriptions,
        });
      }

      reviewPrefButtons.forEach((button) => {
        const isActive = button.dataset.value === roundReviewPreference;
        button.classList.toggle("active", isActive);
        button.setAttribute("aria-pressed", isActive ? "true" : "false");
      });

      if (reviewPrefDescriptionEl) {
        reviewPrefDescriptionEl.textContent = reviewPreferenceDescriptions[roundReviewPreference] || reviewPreferenceDescriptions.ask;
      }

      return true;
    }

    syncDifficultyButtons();
    syncReviewPreferenceButtons();

    initializeSettingsOverlayBindings({
      onOpen: () => {
        syncDifficultyButtons();
        syncReviewPreferenceButtons();
      },
    });

    initializeSettingsPreferenceBindings({
      difficultyButtons,
      reviewPrefButtons,
      onDifficultySelect: async ({ event, selectedMode }) => {
        difficultyButtons.forEach((button) => button.classList.remove("active"));

        const clickedBtn = event && event.currentTarget ? event.currentTarget : null;
        if (clickedBtn) {
          clickedBtn.classList.add("active");
        }

        setDifficultyMode(selectedMode);
        onDifficultyChanged(getDifficultyMode());
        syncDifficultyButtons();
        await saveData().catch((error) => {
          const message = error && error.message ? error.message : String(error);
          logError("Failed to save difficulty mode", message);
        });
      },
      onReviewPreferenceSelect: async ({ selectedPreference }) => {
        setRoundReviewPreference(selectedPreference);
        syncReviewPreferenceButtons();
        await saveData().catch((error) => {
          const message = error && error.message ? error.message : String(error);
          logError("Failed to save round review preference", message);
        });
      },
    });

    return true;
  }

  function initializePlayerOverlaySection(input) {
    const payload = input && typeof input === "object" ? input : {};
    const getElementById = typeof payload.getElementById === "function" ? payload.getElementById : (() => null);
    const querySelector = typeof payload.querySelector === "function" ? payload.querySelector : (() => null);
    const initializePlayerOverlayBindings = typeof payload.initializePlayerOverlayBindings === "function"
      ? payload.initializePlayerOverlayBindings
      : (() => false);
    const closePlayerOverlay = typeof payload.closePlayerOverlay === "function" ? payload.closePlayerOverlay : (() => {});
    const setPlayerNameEditMode = typeof payload.setPlayerNameEditMode === "function" ? payload.setPlayerNameEditMode : (() => {});
    const commitPlayerNameChange = typeof payload.commitPlayerNameChange === "function"
      ? payload.commitPlayerNameChange
      : (() => {});
    const cancelPlayerNameEdit = typeof payload.cancelPlayerNameEdit === "function"
      ? payload.cancelPlayerNameEdit
      : (() => {});
    const getPlayerAvatarPageIndex = typeof payload.getPlayerAvatarPageIndex === "function"
      ? payload.getPlayerAvatarPageIndex
      : (() => 0);
    const setPlayerAvatarPageIndex = typeof payload.setPlayerAvatarPageIndex === "function"
      ? payload.setPlayerAvatarPageIndex
      : (() => {});
    const renderPlayerAvatarOptions = typeof payload.renderPlayerAvatarOptions === "function"
      ? payload.renderPlayerAvatarOptions
      : (() => {});
    const getPlayerDraftAvatarId = typeof payload.getPlayerDraftAvatarId === "function" ? payload.getPlayerDraftAvatarId : (() => "");
    const getBuiltInAvatarsLength = typeof payload.getBuiltInAvatarsLength === "function"
      ? payload.getBuiltInAvatarsLength
      : (() => 0);
    const getAvatarsPerPage = typeof payload.getAvatarsPerPage === "function" ? payload.getAvatarsPerPage : (() => 1);
    const openLeaderboard = typeof payload.openLeaderboard === "function" ? payload.openLeaderboard : (() => {});
    const confirmReset = typeof payload.confirmReset === "function" ? payload.confirmReset : (() => false);
    const resetPlayerStateAndData = typeof payload.resetPlayerStateAndData === "function"
      ? payload.resetPlayerStateAndData
      : (async () => {});
    const refreshPlayerOverlayFields = typeof payload.refreshPlayerOverlayFields === "function"
      ? payload.refreshPlayerOverlayFields
      : (() => {});

    const playerOverlay = getElementById("player-overlay");
    const playerBackdrop = querySelector("#player-overlay .player-backdrop");
    const playerClose = querySelector("#player-overlay .player-close");
    const playerNameEditBtn = getElementById("player-name-edit-btn");
    const playerNameConfirmBtn = getElementById("player-name-confirm-btn");
    const playerNameCancelBtn = getElementById("player-name-cancel-btn");
    const playerNameInput = getElementById("player-name-input");
    const playerNameError = getElementById("player-name-error");
    const playerOpenLeaderboardBtn = getElementById("player-open-leaderboard-btn");
    const playerResetBtn = getElementById("player-reset-btn");
    const avatarPagePrevBtn = getElementById("avatar-page-prev");
    const avatarPageNextBtn = getElementById("avatar-page-next");

    if (!playerOverlay) {
      return false;
    }

    initializePlayerOverlayBindings({
      playerOverlay,
      playerBackdrop,
      playerClose,
      playerNameEditBtn,
      playerNameConfirmBtn,
      playerNameCancelBtn,
      playerNameInput,
      playerOpenLeaderboardBtn,
      playerResetBtn,
      avatarPagePrevBtn,
      avatarPageNextBtn,
      onCloseOverlay: closePlayerOverlay,
      onClearNameError: () => {
        if (playerNameError) {
          playerNameError.textContent = "";
        }
      },
      onStartNameEdit: () => setPlayerNameEditMode(true),
      onConfirmNameEdit: () => commitPlayerNameChange(),
      onCancelNameEdit: () => cancelPlayerNameEdit(),
      onNameInputKeyDown: (event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          commitPlayerNameChange();
          return;
        }
        if (event.key === "Escape") {
          event.preventDefault();
          cancelPlayerNameEdit();
        }
      },
      onAvatarPagePrev: () => {
        const currentPage = getPlayerAvatarPageIndex();
        setPlayerAvatarPageIndex(Math.max(0, currentPage - 1));
        renderPlayerAvatarOptions(getPlayerDraftAvatarId());
      },
      onAvatarPageNext: () => {
        const avatarsPerPage = Math.max(1, getAvatarsPerPage());
        const totalPages = Math.max(1, Math.ceil(getBuiltInAvatarsLength() / avatarsPerPage));
        const currentPage = getPlayerAvatarPageIndex();
        setPlayerAvatarPageIndex(Math.min(totalPages - 1, currentPage + 1));
        renderPlayerAvatarOptions(getPlayerDraftAvatarId());
      },
      onOpenLeaderboard: () => openLeaderboard(),
      onResetPlayer: async () => {
        const confirmed = confirmReset();
        if (!confirmed) {
          return;
        }
        await resetPlayerStateAndData();
        refreshPlayerOverlayFields();
      },
    });

    return true;
  }

  function bootstrapMainInitializers(input) {
    const payload = input && typeof input === "object" ? input : {};
    const documentObj = payload.documentObj || globalScope.document;
    const onPlayerEntryClick = typeof payload.onPlayerEntryClick === "function" ? payload.onPlayerEntryClick : (() => {});
    const onInitializeDailyChallengeOverlayBindings = typeof payload.onInitializeDailyChallengeOverlayBindings === "function"
      ? payload.onInitializeDailyChallengeOverlayBindings
      : (() => {});
    const onInitializeHowToPlayOverlayBindings = typeof payload.onInitializeHowToPlayOverlayBindings === "function"
      ? payload.onInitializeHowToPlayOverlayBindings
      : (() => {});
    const onInitializeLeaderboardOverlayBindings = typeof payload.onInitializeLeaderboardOverlayBindings === "function"
      ? payload.onInitializeLeaderboardOverlayBindings
      : (() => {});
    const onInitializeFallbackOverlayBindings = typeof payload.onInitializeFallbackOverlayBindings === "function"
      ? payload.onInitializeFallbackOverlayBindings
      : (() => {});
    const onInitializeSettingsOverlaySection = typeof payload.onInitializeSettingsOverlaySection === "function"
      ? payload.onInitializeSettingsOverlaySection
      : (() => {});
    const onInitializePlayerOverlaySection = typeof payload.onInitializePlayerOverlaySection === "function"
      ? payload.onInitializePlayerOverlaySection
      : (() => {});

    if (!documentObj) {
      return false;
    }

    documentObj.addEventListener("DOMContentLoaded", () => {
      if (!validateRuntimeDependencies()) {
        return;
      }

      onPlayerEntryClick();
      onInitializeDailyChallengeOverlayBindings();
      onInitializeHowToPlayOverlayBindings();
      onInitializeLeaderboardOverlayBindings();
      onInitializeFallbackOverlayBindings();
      onInitializeSettingsOverlaySection();
      onInitializePlayerOverlaySection();
    });

    return true;
  }

  function runAppStartup(input) {
    const payload = input && typeof input === "object" ? input : {};
    const initializeAppDataBootstrap = typeof payload.initializeAppDataBootstrap === "function"
      ? payload.initializeAppDataBootstrap
      : (async () => {});
    const initializeAppLifecycleBindings = typeof payload.initializeAppLifecycleBindings === "function"
      ? payload.initializeAppLifecycleBindings
      : (() => false);
    const registerServiceWorkerWithUpdatePrompt = typeof payload.registerServiceWorkerWithUpdatePrompt === "function"
      ? payload.registerServiceWorkerWithUpdatePrompt
      : (() => false);
    const onSaveProfile = typeof payload.onSaveProfile === "function" ? payload.onSaveProfile : (() => {});
    const onPageShow = typeof payload.onPageShow === "function" ? payload.onPageShow : (() => {});
    const serviceWorkerPath = payload.serviceWorkerPath || "service-worker.js";
    const promptMessage = payload.promptMessage || "A new version of the game is available. Would you like to update now?";

    (async () => {
      await initializeAppDataBootstrap();
    })();

    initializeAppLifecycleBindings({
      onSaveProfile,
      onPageShow,
    });

    registerServiceWorkerWithUpdatePrompt({
      serviceWorkerPath,
      promptMessage,
    });

    return true;
  }

  globalScope.BibleTriviaMain = Object.assign({}, globalScope.BibleTriviaMain, {
    getMissingRuntimeDependencies,
    validateRuntimeDependencies,
    initializeSettingsOverlaySection,
    initializePlayerOverlaySection,
    bootstrapMainInitializers,
    runAppStartup,
  });
})(window);
