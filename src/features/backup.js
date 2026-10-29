// Settings → Backup: save everyone's progress to a file, or load one (for example on a new phone).
// Loading replaces everything saved on this device, so it asks first, then reloads the app.
import { createBackup, readBackup, restoreBackup } from "../storage/store.js";
import { getLocalDateKey } from "../lib/utils.js";
import { byId } from "../ui/dom.js";
import { closeOverlay, openOverlay } from "../ui/overlay.js";

let pending = null; // the checked backup waiting for "Load Backup"

const setStatus = (text) => { byId("backup-status").textContent = text; };

async function saveBackup() {
  setStatus("");
  try {
    const data = await createBackup();
    const blob = new Blob([JSON.stringify(data)], { type: "application/json" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `bible-trivia-backup-${getLocalDateKey()}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(link.href), 4000);
    const count = data.players.length;
    setStatus(`Backup saved to your downloads (${count} player${count === 1 ? "" : "s"}).`);
  } catch {
    setStatus("Sorry, the backup could not be saved. Please try again.");
  }
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
