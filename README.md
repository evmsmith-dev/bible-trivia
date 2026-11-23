# Bible Trivia

A Bible trivia game that runs in the browser and installs as an app (PWA) on phones and computers. Players answer timed multiple-choice questions, earn speed and streak bonuses, level up, and take a Daily Challenge. It works offline after the first visit.

## Features

- 750+ reviewed questions across Old Testament, New Testament and General, in four modes:

  | Mode | Questions | Base points | Time |
  |---|---|---|---|
  | 🟢 Easy | easy | 50 | 25 s |
  | 🟠 Medium | easy + medium | 100 | 25 s |
  | 🔴 Hard | medium + hard | 150 | 21 s |
  | ⚫ Super Hard | hard | 250 | 18 s |

  Each round has 10 questions, balanced 4 Old Testament / 4 New Testament / 2 General.
- Speed bonus (up to double the base points) and a streak bonus (from 3 in a row, capped at 10) that carries across "Play" rounds.
- Rounds prefer questions the player hasn't seen recently (each player's memory can hold the whole question bank, so a question isn't forgotten and repeated early).
- Daily Challenge: the same 10 questions for everyone on a given day, and a different set on each retry. Scoring 70%+ completes it and adds +5% base points for the rest of the day. Completed days build a daily streak, and results can be shared as an emoji grid.
- Player profile with name, 24 avatars and 12 levels. Levels count correct answers in normal games only.
- Round review with Bible Gateway links, top scores per mode, game history, lifetime stats and daily results.
- Keyboard play (keys 1–4), Escape closes dialogs, and animations are reduced for players who ask for less motion.
- **Play online:** up to 8 players on their own phones, tablets or computers answer the same questions at the same time. One player creates a game and shares a 6-character code or link.
  - The first right answer gets the point, and anyone right within 250 ms shares it. The most points wins the round, with ties going to more right answers, then the faster total time. With **Everyone scores**, first gets 2 points and any other right answer 1.
  - Answers unlock 2 s after each question appears (2.5 s on Easy), so everyone has time to read. One try per question: a wrong tap locks you out, with no minus points.
  - The host picks the difficulty, 5, 10 or 15 questions, and the scoring. **Play again** keeps everyone together with new questions and shows how many rounds each player has won.
  - If the host's device goes offline, the next player takes over. Leaving and coming back rejoins the same seat.
  - No names and no chat: only avatars, answers and five emoji reactions are shared. The avatar is the player's profile picture unless they pick another for online play (also from the lobby, which flags two players with the same picture). Right answers count toward the player's level.
  - It runs on Firebase's free plan, which needs a one-time setup: see [docs/firebase-setup.md](docs/firebase-setup.md). Until then, the page says online play isn't set up.
- Everything else is saved on the device (IndexedDB, with localStorage as a fallback). There are no accounts.

## Project layout

```
index.html               page markup (loads src/main.js as an ES module)
data/questions.json      the question bank. Each question has a permanent id
src/
  config.js              all game rules and labels: modes, points, timers, levels, streaks, avatars
  state.js               the single in-memory state
  main.js                startup: load questions and saved data, wire up screens
  game.js                the game loop: countdown, questions, timer, scoring, review, summary
  lib/                   pure logic (unit-tested): scoring, question selection, saved-record shapes, utils
  storage/store.js       saving and loading (IndexedDB + localStorage fallback)
  features/              player profile, daily challenge, stats, settings, multiplayer (Play online)
  online/                online play's backends: Firebase, and a local one for the browser tests
  lib/race.js            online scoring: who got each question first, the scoreboard, round winners
  ui/                    overlays, celebrations, update banner, styles.css
vendor/                  self-hosted confetti library and Fredoka font, so the app works offline
service-worker.js        offline caching. The build fills in the file list and version
scripts/                 build, local server, question validator
tests/unit/              Node unit tests for src/lib
tests/e2e/               Playwright tests that play the game in desktop and mobile browsers
```

## Working on it

You need [Node.js](https://nodejs.org/) 20 or newer.

```bash
npm install                 # once
npx playwright install chromium   # once, for the browser tests

npm start                   # play the source version at http://localhost:8080
npm test                    # validate questions + unit tests + build + browser tests
npm run preview             # build and play the production version at http://localhost:8080
```

The source runs directly in the browser with no build step, so you can edit a file and refresh. Use `npm start` rather than opening `index.html` from disk, because ES modules need a web server.

### Changing game rules

Edit `src/config.js`. The Settings and How to Play text is generated from it.

### Adding or editing questions

Edit `data/questions.json`, then run `npm run validate:questions`. Each question looks like this:

```json
{"id": 1009, "q": "Who was the first man created by God?", "opts": ["Noah", "Adam", "Abraham", "Moses"], "ans": 1, "ref": "Genesis 2:7", "category": "Old Testament", "difficulty": "easy"}
```

- `id`: use the next unused number. **Never change or reuse an id.** Saved Daily Challenges refer to questions by id.
- `opts`: exactly 4 different options. `ans` is the index of the correct one (0–3). Order doesn't matter, because options are shuffled when shown.
- `category`: `Old Testament`, `New Testament` or `General`. `difficulty`: `easy`, `medium` or `hard`.
- `ref`: a scripture reference, or `""`.

The validator fails on structural problems and duplicate questions. `--verbose` lists questions that look alike so you can review them.

New questions can be drafted as a batch in `data/proposed/`, each batch with a review sheet (`*-review.csv`, which opens in Excel). After review, add the approved ones with:

```bash
node scripts/merge-questions.mjs data/proposed/batch-01-easy.json --skip 1663,1670   # ids to leave out
```

### Online play

`src/features/multiplayer.js` draws the screens and talks to a small backend interface in `src/online/`:

- `firebase-backend.js` uses Firebase anonymous sign-in and the Realtime Database. It is loaded only when Play online is opened, so the rest of the app stays small and offline.
- `local-backend.js` stands in for Firebase in the browser tests, where several tabs play each other.
- `common.js` holds the stored game's shape and the pure moves (join, start, answer, next…). The local backend applies them directly, and `database.rules.json` makes the Firebase server apply the same checks.

Every device works out the scores itself from the stored answers (`src/lib/race.js`), so they always agree and no device, not even the host's, can award points. Each answer carries the device's own reaction time and the server's arrival time. The device's figure is trusted only within 300 ms of the server's, which takes out network lag without letting a tampered app gain more than that.

`package.json` overrides `@grpc/grpc-js` to a patched version. It only arrives through Firestore's Node.js code, which the app never bundles, but this keeps `npm audit` clean. Dependabot (`.github/dependabot.yml`) opens pull requests for dependency and GitHub Action updates every week.

`npm run test:rules` checks the security rules in the Firebase emulator (it needs Java). CI runs it on every push. Setup steps are in [docs/firebase-setup.md](docs/firebase-setup.md).

## Deploying

Pushing to `main` runs `.github/workflows/deploy.yml`. It validates the questions, runs all tests, builds `dist/` and publishes it to GitHub Pages.

One-time setup: in the GitHub repo, go to **Settings → Pages → Build and deployment → Source** and choose **GitHub Actions**.

The build gives the service worker a new version whenever any file changes. Installed apps then show an "update available" banner on the Home screen, and there's no cache name to bump by hand. To release a version with a new number, change `version` in `package.json`.

## Saved data compatibility

Version 2 reads the same IndexedDB database (`BibleTriviaDB_player_primary`) and localStorage keys (`bibleTriviaPlayer_primary_*`) as version 1, so players keep their scores, history, settings and profile. One change on first load: the level counter is rebuilt from normal-game history, because version 1 mistakenly counted Daily Challenge answers toward levels.

## Debugging

Add `?debug` to the URL, or run `localStorage.setItem("bibleTrivia_debug", "1")` in the console, to see storage logs.
