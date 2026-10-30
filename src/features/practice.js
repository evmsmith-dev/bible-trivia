// Home's Practice card. Practice rounds themselves run in game.js (GAME_MODE_PRACTICE).
import { practiceQuestions } from "../lib/practice.js";
import { state } from "../state.js";
import { byId } from "../ui/dom.js";
import { showToast } from "../ui/toast.js";

export const practiceCount = () => practiceQuestions(state.practice, state.questionsById).length;

export function renderPracticeCard() {
  const count = practiceCount();
  const card = byId("practice-link");
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
