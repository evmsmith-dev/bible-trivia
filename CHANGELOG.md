# Changelog

## 2.2.2
- Play online: the wording no longer assumes everyone is on a phone. Players can join from any phone, tablet or computer.

## 2.2.1
- Play online: the podium's "Wins tonight" is now **Rounds won**, and it lists every player, including those with 0. It now appears from the second round on, even if nobody scored in a round.

## 2.2.0

### New: Play online with friends
- **👥 Online** on Home: up to 8 players, each on their own phone, answer the same questions at the same moment. One player creates a game and shares a code or invite link.
- The first right answer gets the point, and anyone right within a quarter of a second shares it. The most points wins the round. The host can switch to **Everyone scores** instead: 2 points for first, 1 for any other right answer.
- Answers unlock after 2 seconds (2.5 on Easy), so everyone has time to read. One try per question: a wrong tap locks you out, with no minus points.
- After each question: the right answer, who picked what, who got it first, the scores and a Bible Gateway link.
- The podium at the end of a round, then **Play again** with new questions and how many rounds each player has won. The host chooses the difficulty, 5, 10 or 15 questions, and the scoring.
- If the host's phone goes offline, the next player takes over. Leaving and coming back rejoins the same seat.
- No names and no chat leave the phone: only avatars, answers and five emoji reactions. Right answers count toward your level.
- Needs a one-time Firebase setup: see [docs/firebase-setup.md](docs/firebase-setup.md).

### Also
- Fix: long questions now shrink to fit the window the app really has. On some Android phones that report a taller screen, the last answer could end up below the bottom of the screen.
- Security: a patched version of a Firebase sub-dependency (`@grpc/grpc-js`), and Dependabot opens pull requests for dependency updates each week.
- Security: one seat per player in an online game (one account can't fill a game to lock others out), at most one new game per player every 10 seconds, and CodeQL code scanning on every push. **The database rules changed:** paste `database.rules.json` into Firebase again.
- Online play copes with Firebase's automatic clean-up of anonymous accounts: the app signs in again with a new id, and takes a new seat if it was in a game.
- The built page now carries a Content Security Policy: only the app's own code runs, and it talks only to this site, Firebase and reCAPTCHA.

## 2.1.0

### Question bank review
- Added 100 new questions: 50 easy (Old Testament and General) and 50 hard.
- Reviewed every original question: 81 were corrected or removed for errors (wrong facts, two right answers, claims from tradition rather than Scripture), and 316 duplicates were removed.
- The bank now has 752 questions. The How to Play count updates automatically.

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
