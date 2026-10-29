// Player Stats overlay: Top Scores, Game History, lifetime Stats, and Daily results.
import { CATEGORIES, MODES, MODE_KEYS } from "../config.js";
import { getAverageCorrectSeconds, getTopScores, normalizeMode, sanitizeDailyRecord } from "../lib/records.js";
import { escapeHtml, formatTimestamp } from "../lib/utils.js";
import { state } from "../state.js";
import { byId } from "../ui/dom.js";
import { openOverlay } from "../ui/overlay.js";

const modeName = (mode) => `${MODES[mode]?.emoji || "❓"} ${MODES[mode]?.label || "Unknown"}`;
const emptyRow = (columns, text) => `<tr><td colspan="${columns}" class="table-empty">${text}</td></tr>`;

function topScoresHtml() {
  if (!state.highScores.length) {
    return '<div class="leaderboard-empty">No high scores yet. Play a game to get on the board.</div>';
  }
  return `<div id="welcome-leaderboard-container">${MODE_KEYS.map((mode) => {
    const scores = getTopScores(state.highScores, mode);
    const rows = scores.length
      ? scores.map((score, index) => `
          <tr><td>${index + 1}</td><td>${score.score}</td>
          <td class="table-date">${escapeHtml(formatTimestamp(score.timestamp))}</td><td>${score.correct} / ${score.total}</td></tr>`).join("")
      : emptyRow(4, "No scores yet");
    return `
      <div class="leaderboard-mode">
        <h4>${modeName(mode)} Mode Top Scores</h4>
        <table>
          <colgroup><col class="scores-rank"><col class="scores-score"><col class="scores-date"><col class="scores-correct"></colgroup>
          <thead><tr><th>Rank</th><th>Score</th><th>Date / Time</th><th>Correct</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`;
  }).join("")}</div>`;
}

function historyHtml() {
  const games = state.history.slice().reverse();
  const rows = games.length
    ? games.map((game, index) => `
        <tr><td>${index + 1}</td><td>${modeName(normalizeMode(game.difficultyMode))}</td>
        <td class="table-date">${escapeHtml(formatTimestamp(game.timestamp))}</td>
        <td>${game.correct} / ${game.total}</td><td>${game.score}</td><td>${game.percent}%</td></tr>`).join("")
    : emptyRow(6, "No game history yet");
  return `
    <table>
      <colgroup><col class="history-game"><col class="history-mode"><col class="history-date"><col class="history-correct"><col class="history-score"><col class="history-percent"></colgroup>
      <thead><tr><th>Game</th><th>Mode</th><th>Date / Time</th><th>Correct</th><th>Score</th><th>%</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>`;
}

function lifetimeStatsHtml() {
  const stats = state.playerStats;
  const timingRows = MODE_KEYS.map((mode) => {
    const average = getAverageCorrectSeconds(stats, mode);
    return `<tr><td>${modeName(mode)}</td><td>${average === null ? "-" : `${average}s`}</td><td>${stats.correctCountByMode[mode]}</td></tr>`;
  }).join("");
  return `
    <div class="stats-grid">
      <article class="stats-card">
        <h4>Average Correct Answer Time</h4>
        <table><thead><tr><th>Mode</th><th>Avg Time</th><th>Correct</th></tr></thead><tbody>${timingRows}</tbody></table>
      </article>
      <article class="stats-card">
        <h4>Correct Answers by Category</h4>
        ${CATEGORIES.map((category) => `<p class="stats-row"><strong>${category}:</strong> ${stats.correctByCategory[category]}</p>`).join("")}
        <p class="stats-row"><strong>Total Correct:</strong> ${stats.totalCorrectClicks}</p>
      </article>
      <article class="stats-card">
        <h4>Correct-Answer Streaks</h4>
        <p class="stats-row"><strong>Current:</strong> ${stats.currentStreak}</p>
        <p class="stats-row"><strong>Last Game Max:</strong> ${stats.lastGameMaxStreak}</p>
        <p class="stats-row"><strong>All-Time Best:</strong> ${stats.allTimeBestStreak}</p>
      </article>
    </div>`;
}

function dailyHtml() {
  const records = Object.values(state.dailyChallenges).map(sanitizeDailyRecord).sort((a, b) => b.dateKey.localeCompare(a.dateKey));
  const wins = records.filter((record) => record.completed).length;
  const rows = records.length
    ? records.map((record) => `<tr><td>${escapeHtml(record.dateKey)}</td><td>${record.completed ? "Yes" : "No"}</td><td>${record.lastScore}</td></tr>`).join("")
    : emptyRow(3, "No daily challenges yet");
  const { dailyStats } = state;
  return `
    <div class="stats-grid">
      <article class="stats-card">
        <h4>Daily Streak</h4>
        <p class="stats-row"><strong>Current:</strong> ${dailyStats.currentDailyStreak}</p>
        <p class="stats-row"><strong>Best:</strong> ${dailyStats.bestDailyStreak}</p>
        <p class="stats-row"><strong>Total Wins:</strong> ${wins} 🏅</p>
        <p class="stats-row"><strong>Total Attempts:</strong> ${dailyStats.totalDailyAttempts}</p>
      </article>
      <article class="stats-card">
        <h4>Recent Daily Challenges</h4>
        <table><thead><tr><th>Date</th><th>Completed</th><th>Score</th></tr></thead><tbody>${rows}</tbody></table>
      </article>
    </div>`;
}

function setActiveTab(panelId) {
  document.querySelectorAll("#leaderboard-overlay .leaderboard-tab").forEach((tab) => {
    const active = tab.dataset.panel === panelId;
    tab.classList.toggle("active", active);
    tab.setAttribute("aria-selected", String(active));
    tab.tabIndex = active ? 0 : -1;
  });
  document.querySelectorAll("#leaderboard-overlay .leaderboard-panel").forEach((panel) => {
    panel.classList.toggle("active", panel.id === panelId);
  });
}

export function openStats() {
  byId("welcome-leaderboard-content").innerHTML = topScoresHtml();
  byId("welcome-history-content").innerHTML = historyHtml();
  byId("welcome-stats-content").innerHTML = lifetimeStatsHtml();
  byId("welcome-daily-content").innerHTML = dailyHtml();
  setActiveTab("leaderboard-top-scores");
  openOverlay("leaderboard-overlay", { initialFocus: ".leaderboard-tab.active" });
}

export function initStats() {
  const tabs = [...document.querySelectorAll("#leaderboard-overlay .leaderboard-tab")];
  tabs.forEach((tab, index) => {
    tab.addEventListener("click", () => setActiveTab(tab.dataset.panel));
    // Arrow keys move between tabs (standard tablist behaviour).
    tab.addEventListener("keydown", (event) => {
      const step = { ArrowRight: 1, ArrowLeft: -1 }[event.key];
      if (!step) return;
      const next = tabs[(index + step + tabs.length) % tabs.length];
      setActiveTab(next.dataset.panel);
      next.focus();
    });
  });
}
