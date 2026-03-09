(function attachBibleTriviaEngine(globalScope) {
  function getTimeLimitForMode(modeTiming, activeMode, fallbackSeconds) {
    const timing = modeTiming && typeof modeTiming === "object" ? modeTiming : {};
    const fallback = Number.isFinite(fallbackSeconds) ? Math.max(1, Math.round(fallbackSeconds)) : 25;
    const value = timing[activeMode];
    return Number.isFinite(value) ? Math.max(1, Math.round(value)) : fallback;
  }

  function calculatePointBreakdown(input) {
    const payload = input && typeof input === "object" ? input : {};
    const basePoints = Number.isFinite(payload.basePoints) ? Math.max(0, payload.basePoints) : 0;
    const dailyBonusPoints = Number.isFinite(payload.dailyBonusPoints) ? Math.max(0, payload.dailyBonusPoints) : 0;
    const timeLeftAtAnswer = Number.isFinite(payload.timeLeftAtAnswer) ? Math.max(0, payload.timeLeftAtAnswer) : 0;
    const timeLimit = Number.isFinite(payload.timeLimit) ? Math.max(1, payload.timeLimit) : 25;
    const streakBonus = Number.isFinite(payload.streakBonus) ? Math.max(0, payload.streakBonus) : 0;

    const maxBonus = basePoints;
    const speedBonus = Math.max(0, maxBonus * ((timeLeftAtAnswer + 0.75) / timeLimit));
    const roundedSpeedBonus = Math.round(speedBonus);
    const roundedStreakBonus = Math.round(streakBonus);

    return {
      base: Math.round(basePoints),
      dailyBaseBonus: Math.round(dailyBonusPoints),
      speedBonus: roundedSpeedBonus,
      streakBonus: roundedStreakBonus,
      total: Math.round(basePoints + dailyBonusPoints + roundedSpeedBonus + roundedStreakBonus),
    };
  }

  function selectBalancedQuestionsForMode(input) {
    const payload = input && typeof input === "object" ? input : {};
    const modeKey = payload.modeKey;
    const randomFn = typeof payload.randomFn === "function" ? payload.randomFn : Math.random;
    const questionCount = Number.isFinite(payload.questionCount) ? Math.max(1, Math.round(payload.questionCount)) : 10;
    const allQuestions = Array.isArray(payload.allQuestions) ? payload.allQuestions : [];
    const modeMap = payload.modeMap && typeof payload.modeMap === "object" ? payload.modeMap : {};
    const categories = Array.isArray(payload.categories) && payload.categories.length
      ? payload.categories
      : ["Old Testament", "New Testament", "General"];
    const normalizeDifficultyMode = typeof payload.normalizeDifficultyMode === "function"
      ? payload.normalizeDifficultyMode
      : (value => String(value || "medium"));

    const normalizedMode = normalizeDifficultyMode(modeKey);
    const modeConfig = modeMap[normalizedMode] || modeMap.medium;
    if (!modeConfig || !Array.isArray(modeConfig.difficulties)) {
      return [];
    }

    const difficulties = modeConfig.difficulties;
    const catRemaining = {
      "Old Testament": 4,
      "New Testament": 4,
      General: 2,
    };

    const diffRemaining = Object.assign({}, modeConfig.difficultyTargets || {});
    const matrix = modeConfig.matrix || {};
    const available = allQuestions.filter((question) => difficulties.includes(question.difficulty));

    const pools = {};
    difficulties.forEach((difficulty) => {
      categories.forEach((category) => {
        pools[`${difficulty}|${category}`] = [];
      });
    });

    available.forEach((question) => {
      const key = `${question.difficulty}|${question.category}`;
      if (pools[key]) pools[key].push(question);
    });

    Object.keys(pools).forEach((key) => {
      const list = pools[key];
      for (let i = list.length - 1; i > 0; i--) {
        const j = Math.floor(randomFn() * (i + 1));
        [list[i], list[j]] = [list[j], list[i]];
      }
    });

    const selectedIds = new Set();
    const shortages = [];

    difficulties.forEach((difficulty) => {
      categories.forEach((category) => {
        const needed = matrix[difficulty]?.[category] ?? 0;
        if (needed === 0) return;

        const pool = pools[`${difficulty}|${category}`] || [];
        const take = Math.min(needed, pool.length);

        for (let i = 0; i < take; i++) {
          const question = pool[i];
          selectedIds.add(question.id);
          catRemaining[category] = (catRemaining[category] || 0) - 1;
          diffRemaining[difficulty] = (diffRemaining[difficulty] || 0) - 1;
        }

        if (take < needed) {
          shortages.push({ missing: needed - take, difficulty, category });
        }
      });
    });

    let remaining = available.filter((question) => !selectedIds.has(question.id));
    for (let i = remaining.length - 1; i > 0; i--) {
      const j = Math.floor(randomFn() * (i + 1));
      [remaining[i], remaining[j]] = [remaining[j], remaining[i]];
    }

    shortages.forEach((shortage) => {
      let needed = shortage.missing;
      while (needed > 0) {
        const candidates = remaining.filter((question) =>
          (catRemaining[question.category] || 0) > 0 && (diffRemaining[question.difficulty] || 0) > 0
        );

        if (candidates.length === 0) break;

        candidates.sort((a, b) => {
          const categoryDelta = (catRemaining[b.category] || 0) - (catRemaining[a.category] || 0);
          if (categoryDelta !== 0) return categoryDelta;
          return (diffRemaining[b.difficulty] || 0) - (diffRemaining[a.difficulty] || 0);
        });

        const chosen = candidates[0];
        selectedIds.add(chosen.id);
        catRemaining[chosen.category] = (catRemaining[chosen.category] || 0) - 1;
        diffRemaining[chosen.difficulty] = (diffRemaining[chosen.difficulty] || 0) - 1;
        needed -= 1;
        remaining = remaining.filter((question) => question.id !== chosen.id);
      }
    });

    let finalSelection = available.filter((question) => selectedIds.has(question.id));
    for (let i = finalSelection.length - 1; i > 0; i--) {
      const j = Math.floor(randomFn() * (i + 1));
      [finalSelection[i], finalSelection[j]] = [finalSelection[j], finalSelection[i]];
    }

    if (finalSelection.length < questionCount) {
      const remainingPool = available.filter((question) => !selectedIds.has(question.id));
      for (let i = remainingPool.length - 1; i > 0; i--) {
        const j = Math.floor(randomFn() * (i + 1));
        [remainingPool[i], remainingPool[j]] = [remainingPool[j], remainingPool[i]];
      }

      remainingPool.forEach((question) => {
        if (finalSelection.length >= questionCount) return;
        if (selectedIds.has(question.id)) return;
        selectedIds.add(question.id);
        finalSelection.push(question);
      });
    }

    return finalSelection.slice(0, questionCount);
  }

  function startCountdownThenGame(input) {
    const payload = input && typeof input === "object" ? input : {};
    const overlayEl = payload.overlayEl || null;
    const numberEl = payload.numberEl || null;
    const mode = payload.mode;
    const normalMode = payload.normalMode;
    const dailyMode = payload.dailyMode;
    const preserveBonusStreak = payload.preserveBonusStreak === true;
    const startDailyChallenge = typeof payload.startDailyChallenge === "function"
      ? payload.startDailyChallenge
      : (async () => {});
    const startNewGame = typeof payload.startNewGame === "function" ? payload.startNewGame : (() => {});
    const logError = typeof payload.logError === "function" ? payload.logError : (() => {});
    const alertFn = typeof payload.alertFn === "function" ? payload.alertFn : (() => {});
    const setQuestionContainerDisplay = typeof payload.setQuestionContainerDisplay === "function"
      ? payload.setQuestionContainerDisplay
      : (() => {});
    const setWelcomeDisplay = typeof payload.setWelcomeDisplay === "function" ? payload.setWelcomeDisplay : (() => {});
    const renderWelcomeDailyCard = typeof payload.renderWelcomeDailyCard === "function"
      ? payload.renderWelcomeDailyCard
      : (() => {});

    let count = 3;
    if (numberEl) {
      numberEl.textContent = count;
    }
    if (overlayEl) {
      overlayEl.style.display = "flex";
    }

    const interval = setInterval(() => {
      count -= 1;

      if (count <= 0) {
        clearInterval(interval);
        if (overlayEl) {
          overlayEl.style.display = "none";
        }

        if (mode === dailyMode) {
          startDailyChallenge({ preserveBonusStreak }).catch((error) => {
            const message = error && error.message ? error.message : String(error);
            logError("Failed to start daily challenge", message);
            const alertMessage = /already been completed/i.test(message)
              ? "Today's Daily Challenge is already completed. Come back tomorrow."
              : "Could not load today's challenge. Please try again.";
            alertFn(alertMessage);
            setQuestionContainerDisplay("none");
            setWelcomeDisplay("block");
            renderWelcomeDailyCard();
          });
        } else {
          startNewGame({ mode: normalMode, preserveBonusStreak });
        }
        return;
      }

      if (numberEl) {
        numberEl.textContent = count;
        numberEl.style.animation = "none";
        void numberEl.offsetWidth;
        numberEl.style.animation = "";
      }
    }, 1000);

    return true;
  }

  function buildCategoryCount(input) {
    const payload = input && typeof input === "object" ? input : {};
    const questions = Array.isArray(payload.questions) ? payload.questions : [];
    const counts = {
      "Old Testament": 0,
      "New Testament": 0,
      General: 0,
    };

    questions.forEach((question) => {
      if (question && Object.prototype.hasOwnProperty.call(counts, question.category)) {
        counts[question.category] += 1;
      }
    });

    return counts;
  }

  function buildEndGameSummaryHtml(input) {
    const payload = input && typeof input === "object" ? input : {};
    const isDailyGame = payload.isDailyGame === true;
    const correctCount = Number.isFinite(payload.correctCount) ? payload.correctCount : 0;
    const totalQuestions = Number.isFinite(payload.totalQuestions) ? payload.totalQuestions : 10;
    const percent = Number.isFinite(payload.percent) ? payload.percent : 0;
    const totalScore = Number.isFinite(payload.totalScore) ? payload.totalScore : 0;
    const verseText = String(payload.verseText || "");
    const statsHtml = String(payload.statsHtml || "");
    const showRestartSameButton = payload.showRestartSameButton === true;
    const carryoverBannerHtml = String(payload.carryoverBannerHtml || "");
    const summaryPlayerLevel = Number.isFinite(payload.summaryPlayerLevel) ? payload.summaryPlayerLevel : 1;
    const playerProfile = payload.playerProfile && typeof payload.playerProfile === "object"
      ? payload.playerProfile
      : { name: "Player", avatarId: "" };
    const builtInAvatars = Array.isArray(payload.builtInAvatars) ? payload.builtInAvatars : [];
    const getAvatarById = typeof payload.getAvatarById === "function"
      ? payload.getAvatarById
      : (() => (builtInAvatars[0] || { type: "emoji", value: "", label: "Avatar" }));
    const escapeHtml = typeof payload.escapeHtml === "function"
      ? payload.escapeHtml
      : (value => String(value || ""));

    const fallbackAvatarId = builtInAvatars[0] && builtInAvatars[0].id ? builtInAvatars[0].id : "";
    const avatar = getAvatarById(playerProfile.avatarId || fallbackAvatarId);
    const avatarHtml = avatar && avatar.type === "image"
      ? `<img src="${escapeHtml(avatar.value)}" alt="${escapeHtml(playerProfile.name || "Player")} avatar"/>`
      : `${escapeHtml((avatar && avatar.value) || "")}`;

    return `
        <h2>${isDailyGame ? "Daily Challenge Summary" : "Game Summary"}</h2>
        <p>You got <strong>${correctCount}</strong> right out of ${totalQuestions} (${percent}%).</p>
        <p><strong>Total Score: ${totalScore} points</strong></p>
        <p id="encouraging-verse">${verseText}</p>
        ${statsHtml}
        <div class="summary-player-wrap">
          <button id="summary-player-btn"
            type="button"
            aria-label="Open player profile">
            ${avatarHtml}
          </button>
          <span id="summary-player-name" class="summary-player-name">${escapeHtml(playerProfile.name || "Player")}</span>
          <span id="summary-player-level" class="summary-player-level">Level ${summaryPlayerLevel}</span>
        </div>
        ${carryoverBannerHtml}
        <div style="margin-top: 30px;">
          ${showRestartSameButton ? '<button id="restart-same">&#9654; Play</button>' : ""}
          <button id="restart-change">&#x1F3E0; Home</button>
        </div>
      `;
  }

  globalScope.BibleTriviaEngine = Object.assign({}, globalScope.BibleTriviaEngine, {
    getTimeLimitForMode,
    calculatePointBreakdown,
    selectBalancedQuestionsForMode,
    startCountdownThenGame,
    buildCategoryCount,
    buildEndGameSummaryHtml,
  });
})(window);
