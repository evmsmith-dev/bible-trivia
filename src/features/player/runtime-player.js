(function attachBibleTriviaPlayerFeature(globalScope) {
  function createDefaultPlayerProfile(input) {
    const payload = input && typeof input === "object" ? input : {};
    const playerId = String(payload.playerId || "primary");
    const builtInAvatars = Array.isArray(payload.builtInAvatars) ? payload.builtInAvatars : [];
    const defaultAvatarId = builtInAvatars.length > 0 && builtInAvatars[0] && builtInAvatars[0].id
      ? builtInAvatars[0].id
      : "";

    return {
      id: playerId,
      name: "Player",
      avatarId: defaultAvatarId,
      nonDailyCorrectAnswers: 0,
    };
  }

  function sanitizePlayerName(input) {
    const payload = input && typeof input === "object" ? input : {};
    const nameInput = payload.nameInput;
    const trimmed = String(nameInput || "").trim();
    if (trimmed.length < 2 || trimmed.length > 15) {
      return null;
    }
    return trimmed;
  }

  function sanitizePlayerProfile(input) {
    const payload = input && typeof input === "object" ? input : {};
    const rawProfile = payload.rawProfile && typeof payload.rawProfile === "object" ? payload.rawProfile : {};
    const defaults = payload.defaults && typeof payload.defaults === "object" ? payload.defaults : createDefaultPlayerProfile(payload);
    const playerId = String(payload.playerId || defaults.id || "primary");
    const builtInAvatars = Array.isArray(payload.builtInAvatars) ? payload.builtInAvatars : [];
    const sanitizePlayerName = typeof payload.sanitizePlayerName === "function"
      ? payload.sanitizePlayerName
      : (value => sanitizePlayerName({ nameInput: value }));

    const cleanName = sanitizePlayerName(rawProfile.name) || defaults.name;
    const avatarExists = builtInAvatars.some((avatar) => avatar && avatar.id === rawProfile.avatarId);

    return {
      id: playerId,
      name: cleanName,
      avatarId: avatarExists ? rawProfile.avatarId : defaults.avatarId,
      nonDailyCorrectAnswers: Number.isFinite(rawProfile.nonDailyCorrectAnswers)
        ? Math.max(0, Math.round(rawProfile.nonDailyCorrectAnswers))
        : 0,
    };
  }

  function getPlayerLevelFromCorrectCount(input) {
    const payload = input && typeof input === "object" ? input : {};
    const correctAnswers = payload.correctAnswers;
    const thresholds = Array.isArray(payload.thresholds) ? payload.thresholds : [];
    const safeCount = Number.isFinite(correctAnswers) ? Math.max(0, Math.round(correctAnswers)) : 0;
    let level = 1;
    thresholds.forEach((threshold, index) => {
      if (safeCount >= threshold) {
        level = index + 1;
      }
    });
    return level;
  }

  function getAvatarById(input) {
    const payload = input && typeof input === "object" ? input : {};
    const avatarId = payload.avatarId;
    const builtInAvatars = Array.isArray(payload.builtInAvatars) ? payload.builtInAvatars : [];
    if (builtInAvatars.length === 0) {
      return { id: "", type: "emoji", value: "", label: "Avatar" };
    }

    return builtInAvatars.find((avatar) => avatar && avatar.id === avatarId) || builtInAvatars[0];
  }

  function getAvatarHtml(input) {
    const payload = input && typeof input === "object" ? input : {};
    const avatar = payload.avatar && typeof payload.avatar === "object"
      ? payload.avatar
      : { type: "emoji", value: "", label: "Avatar" };
    const withAlt = payload.withAlt !== false;
    const escapeHtml = typeof payload.escapeHtml === "function" ? payload.escapeHtml : (value => String(value || ""));

    if (avatar.type === "image") {
      const safeAlt = withAlt ? ` alt="${escapeHtml(avatar.label)} avatar"` : ' alt="" aria-hidden="true"';
      return `<img src="${escapeHtml(avatar.value)}"${safeAlt}>`;
    }

    return `<span>${escapeHtml(avatar.value)}</span>`;
  }

  function setPlayerAvatarPreview(input) {
    const payload = input && typeof input === "object" ? input : {};
    const avatarId = payload.avatarId;
    const getElementById = typeof payload.getElementById === "function" ? payload.getElementById : (() => null);
    const resolveAvatarById = typeof payload.getAvatarById === "function"
      ? payload.getAvatarById
      : (id => getAvatarById({ avatarId: id, builtInAvatars: payload.builtInAvatars }));
    const renderAvatarHtml = typeof payload.getAvatarHtml === "function"
      ? payload.getAvatarHtml
      : (avatar => getAvatarHtml({ avatar, withAlt: false, escapeHtml: payload.escapeHtml }));

    const previewEl = getElementById("player-avatar-preview");
    if (!previewEl) {
      return;
    }

    const avatar = resolveAvatarById(avatarId);
    previewEl.innerHTML = renderAvatarHtml(avatar, { withAlt: false });
  }

  function renderPlayerAvatarOptions(input) {
    const payload = input && typeof input === "object" ? input : {};
    const selectedAvatarId = payload.selectedAvatarId;
    const getElementById = typeof payload.getElementById === "function" ? payload.getElementById : (() => null);
    const builtInAvatars = Array.isArray(payload.builtInAvatars) ? payload.builtInAvatars : [];
    const avatarsPerPage = Number.isFinite(payload.avatarsPerPage) ? Math.max(1, Math.round(payload.avatarsPerPage)) : 6;
    const getPlayerAvatarPageIndex = typeof payload.getPlayerAvatarPageIndex === "function"
      ? payload.getPlayerAvatarPageIndex
      : (() => 0);
    const setPlayerAvatarPageIndex = typeof payload.setPlayerAvatarPageIndex === "function"
      ? payload.setPlayerAvatarPageIndex
      : (() => {});
    const escapeHtml = typeof payload.escapeHtml === "function" ? payload.escapeHtml : (value => String(value || ""));
    const onAvatarSelected = typeof payload.onAvatarSelected === "function" ? payload.onAvatarSelected : (async () => {});

    const optionsHost = getElementById("player-avatar-options");
    const prevBtn = getElementById("avatar-page-prev");
    const nextBtn = getElementById("avatar-page-next");
    const pageIndicator = getElementById("avatar-page-indicator");
    if (!optionsHost) {
      return false;
    }

    const totalPages = Math.max(1, Math.ceil(builtInAvatars.length / avatarsPerPage));
    let pageIndex = getPlayerAvatarPageIndex();
    if (!Number.isFinite(pageIndex)) {
      pageIndex = 0;
    }
    pageIndex = Math.min(totalPages - 1, Math.max(0, Math.round(pageIndex)));
    setPlayerAvatarPageIndex(pageIndex);

    const start = pageIndex * avatarsPerPage;
    const end = start + avatarsPerPage;
    const avatarsOnPage = builtInAvatars.slice(start, end);

    optionsHost.innerHTML = avatarsOnPage.map((avatar) => {
      const selected = avatar.id === selectedAvatarId;
      const icon = avatar.type === "image"
        ? `<img src="${escapeHtml(avatar.value)}" alt="${escapeHtml(avatar.label)} avatar">`
        : `<span>${escapeHtml(avatar.value)}</span>`;
      return `
      <button type="button"
              class="avatar-option${selected ? " is-selected" : ""}"
              data-avatar-id="${escapeHtml(avatar.id)}"
              role="radio"
              aria-checked="${selected ? "true" : "false"}"
              aria-label="Select ${escapeHtml(avatar.label)} avatar">
        <span class="avatar-option-icon" aria-hidden="true">${icon}</span>
        <span class="avatar-option-label">${escapeHtml(avatar.label)}</span>
      </button>
    `;
    }).join("");

    optionsHost.querySelectorAll(".avatar-option").forEach((button) => {
      button.addEventListener("click", async () => {
        const avatarId = button.dataset.avatarId || (builtInAvatars[0] && builtInAvatars[0].id) || "";
        await onAvatarSelected(avatarId);
      });
    });

    if (pageIndicator) {
      pageIndicator.textContent = `${pageIndex + 1} / ${totalPages}`;
    }
    if (prevBtn) {
      prevBtn.disabled = pageIndex <= 0;
    }
    if (nextBtn) {
      nextBtn.disabled = pageIndex >= totalPages - 1;
    }

    return true;
  }

  function renderWelcomePlayerEntry(input) {
    const payload = input && typeof input === "object" ? input : {};
    const ensurePlayerProfileLoaded = typeof payload.ensurePlayerProfileLoaded === "function"
      ? payload.ensurePlayerProfileLoaded
      : (() => {});
    const getElementById = typeof payload.getElementById === "function" ? payload.getElementById : (() => null);
    const playerProfile = payload.playerProfile && typeof payload.playerProfile === "object"
      ? payload.playerProfile
      : { name: "Player", avatarId: "" };
    const getAvatarById = typeof payload.getAvatarById === "function"
      ? payload.getAvatarById
      : (avatarId => getAvatarById({ avatarId, builtInAvatars: payload.builtInAvatars }));
    const getAvatarHtml = typeof payload.getAvatarHtml === "function"
      ? payload.getAvatarHtml
      : (avatar => getAvatarHtml({ avatar, withAlt: false, escapeHtml: payload.escapeHtml }));
    const getPlayerCurrentLevel = typeof payload.getPlayerCurrentLevel === "function"
      ? payload.getPlayerCurrentLevel
      : (() => 1);

    ensurePlayerProfileLoaded();

    const avatarHost = getElementById("player-entry-avatar");
    const nameEl = getElementById("player-entry-name");
    const levelEl = getElementById("player-entry-level");
    if (!avatarHost || !nameEl || !levelEl) {
      return;
    }

    const avatar = getAvatarById(playerProfile.avatarId);
    avatarHost.innerHTML = getAvatarHtml(avatar, { withAlt: false });
    nameEl.textContent = playerProfile.name;
    levelEl.textContent = `Level ${getPlayerCurrentLevel()}`;
  }

  function refreshSummaryPlayerDisplay(input) {
    const payload = input && typeof input === "object" ? input : {};
    const ensurePlayerProfileLoaded = typeof payload.ensurePlayerProfileLoaded === "function"
      ? payload.ensurePlayerProfileLoaded
      : (() => {});
    const getElementById = typeof payload.getElementById === "function" ? payload.getElementById : (() => null);
    const playerProfile = payload.playerProfile && typeof payload.playerProfile === "object"
      ? payload.playerProfile
      : { name: "Player", avatarId: "" };
    const getAvatarById = typeof payload.getAvatarById === "function"
      ? payload.getAvatarById
      : (avatarId => getAvatarById({ avatarId, builtInAvatars: payload.builtInAvatars }));
    const escapeHtml = typeof payload.escapeHtml === "function" ? payload.escapeHtml : (value => String(value || ""));
    const getPlayerCurrentLevel = typeof payload.getPlayerCurrentLevel === "function"
      ? payload.getPlayerCurrentLevel
      : (() => 1);

    ensurePlayerProfileLoaded();

    const summaryAvatarBtn = getElementById("summary-player-btn");
    const summaryNameEl = getElementById("summary-player-name");
    const summaryLevelEl = getElementById("summary-player-level");
    if (!summaryAvatarBtn || !summaryNameEl || !summaryLevelEl) {
      return;
    }

    const avatar = getAvatarById(playerProfile.avatarId);
    summaryAvatarBtn.innerHTML = avatar.type === "image"
      ? `<img src="${escapeHtml(avatar.value)}" alt="${escapeHtml(playerProfile.name)} avatar"/>`
      : `${escapeHtml(avatar.value)}`;
    summaryNameEl.textContent = playerProfile.name;
    summaryLevelEl.textContent = `Level ${getPlayerCurrentLevel()}`;
  }

  function refreshPlayerOverlayFields(input) {
    const payload = input && typeof input === "object" ? input : {};
    const ensurePlayerProfileLoaded = typeof payload.ensurePlayerProfileLoaded === "function"
      ? payload.ensurePlayerProfileLoaded
      : (() => {});
    const getElementById = typeof payload.getElementById === "function" ? payload.getElementById : (() => null);
    const playerProfile = payload.playerProfile && typeof payload.playerProfile === "object"
      ? payload.playerProfile
      : { name: "Player", avatarId: "" };
    const builtInAvatars = Array.isArray(payload.builtInAvatars) ? payload.builtInAvatars : [];
    const avatarsPerPage = Number.isFinite(payload.avatarsPerPage) ? Math.max(1, Math.round(payload.avatarsPerPage)) : 6;
    const getPlayerLevelProgress = typeof payload.getPlayerLevelProgress === "function"
      ? payload.getPlayerLevelProgress
      : (() => ({ currentLevel: 1, progressPercent: 0, remainingToNextLevel: 0, isMaxLevel: false }));
    const setPlayerAvatarPreview = typeof payload.setPlayerAvatarPreview === "function"
      ? payload.setPlayerAvatarPreview
      : (() => {});
    const renderPlayerAvatarOptions = typeof payload.renderPlayerAvatarOptions === "function"
      ? payload.renderPlayerAvatarOptions
      : (() => {});
    const setPlayerNameEditMode = typeof payload.setPlayerNameEditMode === "function"
      ? payload.setPlayerNameEditMode
      : (() => {});

    ensurePlayerProfileLoaded();

    const nameInput = getElementById("player-name-input");
    const nameDisplayEl = getElementById("player-name-display");
    const levelEl = getElementById("player-level-display");
    const levelProgressFillEl = getElementById("player-level-progress-fill");
    const levelProgressTextEl = getElementById("player-level-progress-text");
    const errorEl = getElementById("player-name-error");

    const selectedAvatarIndex = builtInAvatars.findIndex((avatar) => avatar && avatar.id === playerProfile.avatarId);
    const draftAvatarId = playerProfile.avatarId;
    const avatarPageIndex = selectedAvatarIndex >= 0 ? Math.floor(selectedAvatarIndex / avatarsPerPage) : 0;

    if (nameInput) {
      nameInput.value = playerProfile.name;
    }
    if (nameDisplayEl) {
      nameDisplayEl.textContent = playerProfile.name;
    }

    const progress = getPlayerLevelProgress();
    if (levelEl) {
      levelEl.textContent = `Level ${progress.currentLevel}`;
    }
    if (levelProgressFillEl) {
      levelProgressFillEl.style.width = `${progress.progressPercent}%`;
    }
    if (levelProgressTextEl) {
      levelProgressTextEl.textContent = progress.isMaxLevel
        ? "Max level reached"
        : `${progress.remainingToNextLevel} more correct answers to next level`;
    }
    if (errorEl) {
      errorEl.textContent = "";
    }

    setPlayerAvatarPreview(draftAvatarId);
    renderPlayerAvatarOptions(draftAvatarId);
    setPlayerNameEditMode(false);

    return {
      playerDraftAvatarId: draftAvatarId,
      playerAvatarPageIndex: avatarPageIndex,
    };
  }

  function openPlayerOverlay(input) {
    const payload = input && typeof input === "object" ? input : {};
    const ensurePlayerProfileLoaded = typeof payload.ensurePlayerProfileLoaded === "function"
      ? payload.ensurePlayerProfileLoaded
      : (() => {});
    const getElementById = typeof payload.getElementById === "function" ? payload.getElementById : (() => null);
    const refreshPlayerOverlayFields = typeof payload.refreshPlayerOverlayFields === "function"
      ? payload.refreshPlayerOverlayFields
      : (() => null);

    ensurePlayerProfileLoaded();
    const overlay = getElementById("player-overlay");
    if (!overlay) {
      return null;
    }

    const state = refreshPlayerOverlayFields();
    overlay.style.display = "flex";
    return state;
  }

  function closePlayerOverlay(input) {
    const payload = input && typeof input === "object" ? input : {};
    const getElementById = typeof payload.getElementById === "function" ? payload.getElementById : (() => null);
    const overlay = getElementById("player-overlay");
    if (!overlay) {
      return;
    }
    overlay.style.display = "none";
  }

  globalScope.BibleTriviaPlayer = Object.assign({}, globalScope.BibleTriviaPlayer, {
    createDefaultPlayerProfile,
    sanitizePlayerName,
    sanitizePlayerProfile,
    getPlayerLevelFromCorrectCount,
    getAvatarById,
    getAvatarHtml,
    setPlayerAvatarPreview,
    renderPlayerAvatarOptions,
    renderWelcomePlayerEntry,
    refreshSummaryPlayerDisplay,
    refreshPlayerOverlayFields,
    openPlayerOverlay,
    closePlayerOverlay,
  });
})(window);