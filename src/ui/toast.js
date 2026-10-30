// A short message near the bottom of the screen that fades after a moment.
import { byId } from "./dom.js";

let hideHandle = null;

export function showToast(message, { ms = 2600 } = {}) {
  const toast = byId("toast");
  toast.textContent = message;
  toast.classList.add("is-visible");
  clearTimeout(hideHandle);
  hideHandle = setTimeout(() => toast.classList.remove("is-visible"), ms);
}
