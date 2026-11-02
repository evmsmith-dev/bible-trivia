// Fill-in-the-blank questions: the question text has one blank, written "___", and the options
// are written as they'd read in the sentence ("earth", not "Earth"), so the right answer can
// be dropped into the blank once the question is answered.

export const BLANK = "___";
const BLANK_PATTERN = /_{2,}/;

/** [before, after] around the blank, or null when the question has no blank. */
export function splitBlank(text) {
  const match = BLANK_PATTERN.exec(String(text));
  if (!match) return null;
  return [text.slice(0, match.index), text.slice(match.index + match[0].length)];
}

export const isFillInTheBlank = (question) => splitBlank(question?.q) !== null;

/** The sentence with the blank filled in (plain text). */
export function fillBlank(text, answer) {
  const parts = splitBlank(text);
  return parts ? `${parts[0]}${answer}${parts[1]}` : String(text);
}
