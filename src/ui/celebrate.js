// Full-screen celebration cards and confetti. Purely decorative: never throws.
import { state } from "../state.js";

const reducedMotion = () => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;

export function fireConfetti(options) {
  if (reducedMotion() || typeof window.confetti !== "function") return;
  try {
    window.confetti(options);
  } catch {
    // Decorative only.
  }
}

/**
 * Shows a celebration card for `durationMs`, then fades it out.
 * `blocking` cards stop the summary buttons from being used until they finish.
 */
export function showCelebration({ id, icon, title, subtitle, highlight, durationMs = 3000, blocking = false }) {
  document.getElementById(id)?.remove();
  const overlay = document.createElement("div");
  overlay.id = id;
  overlay.className = `celebration${blocking ? "" : " is-passive"}`;
  overlay.setAttribute("role", "status");
  overlay.innerHTML = `
    <div class="celebration-card">
      ${icon ? `<div class="celebration-icon" aria-hidden="true">${icon}</div>` : ""}
      <h2 class="celebration-title"></h2>
      <p class="celebration-subtitle"></p>
      ${highlight ? '<p class="celebration-highlight"></p>' : ""}
    </div>`;
  overlay.querySelector(".celebration-title").textContent = title;
  overlay.querySelector(".celebration-subtitle").textContent = subtitle;
  if (highlight) overlay.querySelector(".celebration-highlight").textContent = highlight;
  document.body.appendChild(overlay);

  if (blocking) state.celebrationActive = true;
  requestAnimationFrame(() => overlay.classList.add("is-visible"));
  setTimeout(() => {
    overlay.classList.remove("is-visible");
    setTimeout(() => {
      overlay.remove();
      if (blocking) state.celebrationActive = false;
    }, 800);
  }, durationMs);
}

export function celebrateHighScore(score) {
  if (state.celebrationActive) return;
  showCelebration({ id: "highscore-celebration", title: "Great!", subtitle: "New High Score Achieved!", highlight: `${score} points`, blocking: true });
  const burst = { particleCount: 120, spread: 80, startVelocity: 45, origin: { y: 0.6 } };
  fireConfetti(burst);
  setTimeout(() => fireConfetti({ ...burst, particleCount: 100, colors: ["#4CAF50", "#FFCA28", "#2196F3", "#F44336", "#9C27B0"] }), 400);
  setTimeout(() => fireConfetti({ particleCount: 150, spread: 100, origin: { y: 0.4 } }), 900);
}

export function celebrateLevel(level) {
  showCelebration({ id: "level-celebration", title: "Level Up!", subtitle: "You achieved a new level!", highlight: `Level ${level}` });
}

export function celebrateDailyCompletion() {
  showCelebration({
    id: "daily-completion-celebration",
    icon: "🏅",
    title: "Daily Challenge Complete!",
    subtitle: "Great job! Your daily result has been recorded.",
    durationMs: 2200,
  });
}
