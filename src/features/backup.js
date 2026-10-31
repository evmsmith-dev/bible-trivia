// Settings → Backup: save everyone's progress to a file, or load one (for example on a new phone).
// Loading replaces everything saved on this device, so it asks first, then reloads the app.
//
// Saving uses the phone's share sheet where there is one, so the file can go straight to Google
// Drive, iCloud Drive / Files or an email: somewhere that survives losing the phone. Elsewhere it
// downloads. A web app can't save a file without a tap, so instead of an automatic backup there's
// a reminder on Home about once a month (see maybeShowBackupReminder).
import { createBackup, DEVICE_KEYS, readBackup, readLocal, restoreBackup, writeLocal } from "../storage/store.js";
import { getLocalDateKey } from "../lib/utils.js";
import { state } from "../state.js";
import { anyOverlayOpen, closeOverlay, openOverlay } from "../ui/overlay.js";
import { byId, isWelcomeVisible } from "../ui/dom.js";
import { showToast } from "../ui/toast.js";

const DAY_MS = 24 * 60 * 60 * 1000;
export const BACKUP_REMINDER = {
  minGames: 20, // the reminder only appears once the player has this many games
  everyDays: 30, // and it's been this long since the last backup
  snoozeDays: 7, // "Not now" hides it for this long
};

let pending = null; // the checked backup waiting for "Load Backup"

const setStatus = (text) => { byId("backup-status").textContent = text; };

/** When a backup was last saved on this device ("Last backup: Oct 31, 2026"). */
export function lastBackupText() {
  const when = Date.parse(readLocal(DEVICE_KEYS.lastBackup) || "");
  return Number.isNaN(when)
    ? "No backup saved on this device yet."
    : `Last backup: ${new Date(when).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`;
}

/**
 * Makes the backup file and hands it over: the share sheet where there is one, otherwise a
 * download. Returns { how: "shared" | "downloaded" | "cancelled", count }.
 */
async function writeBackupFile() {
  const data = await createBackup();
  const count = data.players.length;
  const name = `bible-trivia-backup-${getLocalDateKey()}.json`;
  const json = JSON.stringify(data);
  const file = typeof File === "function" ? new File([json], name, { type: "application/json" }) : null;
  if (file && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: "Bible Trivia backup" });
      return { how: "shared", count };
    } catch (error) {
      if (error?.name === "AbortError") return { how: "cancelled", count };
      // Sharing failed for another reason: download instead.
    }
  }
  const link = document.createElement("a");
  link.href = URL.createObjectURL(new Blob([json], { type: "application/json" }));
  link.download = name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(link.href), 4000);
  return { how: "downloaded", count };
}

function backupSaved() {
  writeLocal(DEVICE_KEYS.lastBackup, new Date().toISOString());
  writeLocal(DEVICE_KEYS.backupSnooze, "");
  byId("backup-reminder")?.remove();
  const last = byId("backup-last");
  if (last) last.textContent = lastBackupText();
}

const players = (count) => `${count} player${count === 1 ? "" : "s"}`;

async function saveBackup() {
  setStatus("");
  try {
    const { how, count } = await writeBackupFile();
    if (how === "cancelled") return;
    backupSaved();
    setStatus(how === "shared"
      ? `Backup saved (${players(count)}).`
      : `Backup saved to your downloads (${players(count)}). To keep it safe if anything happens to this device, move it to Google Drive, iCloud or an email.`);
  } catch {
    setStatus("Sorry, the backup could not be saved. Please try again.");
  }
}

// ---------- the monthly reminder on Home ----------

export function backupReminderDue(now = Date.now()) {
  if (state.history.length < BACKUP_REMINDER.minGames) return false;
  const snoozedUntil = Date.parse(readLocal(DEVICE_KEYS.backupSnooze) || "");
  if (!Number.isNaN(snoozedUntil) && now < snoozedUntil) return false;
  const last = Date.parse(readLocal(DEVICE_KEYS.lastBackup) || "");
  return Number.isNaN(last) || now - last >= BACKUP_REMINDER.everyDays * DAY_MS;
}

/** Shows the reminder on Home when one is due (not over a pop-up or the update banner). */
export function maybeShowBackupReminder() {
  if (!isWelcomeVisible() || anyOverlayOpen() || byId("update-banner") || byId("backup-reminder") || !backupReminderDue()) return;
  const hasBackup = !Number.isNaN(Date.parse(readLocal(DEVICE_KEYS.lastBackup) || ""));
  const banner = document.createElement("div");
  banner.id = "backup-reminder";
  banner.setAttribute("role", "status");
  banner.innerHTML = '<p class="update-banner-title">💾 Time to save a backup</p>'
    + `<p class="update-banner-text">${hasBackup ? "It's been over a month since your last backup." : "You haven't saved a backup on this device yet."}`
    + " Save one to Google Drive, Files or an email, so your progress is safe if anything happens to this device.</p>"
    + '<div class="update-banner-actions">'
    + '<button type="button" id="backup-reminder-save">Save backup</button>'
    + '<button type="button" id="backup-reminder-later">Not now</button>'
    + "</div>";
  document.body.appendChild(banner);
  byId("backup-reminder-save").addEventListener("click", async () => {
    try {
      const { how } = await writeBackupFile();
      if (how === "cancelled") return; // keep the reminder up
      backupSaved();
      showToast(how === "shared" ? "Backup saved." : "Backup saved to your downloads.");
    } catch {
      showToast("Sorry, the backup could not be saved. Please try again.");
    }
  });
  byId("backup-reminder-later").addEventListener("click", () => {
    writeLocal(DEVICE_KEYS.backupSnooze, new Date(Date.now() + BACKUP_REMINDER.snoozeDays * DAY_MS).toISOString());
    banner.remove();
  });
}

function describe(backup) {
  const names = backup.players.map((player) => player.profile.name).join(", ");
  const count = backup.players.length;
  const saved = backup.saved && !Number.isNaN(Date.parse(backup.saved))
    ? ` It was saved on ${new Date(backup.saved).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}.`
    : "";
  return `It has ${count} player${count === 1 ? "" : "s"} (${names}).${saved} `
    + "Everything saved on this device now will be replaced.";
}

async function chooseFile(file) {
  setStatus("");
  if (!file) return;
  let data = null;
  try {
    data = JSON.parse(await file.text());
  } catch {
    data = null;
  }
  pending = readBackup(data);
  if (!pending) {
    setStatus("That file isn't a Bible Trivia backup.");
    return;
  }
  byId("backup-confirm-text").textContent = describe(pending);
  openOverlay("backup-overlay", { initialFocus: "#backup-cancel-btn" });
}

async function loadBackup() {
  if (!pending) return;
  const button = byId("backup-confirm-btn");
  button.disabled = true;
  button.textContent = "Loading…";
  try {
    await restoreBackup(pending);
    location.reload(); // start fresh with the restored players
  } catch {
    button.disabled = false;
    button.textContent = "Load Backup";
    closeOverlay("backup-overlay");
    setStatus("Sorry, the backup could not be loaded. Please try again.");
  }
}

export function initBackup() {
  const input = byId("backup-file");
  byId("backup-save-btn").addEventListener("click", saveBackup);
  byId("backup-load-btn").addEventListener("click", () => input.click());
  input.addEventListener("change", () => {
    const [file] = input.files;
    input.value = ""; // so choosing the same file again still fires
    chooseFile(file);
  });
  byId("backup-confirm-btn").addEventListener("click", loadBackup);
}
