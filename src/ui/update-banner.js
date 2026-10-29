// Service worker registration and a non-blocking "update available" banner.
// A new version installs in the background and waits; the banner is shown only on the
// Home screen, and the page reloads only after the player taps Update.
import { byId, isWelcomeVisible } from "./dom.js";

let waitingWorker = null;
let updateRequested = false;

export function showUpdateBannerIfReady() {
  if (!waitingWorker || !isWelcomeVisible() || byId("update-banner")) return;
  const banner = document.createElement("div");
  banner.id = "update-banner";
  banner.setAttribute("role", "status");
  banner.innerHTML = '<span>A new version of Bible Trivia is available.</span>'
    + '<button type="button" id="update-banner-btn">Update</button>'
    + '<button type="button" id="update-banner-dismiss" aria-label="Dismiss update notice">✕</button>';
  document.body.appendChild(banner);
  byId("update-banner-btn").addEventListener("click", () => {
    updateRequested = true;
    waitingWorker?.postMessage({ type: "SKIP_WAITING" });
    banner.remove();
  });
  byId("update-banner-dismiss").addEventListener("click", () => banner.remove());
}

function onUpdateReady(worker) {
  waitingWorker = worker;
  showUpdateBannerIfReady();
}

export async function registerServiceWorker(path = "service-worker.js") {
  if (!("serviceWorker" in navigator) || !/^https?:$/.test(location.protocol)) return;
  try {
    const registration = await navigator.serviceWorker.register(path);
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      // A first visit also fires this when the worker claims the page; only reload on request.
      if (updateRequested) location.reload();
    });
    if (registration.waiting && navigator.serviceWorker.controller) onUpdateReady(registration.waiting);
    registration.addEventListener("updatefound", () => {
      const worker = registration.installing;
      worker?.addEventListener("statechange", () => {
        if (worker.state === "installed" && navigator.serviceWorker.controller) onUpdateReady(worker);
      });
    });
  } catch {
    // Unsupported or restricted environment: the app still works online.
  }
}
