// Verse of the day on Home, from data/verses.json (one verse for each calendar day, MM-DD).
// It ships with the app, so it works offline. If it can't load, Home keeps its usual line.
import { bibleGatewayUrl } from "../lib/utils.js";
import { byId } from "../ui/dom.js";
import { openOverlay } from "../ui/overlay.js";

let byDay = null; // Map "MM-DD" → { ref, text }

/** "10-30" for 30 October (local time). */
export const dayKey = (date = new Date()) =>
  `${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

export const verseFor = (date = new Date()) => byDay?.get(dayKey(date)) || null;

export function renderVerse(date = new Date()) {
  const verse = verseFor(date);
  byId("home-sub").hidden = Boolean(verse);
  byId("home-verse").hidden = !verse;
  if (!verse) return;
  byId("home-verse-ref").textContent = `📖 ${verse.ref}`;
  byId("home-verse-text").textContent = verse.text;
  byId("home-verse").setAttribute("aria-label", `Verse of the day, ${verse.ref}: ${verse.text}`);
}

/** The whole verse, with a link to read the chapter. */
function openVerse() {
  const verse = verseFor();
  if (!verse) return;
  const chapter = verse.ref.replace(/:\d+(-\d+)?$/, "");
  byId("verse-full-text").textContent = verse.text;
  byId("verse-full-ref").textContent = verse.ref;
  const link = byId("verse-chapter-link");
  link.href = bibleGatewayUrl(chapter);
  link.textContent = `Read ${chapter} on Bible Gateway ›`;
  openOverlay("verse-overlay", { initialFocus: ".overlay-close-button" });
}

/** Loads the verses, shows today's, and keeps it current across midnight and app resumes. */
export async function initVerse() {
  try {
    const response = await fetch("data/verses.json");
    if (!response.ok) return;
    const data = await response.json();
    byDay = new Map(data.verses.map((verse) => [verse.day, verse]));
  } catch {
    return; // Home keeps "Ready to test your knowledge of God's Word?"
  }
  byId("home-verse").addEventListener("click", openVerse);
  let shown = dayKey();
  renderVerse();
  const refresh = () => {
    if (dayKey() === shown) return;
    shown = dayKey();
    renderVerse();
  };
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") refresh(); });
  setInterval(refresh, 60_000); // a new day while the app stays open
}
