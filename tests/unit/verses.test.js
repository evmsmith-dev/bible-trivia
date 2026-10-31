import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const { verses } = JSON.parse(readFileSync(new URL("../../data/verses.json", import.meta.url), "utf8"));

test("there is one verse for every day of the year, including 29 February", () => {
  const days = [];
  for (let day = new Date(2024, 0, 1); day.getFullYear() === 2024; day.setDate(day.getDate() + 1)) {
    days.push(`${String(day.getMonth() + 1).padStart(2, "0")}-${String(day.getDate()).padStart(2, "0")}`);
  }
  assert.equal(verses.length, 366);
  assert.deepEqual(verses.map((v) => v.day).sort(), days);
  assert.equal(new Set(verses.map((v) => v.ref)).size, 366, "no verse is used twice");
});

test("every verse is short, complete, and uses 'the LORD'", () => {
  for (const { ref, text } of verses) {
    assert.match(ref, /^(\d )?[A-Z][a-z]+( [A-Z][a-z]+)* \d+:\d+(-\d+)?$/, ref);
    assert.ok(text.length <= 175, `${ref} is ${text.length} characters`);
    assert.match(text, /^(…|[“‘(]?[A-Z0-9])/, `${ref} starts mid-sentence without "…"`);
    assert.match(text, /[.!?”’]$/, `${ref} doesn't end a sentence`);
    assert.doesNotMatch(text, /Yahweh|\bYah\b|\s{2}/, ref);
    assert.equal(text.split("“").length, text.split("”").length, `${ref} has unmatched quotes`);
  }
});

test("Christmas and New Year's Day have fitting verses", () => {
  const on = (day) => verses.find((v) => v.day === day).ref;
  assert.equal(on("12-25"), "Luke 2:14");
  assert.equal(on("12-24"), "Luke 2:11");
  assert.equal(on("01-01"), "Revelation 21:5");
});
