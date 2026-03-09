const fs = require('fs');

function fail(message) {
  console.error(`FAIL: ${message}`);
  process.exit(1);
}

function requireAny(text, markerGroup, label) {
  if (!markerGroup.some(marker => text.includes(marker))) {
    fail(`Missing ${label}: one of ${markerGroup.join(', ')}`);
  }
}

function requireRegex(text, pattern, label) {
  const regex = new RegExp(pattern, 'is');
  if (!regex.test(text)) {
    fail(`Missing ${label} (pattern: ${pattern})`);
  }
}

function countMatches(text, regex) {
  const matches = text.match(regex);
  return matches ? matches.length : 0;
}

const minifiedPath = process.argv[2] || 'index.html';
const sourcePath = process.argv[3] || 'index.source.html';

if (!fs.existsSync(sourcePath)) {
  fail(`Missing source file: ${sourcePath}`);
}

if (!fs.existsSync(minifiedPath)) {
  fail(`Missing minified file: ${minifiedPath}. Run npm run minify:safe first.`);
}

const source = fs.readFileSync(sourcePath, 'utf8');
const minified = fs.readFileSync(minifiedPath, 'utf8');

const sourceBytes = Buffer.byteLength(source, 'utf8');
const minifiedBytes = Buffer.byteLength(minified, 'utf8');

if (minifiedBytes >= sourceBytes) {
  fail(`Minified output is not smaller (source=${sourceBytes}, minified=${minifiedBytes}).`);
}

const requiredAnyMarkers = [
  ['id="welcome"', "id='welcome'", 'id=welcome'],
  ['id="question-container"', "id='question-container'", 'id=question-container'],
  ['id="options"', "id='options'", 'id=options'],
  ['const allQuestions=', 'const allQuestions ='],
  [
    "navigator.serviceWorker.register('service-worker.js')",
    'navigator.serviceWorker.register("service-worker.js")',
    'navigator.serviceWorker.register(`service-worker.js`)'
  ]
];

for (const markerGroup of requiredAnyMarkers) {
  requireAny(minified, markerGroup, 'core marker in minified output');
}

const dailyFeatureMarkers = [
  ['id="daily-challenge-link"', "id='daily-challenge-link'", 'id=daily-challenge-link'],
  ['id="daily-challenge-overlay"', "id='daily-challenge-overlay'", 'id=daily-challenge-overlay'],
  ['id="daily-start-btn"', "id='daily-start-btn'", 'id=daily-start-btn'],
  ["GAME_MODE_DAILY='daily'", 'GAME_MODE_DAILY="daily"', 'GAME_MODE_DAILY=`daily`'],
  ['startDailyChallenge(', 'openDailyChallengeOverlay(']
];

for (const markerGroup of dailyFeatureMarkers) {
  requireAny(minified, markerGroup, 'daily challenge marker in minified output');
}

const playerProfileMarkers = [
  ['id="player-entry-btn"', "id='player-entry-btn'", 'id=player-entry-btn'],
  ['id="player-entry-level"', "id='player-entry-level'", 'id=player-entry-level'],
  ['id="summary-player-level"', "id='summary-player-level'", 'id=summary-player-level'],
  ['id="player-overlay"', "id='player-overlay'", 'id=player-overlay'],
  ['id="player-name-input"', "id='player-name-input'", 'id=player-name-input'],
  ['renderWelcomePlayerEntry(', 'refreshSummaryPlayerDisplay(']
];

for (const markerGroup of playerProfileMarkers) {
  requireAny(minified, markerGroup, 'player profile marker in minified output');
}

const streakMarkers = [
  ['id="streak-hud"', "id='streak-hud'", 'id=streak-hud'],
  ['id="streak-hud-bonus"', "id='streak-hud-bonus'", 'id=streak-hud-bonus'],
  ['Next bonus at 3'],
  ['getStreakBonus(', 'STREAK_BONUS_TABLE'],
  ['streak-carryover-banner']
];

for (const markerGroup of streakMarkers) {
  requireAny(minified, markerGroup, 'streak marker in minified output');
}

const sourceCarryoverGuardPattern =
  'showCarryoverBanner\\s*=\\s*showRestartSameButton\\s*&&\\s*carryoverStreak\\s*>\\s*0\\s*&&\\s*carryoverBonus\\s*>\\s*0';
const minifiedCarryoverGuardPattern =
  'showCarryoverBanner\\s*=\\s*showRestartSameButton\\s*&&\\s*carryoverStreak>0\\s*&&\\s*carryoverBonus>0';
requireRegex(source, sourceCarryoverGuardPattern, 'source streak carryover guard');
requireRegex(minified, minifiedCarryoverGuardPattern, 'minified streak carryover guard');

const sourceHomeRefreshPattern =
  'getElementById\\(\\s*[`"\\\']restart-change[`"\\\']\\s*\\)\\??\\.addEventListener\\(\\s*[`"\\\']click[`"\\\']\\s*,.*?renderWelcomePlayerEntry\\s*\\(\\s*\\)';
const minifiedHomeRefreshPattern =
  'getElementById\\(\\s*[`"\\\']restart-change[`"\\\']\\s*\\)\\??\\.addEventListener\\(\\s*[`"\\\']click[`"\\\'].*?renderWelcomePlayerEntry\\(\\s*\\)';
requireRegex(source, sourceHomeRefreshPattern, 'source Home handler welcome-player refresh');
requireRegex(minified, minifiedHomeRefreshPattern, 'minified Home handler welcome-player refresh');

const sourceScriptCount = countMatches(source, /<script\b/gi);
const minifiedScriptCount = countMatches(minified, /<script\b/gi);

if (sourceScriptCount !== minifiedScriptCount) {
  fail(`Script tag count changed (source=${sourceScriptCount}, minified=${minifiedScriptCount}).`);
}

const sourceStyleCount = countMatches(source, /<style\b/gi);
const minifiedStyleCount = countMatches(minified, /<style\b/gi);

if (sourceStyleCount !== minifiedStyleCount) {
  fail(`Style tag count changed (source=${sourceStyleCount}, minified=${minifiedStyleCount}).`);
}

const reduction = (((sourceBytes - minifiedBytes) / sourceBytes) * 100).toFixed(2);
console.log(`PASS: Minified HTML is smaller and passed smoke checks.`);
console.log(`Size: ${sourceBytes} -> ${minifiedBytes} bytes (${reduction}% reduction)`);
