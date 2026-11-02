// The app's own confirmation pop-up, used in place of the browser's confirm() so it matches
// End Round and Load Backup: a card over a dimmed screen, a green "keep" button (focused first,
// so a stray Enter or tap can't do the destructive thing) and a red action button.
// Cancel, Back, Escape and tapping outside the card all count as "no".
import { byId } from "./dom.js";
import { closeOverlay, openOverlay } from "./overlay.js";

let resolvePending = null;

/** Resolves true when the player taps the action button, false otherwise. */
export function askConfirm({ title, text, confirmLabel, cancelLabel = "Cancel" }) {
  resolvePending?.(false); // only one question at a time
  byId("confirm-title").textContent = title;
  byId("confirm-text").textContent = text;
  byId("confirm-ok-btn").textContent = confirmLabel;
  byId("confirm-cancel-btn").textContent = cancelLabel;
  return new Promise((resolve) => {
    let answer = false;
    resolvePending = resolve;
    byId("confirm-ok-btn").onclick = () => {
      answer = true;
      closeOverlay("confirm-dialog");
    };
    openOverlay("confirm-dialog", {
      initialFocus: "#confirm-cancel-btn",
      onClose: () => {
        if (resolvePending === resolve) resolvePending = null;
        resolve(answer);
      },
    });
  });
}
