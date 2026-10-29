// Short vibrations on answers. Only devices with the Vibration API get them (Android
// browsers); iPhones and iPads don't support it, so the setting is hidden there.
import { KEYS, readLocal, writeLocal } from "../storage/store.js";

export const canVibrate = () => typeof navigator !== "undefined" && typeof navigator.vibrate === "function";

export const isVibrationOn = () => readLocal(KEYS.vibration) !== "off";

export function setVibrationOn(on) {
  writeLocal(KEYS.vibration, on ? "on" : "off");
}

export const VIBRATION = {
  correct: 40,
  wrong: [70, 60, 70],
};

export function vibrate(pattern) {
  if (!canVibrate() || !isVibrationOn()) return;
  try {
    navigator.vibrate(pattern);
  } catch {
    // Some browsers throw when vibration is blocked; it's only a nicety.
  }
}
