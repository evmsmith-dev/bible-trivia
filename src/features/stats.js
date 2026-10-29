// Scores page. "Me": level and overview, top scores per mode, recent games, right answers by
// category, and Daily Challenge results. "Everyone" (when 2+ people play on this device):
// everyone's best score in a mode, ranked. A full page with a back button (Android's Back
// gesture closes it too; see ui/overlay.js).
import { CATEGORIES, CATEGORY_EMOJIS, MODES, MODE_KEYS } from "../config.js";
import { getAvatar, getAverageCorrectSeconds, getTopScores, normalizeMode, sanitizeDailyRecord } from "../lib/records.js";
import { getLevel, getLevelProgress } from "../lib/scoring.js";
import { escapeHtml } from "../lib/utils.js";
import { state } from "../state.js";
import { getActivePlayerId, listPlayers, loadPlayerSnapshot, readBadges } from "../storage/store.js";
import { avatarHtml } from "./player.js";
import { badgesSectionHtml, countEarned } from "./badges.js";
import { byId } from "../ui/dom.js";
import { openOverlay } from "../ui/overlay.js";

const RECENT_GAMES = 10;
const RECENT_DAILY = 7;
const MEDALS = ["🥇", "🥈", "🥉"];

let selectedMode = null;
let view = "me"; // "me" | "everyone"
let everyone = null; // [{ id, profile, highScores, games }] while the page is open

const number = (value) => Number(value || 0).toLocaleString();
const modeLabel = (mode) => `${MODES[mode]?.emoji || ""} ${MODES[mode]?.label || "Unknown"}`.trim();

/** "Oct 29" (and "Oct 29, 2025" for other years). Older saved records may not be ISO dates. */
function shortDate(timestamp, { withTime = false } = {}) {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return escapeHtml(String(timestamp ?? ""));
  const options = { month: "short", day: "numeric" };
  if (date.getFullYear() !== new Date().getFullYear()) options.year = "numeric";
  if (withTime) Object.assign(options, { hour: "numeric", minute: "2-digit" });
  return escapeHtml(date.toLocaleString(undefined, options));
}

function dateKeyLabel(dateKey) {
  const [year, month, day] = String(dateKey).split("-").map(Number);
  return year && month && day ? shortDate(new Date(year, month - 1, day)) : escapeHtml(String(dateKey));
}

const card = (label, value, detail = "") => `
  <div class="stat-card">
    <span class="stat-label">${label}</span>
    <span class="stat-value">${value}</span>
    ${detail ? `<span class="stat-detail">${detail}</span>` : ""}
  </div>`;

function overviewHtml() {
  const { history, playerStats, dailyStats, profile } = state;
  const progress = getLevelProgress(profile.nonDailyCorrectAnswers);
  const asked = history.reduce((sum, game) => sum + (game.total || 0), 0);
  const right = history.reduce((sum, game) => sum + (game.correct || 0), 0);
  const accuracy = asked ? `${Math.round((right / asked) * 100)}%` : "–";
  return `
    <section class="scores-section" aria-labelledby="scores-level-title">
      <div class="level-card">
        <div>
          <h3 id="scores-level-title" class="level-title">Level ${progress.level}</h3>
          <p class="level-detail">${progress.isMaxLevel ? "Top level reached!" : `${progress.remaining} more right answers to Level ${progress.level + 1}`}</p>
        </div>
        <div class="level-track" role="progressbar" aria-label="Progress to the next level"
             aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(progress.percent)}">
          <div class="level-fill" style="width:${progress.percent}%"></div>
        </div>
      </div>
      <div class="stat-cards">
        ${card("Games played", number(history.length))}
        ${card("Accuracy", accuracy, asked ? `${number(right)} of ${number(asked)} right` : "")}
        ${card("Best streak", number(playerStats.allTimeBestStreak), "right answers in a row")}
        ${card("Daily streak", `${number(dailyStats.currentDailyStreak)} 🔥`, `Best: ${number(dailyStats.bestDailyStreak)} days`)}
      </div>
    </section>`;
}

function topScoresHtml() {
  const mode = selectedMode;
  const scores = getTopScores(state.highScores, mode);
  const average = getAverageCorrectSeconds(state.playerStats, mode);
  const rows = scores.length
    ? `<ol class="score-list">${scores.map((score, index) => `
        <li class="score-row">
          <span class="score-rank" aria-label="Rank ${index + 1}">${MEDALS[index] || index + 1}</span>
          <span class="score-points">${number(score.score)}</span>
          <span class="score-meta">${score.correct}/${score.total} · ${shortDate(score.timestamp)}</span>
        </li>`).join("")}</ol>`
    : `<p class="scores-empty">No ${MODES[mode].label} scores yet. Play a ${MODES[mode].label} round to set one.</p>`;
  return `
    <section class="scores-section" aria-labelledby="scores-top-title">
      <h3 id="scores-top-title" class="scores-heading">Top scores</h3>
      ${modeSwitchHtml(mode)}
      ${rows}
      <p class="scores-note">${average === null
        ? `Average answer time appears after your first right answer in ${MODES[mode].label}.`
        : `Average time for a right answer: <strong>${average}s</strong> · ${number(state.playerStats.correctCountByMode[mode])} right answers`}</p>
    </section>`;
}

function recentGamesHtml() {
  const games = state.history.slice(-RECENT_GAMES).reverse();
  const body = games.length
    ? `<ul class="game-list">${games.map((game) => `
        <li class="game-row">
          <span class="game-date">${shortDate(game.timestamp, { withTime: true })}</span>
          <span class="game-mode">${modeLabel(normalizeMode(game.difficultyMode))}</span>
          <span class="game-result">${game.correct}/${game.total}</span>
          <span class="game-score">${number(game.score)}</span>
        </li>`).join("")}</ul>`
    : '<p class="scores-empty">No games yet. Your last 10 rounds will show here.</p>';
  return `
    <section class="scores-section" aria-labelledby="scores-recent-title">
      <h3 id="scores-recent-title" class="scores-heading">Recent games</h3>
      ${body}
    </section>`;
}

function categoriesHtml() {
  const counts = state.playerStats.correctByCategory;
  const total = CATEGORIES.reduce((sum, category) => sum + counts[category], 0);
  const most = Math.max(1, ...CATEGORIES.map((category) => counts[category]));
  const body = total
    ? CATEGORIES.map((category) => `
        <div class="category-row">
          <span class="category-name">${CATEGORY_EMOJIS[category] || ""} ${category}</span>
          <span class="category-count">${number(counts[category])}</span>
          <div class="category-track" aria-hidden="true"><div class="category-fill" style="width:${(counts[category] / most) * 100}%"></div></div>
        </div>`).join("")
    : '<p class="scores-empty">Right answers will be counted here by category.</p>';
  return `
    <section class="scores-section" aria-labelledby="scores-category-title">
      <h3 id="scores-category-title" class="scores-heading">Right answers by category</h3>
      ${body}
    </section>`;
}

function dailyHtml() {
  const records = Object.values(state.dailyChallenges).map(sanitizeDailyRecord)
    .filter((record) => record.attempts > 0 || record.completed) // only days that were played
    .sort((a, b) => b.dateKey.localeCompare(a.dateKey));
  const completed = records.filter((record) => record.completed).length;
  const list = records.length
    ? `<ul class="game-list">${records.slice(0, RECENT_DAILY).map((record) => `
        <li class="game-row daily-row">
          <span class="game-date">${dateKeyLabel(record.dateKey)}</span>
          <span class="game-mode">${record.completed ? "✅ Completed" : "Not completed"}</span>
          <span class="game-score">${number(record.bestScore)}</span>
        </li>`).join("")}</ul>`
    : '<p class="scores-empty">No Daily Challenges yet. A new one is ready every day.</p>';
  return `
    <section class="scores-section" aria-labelledby="scores-daily-title">
      <h3 id="scores-daily-title" class="scores-heading">Daily Challenge</h3>
      <div class="stat-cards">
        ${card("Days completed", number(completed))}
        ${card("Attempts", number(state.dailyStats.totalDailyAttempts))}
      </div>
      ${list}
    </section>`;
}

function modeSwitchHtml(mode) {
  return `
      <div class="mode-switch" role="group" aria-label="Difficulty mode">
        ${MODE_KEYS.map((key) => `
          <button type="button" class="mode-switch-btn${key === mode ? " active" : ""}" data-mode="${key}" aria-pressed="${key === mode}">
            <span aria-hidden="true">${MODES[key].emoji}</span> ${MODES[key].shortLabel}
          </button>`).join("")}
      </div>`;
}

function everyoneHtml() {
  const mode = selectedMode;
  if (!everyone) return '<section class="scores-section"><p class="scores-empty">Loading everyone’s scores…</p></section>';
  const activeId = getActivePlayerId();
  const ranked = everyone
    .map((player) => ({ ...player, best: getTopScores(player.highScores, mode, 1)[0] || null }))
    .sort((a, b) => (b.best?.score ?? -1) - (a.best?.score ?? -1) || a.profile.name.localeCompare(b.profile.name));
  const rows = ranked.map((player, index) => `
      <li class="everyone-row${player.id === activeId ? " is-me" : ""}">
        <span class="score-rank" aria-label="${player.best ? `Rank ${index + 1}` : "No score yet"}">${player.best ? MEDALS[index] || index + 1 : "–"}</span>
        <span class="everyone-avatar" aria-hidden="true">${avatarHtml(getAvatar(player.profile.avatarId))}</span>
        <span class="everyone-name">
          <strong>${escapeHtml(player.profile.name)}${player.id === activeId ? " (you)" : ""}</strong>
          <span class="everyone-meta">Level ${getLevel(player.profile.nonDailyCorrectAnswers)} · ${number(player.games)} ${player.games === 1 ? "game" : "games"} · 🏅 ${number(player.badges)}</span>
        </span>
        <span class="everyone-best">${player.best ? number(player.best.score) : "–"}</span>
      </li>`).join("");
  return `
    <section class="scores-section" aria-labelledby="scores-everyone-title">
      <h3 id="scores-everyone-title" class="scores-heading">Best ${MODES[mode].label} score</h3>
      ${modeSwitchHtml(mode)}
      <ol class="everyone-list">${rows}</ol>
      <p class="scores-note">Everyone who plays on this device. Each player's scores stay their own.</p>
    </section>`;
}

function tabsHtml() {
  if (listPlayers().length < 2) return "";
  return `
    <div class="scores-tabs" role="group" aria-label="Whose scores">
      <button type="button" class="scores-tab${view === "me" ? " active" : ""}" data-view="me" aria-pressed="${view === "me"}">Me</button>
      <button type="button" class="scores-tab${view === "everyone" ? " active" : ""}" data-view="everyone" aria-pressed="${view === "everyone"}">Everyone</button>
    </div>`;
}

function renderScores() {
  const body = view === "everyone"
    ? everyoneHtml()
    : overviewHtml() + badgesSectionHtml() + topScoresHtml() + recentGamesHtml() + categoriesHtml() + dailyHtml();
  byId("scores-content").innerHTML = tabsHtml() + body;
}

async function loadEveryone() {
  const players = listPlayers();
  const snapshots = await Promise.all(players.map((player) => loadPlayerSnapshot(player.id)));
  everyone = players.map((player, index) => ({
    id: player.id,
    profile: player.id === getActivePlayerId() ? state.profile : player.profile,
    highScores: snapshots[index].highScores,
    games: snapshots[index].history.length,
    badges: countEarned(player.id === getActivePlayerId() ? state.badges : readBadges(player.id) || {}),
  }));
  if (view === "everyone") renderScores();
}

/** Opens Scores → Me. `section: "badges"` scrolls to the badges (from the summary's "New badge"). */
export function openStats({ section = null } = {}) {
  selectedMode = normalizeMode(state.difficultyMode);
  view = "me";
  everyone = null;
  renderScores();
  openOverlay("scores-page", { initialFocus: ".page-back" });
  const content = byId("scores-content");
  content.scrollTop = 0;
  if (section === "badges") {
    const target = byId("scores-badges");
    content.scrollTop = target.offsetTop - content.offsetTop - 8;
  }
}

export function initStats() {
  byId("home-scores-btn").addEventListener("click", () => openStats());
  byId("scores-content").addEventListener("click", (event) => {
    const tab = event.target.closest(".scores-tab");
    if (tab && tab.dataset.view !== view) {
      view = tab.dataset.view;
      renderScores();
      if (view === "everyone" && !everyone) loadEveryone();
      document.querySelector(`.scores-tab[data-view="${view}"]`)?.focus();
      return;
    }
    const button = event.target.closest(".mode-switch-btn");
    if (!button || button.dataset.mode === selectedMode) return;
    selectedMode = normalizeMode(button.dataset.mode);
    if (view === "everyone") {
      renderScores();
    } else {
      byId("scores-top-title").closest("section").outerHTML = topScoresHtml();
    }
    document.querySelector(`.mode-switch-btn[data-mode="${selectedMode}"]`)?.focus();
  });
}
