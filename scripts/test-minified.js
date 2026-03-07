const fs = require('fs');

function fail(message) {
  console.error(`FAIL: ${message}`);
  process.exit(1);
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
  if (!markerGroup.some(marker => minified.includes(marker))) {
    fail(`Missing marker in minified output: one of ${markerGroup.join(', ')}`);
  }
}

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
