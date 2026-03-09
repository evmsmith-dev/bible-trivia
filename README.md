# Bible Trivia

Static Bible trivia app for web and GitHub Pages.

## Version Info

- Runtime cache version: `bible-trivia-cache-v1.9.105` (`service-worker.js`)
- Package version: `1.9.105` (`package.json`)
- Daily challenge mode version: `v1` (`index.source.html`)

## App Overview

Bible Trivia is a single-page quiz game focused on Scripture knowledge. Players answer multiple-choice questions under a timer, receive immediate feedback, and see their score progression throughout each round. The app is designed to work well on desktop and mobile and can be installed as a PWA.

## Current Feature Set

- Multiple-choice Bible questions across Old Testament, New Testament, and General categories
- Question pool expanded to 1000+ questions
- Difficulty support (`easy`, `medium`, `hard`, `superHard`) with visible per-question difficulty tags
- Mode-based scoring and timers:
  - Easy: 50 pts, 25s (max 500/game)
  - Medium: 100 pts, 25s (max 1000/game)
  - Hard: 150 pts, 21s (max 1500/game)
  - Super Hard: 250 pts, 18s (max 2500/game)
- Timed gameplay with countdown display, progress bar, timeout handling, and per-question feedback states
- Round scoring with progress dots, correct-count tracking, and end-of-round summary
- Speed bonus and streak bonus system (streak tiers begin at 3, cap at 10)
- Streak carryover support across normal rounds, with carryover messaging
- Daily Challenge mode with once-per-day flow and completion tracking
- Daily bonus unlock: reaching 70%+ in Daily Challenge grants +5% base-point bonus for the rest of that day
- Review flow for completed rounds, including per-question correctness and references
- Configurable post-round review preference (`ask`, `alwaysReview`, `alwaysSkip`)
- Single local Player profile (no login required)
- Player profile editor with save-only updates for name and avatar
- Built-in avatar picker with paged options (24 total: 8 emoji + 16 bundled image avatars)
- Level system tied to lifetime correct answers in normal gameplay modes (daily challenge excluded)
- Player entry point on Welcome and Summary screens
- Player overlay actions to open Settings and Leaderboard overlays
- Player Stats overlay tabs: Top Scores, Game History, Stats, and Daily
- IndexedDB-backed persistence with localStorage fallback/migration for compatible data
- PWA support through `manifest.json` and `service-worker.js`
- Offline-first behavior using service worker asset caching
- Update notification flow when a new service worker version is installed

## Player Profile System

- Default player is auto-created as `Player` with the first built-in avatar.
- Name validation rules:
  - Leading/trailing spaces are trimmed before validation.
  - Length must be between 2 and 15 characters after trim.
- Avatar rules:
  - Only built-in avatars are available.
  - No custom upload support.
  - Avatars include emoji and bundled SVG images.
  - Bundled image avatars are stored in `icons/avatars/` and cached for offline play.
- Only one player is supported.
- A `Reset Player` action is available in the Player overlay.

### Level Thresholds

Levels increase based on lifetime non-daily correct answers:

1. Level 1: `0-24`
2. Level 2: `25-59`
3. Level 3: `60-109`
4. Level 4: `110-179`
5. Level 5: `180-269`
6. Level 6: `270-389`
7. Level 7: `390-539`
8. Level 8: `540-729`
9. Level 9: `730-969`
10. Level 10: `970-1269`
11. Level 11: `1270-1639`
12. Level 12: `1640+`

### Overlay and Navigation Updates

- Welcome screen:
  - Settings and Leaderboard links are replaced by the Player entry card (avatar, name, level).
- Game summary:
  - The previous leaderboard link is replaced by a Player entry link.
- Player overlay:
  - Allows changing name/avatar (saved only when `Save Profile` is clicked).
  - Provides buttons to open Settings and Leaderboard overlays above it.
  - When those overlays close, Player overlay remains visible.

### Data Storage Scope

- Persisted datasets are player-scoped via storage key prefixes.
- IndexedDB is used when available, with localStorage fallback and migration for compatible legacy records.

## Minification Workflow

This project now uses a source-to-deploy workflow:

- Edit: `index.source.html` (human-readable source)
- Deploy file: `index.html` (minified output used by GitHub Pages)
- Deploy stylesheet: `src/ui/styles.min.css` (generated from `src/ui/styles.css`)
- Deploy scripts: local `*.min.js` files generated from referenced external scripts in `index.source.html`
- Optional artifacts:
  - `index.min.html` (HTML+CSS minified, JS not minified)
  - `index.min.js.html` (HTML+CSS+inline JS minified)

## Why This Setup

GitHub Pages serves `index.html` by default. The workflow keeps a readable source file while generating a smaller deployable page.

## Python-First Commands (Works Without Node/npm)

Run from the repository root.

### 1) Build deployable minified `index.html` (with inline JS + external CSS + external JS minification)

```powershell
py scripts/minify_safe.py --source index.source.html --minify-js --minify-external-css --minify-external-js --output index.html
```

### 2) Verify minified `index.html` still contains critical app markers

```powershell
py scripts/test_minified.py index.html index.source.html
```

### 3) One-step publish prep (recommended)

```powershell
py scripts/publish_prep.py
```

This command does both build and verification.

## npm Script Aliases

If Node.js/npm is installed, these aliases are available in `package.json`:

```powershell
npm run build:pages:py
npm run verify:pages:py
npm run publish:prep:py
```

Additional outputs:

```powershell
npm run minify:safe:py        # writes index.min.html
npm run minify:with-js:py     # writes index.min.js.html
npm run minify:safe:css:py    # writes index.min.html + src/ui/styles.min.css
npm run minify:with-js:css:py # writes index.min.js.html + src/ui/styles.min.css + local *.min.js files
```

## GitHub Pages Publish Steps

1. Edit `index.source.html`.
2. Run `py scripts/publish_prep.py`.
3. Commit and push updated files (including `index.html`).
4. Open the GitHub Pages site and hard refresh once.

## Service Worker Cache Note

`service-worker.js` caches `index.html` and core assets. After changing deploy behavior/content, bump `CACHE_NAME` so existing users receive fresh files.

Current cache version: `bible-trivia-cache-v1.9.105`.
