// Diagnostic logging, off by default. Enable with ?debug in the URL
// or localStorage.setItem("bibleTrivia_debug", "1").
const enabled = (() => {
  try {
    return /[?&]debug\b/.test(location.search) || localStorage.getItem("bibleTrivia_debug") === "1";
  } catch {
    return false;
  }
})();

export function log(...args) {
  if (enabled) console.log("[BibleTrivia]", ...args);
}
