// Tiny DOM helpers.
export const byId = (id) => document.getElementById(id);

export function setVisible(element, visible, display = "block") {
  if (element) element.style.display = visible ? display : "none";
}

/** Switches between the Welcome screen and the game screen. */
export function showScreen(name) {
  setVisible(byId("welcome"), name === "welcome");
  setVisible(byId("question-container"), name === "game");
}

export const isWelcomeVisible = () => byId("welcome")?.style.display !== "none";

/** Restarts a CSS animation class on an element. */
export function replayAnimation(element, className) {
  if (!element) return;
  element.classList.remove(className);
  void element.offsetWidth; // force reflow so the animation restarts
  element.classList.add(className);
}
