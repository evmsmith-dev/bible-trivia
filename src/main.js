// App entry point: load questions and saved data, wire up the screens, register the service worker.
import { reconcileLevelCounter } from "./lib/records.js";
import { state, applySnapshot } from "./state.js";
import {
  initStore, KEYS, listPlayers, loadAll, loadRecentQuestionIds, moveDeviceSettings, readLocal, saveProfile, writeLocal,
} from "./storage/store.js";
import { byId, showScreen } from "./ui/dom.js";
import { initOverlays } from "./ui/overlay.js";
import { registerServiceWorker } from "./ui/update-banner.js";
import { initDaily, renderDailyCard } from "./features/daily.js";
import { initPlayer, openWhosPlaying, renderPlayerCards } from "./features/player.js";
import { initBackup } from "./features/backup.js";
import { loadBadges } from "./features/badges.js";
import { initSettings, openHowToPlay, renderModeChip } from "./features/settings.js";
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

/** How to Play opens by itself the first time a player uses the app (a new device, or a newly
 *  added player). Players who already have games or right answers have clearly found their way. */
function welcomeNewPlayer() {
  if (readLocal(KEYS.howToPlaySeen)) return;
  writeLocal(KEYS.howToPlaySeen, "1");
  if (state.history.length || state.profile.nonDailyCorrectAnswers) return;
  openHowToPlay({ firstSection: true });
}

/** Puts a player's saved data into the app (at startup, and when someone else starts playing). */
function activatePlayer(snapshot, { welcome = true } = {}) {
  applySnapshot(snapshot);
  state.recentQuestionIds = loadRecentQuestionIds();
  state.profile = reconcileLevelCounter(state.profile, state.history);
  state.bonusStreak = 0;
  saveProfile(state.profile);
  loadBadges();
  renderPlayerCards();
  renderModeChip();
  renderDailyCard();
  if (welcome) welcomeNewPlayer();
}

async function start() {
  moveDeviceSettings();
  initTheme();
  initOverlays();
  initGame();
  initSettings();
  initBackup();
  initStats();
  initPlayer({ onPlayerChanged: activatePlayer });

  const [snapshot] = await Promise.all([initStore().then(loadAll), loadQuestions()]);
  initDaily({ startDaily: startDailyGame });
  // When more than one person plays on this device, ask who's playing at launch (How to Play
  // waits until a new player is picked).
  const askWhosPlaying = listPlayers().length > 1;
  showScreen("welcome");
  activatePlayer(snapshot, { welcome: !askWhosPlaying });
  document.body.classList.add("is-ready");
  if (askWhosPlaying) openWhosPlaying({ atLaunch: true });

  addEventListener("pagehide", () => saveProfile(state.profile));
  addEventListener("pageshow", renderPlayerCards); // refresh when restored from the back/forward cache
  registerServiceWorker();
}

start().catch((error) => {
  console.error(error);
  byId("welcome").insertAdjacentHTML("beforeend",
    '<p class="load-error" role="alert">Sorry, the game could not load. Please check your connection and refresh.</p>');
});
