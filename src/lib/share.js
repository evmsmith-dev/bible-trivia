// Text for sharing a Daily Challenge result, e.g.
//   Bible Trivia Daily Challenge 🎯
//   Thu, Oct 29, 2026
//   🟩🟩🟥🟩🟩🟩🟥🟩🟩🟩
//   8/10 · 1,234 pts
//   https://example.org/bible-trivia/

export function buildDailyShareText({ dateKey, results, score, attemptNumber = 1, url = "" }) {
  const [year, month, day] = dateKey.split("-").map(Number);
  const date = new Date(year, month - 1, day).toLocaleDateString("en-US", {
    weekday: "short", month: "short", day: "numeric", year: "numeric",
  });
  const correct = results.filter(Boolean).length;
  const grid = results.map((isCorrect) => (isCorrect ? "🟩" : "🟥")).join("");
  const attempt = attemptNumber > 1 ? ` · attempt ${attemptNumber}` : "";
  return [
    "Bible Trivia Daily Challenge 🎯",
    date,
    grid,
    `${correct}/${results.length} · ${score.toLocaleString("en-US")} pts${attempt}`,
    url,
  ].filter(Boolean).join("\n");
}
