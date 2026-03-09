const fs = require('fs');

function fail(message) {
  console.error(`FAIL: ${message}`);
  process.exit(1);
}

function readRequired(path) {
  if (!fs.existsSync(path)) {
    fail(`Missing file: ${path}`);
  }
  return fs.readFileSync(path, 'utf8');
}

function requireRegex(text, pattern, label) {
  const regex = new RegExp(pattern, 's');
  if (!regex.test(text)) {
    fail(`Missing ${label} (pattern: ${pattern})`);
  }
}

function forbidRegex(text, pattern, label) {
  const regex = new RegExp(pattern, 's');
  if (regex.test(text)) {
    fail(`Unexpected ${label} (pattern: ${pattern})`);
  }
}

const sourceRuntimePath = process.argv[2] || 'src/app-runtime.js';
const minifiedRuntimePath = process.argv[3] || 'src/app-runtime.min.js';

const sourceRuntime = readRequired(sourceRuntimePath);
const minifiedRuntime = readRequired(minifiedRuntimePath);

// Source runtime should stamp a newly inserted IndexedDB id onto each in-memory history record.
requireRegex(
  sourceRuntime,
  String.raw`const\s+insertedId\s*=\s*await\s+DBManager\.addGameRecord\(record\);\s*if\s*\(\s*insertedId\s*!==\s*undefined\s*&&\s*insertedId\s*!==\s*null\s*\)\s*\{\s*record\.id\s*=\s*insertedId;`,
  'source history id stamping after IndexedDB insert'
);

// Normal endGame flow should not call saveData twice (saveHighScore already persists data).
requireRegex(
  sourceRuntime,
  String.raw`await\s+saveHighScore\(\);\s*await\s+reloadGameHistory\(\);`,
  'source endGame normal-mode single-save sequence'
);
forbidRegex(
  sourceRuntime,
  String.raw`await\s+saveHighScore\(\);\s*await\s+saveData\(\);\s*await\s+reloadGameHistory\(\);`,
  'source endGame double-save sequence'
);

// Minified runtime should preserve the same regression guards.
requireRegex(
  minifiedRuntime,
  String.raw`let\s+insertedId\s*=\s*await\s+DBManager\.addGameRecord\(record\)` ,
  'minified history id stamping after IndexedDB insert'
);
requireRegex(
  minifiedRuntime,
  String.raw`await\s+saveHighScore\(\),await\s+reloadGameHistory\(\)` ,
  'minified endGame normal-mode single-save sequence'
);
forbidRegex(
  minifiedRuntime,
  String.raw`await\s+saveHighScore\(\),await\s+saveData\(\),await\s+reloadGameHistory\(\)` ,
  'minified endGame double-save sequence'
);

console.log('PASS: Duplicate-history regression checks passed.');
