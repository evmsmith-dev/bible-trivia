// Validates the question bank. Exits non-zero on errors; prints warnings for likely near-duplicates.
// Usage: node scripts/validate-questions.mjs [path-to-question-bank]
import { readFileSync } from "node:fs";
import vm from "node:vm";

const file = process.argv[2] || "src/data/questions-bank.js";
const DIFFICULTIES = ["easy", "medium", "hard"];
const CATEGORIES = ["Old Testament", "New Testament", "General"];

function loadQuestions(path) {
  const text = readFileSync(path, "utf8");
  if (path.endsWith(".json")) return JSON.parse(text);
  const context = { window: {} };
  vm.createContext(context);
  vm.runInContext(text, context);
  return context.window.BibleTriviaQuestionBank;
}

const normalize = (value) => String(value).toLowerCase().replace(/[’‘]/g, "'").replace(/[^a-z0-9' ]/g, " ").replace(/\s+/g, " ").trim();

const questions = loadQuestions(file);
const errors = [];
const warnings = [];
const ids = new Set();
const texts = new Map();

if (!Array.isArray(questions) || questions.length === 0) {
  console.error(`FAIL: no questions found in ${file}`);
  process.exit(1);
}

questions.forEach((question, index) => {
  const where = `#${index} (id ${question.id})`;
  if (!Number.isInteger(question.id) || question.id < 1) errors.push(`${where}: id must be a positive integer`);
  else if (ids.has(question.id)) errors.push(`${where}: duplicate id ${question.id}`);
  else ids.add(question.id);

  if (typeof question.q !== "string" || !question.q.trim()) errors.push(`${where}: missing question text`);
  if (!Array.isArray(question.opts) || question.opts.length !== 4) errors.push(`${where}: must have exactly 4 options`);
  else {
    if (question.opts.some((option) => typeof option !== "string" || !option.trim())) errors.push(`${where}: empty option`);
    if (new Set(question.opts.map(normalize)).size !== question.opts.length) errors.push(`${where}: duplicate options`);
  }
  if (!Number.isInteger(question.ans) || question.ans < 0 || question.ans >= (question.opts?.length || 0)) {
    errors.push(`${where}: ans must index into opts`);
  }
  if (!DIFFICULTIES.includes(question.difficulty)) errors.push(`${where}: difficulty must be one of ${DIFFICULTIES.join(", ")}`);
  if (!CATEGORIES.includes(question.category)) errors.push(`${where}: category must be one of ${CATEGORIES.join(", ")}`);
  if (typeof question.ref !== "string") errors.push(`${where}: ref must be a string (may be empty)`);

  const key = normalize(question.q);
  if (texts.has(key)) errors.push(`${where}: same question text as id ${texts.get(key)}`);
  else texts.set(key, question.id);
});

// Near-duplicates: same correct answer and mostly the same words. Reported, not fatal.
const STOP = new Set("the a an of in to was who what which did is for and by on at with his her from that as be this were".split(" "));
const words = (text) => new Set(normalize(text).split(" ").filter((word) => word && !STOP.has(word)));
const byAnswer = new Map();
for (const question of questions) {
  const answer = normalize(question.opts?.[question.ans] ?? "");
  if (!byAnswer.has(answer)) byAnswer.set(answer, []);
  byAnswer.get(answer).push({ id: question.id, q: question.q, words: words(question.q) });
}
for (const group of byAnswer.values()) {
  for (let i = 0; i < group.length; i++) {
    for (let j = i + 1; j < group.length; j++) {
      const a = group[i].words;
      const b = group[j].words;
      let shared = 0;
      a.forEach((word) => { if (b.has(word)) shared++; });
      const similarity = shared / (a.size + b.size - shared);
      if (similarity >= 0.75) warnings.push(`ids ${group[i].id} & ${group[j].id} look alike: "${group[i].q}" / "${group[j].q}"`);
    }
  }
}

const counts = {};
for (const question of questions) {
  const key = `${question.difficulty} / ${question.category}`;
  counts[key] = (counts[key] || 0) + 1;
}

console.log(`${questions.length} questions in ${file}`);
console.table(counts);
if (warnings.length) {
  console.log(`\n${warnings.length} possible near-duplicates (review when convenient):`);
  if (process.argv.includes("--verbose")) warnings.forEach((warning) => console.log(`  - ${warning}`));
  else console.log("  run with --verbose to list them");
}
if (errors.length) {
  console.error(`\nFAIL: ${errors.length} error(s)`);
  errors.forEach((error) => console.error(`  - ${error}`));
  process.exit(1);
}
console.log("\nPASS: question bank is valid.");
