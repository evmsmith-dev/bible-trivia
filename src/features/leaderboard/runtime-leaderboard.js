(function attachBibleTriviaLeaderboardFeature(globalScope) {
  const MODE_EMOJIS = { easy: "🟢", medium: "🟠", hard: "🔴", superHard: "⚫" };
  const MODE_NAMES = { easy: "Easy", medium: "Medium", hard: "Hard", superHard: "Super Hard" };

  function formatTimestampForDisplay(input) {
    const payload = input && typeof input === "object" ? input : {};
    const timestamp = payload.timestamp;
    const parsed = Date.parse(timestamp);
    return Number.isNaN(parsed) ? timestamp : new Date(parsed).toLocaleString();
  }

  function buildLeaderboardHtml(input) {
    const payload = input && typeof input === "object" ? input : {};
    const scores = Array.isArray(payload.scores) ? payload.scores : [];
    const containerId = payload.containerId || "leaderboard-container";
    const difficultyModeKeys = Array.isArray(payload.difficultyModeKeys)
      ? payload.difficultyModeKeys
      : ["easy", "medium", "hard", "superHard"];
    const getTopScoresByMode = typeof payload.getTopScoresByMode === "function"
      ? payload.getTopScoresByMode
      : (() => []);
    const maxHighScoresShown = Number.isFinite(payload.maxHighScoresShown)
      ? Math.max(1, Math.round(payload.maxHighScoresShown))
      : 5;
    const formatTimestamp = typeof payload.formatTimestampForDisplay === "function"
      ? payload.formatTimestampForDisplay
      : (timestamp => formatTimestampForDisplay({ timestamp }));

    let leaderboardHtml = `<div id="${containerId}">`;

    difficultyModeKeys.forEach((mode) => {
      const modeScores = getTopScoresByMode(scores, mode, maxHighScoresShown);
      const emoji = MODE_EMOJIS[mode];
      const name = MODE_NAMES[mode];

      leaderboardHtml += `
      <div class="leaderboard-mode">
        <h4>${emoji} ${name} Mode Top Scores</h4>
        <table>
          <colgroup>
            <col class="scores-rank">
            <col class="scores-score">
            <col class="scores-date">
            <col class="scores-correct">
          </colgroup>
          <thead>
            <tr>
              <th>Rank</th>
              <th>Score</th>
              <th>Date / Time</th>
              <th>Correct</th>
            </tr>
          </thead>
          <tbody>
    `;

      if (modeScores.length === 0) {
        leaderboardHtml += "<tr><td colspan=\"4\" style=\"text-align: center; padding: 12px; color: #999;\">No scores yet</td></tr>";
      } else {
        modeScores.forEach((highScore, index) => {
          leaderboardHtml += `
          <tr>
            <td>${index + 1}</td>
            <td>${highScore.score}</td>
            <td class="table-date">${formatTimestamp(highScore.timestamp)}</td>
            <td>${highScore.correct} / ${highScore.total}</td>
          </tr>
        `;
        });
      }

      leaderboardHtml += `
          </tbody>
        </table>
      </div>
    `;
    });

    leaderboardHtml += "</div>";
    return leaderboardHtml;
  }

  function buildGameHistoryHtml(input) {
    const payload = input && typeof input === "object" ? input : {};
    const history = Array.isArray(payload.history) ? payload.history : [];
    const withDetails = payload.withDetails !== false;
    const normalizeDifficultyMode = typeof payload.normalizeDifficultyMode === "function"
      ? payload.normalizeDifficultyMode
      : (value => value);
    const formatTimestamp = typeof payload.formatTimestampForDisplay === "function"
      ? payload.formatTimestampForDisplay
      : (timestamp => formatTimestampForDisplay({ timestamp }));

    const games = history.slice().reverse();
    let tableHtml = `
    <table>
      <colgroup>
        <col class="history-game">
        <col class="history-mode">
        <col class="history-date">
        <col class="history-correct">
        <col class="history-score">
        <col class="history-percent">
      </colgroup>
      <thead>
        <tr>
          <th>Game</th>
          <th>Mode</th>
          <th>Date / Time</th>
          <th>Correct</th>
          <th>Score</th>
          <th>%</th>
        </tr>
      </thead>
      <tbody>
  `;

    if (games.length === 0) {
      tableHtml += "<tr><td colspan=\"6\" style=\"text-align: center; padding: 12px; color: #999;\">No game history yet</td></tr>";
    } else {
      games.forEach((game, index) => {
        const modeKey = normalizeDifficultyMode(game.difficultyMode);
        const modeEmoji = MODE_EMOJIS[modeKey] || "❓";
        const modeName = MODE_NAMES[modeKey] || "Unknown";
        tableHtml += `
        <tr>
          <td>${index + 1}</td>
          <td>${modeEmoji} ${modeName}</td>
          <td class="table-date">${formatTimestamp(game.timestamp)}</td>
          <td>${game.correct} / ${game.total}</td>
          <td>${game.score}</td>
          <td>${game.percent}%</td>
        </tr>
      `;
      });
    }

    tableHtml += "</tbody></table>";
    if (!withDetails) {
      return tableHtml;
    }

    return `
    <details>
      <summary>Past Games History (all games)</summary>
      ${tableHtml}
    </details>
  `;
  }

  function buildLifetimeStatsHtml(input) {
    const payload = input && typeof input === "object" ? input : {};
    const stats = payload.stats;
    const sanitizePlayerStats = typeof payload.sanitizePlayerStats === "function"
      ? payload.sanitizePlayerStats
      : (value => value || {});
    const difficultyModeKeys = Array.isArray(payload.difficultyModeKeys)
      ? payload.difficultyModeKeys
      : ["easy", "medium", "hard", "superHard"];
    const getAverageCorrectSecondsByMode = typeof payload.getAverageCorrectSecondsByMode === "function"
      ? payload.getAverageCorrectSecondsByMode
      : (() => null);

    const normalized = sanitizePlayerStats(stats);
    let timingRows = "";

    difficultyModeKeys.forEach((mode) => {
      const avg = getAverageCorrectSecondsByMode(mode, normalized);
      const count = normalized.correctCountByMode[mode] || 0;
      timingRows += `
      <tr>
        <td>${MODE_EMOJIS[mode]} ${MODE_NAMES[mode]}</td>
        <td>${avg === null ? "-" : `${avg}s`}</td>
        <td>${count}</td>
      </tr>
    `;
    });

    return `
    <div class="stats-grid">
      <article class="stats-card">
        <h4>Average Correct Answer Time</h4>
        <table>
          <thead>
            <tr>
              <th>Mode</th>
              <th>Avg Time</th>
              <th>Correct</th>
            </tr>
          </thead>
          <tbody>
            ${timingRows}
          </tbody>
        </table>
      </article>

      <article class="stats-card">
        <h4>Correct Answers by Category</h4>
        <p class="stats-row"><strong>Old Testament:</strong> ${normalized.correctByCategory["Old Testament"]}</p>
        <p class="stats-row"><strong>New Testament:</strong> ${normalized.correctByCategory["New Testament"]}</p>
        <p class="stats-row"><strong>General:</strong> ${normalized.correctByCategory.General}</p>
        <p class="stats-row"><strong>Total Correct:</strong> ${normalized.totalCorrectClicks}</p>
      </article>

      <article class="stats-card">
        <h4>Correct-Answer Streaks</h4>
        <p class="stats-row"><strong>Current:</strong> ${normalized.currentStreak}</p>
        <p class="stats-row"><strong>Last Game Max:</strong> ${normalized.lastGameMaxStreak}</p>
        <p class="stats-row"><strong>All-Time Best:</strong> ${normalized.allTimeBestStreak}</p>
      </article>
    </div>
  `;
  }

  function renderLeaderboardOverlayFromCurrentState(input) {
    const payload = input && typeof input === "object" ? input : {};
    const getElementById = typeof payload.getElementById === "function" ? payload.getElementById : (() => null);
    const highScores = payload.highScores;
    const gameHistory = payload.gameHistory;
    const playerStats = payload.playerStats;
    const buildLeaderboardHtml = typeof payload.buildLeaderboardHtml === "function"
      ? payload.buildLeaderboardHtml
      : (() => "");
    const buildGameHistoryHtml = typeof payload.buildGameHistoryHtml === "function"
      ? payload.buildGameHistoryHtml
      : (() => "");
    const buildLifetimeStatsHtml = typeof payload.buildLifetimeStatsHtml === "function"
      ? payload.buildLifetimeStatsHtml
      : (() => "");
    const renderDailyLeaderboardPanel = typeof payload.renderDailyLeaderboardPanel === "function"
      ? payload.renderDailyLeaderboardPanel
      : (() => {});

    const topScoresContent = getElementById("welcome-leaderboard-content");
    const historyContent = getElementById("welcome-history-content");
    const statsContent = getElementById("welcome-stats-content");
    const dailyContent = getElementById("welcome-daily-content");

    if (topScoresContent) {
      const hasScores = Array.isArray(highScores) && highScores.length > 0;
      topScoresContent.innerHTML = hasScores
        ? buildLeaderboardHtml(highScores, "welcome-leaderboard-container")
        : "<div class=\"leaderboard-empty\">No high scores yet. Play a game to get on the board.</div>";
    }

    if (historyContent) {
      historyContent.innerHTML = buildGameHistoryHtml(gameHistory, { withDetails: false });
    }

    if (statsContent) {
      statsContent.innerHTML = buildLifetimeStatsHtml(playerStats);
    }

    renderDailyLeaderboardPanel(dailyContent);
  }

  function setActiveLeaderboardPanel(input) {
    const payload = input && typeof input === "object" ? input : {};
    const panelId = payload.panelId || "leaderboard-top-scores";
    const tabs = payload.tabs && typeof payload.tabs.forEach === "function" ? payload.tabs : [];
    const panels = payload.panels && typeof payload.panels.forEach === "function" ? payload.panels : [];

    tabs.forEach((tab) => {
      const isActive = tab && tab.dataset && tab.dataset.panel === panelId;
      tab.classList.toggle("active", isActive);
      tab.setAttribute("aria-selected", isActive ? "true" : "false");
    });

    panels.forEach((panel) => {
      panel.classList.toggle("active", panel && panel.id === panelId);
    });
  }

  function activateDefaultLeaderboardPanel(input) {
    const payload = input && typeof input === "object" ? input : {};
    const querySelectorAll = typeof payload.querySelectorAll === "function" ? payload.querySelectorAll : (() => []);
    const tabs = querySelectorAll("#leaderboard-overlay .leaderboard-tab");
    const panels = querySelectorAll("#leaderboard-overlay .leaderboard-panel");
    setActiveLeaderboardPanel({ panelId: "leaderboard-top-scores", tabs, panels });
  }

  function bindLeaderboardTabClicks(input) {
    const payload = input && typeof input === "object" ? input : {};
    const tabs = payload.tabs && typeof payload.tabs.forEach === "function" ? payload.tabs : [];
    const panels = payload.panels && typeof payload.panels.forEach === "function" ? payload.panels : [];
    const setActive = typeof payload.setActiveLeaderboardPanel === "function"
      ? payload.setActiveLeaderboardPanel
      : (panelId => setActiveLeaderboardPanel({ panelId, tabs, panels }));

    tabs.forEach((tab) => {
      tab.addEventListener("click", () => {
        setActive(tab.dataset.panel, tabs, panels);
      });
    });
  }

  function closeLeaderboardOverlay(input) {
    const payload = input && typeof input === "object" ? input : {};
    const getElementById = typeof payload.getElementById === "function" ? payload.getElementById : (() => null);
    const overlay = getElementById("leaderboard-overlay");
    if (!overlay) {
      return;
    }
    overlay.style.display = "none";
  }

  function initializeLeaderboardOverlayBindings(input) {
    const payload = input && typeof input === "object" ? input : {};
    const getElementById = typeof payload.getElementById === "function" ? payload.getElementById : (() => null);
    const querySelector = typeof payload.querySelector === "function" ? payload.querySelector : (() => null);
    const querySelectorAll = typeof payload.querySelectorAll === "function" ? payload.querySelectorAll : (() => []);
    const bindTabs = typeof payload.bindLeaderboardTabClicks === "function"
      ? payload.bindLeaderboardTabClicks
      : ((tabs, panels) => bindLeaderboardTabClicks({ tabs, panels }));
    const openOverlay = typeof payload.openLeaderboardOverlay === "function"
      ? payload.openLeaderboardOverlay
      : (() => {});
    const closeOverlay = typeof payload.closeLeaderboardOverlay === "function"
      ? payload.closeLeaderboardOverlay
      : (() => closeLeaderboardOverlay({ getElementById }));

    const leaderboardOverlay = getElementById("leaderboard-overlay");
    if (!leaderboardOverlay) {
      return false;
    }

    const leaderboardLink = getElementById("leaderboard-link");
    const leaderboardClose = querySelector("#leaderboard-overlay .leaderboard-close");
    const leaderboardBackdrop = querySelector("#leaderboard-overlay .leaderboard-backdrop");
    const tabs = querySelectorAll("#leaderboard-overlay .leaderboard-tab");
    const panels = querySelectorAll("#leaderboard-overlay .leaderboard-panel");

    bindTabs(tabs, panels);

    leaderboardLink && leaderboardLink.addEventListener("click", (event) => {
      event.preventDefault();
      openOverlay();
    });

    leaderboardClose && leaderboardClose.addEventListener("click", () => {
      closeOverlay();
    });

    leaderboardBackdrop && leaderboardBackdrop.addEventListener("click", () => {
      closeOverlay();
    });

    return true;
  }

  async function openLeaderboardOverlay(input) {
    const payload = input && typeof input === "object" ? input : {};
    const getElementById = typeof payload.getElementById === "function" ? payload.getElementById : (() => null);
    const querySelectorAll = typeof payload.querySelectorAll === "function" ? payload.querySelectorAll : (() => []);
    const renderLeaderboardOverlayFromCurrentState = typeof payload.renderLeaderboardOverlayFromCurrentState === "function"
      ? payload.renderLeaderboardOverlayFromCurrentState
      : (() => {});
    const loadData = typeof payload.loadData === "function" ? payload.loadData : (() => Promise.resolve());
    const log = typeof payload.log === "function" ? payload.log : (() => {});

    const overlay = getElementById("leaderboard-overlay");
    if (overlay) {
      overlay.style.display = "flex";
    }

    activateDefaultLeaderboardPanel({ querySelectorAll });

    renderLeaderboardOverlayFromCurrentState();
    await loadData().catch((error) => {
      log("Open leaderboard load failed", error && error.message);
    });
    renderLeaderboardOverlayFromCurrentState();
  }

  globalScope.BibleTriviaLeaderboard = Object.assign({}, globalScope.BibleTriviaLeaderboard, {
    formatTimestampForDisplay,
    buildLeaderboardHtml,
    buildGameHistoryHtml,
    buildLifetimeStatsHtml,
    renderLeaderboardOverlayFromCurrentState,
    setActiveLeaderboardPanel,
    activateDefaultLeaderboardPanel,
    bindLeaderboardTabClicks,
    closeLeaderboardOverlay,
    initializeLeaderboardOverlayBindings,
    openLeaderboardOverlay,
  });
})(window);
