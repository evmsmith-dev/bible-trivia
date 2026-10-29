// Settings overlay (difficulty mode, round review preference) and the How to Play overlay.
// Mode buttons and descriptions are generated from config.MODES.
import { MODES, MODE_KEYS, REVIEW_PREFERENCES } from "../config.js";
import { normalizeMode, normalizeReviewPreference } from "../lib/records.js";
import { state } from "../state.js";
import { save } from "../storage/store.js";
import { byId } from "../ui/dom.js";
import { openOverlay } from "../ui/overlay.js";

const modeSummary = (mode) => {
  const m = MODES[mode];
  return `<b>${m.emoji} ${m.label}:</b> ${m.questionsText} • ${m.basePoints} pts • ${m.seconds} sec • + bonuses${m.tagline ? ` — ${m.tagline}` : ""}`;
};

function renderSettings() {
  document.querySelectorAll(".difficulty-btn").forEach((button) => {
    const active = button.dataset.mode === state.difficultyMode;
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", String(active));
  });
  byId("mode-description").innerHTML = modeSummary(state.difficultyMode);
  document.querySelectorAll(".review-pref-btn").forEach((button) => {
    const active = button.dataset.value === state.roundReviewPreference;
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", String(active));
  });
  byId("review-pref-description").textContent = REVIEW_PREFERENCES[state.roundReviewPreference];
}

export function openSettings() {
  renderSettings();
  openOverlay("settings-overlay", { initialFocus: ".difficulty-btn.active" });
}

function renderHowToPlay() {
  byId("howto-mode-list").innerHTML = MODE_KEYS.map((mode) => {
    const m = MODES[mode];
    return `<li>${m.emoji} ${m.label}: ${m.basePoints} pts/question, ${m.seconds} seconds${m.tagline ? ` - ${m.tagline}` : "."}</li>`;
  }).join("");
}

export function initSettings() {
  byId("difficulty-selector").innerHTML = MODE_KEYS.map((mode) => `
    <button type="button" class="difficulty-btn" data-mode="${mode}" aria-pressed="false">
      <span class="emoji" aria-hidden="true">${MODES[mode].emoji}</span>
      <span class="label">${MODES[mode].shortLabel}</span>
    </button>`).join("");

  byId("difficulty-selector").addEventListener("click", (event) => {
    const button = event.target.closest(".difficulty-btn");
    if (!button) return;
    state.difficultyMode = normalizeMode(button.dataset.mode);
    renderSettings();
    save({ settings: { difficultyMode: state.difficultyMode } });
  });

  document.querySelectorAll(".review-pref-btn").forEach((button) => {
    button.addEventListener("click", () => {
      state.roundReviewPreference = normalizeReviewPreference(button.dataset.value);
      renderSettings();
      save({ settings: { roundReviewPreference: state.roundReviewPreference } });
    });
  });

  renderHowToPlay();
  byId("how-to-play-link").addEventListener("click", () => {
    document.querySelectorAll("#how-to-play-overlay .howto-section").forEach((section) => section.removeAttribute("open"));
    openOverlay("how-to-play-overlay");
  });
}
