// App entry point: load questions and saved data, wire up the screens, register the service worker.
import { reconcileLevelCounter } from "./lib/records.js";
import { state, applySnapshot } from "./state.js";
import { initStore, listPlayers, loadAll, loadRecentQuestionIds, moveDeviceSettings, saveProfile } from "./storage/store.js";
import { byId, showScreen } from "./ui/dom.js";
import { initOverlays } from "./ui/overlay.js";
import { registerServiceWorker } from "./ui/update-banner.js";
import { initDaily, renderDailyCard } from "./features/daily.js";
import { initPlayer, openWhosPlaying, renderPlayerCards } from "./features/player.js";
import { initSettings, renderModeChip } from "./features/settings.js";
import { initTheme } from "./ui/theme.js";
import { initStats } from "./features/stats.js";
import { initGame, startDailyGame } from "./game.js";

async function loadQuestions() {
  const response = await fetch("data/questions.json");
  if (!response.ok) throw new Error(`Questions failed to load (${response.status})`);
  const questions = await response.json();
  state.questions = questions;
  state.questionsById = new Map(questions.map((question) => [question.id, question]));
  // Shown in How to Play, rounded down to the nearest 50 (e.g. "750+").
  const countEl = byId("question-count");
  if (countEl) countEl.textContent = `${Math.floor(questions.length / 50) * 50}+`;
}

/** Puts a player's saved data into the app (at startup, and when someone else starts playing). */
function activatePlayer(snapshot) {
  applySnapshot(snapshot);
  state.recentQuestionIds = loadRecentQuestionIds();
  state.profile = reconcileLevelCounter(state.profile, state.history);
  state.bonusStreak = 0;
  saveProfile(state.profile);
  renderPlayerCards();
  renderModeChip();
  renderDailyCard();
}

async function start() {
  moveDeviceSettings();
  initTheme();
  initOverlays();
  initGame();
  initSettings();
  initStats();
  initPlayer({ onPlayerChanged: activatePlayer });

  const [snapshot] = await Promise.all([initStore().then(loadAll), loadQuestions()]);
  initDaily({ startDaily: startDailyGame });
  activatePlayer(snapshot);
  showScreen("welcome");
  document.body.classList.add("is-ready");

  // When more than one person plays on this device, ask who's playing at launch.
  if (listPlayers().length > 1) openWhosPlaying({ atLaunch: true });

  addEventListener("pagehide", () => saveProfile(state.profile));
  addEventListener("pageshow", renderPlayerCards); // refresh when restored from the back/forward cache
  registerServiceWorker();
}

start().catch((error) => {
  console.error(error);
  byId("welcome").insertAdjacentHTML("beforeend",
    '<p class="load-error" role="alert">Sorry, the game could not load. Please check your connection and refresh.</p>');
});
