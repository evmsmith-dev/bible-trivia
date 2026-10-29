// Player: level display, the Home/Summary player cards, and the Edit player sheet.
import { AVATARS, PLAYER_NAME } from "../config.js";
import { createDefaultProfile, getAvatar, sanitizeDailyStats, sanitizePlayerName, sanitizePlayerStats } from "../lib/records.js";
import { getLevel, getLevelProgress } from "../lib/scoring.js";
import { escapeHtml } from "../lib/utils.js";
import { state } from "../state.js";
import { resetAll, save, saveProfile } from "../storage/store.js";
import { byId } from "../ui/dom.js";
import { closeOverlay, openOverlay } from "../ui/overlay.js";

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

// ---------- Edit player sheet ----------
// Name and picture changes are kept in the sheet until Save; ✕, the backdrop, Escape or
// the phone's Back gesture close it without saving.

let draftAvatarId = null;

function renderAvatarPicker() {
  byId("player-avatar-options").innerHTML = AVATARS.map((avatar, index) => {
    const selected = avatar.id === draftAvatarId;
    return `
      <button type="button" class="avatar-option tint-${index % 8}${selected ? " is-selected" : ""}" data-avatar-id="${escapeHtml(avatar.id)}"
              role="radio" aria-checked="${selected}" aria-label="${escapeHtml(avatar.label)}" title="${escapeHtml(avatar.label)}">
        ${avatarHtml(avatar)}
      </button>`;
  }).join("");
  byId("player-sheet-avatar").innerHTML = avatarHtml(getAvatar(draftAvatarId));
}

function renderPlayerSheet() {
  const progress = getLevelProgress(state.profile.nonDailyCorrectAnswers);
  byId("player-level-display").textContent = `Level ${progress.level}`;
  byId("player-level-progress-fill").style.width = `${progress.percent}%`;
  byId("player-level-progress-text").textContent = progress.isMaxLevel
    ? "Top level reached!"
    : `${progress.remaining} more right answers to Level ${progress.level + 1}`;
  byId("player-name-input").value = state.profile.name;
  byId("player-name-error").textContent = "";
  draftAvatarId = state.profile.avatarId;
  renderAvatarPicker();
}

export function openPlayerSheet() {
  if (state.celebrationActive) return;
  renderPlayerSheet();
  openOverlay("player-sheet", { initialFocus: "#player-name-input" });
  // Start at the top on phones, where the sheet can scroll.
  document.querySelector("#player-sheet .sheet").scrollTop = 0;
}

function savePlayer() {
  const name = sanitizePlayerName(byId("player-name-input").value);
  if (!name) {
    byId("player-name-error").textContent = `Names need ${PLAYER_NAME.min} to ${PLAYER_NAME.max} letters.`;
    byId("player-name-input").focus();
    return;
  }
  state.profile.name = name;
  state.profile.avatarId = draftAvatarId;
  saveProfile(state.profile);
  renderPlayerCards();
  closeOverlay("player-sheet");
}

async function resetPlayer(onReset) {
  if (!confirm(`Reset ${state.profile.name}? This clears their level, scores, history and Daily Challenge progress.`)) return;
  Object.assign(state, {
    profile: createDefaultProfile(),
    history: [],
    highScores: [],
    playerStats: sanitizePlayerStats(null),
    dailyStats: sanitizeDailyStats(null),
    dailyChallenges: {},
    recentQuestionIds: [],
    difficultyMode: "medium",
    bonusStreak: 0,
  });
  saveProfile(state.profile);
  await resetAll();
  await save({ settings: { difficultyMode: "medium" } });
  renderPlayerCards();
  closeOverlay("player-sheet");
  onReset?.();
}

export function initPlayer({ onReset }) {
  byId("player-entry-btn").addEventListener("click", openPlayerSheet);
  byId("player-form").addEventListener("submit", (event) => {
    event.preventDefault();
    savePlayer();
  });
  byId("player-name-input").addEventListener("input", () => { byId("player-name-error").textContent = ""; });
  byId("player-avatar-options").addEventListener("click", (event) => {
    const option = event.target.closest("[data-avatar-id]");
    if (!option) return;
    draftAvatarId = option.dataset.avatarId;
    renderAvatarPicker();
    byId("player-avatar-options").querySelector(`[data-avatar-id="${CSS.escape(draftAvatarId)}"]`)?.focus();
  });
  byId("player-reset-btn").addEventListener("click", () => resetPlayer(onReset));
}
