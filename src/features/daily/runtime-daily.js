(function attachBibleTriviaDailyFeature(globalScope) {
  function toNonNegativeInteger(value) {
    return Number.isFinite(value) ? Math.max(0, Math.round(value)) : 0;
  }

  function createDefaultDailyChallengeRecord(input) {
    const payload = input && typeof input === "object" ? input : {};
    const sanitizeDailyChallengeRecord = typeof payload.sanitizeDailyChallengeRecord === "function"
      ? payload.sanitizeDailyChallengeRecord
      : (record => ({ ...(record || {}) }));

    return sanitizeDailyChallengeRecord({
      dateKey: payload.dateKey,
      seed: payload.seed,
      questionIds: payload.questionIds,
      attempts: 0,
      bestScore: 0,
      lastScore: 0,
      completed: false,
      completedAt: null,
      modeVersion: payload.modeVersion,
    });
  }

  function applyDailyCompletionToStats(input) {
    const payload = input && typeof input === "object" ? input : {};
    const sourceStats = payload.stats && typeof payload.stats === "object" ? payload.stats : {};
    const dateKey = String(payload.dateKey || "").trim();
    const firstCompletionForDay = Boolean(payload.firstCompletionForDay);
    const getDateKeyOffset = typeof payload.getDateKeyOffset === "function"
      ? payload.getDateKeyOffset
      : (() => null);

    const nextStats = {
      key: "lifetime",
      currentDailyStreak: toNonNegativeInteger(sourceStats.currentDailyStreak),
      bestDailyStreak: toNonNegativeInteger(sourceStats.bestDailyStreak),
      lastCompletedDateKey: typeof sourceStats.lastCompletedDateKey === "string" && sourceStats.lastCompletedDateKey
        ? sourceStats.lastCompletedDateKey
        : null,
      totalDailyCompletions: toNonNegativeInteger(sourceStats.totalDailyCompletions),
      totalDailyAttempts: toNonNegativeInteger(sourceStats.totalDailyAttempts),
    };

    nextStats.totalDailyCompletions += firstCompletionForDay ? 1 : 0;

    if (!firstCompletionForDay || !dateKey) {
      return nextStats;
    }

    const previousDateKey = nextStats.lastCompletedDateKey;
    const yesterdayDateKey = getDateKeyOffset(dateKey, -1);

    if (previousDateKey === dateKey) {
      return nextStats;
    }

    if (previousDateKey && previousDateKey === yesterdayDateKey) {
      nextStats.currentDailyStreak += 1;
    } else {
      nextStats.currentDailyStreak = 1;
    }

    if (nextStats.currentDailyStreak > nextStats.bestDailyStreak) {
      nextStats.bestDailyStreak = nextStats.currentDailyStreak;
    }

    nextStats.lastCompletedDateKey = dateKey;
    return nextStats;
  }

  function getDailyChallengeStatusText(record) {
    if (!record) return "Not started";
    if (record.completed) return "Completed";
    if ((record.attempts || 0) > 0) return "In progress";
    return "Not started";
  }

  function selectDailyChallengeQuestions(input) {
    const payload = input && typeof input === "object" ? input : {};
    const seed = payload.seed;
    const createSeededRandom = typeof payload.createSeededRandom === "function"
      ? payload.createSeededRandom
      : (() => Math.random);
    const selectBalancedQuestionsForMode = typeof payload.selectBalancedQuestionsForMode === "function"
      ? payload.selectBalancedQuestionsForMode
      : (() => []);
    const difficultyMode = payload.difficultyMode;
    const questionCount = Number.isFinite(payload.questionCount) ? Math.max(1, Math.round(payload.questionCount)) : 10;

    const randomFn = createSeededRandom(seed);
    return selectBalancedQuestionsForMode(difficultyMode, randomFn, questionCount);
  }

  function hydrateDailyQuestions(input) {
    const payload = input && typeof input === "object" ? input : {};
    const questionIds = Array.isArray(payload.questionIds) ? payload.questionIds : [];
    const allQuestionsById = payload.allQuestionsById instanceof Map ? payload.allQuestionsById : new Map();
    const questionCount = Number.isFinite(payload.questionCount) ? Math.max(1, Math.round(payload.questionCount)) : 10;
    const fallbackQuestions = typeof payload.fallbackQuestions === "function" ? payload.fallbackQuestions : (() => []);

    const resolved = [];
    const seen = new Set();

    questionIds.forEach((id) => {
      if (seen.has(id)) return;
      const question = allQuestionsById.get(id);
      if (!question) return;
      seen.add(id);
      resolved.push(question);
    });

    if (resolved.length < questionCount) {
      const fallback = fallbackQuestions();
      fallback.forEach((question) => {
        if (resolved.length >= questionCount) return;
        if (!question || seen.has(question.id)) return;
        seen.add(question.id);
        resolved.push(question);
      });
    }

    return resolved.slice(0, questionCount);
  }

  async function getOrCreateDailyChallengeRecord(input) {
    const payload = input && typeof input === "object" ? input : {};
    const normalizedDateKey = String(payload.dateKey || "").trim();
    if (!normalizedDateKey) {
      throw new Error("Invalid daily challenge date key");
    }

    const ensureDailyDataLoaded = typeof payload.ensureDailyDataLoaded === "function" ? payload.ensureDailyDataLoaded : (() => {});
    const getMapRecord = typeof payload.getMapRecord === "function" ? payload.getMapRecord : (() => null);
    const setMapRecord = typeof payload.setMapRecord === "function" ? payload.setMapRecord : (() => {});
    const isDbReady = typeof payload.isDbReady === "function" ? payload.isDbReady : (() => false);
    const loadDailyChallenge = typeof payload.loadDailyChallenge === "function" ? payload.loadDailyChallenge : (async () => null);
    const saveDailyChallenge = typeof payload.saveDailyChallenge === "function" ? payload.saveDailyChallenge : (async () => {});
    const log = typeof payload.log === "function" ? payload.log : (() => {});
    const createDailySeed = typeof payload.createDailySeed === "function" ? payload.createDailySeed : (dateKey => `${dateKey}|daily`);
    const selectDailyChallengeQuestions = typeof payload.selectDailyChallengeQuestions === "function"
      ? payload.selectDailyChallengeQuestions
      : (() => []);
    const createDefaultDailyChallengeRecord = typeof payload.createDefaultDailyChallengeRecord === "function"
      ? payload.createDefaultDailyChallengeRecord
      : (() => ({}));
    const sanitizeDailyChallengeRecord = typeof payload.sanitizeDailyChallengeRecord === "function"
      ? payload.sanitizeDailyChallengeRecord
      : (record => ({ ...(record || {}) }));
    const questionCount = Number.isFinite(payload.questionCount) ? Math.max(1, Math.round(payload.questionCount)) : 10;

    ensureDailyDataLoaded();

    let record = getMapRecord(normalizedDateKey) || null;

    if (!record && isDbReady()) {
      try {
        record = await loadDailyChallenge(normalizedDateKey);
      } catch (error) {
        const message = error && error.message ? error.message : String(error);
        log("Failed to load daily challenge from IndexedDB", message);
      }
    }

    if (!record) {
      const seed = createDailySeed(normalizedDateKey);
      const questions = selectDailyChallengeQuestions(seed);
      const questionIds = questions.map((question) => question.id);
      record = createDefaultDailyChallengeRecord(normalizedDateKey, questionIds, seed);
    }

    record = sanitizeDailyChallengeRecord(record);

    if (!Array.isArray(record.questionIds) || record.questionIds.length < questionCount) {
      const recoverySeed = record.seed || createDailySeed(normalizedDateKey);
      const recoveredQuestions = selectDailyChallengeQuestions(recoverySeed);
      record = sanitizeDailyChallengeRecord({
        ...record,
        seed: recoverySeed,
        questionIds: recoveredQuestions.map((question) => question.id),
      });
    }

    setMapRecord(normalizedDateKey, record);

    if (isDbReady()) {
      try {
        await saveDailyChallenge(record);
      } catch (error) {
        const message = error && error.message ? error.message : String(error);
        log("Failed to persist daily challenge", message);
      }
    }

    return record;
  }

  async function prepareDailyChallengeStart(input) {
    const payload = input && typeof input === "object" ? input : {};
    const preserveBonusStreak = Boolean(payload.preserveBonusStreak);
    const questionCount = Number.isFinite(payload.questionCount) ? Math.max(1, Math.round(payload.questionCount)) : 10;

    const getLocalDateKey = typeof payload.getLocalDateKey === "function" ? payload.getLocalDateKey : (() => "");
    const getOrCreateDailyChallengeRecord = typeof payload.getOrCreateDailyChallengeRecord === "function"
      ? payload.getOrCreateDailyChallengeRecord
      : (async () => null);
    const hydrateDailyQuestions = typeof payload.hydrateDailyQuestions === "function"
      ? payload.hydrateDailyQuestions
      : (() => []);
    const selectDailyChallengeQuestions = typeof payload.selectDailyChallengeQuestions === "function"
      ? payload.selectDailyChallengeQuestions
      : (() => []);
    const createDailySeed = typeof payload.createDailySeed === "function"
      ? payload.createDailySeed
      : (dateKey => `${dateKey}|daily`);

    const dateKey = getLocalDateKey();
    const dailyRecord = await getOrCreateDailyChallengeRecord(dateKey);

    if (dailyRecord && dailyRecord.completed) {
      throw new Error("Today's daily challenge has already been completed.");
    }

    const hydratedQuestions = hydrateDailyQuestions(dailyRecord ? dailyRecord.questionIds : []);
    const questions = hydratedQuestions.length >= questionCount
      ? hydratedQuestions
      : selectDailyChallengeQuestions((dailyRecord && dailyRecord.seed) || createDailySeed(dateKey));

    if (!Array.isArray(questions) || questions.length < questionCount) {
      throw new Error("Unable to build a full daily challenge");
    }

    return {
      dateKey,
      dailyRecord,
      questions,
      preserveBonusStreak,
    };
  }

  function renderWelcomeDailyCard(input) {
    const payload = input && typeof input === "object" ? input : {};
    const ensureDailyDataLoaded = typeof payload.ensureDailyDataLoaded === "function" ? payload.ensureDailyDataLoaded : (() => {});
    const getElementById = typeof payload.getElementById === "function" ? payload.getElementById : (() => null);
    const getLocalDateKey = typeof payload.getLocalDateKey === "function" ? payload.getLocalDateKey : (() => "");
    const getDailyRecordForDate = typeof payload.getDailyRecordForDate === "function" ? payload.getDailyRecordForDate : (() => null);
    const getDailyChallengeStatusText = typeof payload.getDailyChallengeStatusText === "function"
      ? payload.getDailyChallengeStatusText
      : (() => "Not started");
    const isDailyBaseBonusActive = typeof payload.isDailyBaseBonusActive === "function"
      ? payload.isDailyBaseBonusActive
      : (() => false);
    const updateDailyChallengeLinkPulse = typeof payload.updateDailyChallengeLinkPulse === "function"
      ? payload.updateDailyChallengeLinkPulse
      : (() => {});

    ensureDailyDataLoaded();

    const statusEl = getElementById("daily-challenge-status");
    const dailyStartBtn = getElementById("daily-start-btn");
    if (!statusEl) {
      return;
    }

    const todayKey = getLocalDateKey();
    const todayRecord = getDailyRecordForDate(todayKey);
    const statusText = getDailyChallengeStatusText(todayRecord && todayRecord.dateKey ? todayRecord : null);
    const isCompletedToday = Boolean(todayRecord && todayRecord.dateKey && todayRecord.completed);
    const isDailyBonusActiveNow = Boolean(isDailyBaseBonusActive(todayKey));

    statusEl.innerHTML = [
      `${statusText}`,
      `Point Bonus: ${isDailyBonusActiveNow ? "Active (+5% base/question)" : "Inactive"}`,
    ].join("<br>");

    if (dailyStartBtn) {
      dailyStartBtn.disabled = isCompletedToday;
      dailyStartBtn.textContent = isCompletedToday ? "Completed for Today" : "Start Today's Challenge";
    }

    updateDailyChallengeLinkPulse(todayKey);
  }

  function buildDailyLeaderboardHtml(input) {
    const payload = input && typeof input === "object" ? input : {};
    const challenges = Array.isArray(payload.challenges) ? payload.challenges : [];
    const stats = payload.stats;
    const sanitizeDailyStats = typeof payload.sanitizeDailyStats === "function"
      ? payload.sanitizeDailyStats
      : (value => value || {});
    const sanitizeDailyChallengeRecord = typeof payload.sanitizeDailyChallengeRecord === "function"
      ? payload.sanitizeDailyChallengeRecord
      : (value => value || {});
    const escapeHtml = typeof payload.escapeHtml === "function" ? payload.escapeHtml : (value => String(value || ""));

    const records = challenges
      .slice()
      .sort((a, b) => String(b.dateKey).localeCompare(String(a.dateKey)));

    const sanitizedStats = sanitizeDailyStats(stats);
    const successfulCompletions = records.filter((record) => sanitizeDailyChallengeRecord(record).completed).length;

    let rows = "";
    if (records.length === 0) {
      rows = '<tr><td colspan="3" style="text-align: center; padding: 12px; color: #999;">No daily challenges yet</td></tr>';
    } else {
      records.forEach((record) => {
        const safe = sanitizeDailyChallengeRecord(record);
        rows += `
        <tr>
          <td>${escapeHtml(safe.dateKey)}</td>
          <td>${safe.completed ? "Yes" : "No"}</td>
          <td>${safe.lastScore}</td>
        </tr>
      `;
      });
    }

    return `
    <div class="stats-grid">
      <article class="stats-card">
        <h4>Daily Streak</h4>
        <p class="stats-row"><strong>Current:</strong> ${sanitizedStats.currentDailyStreak}</p>
        <p class="stats-row"><strong>Best:</strong> ${sanitizedStats.bestDailyStreak}</p>
        <p class="stats-row"><strong>Total Wins:</strong> ${successfulCompletions} \ud83c\udfc5</p>
        <p class="stats-row"><strong>Total Attempts:</strong> ${sanitizedStats.totalDailyAttempts}</p>
      </article>

      <article class="stats-card">
        <h4>Recent Daily Challenges</h4>
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Completed</th>
              <th>Score</th>
            </tr>
          </thead>
          <tbody>
            ${rows}
          </tbody>
        </table>
      </article>
    </div>
  `;
  }

  async function refreshDailyChallengeCard(input) {
    const payload = input && typeof input === "object" ? input : {};
    const loadData = typeof payload.loadData === "function" ? payload.loadData : (async () => {});
    const renderWelcomeDailyCard = typeof payload.renderWelcomeDailyCard === "function"
      ? payload.renderWelcomeDailyCard
      : (() => {});
    const log = typeof payload.log === "function" ? payload.log : (() => {});

    try {
      await loadData();
    } catch (error) {
      const message = error && error.message ? error.message : String(error);
      log("Failed to refresh daily card from persisted data", message);
    }

    renderWelcomeDailyCard();
  }

  async function openDailyChallengeOverlay(input) {
    const payload = input && typeof input === "object" ? input : {};
    const getLocalDateKey = typeof payload.getLocalDateKey === "function" ? payload.getLocalDateKey : (() => "");
    const acknowledgeDailyChallengeLinkClick = typeof payload.acknowledgeDailyChallengeLinkClick === "function"
      ? payload.acknowledgeDailyChallengeLinkClick
      : (() => false);
    const updateDailyChallengeLinkPulse = typeof payload.updateDailyChallengeLinkPulse === "function"
      ? payload.updateDailyChallengeLinkPulse
      : (() => {});
    const getElementById = typeof payload.getElementById === "function" ? payload.getElementById : (() => null);
    const renderWelcomeDailyCard = typeof payload.renderWelcomeDailyCard === "function"
      ? payload.renderWelcomeDailyCard
      : (() => {});
    const refreshDailyChallengeCard = typeof payload.refreshDailyChallengeCard === "function"
      ? payload.refreshDailyChallengeCard
      : (async () => {});
    const log = typeof payload.log === "function" ? payload.log : (() => {});

    const todayKey = getLocalDateKey();
    const didAcknowledgeToday = acknowledgeDailyChallengeLinkClick(todayKey);
    if (didAcknowledgeToday) {
      updateDailyChallengeLinkPulse(todayKey);
    }

    const overlay = getElementById("daily-challenge-overlay");
    if (overlay) {
      overlay.style.display = "flex";
    }

    renderWelcomeDailyCard();
    try {
      await refreshDailyChallengeCard();
    } catch (error) {
      const message = error && error.message ? error.message : String(error);
      log("Open daily overlay refresh failed", message);
    }
  }

  function closeDailyChallengeOverlay(input) {
    const payload = input && typeof input === "object" ? input : {};
    const getElementById = typeof payload.getElementById === "function" ? payload.getElementById : (() => null);
    const overlay = getElementById("daily-challenge-overlay");
    if (!overlay) {
      return;
    }
    overlay.style.display = "none";
  }

  function initializeDailyChallengeOverlayBindings(input) {
    const payload = input && typeof input === "object" ? input : {};
    const getElementById = typeof payload.getElementById === "function" ? payload.getElementById : (() => null);
    const querySelector = typeof payload.querySelector === "function" ? payload.querySelector : (() => null);
    const openDailyChallengeOverlay = typeof payload.openDailyChallengeOverlay === "function"
      ? payload.openDailyChallengeOverlay
      : (() => {});
    const closeDailyChallengeOverlay = typeof payload.closeDailyChallengeOverlay === "function"
      ? payload.closeDailyChallengeOverlay
      : (() => closeDailyChallengeOverlay({ getElementById }));
    const resetBonusCarryStreak = typeof payload.resetBonusCarryStreak === "function"
      ? payload.resetBonusCarryStreak
      : (() => {});
    const setWelcomeDisplay = typeof payload.setWelcomeDisplay === "function"
      ? payload.setWelcomeDisplay
      : (() => {});
    const setQuestionContainerDisplay = typeof payload.setQuestionContainerDisplay === "function"
      ? payload.setQuestionContainerDisplay
      : (() => {});
    const startCountdownThenGame = typeof payload.startCountdownThenGame === "function"
      ? payload.startCountdownThenGame
      : (() => {});
    const scheduleDailyChallengePulseReset = typeof payload.scheduleDailyChallengePulseReset === "function"
      ? payload.scheduleDailyChallengePulseReset
      : (() => {});
    const isHighScoreCelebrationActive = Boolean(payload.isHighScoreCelebrationActive);

    const dailyChallengeLink = getElementById("daily-challenge-link");
    const dailyChallengeOverlay = getElementById("daily-challenge-overlay");
    const dailyChallengeClose = querySelector("#daily-challenge-overlay .daily-overlay-close");
    const dailyChallengeBackdrop = querySelector("#daily-challenge-overlay .overlay-backdrop");
    const dailyStartBtn = getElementById("daily-start-btn");

    if (!dailyChallengeOverlay) {
      return false;
    }

    dailyChallengeLink && dailyChallengeLink.addEventListener("click", (event) => {
      event.preventDefault();
      openDailyChallengeOverlay();
    });

    dailyChallengeClose && dailyChallengeClose.addEventListener("click", () => {
      closeDailyChallengeOverlay();
    });

    dailyChallengeBackdrop && dailyChallengeBackdrop.addEventListener("click", () => {
      closeDailyChallengeOverlay();
    });

    dailyStartBtn && dailyStartBtn.addEventListener("click", () => {
      if (dailyStartBtn.disabled) return;
      if (isHighScoreCelebrationActive) return;
      resetBonusCarryStreak();
      closeDailyChallengeOverlay();
      setWelcomeDisplay();
      setQuestionContainerDisplay();
      startCountdownThenGame({ mode: "daily", preserveBonusStreak: false });
    });

    scheduleDailyChallengePulseReset();
    return true;
  }

  function shouldPulseDailyChallengeLink(input) {
    const payload = input && typeof input === "object" ? input : {};
    const dateKey = payload.dateKey;
    const getLocalDateKey = typeof payload.getLocalDateKey === "function" ? payload.getLocalDateKey : (() => "");
    const getStoredPulseDateKey = typeof payload.getStoredPulseDateKey === "function"
      ? payload.getStoredPulseDateKey
      : (() => "");
    const isDailyChallengeCompletedForDate = typeof payload.isDailyChallengeCompletedForDate === "function"
      ? payload.isDailyChallengeCompletedForDate
      : (() => false);
    const storageKeyDailyPulseAckDate = payload.storageKeyDailyPulseAckDate;

    const normalizedDateKey = String(dateKey || "").trim() || getLocalDateKey();
    const acknowledgedDateKey = getStoredPulseDateKey(storageKeyDailyPulseAckDate);
    return acknowledgedDateKey !== normalizedDateKey && !isDailyChallengeCompletedForDate(normalizedDateKey);
  }

  function updateDailyChallengeLinkPulse(input) {
    const payload = input && typeof input === "object" ? input : {};
    const dateKey = payload.dateKey;
    const getElementById = typeof payload.getElementById === "function" ? payload.getElementById : (() => null);
    const getLocalDateKey = typeof payload.getLocalDateKey === "function" ? payload.getLocalDateKey : (() => "");
    const shouldPulseDailyChallengeLink = typeof payload.shouldPulseDailyChallengeLink === "function"
      ? payload.shouldPulseDailyChallengeLink
      : (() => false);
    const getStoredPulseDateKey = typeof payload.getStoredPulseDateKey === "function"
      ? payload.getStoredPulseDateKey
      : (() => "");
    const setPulseDateKey = typeof payload.setPulseDateKey === "function" ? payload.setPulseDateKey : (() => {});
    const incrementDailyPulseCounter = typeof payload.incrementDailyPulseCounter === "function"
      ? payload.incrementDailyPulseCounter
      : (() => 0);
    const log = typeof payload.log === "function" ? payload.log : (() => {});
    const storageKeyDailyPulseLastShownDate = payload.storageKeyDailyPulseLastShownDate;
    const storageKeyDailyPulseShowCount = payload.storageKeyDailyPulseShowCount;

    const dailyChallengeLink = getElementById("daily-challenge-link");
    const dailyChallengeNewBadge = getElementById("daily-challenge-new-badge");
    if (!dailyChallengeLink) {
      return;
    }

    const normalizedDateKey = String(dateKey || "").trim() || getLocalDateKey();
    const shouldPulse = shouldPulseDailyChallengeLink(normalizedDateKey);
    dailyChallengeLink.classList.toggle("daily-link-pulse", shouldPulse);
    if (dailyChallengeNewBadge) {
      dailyChallengeNewBadge.classList.toggle("is-visible", shouldPulse);
    }

    if (!shouldPulse) {
      return;
    }

    const lastShownDateKey = getStoredPulseDateKey(storageKeyDailyPulseLastShownDate);
    if (lastShownDateKey !== normalizedDateKey) {
      setPulseDateKey(storageKeyDailyPulseLastShownDate, normalizedDateKey);
      const showCount = incrementDailyPulseCounter(storageKeyDailyPulseShowCount);
      log("Daily challenge pulse shown", { dateKey: normalizedDateKey, showCount });
    }
  }

  function acknowledgeDailyChallengeLinkClick(input) {
    const payload = input && typeof input === "object" ? input : {};
    const dateKey = payload.dateKey;
    const getLocalDateKey = typeof payload.getLocalDateKey === "function" ? payload.getLocalDateKey : (() => "");
    const getStoredPulseDateKey = typeof payload.getStoredPulseDateKey === "function"
      ? payload.getStoredPulseDateKey
      : (() => "");
    const setPulseDateKey = typeof payload.setPulseDateKey === "function" ? payload.setPulseDateKey : (() => {});
    const incrementDailyPulseCounter = typeof payload.incrementDailyPulseCounter === "function"
      ? payload.incrementDailyPulseCounter
      : (() => 0);
    const log = typeof payload.log === "function" ? payload.log : (() => {});
    const storageKeyDailyPulseAckDate = payload.storageKeyDailyPulseAckDate;
    const storageKeyDailyPulseClickCount = payload.storageKeyDailyPulseClickCount;

    const normalizedDateKey = String(dateKey || "").trim() || getLocalDateKey();
    const acknowledgedDateKey = getStoredPulseDateKey(storageKeyDailyPulseAckDate);
    if (acknowledgedDateKey === normalizedDateKey) {
      return false;
    }

    setPulseDateKey(storageKeyDailyPulseAckDate, normalizedDateKey);
    const clickCount = incrementDailyPulseCounter(storageKeyDailyPulseClickCount);
    log("Daily challenge link acknowledged", { dateKey: normalizedDateKey, clickCount });
    return true;
  }

  function scheduleDailyChallengePulseReset(input) {
    const payload = input && typeof input === "object" ? input : {};
    const currentTimer = payload.currentTimer || null;
    const setTimer = typeof payload.setTimer === "function" ? payload.setTimer : (() => {});
    const clearTimer = typeof payload.clearTimer === "function" ? payload.clearTimer : (() => {});
    const nowFactory = typeof payload.nowFactory === "function" ? payload.nowFactory : (() => new Date());
    const setTimeoutFn = typeof payload.setTimeoutFn === "function" ? payload.setTimeoutFn : setTimeout;
    const updateDailyChallengeLinkPulse = typeof payload.updateDailyChallengeLinkPulse === "function"
      ? payload.updateDailyChallengeLinkPulse
      : (() => {});
    const getLocalDateKey = typeof payload.getLocalDateKey === "function" ? payload.getLocalDateKey : (() => "");

    if (currentTimer) {
      clearTimer(currentTimer);
    }

    const now = nowFactory();
    const nextChallengeTime = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0, 250);
    const delayMs = Math.max(1000, nextChallengeTime.getTime() - now.getTime());

    const nextTimer = setTimeoutFn(() => {
      updateDailyChallengeLinkPulse(getLocalDateKey());
      const rescheduledTimer = scheduleDailyChallengePulseReset(Object.assign({}, payload, {
        currentTimer: null,
      }));
      setTimer(rescheduledTimer);
    }, delayMs);

    return nextTimer;
  }

  function isDailyBaseBonusActive(input) {
    const payload = input && typeof input === "object" ? input : {};
    const dateKey = payload.dateKey;
    const ensureDailyDataLoaded = typeof payload.ensureDailyDataLoaded === "function" ? payload.ensureDailyDataLoaded : (() => {});
    const getLocalDateKey = typeof payload.getLocalDateKey === "function" ? payload.getLocalDateKey : (() => "");
    const getDailyRecordForDate = typeof payload.getDailyRecordForDate === "function" ? payload.getDailyRecordForDate : (() => null);

    ensureDailyDataLoaded();
    const normalizedDateKey = String(dateKey || "").trim() || getLocalDateKey();
    const record = getDailyRecordForDate(normalizedDateKey);
    return Boolean(record && record.dateKey && record.completed);
  }

  function getDailyBaseBonusPoints(input) {
    const payload = input && typeof input === "object" ? input : {};
    const basePoints = payload.basePoints;
    const isDailyBaseBonusActive = typeof payload.isDailyBaseBonusActive === "function"
      ? payload.isDailyBaseBonusActive
      : (() => false);
    const dailyBaseBonusMultiplier = Number.isFinite(payload.dailyBaseBonusMultiplier)
      ? Math.max(0, payload.dailyBaseBonusMultiplier)
      : 0;

    const safeBasePoints = Number.isFinite(basePoints) ? Math.max(0, basePoints) : 0;
    if (!safeBasePoints || !isDailyBaseBonusActive()) {
      return 0;
    }

    return Math.round(safeBasePoints * dailyBaseBonusMultiplier);
  }

  function isDailyChallengeCompletedForDate(input) {
    const payload = input && typeof input === "object" ? input : {};
    const dateKey = payload.dateKey;
    const ensureDailyDataLoaded = typeof payload.ensureDailyDataLoaded === "function" ? payload.ensureDailyDataLoaded : (() => {});
    const getLocalDateKey = typeof payload.getLocalDateKey === "function" ? payload.getLocalDateKey : (() => "");
    const getDailyRecordForDate = typeof payload.getDailyRecordForDate === "function" ? payload.getDailyRecordForDate : (() => null);

    ensureDailyDataLoaded();
    const normalizedDateKey = String(dateKey || "").trim() || getLocalDateKey();
    const record = getDailyRecordForDate(normalizedDateKey);
    return Boolean(record && record.dateKey && record.completed);
  }

  function getStoredPulseDateKey(input) {
    const payload = input && typeof input === "object" ? input : {};
    const storageKey = payload.storageKey;
    const readDateKey = typeof payload.readDateKey === "function" ? payload.readDateKey : (() => "");
    return readDateKey(storageKey);
  }

  function incrementDailyPulseCounter(input) {
    const payload = input && typeof input === "object" ? input : {};
    const storageKey = payload.storageKey;
    const incrementCounter = typeof payload.incrementCounter === "function" ? payload.incrementCounter : (() => 0);
    return incrementCounter(storageKey);
  }

  function renderDailyLeaderboardPanel(input) {
    const payload = input && typeof input === "object" ? input : {};
    const dailyContent = payload.dailyContent || null;
    const dailyChallenges = Array.isArray(payload.dailyChallenges) ? payload.dailyChallenges : [];
    const dailyStats = payload.dailyStats;
    const buildDailyLeaderboardHtml = typeof payload.buildDailyLeaderboardHtml === "function"
      ? payload.buildDailyLeaderboardHtml
      : (() => "");

    if (!dailyContent) {
      return;
    }

    dailyContent.innerHTML = buildDailyLeaderboardHtml(dailyChallenges, dailyStats);
  }

  globalScope.BibleTriviaDaily = Object.assign({}, globalScope.BibleTriviaDaily, {
    createDefaultDailyChallengeRecord,
    applyDailyCompletionToStats,
    getDailyChallengeStatusText,
    selectDailyChallengeQuestions,
    hydrateDailyQuestions,
    getOrCreateDailyChallengeRecord,
    prepareDailyChallengeStart,
    renderWelcomeDailyCard,
    buildDailyLeaderboardHtml,
    refreshDailyChallengeCard,
    openDailyChallengeOverlay,
    closeDailyChallengeOverlay,
    initializeDailyChallengeOverlayBindings,
    shouldPulseDailyChallengeLink,
    updateDailyChallengeLinkPulse,
    acknowledgeDailyChallengeLinkClick,
    scheduleDailyChallengePulseReset,
    isDailyBaseBonusActive,
    getDailyBaseBonusPoints,
    isDailyChallengeCompletedForDate,
    getStoredPulseDateKey,
    incrementDailyPulseCounter,
    renderDailyLeaderboardPanel,
  });
})(window);