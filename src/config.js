// Single source of truth for game rules, labels and tunables.
// UI text (Settings, How to Play) is generated from MODES, so change values here only.

export const QUESTIONS_PER_GAME = 10;

export const CATEGORIES = ["Old Testament", "New Testament", "General"];

// How many questions from each category a round aims for (sums to QUESTIONS_PER_GAME).
export const CATEGORY_TARGETS = { "Old Testament": 4, "New Testament": 4, General: 2 };

export const DIFFICULTY_LABELS = {
  easy: { emoji: "🟢", label: "Easy" },
  medium: { emoji: "🟠", label: "Medium" },
  hard: { emoji: "🔴", label: "Hard" },
};

export const CATEGORY_EMOJIS = { "Old Testament": "📜", "New Testament": "✝️", General: "📖" };

/**
 * Game modes. `mix` controls question selection:
 *  - difficulties: which question difficulties are eligible
 *  - difficultyTargets: how many of each difficulty to aim for
 *  - matrix: guaranteed picks per difficulty and category; the rest is filled by targets
 */
export const MODES = {
  easy: {
    label: "Easy",
    shortLabel: "Easy",
    emoji: "🟢",
    basePoints: 50,
    seconds: 25,
    questionsText: "🟢 questions",
    mix: {
      difficulties: ["easy"],
      difficultyTargets: { easy: 10, medium: 0, hard: 0 },
      matrix: { easy: { "Old Testament": 4, "New Testament": 4, General: 2 } },
    },
  },
  medium: {
    label: "Medium",
    shortLabel: "Medium",
    emoji: "🟠",
    basePoints: 100,
    seconds: 25,
    questionsText: "🟢 & 🟠 questions",
    mix: {
      difficulties: ["easy", "medium"],
      difficultyTargets: { easy: 5, medium: 5, hard: 0 },
      matrix: {
        easy: { "Old Testament": 2, "New Testament": 1, General: 1 },
        medium: { "Old Testament": 1, "New Testament": 1, General: 1 },
      },
    },
  },
  hard: {
    label: "Hard",
    shortLabel: "Hard",
    emoji: "🔴",
    basePoints: 150,
    seconds: 21,
    questionsText: "🟠 & 🔴 questions",
    mix: {
      difficulties: ["medium", "hard"],
      difficultyTargets: { easy: 0, medium: 5, hard: 5 },
      matrix: {
        medium: { "Old Testament": 2, "New Testament": 1, General: 1 },
        hard: { "Old Testament": 1, "New Testament": 1, General: 1 },
      },
    },
  },
  superHard: {
    label: "Super Hard",
    shortLabel: "Super",
    emoji: "⚫",
    basePoints: 250,
    seconds: 18,
    questionsText: "🔴 questions only",
    tagline: "Elite Challenge!",
    mix: {
      difficulties: ["hard"],
      difficultyTargets: { easy: 0, medium: 0, hard: 10 },
      matrix: { hard: { "Old Testament": 1, "New Testament": 1, General: 1 } },
    },
  },
};

export const MODE_KEYS = Object.keys(MODES);
export const DEFAULT_MODE = "medium";

export const GAME_MODE_NORMAL = "normal";
export const GAME_MODE_DAILY = "daily";

export const DAILY = {
  modeVersion: "v1", // changing this changes every future day's question set
  difficultyMode: "medium",
  successPercent: 70,
  baseBonusMultiplier: 0.05, // +5% base points for the rest of the day after passing
  recentLimit: 30,
};

export const STREAK_BONUS_CAP = 10;
export const STREAK_BONUS_TABLE = { 3: 25, 4: 50, 5: 80, 6: 115, 7: 150, 8: 185, 9: 220, 10: 260 };

// Lifetime correct answers (normal games only) needed to reach each level.
export const LEVEL_THRESHOLDS = [0, 25, 60, 110, 180, 270, 390, 540, 730, 970, 1270, 1640];

export const TIMING = {
  countdownSeconds: 3,
  autoAdvanceCorrectMs: 2200,
  autoAdvanceWrongMs: 2800,
  feedbackShowMs: 2200,
  timerWarningSeconds: 8,
  timerDangerSeconds: 4,
};

export const MAX_HIGH_SCORES_PER_MODE = 5;

// How many recently shown questions to remember. New rounds prefer questions seen longest ago.
export const RECENT_QUESTION_MEMORY = 500;

export const PLAYER_NAME = { min: 2, max: 15, default: "Player" };

export const AVATARS_PER_PAGE = 8;
export const AVATARS = [
  { id: "emoji-smile", type: "emoji", value: "🙂", label: "Smile" },
  { id: "emoji-cool", type: "emoji", value: "😎", label: "Cool" },
  { id: "emoji-nerd", type: "emoji", value: "🤓", label: "Nerd" },
  { id: "emoji-fire", type: "emoji", value: "🔥", label: "Fire" },
  { id: "emoji-starstruck", type: "emoji", value: "🤩", label: "Starstruck" },
  { id: "emoji-sunglow", type: "emoji", value: "🌞", label: "Sunny" },
  { id: "emoji-lightbulb", type: "emoji", value: "💡", label: "Bright Idea" },
  { id: "emoji-hands", type: "emoji", value: "🙌", label: "Praise" },
  ...["dove", "crown", "shield", "star", "olive-branch", "lamb", "fish", "scroll", "ark", "lyre", "lamp", "lion", "rainbow", "mountain", "anchor", "sunflower"]
    .map((name) => ({
      id: `image-${name}`,
      type: "image",
      value: `icons/avatars/${name}.svg`,
      label: name.split("-").map((word) => word[0].toUpperCase() + word.slice(1)).join(" "),
    })),
];

export const INCORRECT_MESSAGES = ["Not quite!", "Good try!", "Almost!"];

