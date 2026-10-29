// Small, pure helpers shared across the app.

export function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export const toCount = (value) => (Number.isFinite(value) ? Math.max(0, Math.round(value)) : 0);

/** "YYYY-MM-DD" in the player's local time zone. */
export function getLocalDateKey(date = new Date()) {
  const d = date instanceof Date ? date : new Date(date);
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${month}-${day}`;
}

export function getDateKeyOffset(dateKey, dayOffset) {
  if (typeof dateKey !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) return null;
  const [year, month, day] = dateKey.split("-").map(Number);
  return getLocalDateKey(new Date(year, month - 1, day + dayOffset));
}

/** Deterministic PRNG (FNV-1a hash seed + LCG) so a given day always yields the same questions. */
export function createSeededRandom(seedText) {
  let hash = 2166136261;
  const text = String(seedText || "daily-seed");
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  let state = hash >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

/** Fisher–Yates shuffle in place. */
export function shuffleInPlace(array, random = Math.random) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

export const shuffled = (array, random = Math.random) => shuffleInPlace([...array], random);

export function pickRandom(array, random = Math.random) {
  return array[Math.floor(random() * array.length)];
}

export function formatTimestamp(timestamp) {
  const parsed = Date.parse(timestamp);
  return Number.isNaN(parsed) ? String(timestamp ?? "") : new Date(parsed).toLocaleString();
}

/** Scripture references worth linking (must contain a chapter/verse number). */
export function hasScriptureReference(reference) {
  const ref = String(reference || "").trim();
  if (!ref || /not\s+directly\s+in\s+scripture|church\s+tradition|n\/a|none|unknown/i.test(ref)) return false;
  return /\d/.test(ref);
}

export function bibleGatewayUrl(reference) {
  return `https://www.biblegateway.com/passage/?search=${encodeURIComponent(String(reference || "").trim())}&version=NIV`;
}
