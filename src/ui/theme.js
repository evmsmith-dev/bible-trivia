// Light/dark theme. index.html sets data-theme before the page draws; this module keeps it
// in step with the Appearance setting (auto/light/dark) and with the device when on auto.
import { DEVICE_KEYS, readLocal, writeLocal } from "../storage/store.js";

export const THEME_PREFERENCES = ["auto", "light", "dark"];
const THEME_COLORS = { light: "#4CAF50", dark: "#101510" };
const darkQuery = typeof matchMedia === "function" ? matchMedia("(prefers-color-scheme: dark)") : null;

export function getThemePreference() {
  const value = readLocal(DEVICE_KEYS.theme);
  return THEME_PREFERENCES.includes(value) ? value : "auto";
}

function resolve(preference) {
  if (preference === "auto") return darkQuery?.matches ? "dark" : "light";
  return preference;
}

export function applyTheme(preference = getThemePreference()) {
  const theme = resolve(preference);
  document.documentElement.setAttribute("data-theme", theme);
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", THEME_COLORS[theme]);
}

export function setThemePreference(preference) {
  const value = THEME_PREFERENCES.includes(preference) ? preference : "auto";
  writeLocal(DEVICE_KEYS.theme, value);
  applyTheme(value);
}

export function initTheme() {
  applyTheme();
  darkQuery?.addEventListener?.("change", () => {
    if (getThemePreference() === "auto") applyTheme("auto");
  });
}
