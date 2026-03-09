# Bible Trivia

Static Bible trivia app for web and GitHub Pages.

## App Overview

Bible Trivia is a single-page quiz game focused on Scripture knowledge. Players answer multiple-choice questions under a timer, receive immediate feedback, and see their score progression throughout each round. The app is designed to work well on desktop and mobile and can be installed as a PWA.

## Current Feature Set

- Multiple-choice Bible questions across Old Testament, New Testament, and General categories
- Difficulty support (`easy`, `medium`, `hard`) with visible per-question difficulty tags
- Timed gameplay with countdown display, progress bar, and timeout handling
- Round scoring with progress dots, correct-count tracking, and end-of-round summary
- Review flow for completed rounds, including per-question correctness and references
- Single local Player profile (no login required)
- Player profile editor with save-only updates for name and avatar
- Built-in avatar picker with 8 options (emoji + bundled image avatars)
- Level system tied to lifetime correct answers in normal gameplay modes (daily challenge excluded)
- Player entry point on Welcome and Summary screens
- Player overlay actions to open Settings and Leaderboard overlays
- Leaderboard and history views with mode-based displays
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
- App starts fresh for the new player profile model (legacy stats are not migrated).

## Minification Workflow

This project now uses a source-to-deploy workflow:

- Edit: `index.source.html` (human-readable source)
- Deploy file: `index.html` (minified output used by GitHub Pages)
- Optional artifacts:
  - `index.min.html` (HTML+CSS minified, JS not minified)
  - `index.min.js.html` (HTML+CSS+inline JS minified)

## Why This Setup

GitHub Pages serves `index.html` by default. The workflow keeps a readable source file while generating a smaller deployable page.

## Python-First Commands (Works Without Node/npm)

Run from the repository root.

### 1) Build deployable minified `index.html` (with JS minification)

```powershell
py scripts/minify_safe.py --source index.source.html --minify-js --output index.html
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
```

## GitHub Pages Publish Steps

1. Edit `index.source.html`.
2. Run `py scripts/publish_prep.py`.
3. Commit and push updated files (including `index.html`).
4. Open the GitHub Pages site and hard refresh once.

## Service Worker Cache Note

`service-worker.js` caches `index.html`. After changing deploy behavior/content, bump `CACHE_NAME` (already updated to `bible-trivia-cache-v1.4.0`) so existing users receive fresh files.

Current cache version: `bible-trivia-cache-v1.7.0`.
