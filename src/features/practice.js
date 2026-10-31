// Home's Practice card, the Practice setting, and clearing a practice list.
// Practice rounds themselves run in game.js (GAME_MODE_PRACTICE).
import { practiceQuestions } from "../lib/practice.js";
import { state } from "../state.js";
import { DEVICE_KEYS, getActivePlayerId, readLocal, writeLocal, writePractice } from "../storage/store.js";
import { byId } from "../ui/dom.js";
import { showToast } from "../ui/toast.js";

/** Practice is on unless turned off in Settings (a device setting, like Appearance). */
export const isPracticeOn = () => readLocal(DEVICE_KEYS.practice) !== "off";

export function setPracticeOn(on) {
  writeLocal(DEVICE_KEYS.practice, on ? "on" : "off");
  renderPracticeCard();
}

export const practiceCount = () => practiceQuestions(state.practice, state.questionsById).length;

/** Empties a player's practice list (the active player's unless another id is given). */
export function clearPractice(id = getActivePlayerId()) {
  writePractice({}, id);
  if (id === getActivePlayerId()) state.practice = {};
  renderPracticeCard();
}

export function renderPracticeCard() {
  const card = byId("practice-link");
  card.hidden = !isPracticeOn();
  const count = practiceCount();
  card.classList.toggle("is-empty", count === 0);
  byId("practice-card-count").textContent = count ? String(count) : "";
  byId("practice-card-status").textContent = count
    ? `${count === 1 ? "1 question" : `${count} questions`} you missed · no timer`
    : "Questions you miss will show up here";
  card.setAttribute("aria-label", count
    ? `Practice: ${count} ${count === 1 ? "question" : "questions"} you missed. Start`
    : "Practice: nothing to practise yet");
}

export function initPractice({ startPractice }) {
  byId("practice-link").addEventListener("click", () => {
    if (state.celebrationActive) return;
    if (!practiceCount()) {
      showToast("Nothing to practise yet. Questions you get wrong in a round will show up here.");
      return;
    }
    startPractice();
  });
}
