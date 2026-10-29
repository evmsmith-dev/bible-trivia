// Settings overlay (appearance, vibration), the difficulty picker behind the "🟠 Medium ▾"
// buttons, and the How to Play overlay. Difficulty options are generated from config.MODES.
import { MODES, MODE_KEYS } from "../config.js";
import { normalizeMode } from "../lib/records.js";
import { state } from "../state.js";
import { save } from "../storage/store.js";
import { byId, setVisible } from "../ui/dom.js";
import { canVibrate, isVibrationOn, setVibrationOn, vibrate, VIBRATION } from "../ui/haptics.js";
import { getThemePreference, setThemePreference } from "../ui/theme.js";
import { closeOverlay, openOverlay } from "../ui/overlay.js";

function renderSettings() {
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

/** The "🟠 Medium ▾" buttons (under Start on Home, above Play on the summary): show the current mode and open the picker. */
export function renderModeChip() {
  const m = MODES[normalizeMode(state.difficultyMode)];
  document.querySelectorAll(".mode-chip").forEach((chip) => {
    chip.textContent = `${m.emoji} ${m.label} ▾`;
    chip.setAttribute("aria-label", `Difficulty mode: ${m.label}. Change difficulty`);
  });
}

export function openSettings() {
  renderSettings();
  openOverlay("settings-overlay", { initialFocus: ".theme-btn.active" });
}

// ---------- difficulty picker ----------

function renderDifficultyOptions() {
  const current = normalizeMode(state.difficultyMode);
  byId("difficulty-options").innerHTML = MODE_KEYS.map((mode) => {
    const m = MODES[mode];
    const selected = mode === current;
    return `
      <button type="button" class="difficulty-option${selected ? " is-selected" : ""}" data-mode="${mode}"
              role="radio" aria-checked="${selected}">
        <span class="difficulty-option-emoji" aria-hidden="true">${m.emoji}</span>
        <span class="difficulty-option-text">
          <span class="difficulty-option-name">${m.label}${m.tagline ? ` <span class="difficulty-option-tagline">${m.tagline}</span>` : ""}</span>
          <span class="difficulty-option-detail">${m.questionsText} · ${m.basePoints} pts · ${m.seconds} sec</span>
        </span>
        <span class="difficulty-option-check" aria-hidden="true">${selected ? "✓" : ""}</span>
      </button>`;
  }).join("");
}

/** Opened by the "🟠 Medium ▾" buttons. Tapping a mode chooses it and closes the picker. */
export function openDifficultyPicker() {
  renderDifficultyOptions();
  openOverlay("difficulty-sheet", { initialFocus: ".difficulty-option.is-selected" });
}

function chooseDifficulty(mode) {
  state.difficultyMode = normalizeMode(mode);
  save({ settings: { difficultyMode: state.difficultyMode } });
  renderModeChip();
  closeOverlay("difficulty-sheet");
}

function renderHowToPlay() {
  byId("howto-mode-list").innerHTML = MODE_KEYS.map((mode) => {
    const m = MODES[mode];
    return `<li>${m.emoji} ${m.label}: ${m.basePoints} pts/question, ${m.seconds} seconds${m.tagline ? ` - ${m.tagline}` : "."}</li>`;
  }).join("");
}

export function initSettings() {
  byId("difficulty-options").addEventListener("click", (event) => {
    const option = event.target.closest(".difficulty-option");
    if (option) chooseDifficulty(option.dataset.mode);
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

  byId("mode-chip").addEventListener("click", openDifficultyPicker);
  byId("home-settings-btn").addEventListener("click", openSettings);
  renderModeChip();

  renderHowToPlay();
  byId("how-to-play-link").addEventListener("click", () => {
    document.querySelectorAll("#how-to-play-overlay .howto-section").forEach((section) => section.removeAttribute("open"));
    openOverlay("how-to-play-overlay");
  });
}
