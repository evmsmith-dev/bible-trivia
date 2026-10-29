// Players: level display, the Home/Summary player cards, the "Who's playing?" page and the
// Edit player sheet (which also adds and deletes players).
import { AVATARS, PLAYER_NAME } from "../config.js";
import { createDefaultProfile, getAvatar, sanitizeDailyStats, sanitizePlayerName, sanitizePlayerStats } from "../lib/records.js";
import { getLevel, getLevelProgress } from "../lib/scoring.js";
import { escapeHtml } from "../lib/utils.js";
import { state } from "../state.js";
import {
  canAddPlayer, createPlayer, deletePlayer, getActivePlayerId, listPlayers, readProfile, resetAll, save, saveProfile,
  switchPlayer, writeProfile,
} from "../storage/store.js";
import { byId } from "../ui/dom.js";
import { closeOverlay, isOverlayOpen, openOverlay } from "../ui/overlay.js";

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
  const progress = getLevelProgress(profile.nonDailyCorrectAnswers);

  // Home: avatar (top right), "Hi, <name>!", and the level bar under the greeting.
  byId("player-entry-avatar").innerHTML = avatarHtml(avatar);
  byId("player-entry-btn").setAttribute("aria-label", `${profile.name}: choose who's playing`);
  byId("player-entry-name").textContent = profile.name;
  byId("player-entry-level").textContent = level;
  byId("home-level-fill").style.width = `${progress.percent}%`;
  byId("home-level-to-go").textContent = progress.isMaxLevel ? "Top level!" : `${progress.remaining} to go`;
}

// ---------- Who's playing? ----------

let onPlayerChanged = () => {};

function renderPlayerChooser() {
  const activeId = getActivePlayerId();
  const cards = listPlayers().map(({ id, profile }) => {
    const active = id === activeId;
    const name = escapeHtml(profile.name);
    return `
      <div class="player-tile${active ? " is-active" : ""}">
        <button type="button" class="player-pick" data-player-id="${id}" aria-pressed="${active}"
                aria-label="${name}, Level ${getLevel(profile.nonDailyCorrectAnswers)}${active ? ", playing now" : ""}">
          <span class="player-tile-avatar" aria-hidden="true">${avatarHtml(getAvatar(profile.avatarId))}</span>
          <span class="player-tile-name">${name}</span>
          <span class="player-tile-level">Level ${getLevel(profile.nonDailyCorrectAnswers)}</span>
        </button>
        <button type="button" class="player-edit" data-edit-id="${id}" aria-label="Edit ${name}" title="Edit">✏️</button>
      </div>`;
  });
  if (canAddPlayer()) {
    cards.push(`
      <button type="button" class="player-tile player-add" id="player-add-btn">
        <span class="player-tile-avatar" aria-hidden="true">+</span>
        <span class="player-tile-name">Add player</span>
      </button>`);
  }
  byId("player-cards").innerHTML = cards.join("");
}

/** The page behind the avatar on Home. At launch it opens on its own when 2+ people play here. */
export function openWhosPlaying() {
  if (state.celebrationActive || state.game.active) return;
  renderPlayerChooser();
  openOverlay("players-page", { initialFocus: ".player-tile.is-active .player-pick" });
}

async function choosePlayer(id) {
  if (id !== getActivePlayerId()) {
    saveProfile(state.profile); // keep the current player's latest level count
    onPlayerChanged(await switchPlayer(id));
  }
  closeOverlay("players-page");
}

// ---------- Edit player sheet ----------
// Edits any player (or adds a new one). Name and picture changes are kept in the sheet until
// Save; ✕, the backdrop, Escape or the phone's Back gesture close it without saving.

let draftAvatarId = null;
let editingId = null; // null while adding a new player

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

const editingActive = () => editingId === getActivePlayerId();
const profileFor = (id) => (id === getActivePlayerId() ? state.profile : readProfile(id));

function renderPlayerSheet() {
  const adding = editingId === null;
  const profile = adding ? null : profileFor(editingId);
  byId("player-sheet-title").textContent = adding ? "New player" : "Edit player";
  byId("player-level-card").style.display = adding ? "none" : "";
  if (!adding) {
    const progress = getLevelProgress(profile.nonDailyCorrectAnswers);
    byId("player-level-display").textContent = `Level ${progress.level}`;
    byId("player-level-progress-fill").style.width = `${progress.percent}%`;
    byId("player-level-progress-text").textContent = progress.isMaxLevel
      ? "Top level reached!"
      : `${progress.remaining} more right answers to Level ${progress.level + 1}`;
  }
  byId("player-name-input").value = adding ? "" : profile.name;
  byId("player-name-input").placeholder = adding ? "Your name" : "";
  byId("player-name-error").textContent = "";
  const others = listPlayers().length > 1;
  byId("player-delete-btn").style.display = !adding && others ? "" : "none";
  byId("player-reset-btn").style.display = !adding && !others ? "" : "none";
  byId("player-save-btn").textContent = adding ? "Add" : "Save";
  draftAvatarId = adding ? AVATARS[listPlayers().length % AVATARS.length].id : profile.avatarId;
  renderAvatarPicker();
}

/** Opens the sheet for a player (the active one by default), or for a new player with `id: null`. */
export function openPlayerSheet({ id = getActivePlayerId() } = {}) {
  if (state.celebrationActive) return;
  editingId = id;
  renderPlayerSheet();
  // Focus the title, not the name box, so a phone's keyboard only opens when the name is tapped.
  openOverlay("player-sheet", { initialFocus: "#player-sheet-title" });
  document.querySelector("#player-sheet .sheet").scrollTop = 0; // start at the top on phones
}

function refreshAfterEdit() {
  renderPlayerCards();
  if (isOverlayOpen("players-page")) renderPlayerChooser();
}

async function savePlayer() {
  const name = sanitizePlayerName(byId("player-name-input").value);
  if (!name) {
    byId("player-name-error").textContent = `Names need ${PLAYER_NAME.min} to ${PLAYER_NAME.max} letters.`;
    byId("player-name-input").focus();
    return;
  }
  if (editingId === null) {
    // New player: add them and start playing as them.
    const id = createPlayer({ name, avatarId: draftAvatarId });
    if (!id) return;
    closeOverlay("player-sheet");
    await choosePlayer(id);
    return;
  }
  if (editingActive()) {
    Object.assign(state.profile, { name, avatarId: draftAvatarId });
    saveProfile(state.profile);
  } else {
    writeProfile(editingId, { ...readProfile(editingId), name, avatarId: draftAvatarId });
  }
  closeOverlay("player-sheet");
  refreshAfterEdit();
}

async function removePlayer() {
  const id = editingId;
  const { name } = profileFor(id);
  if (!confirm(`Delete ${name}? Their level, scores, history and Daily Challenge progress will be removed from this device.`)) return;
  if (id === getActivePlayerId()) {
    // Someone else becomes the player before this one is removed.
    const next = listPlayers().find((player) => player.id !== id);
    onPlayerChanged(await switchPlayer(next.id));
  }
  await deletePlayer(id);
  closeOverlay("player-sheet");
  refreshAfterEdit();
}

async function resetPlayer() {
  if (!confirm(`Reset ${state.profile.name}? This clears their level, scores, history and Daily Challenge progress.`)) return;
  const { id, name, avatarId } = state.profile;
  Object.assign(state, {
    profile: { ...createDefaultProfile(id), name, avatarId },
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
  closeOverlay("player-sheet");
  onPlayerChanged(await switchPlayer(id));
}

export function initPlayer({ onPlayerChanged: handler }) {
  onPlayerChanged = handler;
  byId("player-entry-btn").addEventListener("click", openWhosPlaying);
  byId("player-cards").addEventListener("click", (event) => {
    const edit = event.target.closest("[data-edit-id]");
    if (edit) return openPlayerSheet({ id: edit.dataset.editId });
    if (event.target.closest("#player-add-btn")) return openPlayerSheet({ id: null });
    const pick = event.target.closest("[data-player-id]");
    if (pick) choosePlayer(pick.dataset.playerId);
    return undefined;
  });
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
  byId("player-delete-btn").addEventListener("click", removePlayer);
  byId("player-reset-btn").addEventListener("click", resetPlayer);
}
