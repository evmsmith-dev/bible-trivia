// Modal overlays: open/close, Escape and backdrop to close, focus kept inside the
// top overlay and returned to where it was when the overlay closes.
// Markup: the overlay root has an id; close buttons and backdrops carry `data-overlay-close`.
import { byId } from "./dom.js";

const stack = [];

// Android's back gesture (and the browser's Back button) should close the top overlay,
// not leave the app. Opening a dismissible overlay adds one "guard" history entry; Back
// pops it and closes the overlay. Closing an overlay in the app leaves the guard in place
// for the next overlay to reuse (calling history.back() there would race with opening
// another overlay straight away).
const GUARD = { bibleTriviaOverlay: true };
const onGuard = () => Boolean(history.state?.bibleTriviaOverlay);
function pushGuard() {
  try {
    if (!onGuard()) history.pushState(GUARD, "");
  } catch {
    // history unavailable (e.g. sandboxed frame): overlays still work, Back just won't close them
  }
}
const closeHandlers = new Map();
const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), select, textarea, summary, [tabindex]:not([tabindex="-1"])';

function focusables(overlay) {
  return [...overlay.querySelectorAll(FOCUSABLE)].filter((element) => element.offsetParent !== null);
}

export function isOverlayOpen(id) {
  return stack.some((entry) => entry.id === id);
}

/** Opens an overlay. `dismissible: false` disables Escape/backdrop (used for required choices). */
export function openOverlay(id, { onClose, dismissible = true, initialFocus } = {}) {
  const overlay = byId(id);
  if (!overlay || isOverlayOpen(id)) return;
  stack.push({ id, returnFocus: document.activeElement, dismissible });
  if (dismissible) pushGuard();
  if (onClose) closeHandlers.set(id, onClose);
  else closeHandlers.delete(id);
  overlay.style.display = "flex";
  const target = (initialFocus && overlay.querySelector(initialFocus)) || focusables(overlay)[0];
  target?.focus({ preventScroll: true });
}

export function closeOverlay(id) {
  const index = stack.findIndex((entry) => entry.id === id);
  if (index === -1) return;
  const [entry] = stack.splice(index, 1);
  const overlay = byId(id);
  if (overlay) overlay.style.display = "none";
  closeHandlers.get(id)?.();
  if (entry.returnFocus && document.contains(entry.returnFocus)) entry.returnFocus.focus({ preventScroll: true });
}

export function initOverlays() {
  addEventListener("popstate", () => {
    const top = stack[stack.length - 1];
    if (!top) return;
    if (top.dismissible) closeOverlay(top.id);
    // Something is still open (an overlay underneath, or one that must be answered): stay in the app.
    if (stack.length) pushGuard();
  });

  document.addEventListener("click", (event) => {
    const closer = event.target.closest("[data-overlay-close]");
    if (!closer) return;
    const entry = [...stack].reverse().find((item) => byId(item.id)?.contains(closer));
    if (entry?.dismissible) closeOverlay(entry.id);
  });

  document.addEventListener("keydown", (event) => {
    const top = stack[stack.length - 1];
    if (!top) return;
    if (event.key === "Escape" && top.dismissible) {
      event.preventDefault();
      closeOverlay(top.id);
      return;
    }
    if (event.key === "Tab") {
      const items = focusables(byId(top.id));
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
  });
}

export const anyOverlayOpen = () => stack.length > 0;
