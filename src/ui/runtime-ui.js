(function attachBibleTriviaUIRuntime(globalScope) {
  function showOverlay(input) {
    const payload = input && typeof input === "object" ? input : {};
    const overlayId = payload.overlayId;
    const getElementById = typeof payload.getElementById === "function" ? payload.getElementById : (() => null);
    const overlay = getElementById(overlayId);
    if (!overlay) {
      return;
    }
    overlay.style.display = "flex";
  }

  function hideOverlay(input) {
    const payload = input && typeof input === "object" ? input : {};
    const overlayId = payload.overlayId;
    const getElementById = typeof payload.getElementById === "function" ? payload.getElementById : (() => null);
    const overlay = getElementById(overlayId);
    if (!overlay) {
      return;
    }
    overlay.style.display = "none";
  }

  function initializeHowToPlayOverlayBindings(input) {
    const payload = input && typeof input === "object" ? input : {};
    const getElementById = typeof payload.getElementById === "function" ? payload.getElementById : (() => null);
    const querySelector = typeof payload.querySelector === "function" ? payload.querySelector : (() => null);
    const querySelectorAll = typeof payload.querySelectorAll === "function" ? payload.querySelectorAll : (() => []);
    const show = typeof payload.showOverlay === "function"
      ? payload.showOverlay
      : (overlayId => showOverlay({ overlayId, getElementById }));
    const hide = typeof payload.hideOverlay === "function"
      ? payload.hideOverlay
      : (overlayId => hideOverlay({ overlayId, getElementById }));

    const howToPlayLink = getElementById("how-to-play-link");
    const howToPlayClose = querySelector("#how-to-play-overlay .overlay-close");
    const howToPlayBackdrop = querySelector("#how-to-play-overlay .overlay-backdrop");
    const howToPlaySections = querySelectorAll("#how-to-play-overlay .howto-section");

    if (!howToPlayLink) {
      return false;
    }

    const collapseHowToSections = () => {
      howToPlaySections.forEach((section) => section.removeAttribute("open"));
    };

    howToPlayLink.addEventListener("click", () => {
      collapseHowToSections();
      show("how-to-play-overlay");
    });

    howToPlayClose && howToPlayClose.addEventListener("click", () => {
      hide("how-to-play-overlay");
    });

    howToPlayBackdrop && howToPlayBackdrop.addEventListener("click", () => {
      hide("how-to-play-overlay");
    });

    return true;
  }

  function initializeFallbackOverlayBindings(input) {
    const payload = input && typeof input === "object" ? input : {};
    const getElementById = typeof payload.getElementById === "function" ? payload.getElementById : (() => null);
    const querySelector = typeof payload.querySelector === "function" ? payload.querySelector : (() => null);
    const show = typeof payload.showOverlay === "function"
      ? payload.showOverlay
      : (overlayId => showOverlay({ overlayId, getElementById }));
    const hide = typeof payload.hideOverlay === "function"
      ? payload.hideOverlay
      : (overlayId => hideOverlay({ overlayId, getElementById }));

    const settingsLink = getElementById("settings-link");
    const settingsClose = querySelector("#settings-overlay .settings-close");
    const settingsBackdrop = querySelector("#settings-overlay .settings-backdrop");

    settingsLink && settingsLink.addEventListener("click", () => {
      show("settings-overlay");
    });

    settingsClose && settingsClose.addEventListener("click", () => {
      hide("settings-overlay");
    });

    settingsBackdrop && settingsBackdrop.addEventListener("click", () => {
      hide("settings-overlay");
    });

    return true;
  }

  function initializeSettingsOverlayBindings(input) {
    const payload = input && typeof input === "object" ? input : {};
    const getElementById = typeof payload.getElementById === "function" ? payload.getElementById : (() => null);
    const querySelector = typeof payload.querySelector === "function" ? payload.querySelector : (() => null);
    const show = typeof payload.showOverlay === "function"
      ? payload.showOverlay
      : (overlayId => showOverlay({ overlayId, getElementById }));
    const hide = typeof payload.hideOverlay === "function"
      ? payload.hideOverlay
      : (overlayId => hideOverlay({ overlayId, getElementById }));
    const onOpen = typeof payload.onOpen === "function" ? payload.onOpen : (() => {});

    const settingsLink = getElementById("settings-link");
    const playerOpenSettingsBtn = getElementById("player-open-settings-btn");
    const settingsClose = querySelector(".settings-close");
    const settingsBackdrop = querySelector("#settings-overlay .settings-backdrop");

    const openSettingsOverlay = () => {
      show("settings-overlay");
      onOpen();
    };

    settingsLink && settingsLink.addEventListener("click", openSettingsOverlay);
    playerOpenSettingsBtn && playerOpenSettingsBtn.addEventListener("click", openSettingsOverlay);

    settingsClose && settingsClose.addEventListener("click", () => {
      hide("settings-overlay");
    });

    settingsBackdrop && settingsBackdrop.addEventListener("click", () => {
      hide("settings-overlay");
    });

    return true;
  }

  function updateSettingsModeDescription(input) {
    const payload = input && typeof input === "object" ? input : {};
    const mode = payload.mode;
    const modeDescriptionEl = payload.modeDescriptionEl || null;
    const modeDescriptions = payload.modeDescriptions && typeof payload.modeDescriptions === "object"
      ? payload.modeDescriptions
      : {};

    if (!modeDescriptionEl || !Object.prototype.hasOwnProperty.call(modeDescriptions, mode)) {
      return;
    }

    modeDescriptionEl.innerHTML = modeDescriptions[mode];
  }

  function syncDifficultyButtonsUI(input) {
    const payload = input && typeof input === "object" ? input : {};
    const difficultyButtons = payload.difficultyButtons && typeof payload.difficultyButtons.forEach === "function"
      ? payload.difficultyButtons
      : [];
    const difficultyMode = payload.difficultyMode;
    const updateModeDescription = typeof payload.updateModeDescription === "function"
      ? payload.updateModeDescription
      : (() => {});

    difficultyButtons.forEach((button) => {
      button.classList.remove("active");
      if (button.dataset.mode === difficultyMode) {
        button.classList.add("active");
      }
    });

    updateModeDescription(difficultyMode);
  }

  function syncReviewPreferenceButtonsUI(input) {
    const payload = input && typeof input === "object" ? input : {};
    const reviewPrefButtons = payload.reviewPrefButtons && typeof payload.reviewPrefButtons.forEach === "function"
      ? payload.reviewPrefButtons
      : [];
    const roundReviewPreference = payload.roundReviewPreference;
    const reviewPrefDescriptionEl = payload.reviewPrefDescriptionEl || null;
    const reviewPreferenceDescriptions = payload.reviewPreferenceDescriptions && typeof payload.reviewPreferenceDescriptions === "object"
      ? payload.reviewPreferenceDescriptions
      : { ask: "Ask each round whether to review or skip (recommended)." };

    reviewPrefButtons.forEach((button) => {
      const isActive = button.dataset.value === roundReviewPreference;
      button.classList.toggle("active", isActive);
      button.setAttribute("aria-pressed", isActive ? "true" : "false");
    });

    if (reviewPrefDescriptionEl) {
      reviewPrefDescriptionEl.textContent = reviewPreferenceDescriptions[roundReviewPreference] || reviewPreferenceDescriptions.ask;
    }
  }

  function initializeSettingsPreferenceBindings(input) {
    const payload = input && typeof input === "object" ? input : {};
    const difficultyButtons = payload.difficultyButtons && typeof payload.difficultyButtons.forEach === "function"
      ? payload.difficultyButtons
      : [];
    const reviewPrefButtons = payload.reviewPrefButtons && typeof payload.reviewPrefButtons.forEach === "function"
      ? payload.reviewPrefButtons
      : [];
    const onDifficultySelect = typeof payload.onDifficultySelect === "function" ? payload.onDifficultySelect : (async () => {});
    const onReviewPreferenceSelect = typeof payload.onReviewPreferenceSelect === "function"
      ? payload.onReviewPreferenceSelect
      : (async () => {});

    difficultyButtons.forEach((button) => {
      button.addEventListener("click", async (event) => {
        const selectedMode = event.currentTarget && event.currentTarget.dataset
          ? event.currentTarget.dataset.mode
          : undefined;
        await onDifficultySelect({ event, selectedMode });
      });
    });

    reviewPrefButtons.forEach((button) => {
      button.addEventListener("click", async (event) => {
        const selectedPreference = event.currentTarget && event.currentTarget.dataset
          ? event.currentTarget.dataset.value
          : undefined;
        await onReviewPreferenceSelect({ event, selectedPreference });
      });
    });

    return true;
  }

  function initializePlayerOverlayBindings(input) {
    const payload = input && typeof input === "object" ? input : {};
    const playerOverlay = payload.playerOverlay || null;
    if (!playerOverlay) {
      return false;
    }

    const playerBackdrop = payload.playerBackdrop || null;
    const playerClose = payload.playerClose || null;
    const playerNameEditBtn = payload.playerNameEditBtn || null;
    const playerNameConfirmBtn = payload.playerNameConfirmBtn || null;
    const playerNameCancelBtn = payload.playerNameCancelBtn || null;
    const playerNameInput = payload.playerNameInput || null;
    const playerOpenLeaderboardBtn = payload.playerOpenLeaderboardBtn || null;
    const playerResetBtn = payload.playerResetBtn || null;
    const avatarPagePrevBtn = payload.avatarPagePrevBtn || null;
    const avatarPageNextBtn = payload.avatarPageNextBtn || null;

    const onCloseOverlay = typeof payload.onCloseOverlay === "function" ? payload.onCloseOverlay : (() => {});
    const onClearNameError = typeof payload.onClearNameError === "function" ? payload.onClearNameError : (() => {});
    const onStartNameEdit = typeof payload.onStartNameEdit === "function" ? payload.onStartNameEdit : (() => {});
    const onConfirmNameEdit = typeof payload.onConfirmNameEdit === "function" ? payload.onConfirmNameEdit : (async () => {});
    const onCancelNameEdit = typeof payload.onCancelNameEdit === "function" ? payload.onCancelNameEdit : (() => {});
    const onNameInputKeyDown = typeof payload.onNameInputKeyDown === "function" ? payload.onNameInputKeyDown : (() => {});
    const onAvatarPagePrev = typeof payload.onAvatarPagePrev === "function" ? payload.onAvatarPagePrev : (() => {});
    const onAvatarPageNext = typeof payload.onAvatarPageNext === "function" ? payload.onAvatarPageNext : (() => {});
    const onOpenLeaderboard = typeof payload.onOpenLeaderboard === "function" ? payload.onOpenLeaderboard : (() => {});
    const onResetPlayer = typeof payload.onResetPlayer === "function" ? payload.onResetPlayer : (async () => {});

    playerBackdrop && playerBackdrop.addEventListener("click", onCloseOverlay);
    playerClose && playerClose.addEventListener("click", onCloseOverlay);

    playerNameInput && playerNameInput.addEventListener("input", () => {
      onClearNameError();
    });

    playerNameEditBtn && playerNameEditBtn.addEventListener("click", () => {
      onStartNameEdit();
    });

    playerNameConfirmBtn && playerNameConfirmBtn.addEventListener("click", async () => {
      await onConfirmNameEdit();
    });

    playerNameCancelBtn && playerNameCancelBtn.addEventListener("click", () => {
      onCancelNameEdit();
    });

    playerNameInput && playerNameInput.addEventListener("keydown", (event) => {
      onNameInputKeyDown(event);
    });

    avatarPagePrevBtn && avatarPagePrevBtn.addEventListener("click", () => {
      onAvatarPagePrev();
    });

    avatarPageNextBtn && avatarPageNextBtn.addEventListener("click", () => {
      onAvatarPageNext();
    });

    playerOpenLeaderboardBtn && playerOpenLeaderboardBtn.addEventListener("click", () => {
      onOpenLeaderboard();
    });

    playerResetBtn && playerResetBtn.addEventListener("click", async () => {
      await onResetPlayer();
    });

    return true;
  }

  function initializeAppLifecycleBindings(input) {
    const payload = input && typeof input === "object" ? input : {};
    const windowObj = payload.windowObj || globalScope;
    const documentObj = payload.documentObj || (windowObj ? windowObj.document : null);
    const onSaveProfile = typeof payload.onSaveProfile === "function" ? payload.onSaveProfile : (() => {});
    const onPageShow = typeof payload.onPageShow === "function" ? payload.onPageShow : (() => {});

    if (!windowObj || !documentObj) {
      return false;
    }

    windowObj.addEventListener("pagehide", () => {
      onSaveProfile();
    });

    documentObj.addEventListener("visibilitychange", () => {
      if (documentObj.visibilityState === "hidden") {
        onSaveProfile();
      }
    });

    windowObj.addEventListener("pageshow", () => {
      onPageShow();
    });

    return true;
  }

  function attachServiceWorkerUpdatePromptHandlers(input) {
    const payload = input && typeof input === "object" ? input : {};
    const registration = payload.registration || null;
    const navigatorObj = payload.navigatorObj || (globalScope ? globalScope.navigator : null);
    const confirmUpdate = typeof payload.confirmUpdate === "function"
      ? payload.confirmUpdate
      : (() => false);
    const reloadPage = typeof payload.reloadPage === "function"
      ? payload.reloadPage
      : (() => {});

    if (!registration || !navigatorObj || !navigatorObj.serviceWorker) {
      return false;
    }

    registration.addEventListener("updatefound", () => {
      const newWorker = registration.installing;
      if (!newWorker) {
        return;
      }

      newWorker.addEventListener("statechange", () => {
        if (newWorker.state === "installed" && navigatorObj.serviceWorker.controller) {
          if (confirmUpdate()) {
            reloadPage();
          }
        }
      });
    });

    return true;
  }

  function registerServiceWorkerWithUpdatePrompt(input) {
    const payload = input && typeof input === "object" ? input : {};
    const navigatorObj = payload.navigatorObj || (globalScope ? globalScope.navigator : null);
    const serviceWorkerPath = payload.serviceWorkerPath || "service-worker.js";
    const confirmUpdate = typeof payload.confirmUpdate === "function"
      ? payload.confirmUpdate
      : (() => false);
    const reloadPage = typeof payload.reloadPage === "function"
      ? payload.reloadPage
      : (() => {});

    if (!navigatorObj || !navigatorObj.serviceWorker) {
      return false;
    }

    const protocol = globalScope && globalScope.location ? globalScope.location.protocol : "";
    if (protocol !== "http:" && protocol !== "https:") {
      return false;
    }

    navigatorObj.serviceWorker
      .register(serviceWorkerPath)
      .then((registration) => {
        attachServiceWorkerUpdatePromptHandlers({
          registration,
          navigatorObj,
          confirmUpdate,
          reloadPage,
        });
      })
      .catch(() => {
        // Ignore registration failures in unsupported or restricted environments.
      });

    return true;
  }

  async function initializeAppDataBootstrap(input) {
    const payload = input && typeof input === "object" ? input : {};
    const initDb = typeof payload.initDb === "function" ? payload.initDb : (async () => {});
    const loadData = typeof payload.loadData === "function" ? payload.loadData : (async () => {});
    const renderWelcomeDailyCard = typeof payload.renderWelcomeDailyCard === "function"
      ? payload.renderWelcomeDailyCard
      : (() => {});
    const log = typeof payload.log === "function" ? payload.log : (() => {});

    try {
      await initDb();
      await loadData();
      renderWelcomeDailyCard();
      log("Application initialized successfully");
    } catch (error) {
      const message = error && error.message ? error.message : String(error);
      log("Initialization error, using localStorage fallback", message);
      await loadData();
      renderWelcomeDailyCard();
    }
  }

  globalScope.BibleTriviaUI = Object.assign({}, globalScope.BibleTriviaUI, {
    showOverlay,
    hideOverlay,
    initializeHowToPlayOverlayBindings,
    initializeFallbackOverlayBindings,
    initializeSettingsOverlayBindings,
    updateSettingsModeDescription,
    syncDifficultyButtonsUI,
    syncReviewPreferenceButtonsUI,
    initializeSettingsPreferenceBindings,
    initializePlayerOverlayBindings,
    initializeAppLifecycleBindings,
    attachServiceWorkerUpdatePromptHandlers,
    registerServiceWorkerWithUpdatePrompt,
    initializeAppDataBootstrap,
  });
})(window);
