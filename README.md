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
- Settings controls for gameplay preferences (including review preference)
- Leaderboard and history views with mode-based displays
- PWA support through `manifest.json` and `service-worker.js`
- Offline-first behavior using service worker asset caching
- Update notification flow when a new service worker version is installed

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
