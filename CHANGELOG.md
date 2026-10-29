# Changelog

## 2.1.0

### New
- **Fewer repeats.** The app remembers the last 500 questions shown on the device, and new rounds pick unseen questions first, then the ones seen longest ago.
- **Fairer Daily Challenge retries.** The first attempt still uses the day's shared question set. Each retry gets a different set of questions, so a retry can't be passed by remembering answers. An attempt counts as soon as it starts.
- **Share your daily result.** A "Share Result" button on the Daily summary opens the phone's share sheet, or copies the text to the clipboard on other devices. The text looks like this:
  `Bible Trivia Daily Challenge 🎯 / Thu, Oct 29, 2026 / 🟩🟩🟥🟩… / 8/10 · 1,234 pts`

### Look and feel
- Buttons and answers use the Fredoka font like the rest of the app.
- A more compact game header on phones: the title is hidden during play, the chips and dots are smaller, and the timer sits on one line with its bar. The question and all four answers now fit on screen, even on an iPhone SE.
- The points pop-up sits over the header instead of covering the question and answers. It shows the breakdown (`+100 base · +85 speed · +25 streak`). After a wrong answer or a timeout, it shows the correct answer.

## 2.0.0

### Fixes
- The game no longer freezes after a correct answer when the confetti library can't load. Confetti and the Fredoka font are now self-hosted.
- The correct answer is highlighted by its position, not by matching text. Before, "12" could light up "120".
- Levels count normal-game answers only, as documented. Old level counters are rebuilt once from game history.
- The timer runs from a fixed deadline, so it stays accurate when the browser slows background timers, and leaving the app no longer pauses it.
- Updates appear in a banner on the Home screen instead of a pop-up that could interrupt a question. The first visit no longer reloads the page.
- The Daily "Start" button respects the high-score celebration lock.
- A first game with 0 points no longer counts as a new high score. The speed bonus is capped at the base points.
- The end-of-round verse now matches the score. Before, it always showed the lowest tier.
- Each round is now actually balanced 4 Old Testament / 4 New Testament / 2 General, with the intended difficulty mix.
- The Settings and How to Play text no longer shows an incorrect "Max N per game".

### Question bank
- 653 duplicate or reworded questions removed. 1,008 distinct questions remain.
- Every question has a permanent `id`, so editing the bank no longer changes saved Daily Challenges.
- 3-option questions completed to 4 options, and ambiguous questions reworded.
- `npm run validate:questions` checks the bank on every build.

### Accessibility
- Welcome links are buttons, so they can be reached with the keyboard.
- Escape closes dialogs, focus stays inside an open dialog and returns to where it was afterwards, and arrow keys move between the Stats tabs.
- Answer feedback is announced to screen readers, and animations are reduced when the device asks for less motion.

### Code and tooling
- The code is rewritten as ES modules, from about 10,600 lines to about 2,100. All game rules live in `src/config.js`.
- Stored data uses the same database and keys, so players keep their progress.
- Each game's results are saved in one transaction, instead of rewriting everything.
- Playwright end-to-end tests run on desktop and mobile layouts, alongside Node unit tests.
- An esbuild build creates `dist/`, and GitHub Actions tests and deploys it to Pages.
- The service worker version comes from the build output, so there's no manual cache bump.
