// Settings overlay (difficulty mode, appearance, vibration), the Home mode button, and the How to Play overlay.
// Mode buttons and descriptions are generated from config.MODES.
import { MODES, MODE_KEYS } from "../config.js";
import { normalizeMode } from "../lib/records.js";
import { state } from "../state.js";
import { save } from "../storage/store.js";
import { byId, setVisible } from "../ui/dom.js";
import { canVibrate, isVibrationOn, setVibrationOn, vibrate, VIBRATION } from "../ui/haptics.js";
import { getThemePreference, setThemePreference } from "../ui/theme.js";
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
  const theme = getThemePreference();
  document.querySelectorAll(".theme-btn").forEach((button) => {
    const active = button.dataset.value === theme;
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", String(active));
  });
  setVisible(byId("vibration-setting"), canVibrate());
  const vibrationValue = isVibrationOn() ? "on" : "off";
  document.querySelectorAll(".vibration-btn").forEach((button) => {
    const active = button.dataset.value === vibrationValue;
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", String(active));
  });
}

/** The "🟠 Medium ▾" button under Start: shows the current mode and opens Settings. */
export function renderModeChip() {
  const chip = byId("mode-chip");
  if (!chip) return;
  const m = MODES[normalizeMode(state.difficultyMode)];
  chip.textContent = `${m.emoji} ${m.label} ▾`;
  chip.setAttribute("aria-label", `Difficulty mode: ${m.label}. Change difficulty`);
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
    renderModeChip();
    save({ settings: { difficultyMode: state.difficultyMode } });
  });

  document.querySelectorAll(".theme-btn").forEach((button) => {
    button.addEventListener("click", () => {
      setThemePreference(button.dataset.value);
      renderSettings();
    });
  });

  document.querySelectorAll(".vibration-btn").forEach((button) => {
    button.addEventListener("click", () => {
      setVibrationOn(button.dataset.value === "on");
      renderSettings();
      vibrate(VIBRATION.correct); // a sample buzz when turned on
    });
  });

  byId("mode-chip").addEventListener("click", openSettings);
  renderModeChip();

  renderHowToPlay();
  byId("how-to-play-link").addEventListener("click", () => {
    document.querySelectorAll("#how-to-play-overlay .howto-section").forEach((section) => section.removeAttribute("open"));
    openOverlay("how-to-play-overlay");
  });
}
