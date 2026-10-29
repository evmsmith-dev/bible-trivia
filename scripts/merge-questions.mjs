// Adds an approved batch of proposed questions to data/questions.json.
// Usage: node scripts/merge-questions.mjs data/proposed/batch-01-easy.json [--skip 1663,1670]
// Questions listed after --skip are left out. The merged bank is validated before saving.
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";

const args = process.argv.slice(2);
const batchPath = args.find((arg) => !arg.startsWith("--"));
const skipIndex = args.indexOf("--skip");
const skip = new Set(skipIndex >= 0 ? String(args[skipIndex + 1] || "").split(",").map(Number) : []);
if (!batchPath) {
  console.error("Usage: node scripts/merge-questions.mjs <batch.json> [--skip id,id]");
  process.exit(1);
}

const BANK = "data/questions.json";
const bank = JSON.parse(readFileSync(BANK, "utf8"));
const batch = JSON.parse(readFileSync(batchPath, "utf8")).filter((question) => !skip.has(question.id));
const existingIds = new Set(bank.map((question) => question.id));
const clash = batch.filter((question) => existingIds.has(question.id));
if (clash.length) {
  console.error(`These ids are already in the bank: ${clash.map((q) => q.id).join(", ")}. Was this batch merged already?`);
  process.exit(1);
}

const merged = [...bank, ...batch];
const text = `[\n${merged.map((question) => `  ${JSON.stringify(question)}`).join(",\n")}\n]\n`;
const previous = readFileSync(BANK, "utf8");
writeFileSync(BANK, text);
try {
  execFileSync(process.execPath, ["scripts/validate-questions.mjs", BANK], { stdio: "inherit" });
} catch {
  writeFileSync(BANK, previous);
  console.error("Validation failed, so data/questions.json was left unchanged.");
  process.exit(1);
}
console.log(`Added ${batch.length} questions${skip.size ? ` (skipped ${[...skip].join(", ")})` : ""}. The bank now has ${merged.length}.`);
