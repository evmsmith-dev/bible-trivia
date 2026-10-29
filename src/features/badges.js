// Badges for the active player: kept in step with their progress, announced on the summary
// when a round earns one, and listed on the Scores page.
import { BADGES, badgeProgress, countEarned, tierName, TOTAL_BADGE_LEVELS, updateEarned } from "../lib/badges.js";
import { escapeHtml } from "../lib/utils.js";
import { state } from "../state.js";
import { getActivePlayerId, readBadges, writeBadges } from "../storage/store.js";

/** At startup and when the player changes. Anything already achieved is credited quietly;
 *  for a player who had no badges saved yet (from before badges existed) no date is known. */
export function loadBadges() {
  const id = getActivePlayerId();
  const saved = readBadges(id);
  const { earned } = updateEarned(state, saved || {}, saved ? new Date().toISOString() : null);
  state.badges = earned;
  writeBadges(id, earned);
}

/** After a round: saves and returns the badge levels this round earned ([{ badge, tier }]). */
export function checkNewBadges() {
  const { earned, newlyEarned } = updateEarned(state, state.badges);
  if (newlyEarned.length) {
    state.badges = earned;
    writeBadges(getActivePlayerId(), earned);
  }
  return newlyEarned;
}

const label = ({ badge, tier }) => `${badge.emoji} ${badge.name}${tierName(badge, tier) ? ` (${tierName(badge, tier)})` : ""}`;

/** The summary's "🏅 New badge" button (empty when the round earned none). Opens the badges on Scores. */
export function newBadgesHtml(newlyEarned) {
  if (!newlyEarned.length) return "";
  const names = newlyEarned.map((entry) => label(entry).replace(/^\S+\s/, "")).join(", ");
  const text = newlyEarned.length === 1
    ? `New badge: ${label(newlyEarned[0])}`
    : `${newlyEarned.length} new badges: ${newlyEarned.map(({ badge }) => badge.emoji).join(" ")}`;
  return `
    <button type="button" id="summary-badges-btn" class="summary-badges"
            aria-label="${escapeHtml(`${newlyEarned.length === 1 ? "New badge" : "New badges"}: ${names}. Show badges`)}">
      🏅 ${escapeHtml(text)} <span aria-hidden="true">›</span>
    </button>`;
}

function dateLabel(iso) {
  const date = new Date(iso);
  if (!iso || Number.isNaN(date.getTime())) return "";
  const options = { month: "short", day: "numeric" };
  if (date.getFullYear() !== new Date().getFullYear()) options.year = "numeric";
  return date.toLocaleDateString(undefined, options);
}

function tileHtml({ badge, value, tier, nextGoal, earnedAt }) {
  const done = nextGoal === null;
  const levels = badge.goals.length > 1
    ? `<span class="badge-levels" aria-hidden="true">${badge.goals.map((_, index) => `<i class="${index < tier ? "on" : ""}"></i>`).join("")}</span>`
    : "";
  const tierText = tierName(badge, tier);
  let status;
  if (tier && done) {
    const when = dateLabel(earnedAt);
    status = `<span class="badge-status">${tierText ? `${tierText} · ` : ""}${when ? `Earned ${escapeHtml(when)}` : "Earned"}</span>`;
  } else {
    const start = badge.goals[tier - 1] || 0;
    const percent = Math.max(0, Math.min(100, ((value - (tier ? start : 0)) / (nextGoal - (tier ? start : 0))) * 100));
    const shown = nextGoal > 1 ? `<span class="badge-count">${Math.min(value, nextGoal).toLocaleString()} / ${nextGoal.toLocaleString()}</span>` : "";
    status = `
      <span class="badge-how">${escapeHtml(badge.how(nextGoal))}</span>
      ${nextGoal > 1 ? `<span class="badge-track" aria-hidden="true"><span style="width:${percent}%"></span></span>` : ""}
      ${shown}
      ${tier ? `<span class="badge-status">${tierText} earned</span>` : ""}`;
  }
  const state_ = tier ? (done ? "earned" : "partly earned") : "not earned yet";
  return `
    <li class="badge-tile${tier ? " is-earned" : ""}${tier && done ? " is-complete" : ""}" aria-label="${escapeHtml(`${badge.name}, ${state_}`)}">
      <span class="badge-emoji" aria-hidden="true">${badge.emoji}</span>
      <span class="badge-name">${escapeHtml(badge.name)}</span>
      ${levels}
      ${status}
    </li>`;
}

/** The Badges section of Scores → Me. */
export function badgesSectionHtml() {
  const progress = badgeProgress(state, state.badges);
  const earned = countEarned(Object.fromEntries(progress.map((entry) => [entry.badge.id, { tier: entry.tier }])));
  return `
    <section class="scores-section" id="scores-badges" aria-labelledby="scores-badges-title">
      <h3 id="scores-badges-title" class="scores-heading">Badges <span class="badges-count">${earned} of ${TOTAL_BADGE_LEVELS}</span></h3>
      <ul class="badge-grid">${progress.map(tileHtml).join("")}</ul>
      <p class="scores-note">Badges with dots have three levels to earn: bronze, silver and gold.</p>
    </section>`;
}

export { countEarned, BADGES };
