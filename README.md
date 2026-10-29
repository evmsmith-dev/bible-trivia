# Bible Trivia

A Bible trivia game that runs in the browser and installs as an app (PWA) on phones and computers. Players answer timed multiple-choice questions, earn speed and streak bonuses, level up, and take a Daily Challenge. It works offline after the first visit.

## Features

- 1,000+ questions across Old Testament, New Testament and General, in four modes:

  | Mode | Questions | Base points | Time |
  |---|---|---|---|
  | 🟢 Easy | easy | 50 | 25 s |
  | 🟠 Medium | easy + medium | 100 | 25 s |
  | 🔴 Hard | medium + hard | 150 | 21 s |
  | ⚫ Super Hard | hard | 250 | 18 s |

  Each round has 10 questions, balanced 4 Old Testament / 4 New Testament / 2 General.
- Speed bonus (up to double the base points) and a streak bonus (from 3 in a row, capped at 10) that carries across "Play" rounds.
- Rounds prefer questions the player hasn't seen recently (the last 500 are remembered on the device).
- Daily Challenge: the same 10 questions for everyone on a given day, and a different set on each retry. Scoring 70%+ completes it and adds +5% base points for the rest of the day. Completed days build a daily streak, and results can be shared as an emoji grid.
- Player profile with name, 24 avatars and 12 levels. Levels count correct answers in normal games only.
- Round review with Bible Gateway links, top scores per mode, game history, lifetime stats and daily results.
- Keyboard play (keys 1–4), Escape closes dialogs, and animations are reduced for players who ask for less motion.
- Everything is saved on the device (IndexedDB, with localStorage as a fallback). There are no accounts and no server.

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
  features/              player profile, daily challenge, stats, settings
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

## Deploying

Pushing to `main` runs `.github/workflows/deploy.yml`. It validates the questions, runs all tests, builds `dist/` and publishes it to GitHub Pages.

One-time setup: in the GitHub repo, go to **Settings → Pages → Build and deployment → Source** and choose **GitHub Actions**.

The build gives the service worker a new version whenever any file changes. Installed apps then show an "update available" banner on the Home screen, and there's no cache name to bump by hand. To release a version with a new number, change `version` in `package.json`.

## Saved data compatibility

Version 2 reads the same IndexedDB database (`BibleTriviaDB_player_primary`) and localStorage keys (`bibleTriviaPlayer_primary_*`) as version 1, so players keep their scores, history, settings and profile. One change on first load: the level counter is rebuilt from normal-game history, because version 1 mistakenly counted Daily Challenge answers toward levels.

## Debugging

Add `?debug` to the URL, or run `localStorage.setItem("bibleTrivia_debug", "1")` in the console, to see storage logs.
