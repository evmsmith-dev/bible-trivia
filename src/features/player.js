// Player profile: level display, Welcome/Summary player cards, and the Player overlay.
import { AVATARS, AVATARS_PER_PAGE, PLAYER_NAME } from "../config.js";
import { createDefaultProfile, getAvatar, sanitizeDailyStats, sanitizePlayerName, sanitizePlayerStats } from "../lib/records.js";
import { getLevel, getLevelProgress } from "../lib/scoring.js";
import { escapeHtml } from "../lib/utils.js";
import { state } from "../state.js";
import { resetAll, save, saveProfile } from "../storage/store.js";
import { byId } from "../ui/dom.js";
import { openOverlay } from "../ui/overlay.js";

export const getPlayerLevel = () => getLevel(state.profile.nonDailyCorrectAnswers);

export function avatarHtml(avatar, altText = "") {
  return avatar.type === "image"
    ? `<img src="${escapeHtml(avatar.value)}" alt="${escapeHtml(altText)}"${altText ? "" : ' aria-hidden="true"'}>`
    : `<span>${escapeHtml(avatar.value)}</span>`;
}

/** Updates every place the player's avatar, name and level appear. */
export function renderPlayerCards() {
  const { profile } = state;
  const avatar = getAvatar(profile.avatarId);
  const level = `Level ${getPlayerLevel()}`;

  byId("player-entry-avatar").innerHTML = avatarHtml(avatar);
  byId("player-entry-name").textContent = profile.name;
  byId("player-entry-level").textContent = level;

  const summaryButton = byId("summary-player-btn");
  if (summaryButton) {
    summaryButton.innerHTML = avatarHtml(avatar, `${profile.name} avatar`);
    byId("summary-player-name").textContent = profile.name;
    byId("summary-player-level").textContent = level;
  }
}

// ---------- Player overlay ----------

let avatarPage = 0;
let statusTimer = null;

function showSaveStatus(message, type = "success") {
  const tray = byId("player-save-status");
  tray.textContent = message;
  tray.classList.remove("success", "error", "visible");
  tray.classList.add(type);
  void tray.offsetWidth;
  tray.classList.add("visible");
  clearTimeout(statusTimer);
  statusTimer = setTimeout(() => tray.classList.remove("visible"), 2200);
}

function setNameEditMode(editing) {
  byId("player-name-display-row").style.display = editing ? "none" : "inline-flex";
  byId("player-name-edit-row").style.display = editing ? "flex" : "none";
  byId("player-name-help").style.display = editing ? "block" : "none";
  const input = byId("player-name-input");
  if (editing) {
    input.value = state.profile.name;
    input.focus();
    input.select();
  } else {
    byId("player-name-error").textContent = "";
  }
}

function commitName() {
  const name = sanitizePlayerName(byId("player-name-input").value);
  if (!name) {
    byId("player-name-error").textContent = `Name must be ${PLAYER_NAME.min} to ${PLAYER_NAME.max} characters after trimming spaces.`;
    return;
  }
  if (name !== state.profile.name) {
    state.profile.name = name;
    saveProfile(state.profile);
    showSaveStatus("Name Updated");
  }
  byId("player-name-display").textContent = name;
  renderPlayerCards();
  setNameEditMode(false);
}

function renderAvatarPicker() {
  const totalPages = Math.ceil(AVATARS.length / AVATARS_PER_PAGE);
  avatarPage = Math.min(Math.max(0, avatarPage), totalPages - 1);
  const pageAvatars = AVATARS.slice(avatarPage * AVATARS_PER_PAGE, (avatarPage + 1) * AVATARS_PER_PAGE);

  byId("player-avatar-options").innerHTML = pageAvatars.map((avatar) => {
    const selected = avatar.id === state.profile.avatarId;
    return `
      <button type="button" class="avatar-option${selected ? " is-selected" : ""}" data-avatar-id="${escapeHtml(avatar.id)}"
              role="radio" aria-checked="${selected}" aria-label="Select ${escapeHtml(avatar.label)} avatar">
        <span class="avatar-option-icon" aria-hidden="true">${avatarHtml(avatar)}</span>
        <span class="avatar-option-label">${escapeHtml(avatar.label)}</span>
      </button>`;
  }).join("");

  byId("avatar-page-indicator").textContent = `${avatarPage + 1} / ${totalPages}`;
  byId("avatar-page-prev").disabled = avatarPage <= 0;
  byId("avatar-page-next").disabled = avatarPage >= totalPages - 1;
  byId("player-avatar-preview").innerHTML = avatarHtml(getAvatar(state.profile.avatarId));
}

function selectAvatar(avatarId) {
  if (avatarId === state.profile.avatarId) return;
  state.profile.avatarId = avatarId;
  saveProfile(state.profile);
  renderAvatarPicker();
  renderPlayerCards();
  showSaveStatus("Avatar Updated");
}

function renderPlayerOverlay() {
  const progress = getLevelProgress(state.profile.nonDailyCorrectAnswers);
  byId("player-name-display").textContent = state.profile.name;
  byId("player-level-display").textContent = `Level ${progress.level}`;
  byId("player-level-progress-fill").style.width = `${progress.percent}%`;
  byId("player-level-progress-text").textContent = progress.isMaxLevel
    ? "Max level reached"
    : `${progress.remaining} more correct answers to next level`;
  avatarPage = Math.floor(Math.max(0, AVATARS.findIndex((avatar) => avatar.id === state.profile.avatarId)) / AVATARS_PER_PAGE);
  renderAvatarPicker();
  setNameEditMode(false);
}

export function openPlayerOverlay() {
  if (state.celebrationActive) return;
  renderPlayerOverlay();
  openOverlay("player-overlay", { initialFocus: ".player-close" });
}

async function resetPlayer(onReset) {
  if (!confirm("Reset player profile and clear all saved progress for this player?")) return;
  Object.assign(state, {
    profile: createDefaultProfile(),
    history: [],
    highScores: [],
    playerStats: sanitizePlayerStats(null),
    dailyStats: sanitizeDailyStats(null),
    dailyChallenges: {},
    difficultyMode: "medium",
    roundReviewPreference: "ask",
    bonusStreak: 0,
  });
  saveProfile(state.profile);
  await resetAll();
  await save({ settings: { difficultyMode: "medium", roundReviewPreference: "ask" } });
  renderPlayerOverlay();
  renderPlayerCards();
  onReset?.();
}

export function initPlayer({ openStats, openSettings, onReset }) {
  byId("player-entry-btn").addEventListener("click", openPlayerOverlay);
  byId("player-name-edit-btn").addEventListener("click", () => setNameEditMode(true));
  byId("player-name-confirm-btn").addEventListener("click", commitName);
  byId("player-name-cancel-btn").addEventListener("click", () => setNameEditMode(false));
  byId("player-name-input").addEventListener("input", () => { byId("player-name-error").textContent = ""; });
  byId("player-name-input").addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      commitName();
    } else if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation(); // cancel the edit, don't close the overlay
      setNameEditMode(false);
    }
  });
  byId("player-avatar-options").addEventListener("click", (event) => {
    const option = event.target.closest("[data-avatar-id]");
    if (option) selectAvatar(option.dataset.avatarId);
  });
  byId("avatar-page-prev").addEventListener("click", () => { avatarPage -= 1; renderAvatarPicker(); });
  byId("avatar-page-next").addEventListener("click", () => { avatarPage += 1; renderAvatarPicker(); });
  byId("player-open-leaderboard-btn").addEventListener("click", openStats);
  byId("player-open-settings-btn").addEventListener("click", openSettings);
  byId("player-reset-btn").addEventListener("click", () => resetPlayer(onReset));
}

