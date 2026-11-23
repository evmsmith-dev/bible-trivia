// Picks the online backend: Firebase when it's configured, or the local test backend when the
// browser tests ask for it (window.__TRIVIA_BACKEND = "local"; "off" acts as if Firebase weren't
// set up). Returns null when online play isn't available.
import { FIREBASE_CONFIG, APP_CHECK_SITE_KEY, APP_CHECK_PROVIDER } from "./config.js";

let pending = null;

export const onlineConfigured = () => window.__TRIVIA_BACKEND !== "off" && (Boolean(FIREBASE_CONFIG) || window.__TRIVIA_BACKEND === "local");

export function getBackend() {
  pending ||= (async () => {
    if (window.__TRIVIA_BACKEND === "local") {
      const { createLocalBackend } = await import("./local-backend.js");
      return createLocalBackend();
    }
    if (!FIREBASE_CONFIG || window.__TRIVIA_BACKEND === "off") return null;
    const { createFirebaseBackend } = await import("./firebase-backend.js");
    return createFirebaseBackend(FIREBASE_CONFIG, APP_CHECK_SITE_KEY, APP_CHECK_PROVIDER);
  })().catch((error) => {
    pending = null; // let the next attempt try again (e.g. after coming back online)
    throw error;
  });
  return pending;
}
