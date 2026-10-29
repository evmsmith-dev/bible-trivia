// Applies a list of reviewed fixes to data/questions.json, then validates.
// Usage: node scripts/apply-question-fixes.mjs data/proposed/fixes-xyz.json
// Each fix is { "id": 123, "remove": true } or { "id": 123, "set": { ...fields to replace } }.
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";

const fixesPath = process.argv[2];
if (!fixesPath) {
  console.error("Usage: node scripts/apply-question-fixes.mjs <fixes.json>");
  process.exit(1);
}
const BANK = "data/questions.json";
const previous = readFileSync(BANK, "utf8");
let bank = JSON.parse(previous);
const fixes = JSON.parse(readFileSync(fixesPath, "utf8"));
const byId = new Map(bank.map((question) => [question.id, question]));
let changed = 0;
let removed = 0;
for (const fix of fixes) {
  if (!byId.has(fix.id)) {
    console.error(`No question with id ${fix.id}`);
    process.exit(1);
  }
  if (fix.remove) {
    bank = bank.filter((question) => question.id !== fix.id);
    removed++;
  } else {
    Object.assign(byId.get(fix.id), fix.set);
    changed++;
  }
}
writeFileSync(BANK, `[\n${bank.map((question) => `  ${JSON.stringify(question)}`).join(",\n")}\n]\n`);
try {
  execFileSync(process.execPath, ["scripts/validate-questions.mjs", BANK], { stdio: "inherit" });
} catch {
  writeFileSync(BANK, previous);
  console.error("Validation failed, so data/questions.json was left unchanged.");
  process.exit(1);
}
console.log(`Changed ${changed}, removed ${removed}. The bank now has ${bank.length} questions.`);
