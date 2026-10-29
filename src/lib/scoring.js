// Scoring, streak and level rules. Pure functions; values come from config.js.
import { LEVEL_THRESHOLDS, MODES, QUESTIONS_PER_GAME, STREAK_BONUS_CAP, STREAK_BONUS_TABLE } from "../config.js";
import { toCount } from "./utils.js";

export function getStreakBonus(streak) {
  const capped = Math.min(toCount(streak), STREAK_BONUS_CAP);
  return capped < 3 ? 0 : Number(STREAK_BONUS_TABLE[capped] || 0);
}

export function getNextStreakBonusLabel(streak) {
  const current = toCount(streak);
  if (current >= STREAK_BONUS_CAP) return `Cap reached at ${STREAK_BONUS_CAP}`;
  const nextBonus = getStreakBonus(current + 1);
  return nextBonus > 0 ? `Next: +${nextBonus} at ${current + 1}` : "Next bonus at 3";
}

/**
 * Points for a correct answer: base + daily bonus + speed bonus + streak bonus.
 * The speed bonus is up to +100% of base for an instant answer (0.75s grace for reaction time).
 */
export function calculatePoints({ mode, secondsLeft, dailyBonusActive = false, streak = 0, dailyBonusMultiplier = 0.05 }) {
  const { basePoints, seconds } = MODES[mode];
  const dailyBonus = dailyBonusActive ? Math.round(basePoints * dailyBonusMultiplier) : 0;
  const speedBonus = Math.round(Math.min(basePoints, Math.max(0, basePoints * ((Math.max(0, secondsLeft) + 0.75) / seconds))));
  const streakBonus = getStreakBonus(streak);
  return {
    base: basePoints,
    dailyBonus,
    speedBonus,
    streakBonus,
    total: basePoints + dailyBonus + speedBonus + streakBonus,
  };
}

export function getLevel(correctAnswers) {
  const count = toCount(correctAnswers);
  let level = 1;
  LEVEL_THRESHOLDS.forEach((threshold, index) => {
    if (count >= threshold) level = index + 1;
  });
  return level;
}

export function getLevelProgress(correctAnswers) {
  const count = toCount(correctAnswers);
  const level = getLevel(count);
  const current = LEVEL_THRESHOLDS[level - 1] || 0;
  const next = LEVEL_THRESHOLDS[level];
  if (next === undefined) {
    return { level, percent: 100, remaining: 0, isMaxLevel: true };
  }
  const span = Math.max(1, next - current);
  return {
    level,
    percent: Math.min(100, ((count - current) / span) * 100),
    remaining: Math.max(0, next - count),
    isMaxLevel: false,
  };
}

/** "Great job, Dad!" — the summary's headline, by how the round went. */
export function summaryHeadline(correct, name) {
  const percent = (correct / QUESTIONS_PER_GAME) * 100;
  const words = correct === QUESTIONS_PER_GAME ? "Perfect round"
    : percent >= 80 ? "Excellent"
      : percent >= 60 ? "Great job"
        : percent >= 40 ? "Good effort"
          : "Nice try";
  return `${words}, ${name}!`;
}
