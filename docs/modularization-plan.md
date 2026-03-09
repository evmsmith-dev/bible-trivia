# Modularization Plan (Phased)

## Phase 1 (Completed)

Goal: establish structure and guardrails without changing runtime behavior.

Completed items:
- Added module folder scaffold under `src/`.
- Added placeholder module entry file at `src/main.js`.
- Added module area README notes for planned ownership boundaries.
- Did not change `index.source.html` runtime wiring in this phase.

Verification intent for this phase:
- Existing app behavior should be unchanged.
- Existing build/verify workflow should continue to run:
  - `py scripts/publish_prep.py`
  - `py scripts/test_minified.py index.html index.source.html`

## Phase 2 (Next)

Goal: extract shared constants and pure utilities first.

Scope:
- Create `src/core/constants.js` and `src/core/utils.js`.
- Move pure functions only (normalization, score sorting, date/random helpers).
- Keep DOM and storage side effects in current file initially.

Definition of done:
- App behavior unchanged.
- Existing build/test commands pass.

### Phase 2 Status Update

Completed in this iteration:
- Added `src/core/constants.js` with shared constants used across game logic.
- Added `src/core/utils.js` with pure helper functions (normalization, score helpers, date/seed helpers, stats sanitizers, streak helpers).

Intentional constraint for safety:
- Runtime wiring in `index.source.html` remains unchanged in this step.
- Module adoption into live runtime will happen incrementally in the next phase to reduce regression risk.

## Phase 3

Goal: extract persistence layer.

Scope:
- Move DBManager and storage key logic into `src/storage/`.
- Keep API-compatible wrappers for current call sites.

Definition of done:
- IndexedDB path and localStorage fallback both still work.

### Phase 3 Status Update

Completed in this iteration:
- Added browser runtime helper script: `src/core/runtime-utils.js`.
- Loaded runtime helper before inline app logic in `index.source.html`.
- Delegated initial pure helper set with fallback logic:
  - `normalizeDifficultyMode`
  - `normalizeRoundReviewPreference`
  - `isValidHighScoreRecord`
  - `compareScoresDescending`
  - `getTopScoresByMode`
  - `normalizeAndTrimHighScores`
- Added `src/core/runtime-utils.js` to service worker cache asset list.
- Bumped service worker cache name to force fresh cache population.

Additional batch completed:
- Delegated date/seed/shuffle helpers to runtime core utility layer with fallback logic in place.
- Delegated streak helper functions to runtime core utility layer with fallback logic in place.
- Delegated stats and daily sanitize/default helper functions to runtime core utility layer with fallback logic in place.
- Delegated DB validation helpers to runtime core utility layer with fallback logic in place.

Latest batch completed:
- Added `src/storage/keys.js` to centralize player-scoped storage key construction.
- Added `src/storage/db-manager.js` with extracted IndexedDB manager factory (`createDBManager`).
- Wired `index.source.html` to load storage runtime scripts before inline app logic.
- Switched inline `DBManager` initialization to prefer the extracted storage module with inline fallback retained.
- Repointed inline storage key constants to module-generated keys with inline fallback retained.
- Added new storage runtime assets to service worker cache list and bumped cache name.

Latest batch completed (continued):
- Added `src/storage/profile-store.js` to encapsulate player profile localStorage persistence.
- Wired profile store runtime before inline app logic and delegated profile load/save helpers with inline fallback retained.
- Added profile store runtime asset to service worker cache list and bumped cache name.

Latest batch completed (key-value helpers):
- Added `src/storage/key-value-store.js` for date-key reads and local counter increment operations.
- Wired key-value store runtime before inline app logic and delegated daily pulse storage helpers with inline fallback retained.
- Added key-value store runtime asset to service worker cache list and bumped cache name.

Latest batch completed (fallback persistence):
- Added `src/storage/fallback-store.js` to encapsulate localStorage fallback snapshot load/save behavior.
- Wired fallback store runtime before inline app logic and delegated `loadDataFromLocalStorage`/`saveDataToLocalStorage` with inline fallback retained.
- Added fallback store runtime asset to service worker cache list and bumped cache name.

Latest batch completed (constants runtime delegation):
- Added `src/core/runtime-constants.js` to expose shared constants to the inline runtime via `window.BibleTriviaConstants`.
- Wired runtime constants script before inline app logic.
- Delegated core inline constants (game modes, difficulty/review keys, level thresholds, streak config) with inline fallback retained.
- Added runtime constants asset to service worker cache list and bumped cache name.

Latest batch completed (constants expansion):
- Expanded `src/core/constants.js` and `src/core/runtime-constants.js` with daily/timing/scoring constants used by inline runtime.
- Delegated additional inline constants (`DAILY_CHALLENGE_DIFFICULTY_MODE`, `DAILY_CHALLENGE_RECENT_LIMIT`, auto-advance timings, question/high-score limits, feedback and daily bonus thresholds) to `CoreConstants` with safe numeric fallback guards.
- Kept the required test marker literal `GAME_MODE_DAILY = 'daily'` unchanged.

## Phase 4

Goal: centralize mutable app state.

Scope:
- Move global mutable state into `src/core/state.js`.
- Replace direct global mutation with state accessors.

### Phase 4 Status Update

Completed in this iteration:
- Added browser runtime state helper script: `src/core/runtime-state.js` with an app state factory for `currentGameMode`, `difficultyMode`, and `roundReviewPreference`.
- Loaded runtime state helper before inline app logic in `index.source.html`.
- Added inline state accessor helpers (`setCurrentGameMode`, `setDifficultyMode`, `setRoundReviewPreference`) that sync inline variables with runtime state store.
- Replaced key direct mutations across data load/save and settings handlers to use state accessor helpers.
- Added `src/core/runtime-state.js` to service worker cache asset list and bumped cache name.

Additional batch completed:
- Extended runtime state helper to include `playerStats`, `dailyStats`, and `dailyChallengeMap` accessors.
- Added inline state helpers (`setPlayerStats`, `setDailyStats`, `setDailyChallengeMap`) and synchronized them with runtime state.
- Replaced core object-state mutation points in load/save/reset flows and daily-data sanitization to use those helpers.
- Bumped service worker cache name to refresh updated runtime assets.

Additional batch completed (continued):
- Extended runtime state helper to include `gameHistory`, `highScores`, and `playerProfile` accessors.
- Added inline state helpers (`setGameHistory`, `setHighScores`, `setPlayerProfile`) and synchronized them with runtime state.
- Replaced key mutation points in IndexedDB/localStorage load paths, score updates, profile loading, and reset flow to use those helpers.
- Bumped service worker cache name to refresh updated runtime assets.

Additional batch completed (round counters):
- Extended runtime state helper to include `currentIndex`, `correctCount`, and `totalScore` accessors.
- Added inline state helpers (`setCurrentIndex`, `setCorrectCount`, `setTotalScore`) and synchronized them with runtime state.
- Replaced round reset and answer/timer progression counter mutations to use those helpers.

Additional batch completed (streak counters):
- Extended runtime state helper to include `currentGameStreak`, `currentGameMaxStreak`, and `bonusCarryStreak` accessors.
- Added inline state helpers (`setCurrentGameStreak`, `setCurrentGameMaxStreak`, `setBonusCarryStreak`) and synchronized them with runtime state.
- Replaced streak reset/progression mutations in game start and answer handling flows to use those helpers.

Additional batch completed (session/flow flags):
- Extended runtime state helper to include session and celebration flags: `activeDailyChallengeDateKey`, `activeDailyChallengeRecord`, `lastRoundReview`, `pendingHighScoreCelebrationScore`, `pendingLevelCelebrationLevel`, `pendingDailyCompletionCelebration`, and `isHighScoreCelebrationActive`.
- Added inline state helpers for those flags and synchronized them with runtime state.
- Replaced direct assignments in game start/end, summary/celebration flow, and daily navigation reset to use the new setters.

Additional batch completed (ephemeral runtime fields):
- Extended runtime state helper to include `gameQuestions`, `timeLeftAtAnswer`, and `timerInterval` accessors.
- Added inline state helpers (`setGameQuestions`, `setTimeLeftAtAnswer`, `setTimerInterval`) and synchronized them with runtime state.
- Replaced direct assignments in game start and timer lifecycle flow to use the new setters.

## Phase 5

Goal: extract game engine logic.

Scope:
- Move question selection/scoring/timer logic to `src/core/`.

### Phase 5 Status Update

Completed in this iteration:
- Added browser runtime engine helper script: `src/core/runtime-engine.js`.
- Delegated timer-limit resolution through engine helper (`getTimeLimitForMode`) with inline fallback retained.
- Delegated score calculation through engine helper (`calculatePointBreakdown`) with inline fallback retained.
- Loaded runtime engine helper before inline app logic in `index.source.html`.
- Added `src/core/runtime-engine.js` to service worker cache asset list and bumped cache name.

Additional batch completed:
- Added extracted balanced selection helper to runtime engine (`selectBalancedQuestionsForMode`).
- Delegated inline `selectBalancedQuestionsForMode` to runtime engine helper with inline fallback retained.

## Phase 6

Goal: extract feature modules incrementally.

Scope order:
1. Daily challenge
2. Player profile
3. Leaderboard/history/stats

### Phase 6 Status Update

Completed in this iteration:
- Added `src/features/daily/runtime-daily.js` for extracted daily feature helpers.
- Wired daily feature runtime script in `index.source.html` before inline app logic.
- Delegated daily helper functions with inline fallback retained:
  - `createDefaultDailyChallengeRecord`
  - `applyDailyCompletionToStats`
  - `getDailyChallengeStatusText`
- Added daily feature runtime asset to service worker cache list and bumped cache name.

Additional batch completed:
- Expanded `src/features/daily/runtime-daily.js` with extracted daily challenge orchestration helpers.
- Delegated additional inline daily helpers with inline fallback retained:
  - `selectDailyChallengeQuestions`
  - `hydrateDailyQuestions`
  - `getOrCreateDailyChallengeRecord`
- Bumped service worker cache name to refresh updated daily runtime behavior.

Additional batch completed (daily start flow):
- Expanded `src/features/daily/runtime-daily.js` with `prepareDailyChallengeStart` to orchestrate daily-start setup and validation.
- Delegated inline `startDailyChallenge` to the daily runtime helper with inline fallback retained.

Additional batch completed (daily UI helpers):
- Expanded `src/features/daily/runtime-daily.js` with daily UI helpers:
  - `renderWelcomeDailyCard`
  - `buildDailyLeaderboardHtml`
- Delegated inline daily overlay/card rendering helpers with inline fallback retained:
  - `renderWelcomeDailyCard`
  - `buildDailyLeaderboardHtml`

Additional batch completed (daily overlay orchestration):
- Expanded `src/features/daily/runtime-daily.js` with daily overlay helpers:
  - `refreshDailyChallengeCard`
  - `openDailyChallengeOverlay`
- Delegated inline daily overlay orchestration helpers with inline fallback retained:
  - `refreshDailyChallengeCard`
  - `openDailyChallengeOverlay`

Additional batch completed (daily panel wiring):
- Expanded `src/features/daily/runtime-daily.js` with `renderDailyLeaderboardPanel` to centralize daily panel DOM update behavior.
- Added inline delegating helper `renderDailyLeaderboardPanel` and replaced duplicate daily-panel render blocks in leaderboard overlay paths with fallback retained.

Additional batch completed (daily pulse helpers):
- Expanded `src/features/daily/runtime-daily.js` with daily pulse/acknowledgement helpers:
  - `shouldPulseDailyChallengeLink`
  - `updateDailyChallengeLinkPulse`
  - `acknowledgeDailyChallengeLinkClick`
- Delegated inline pulse/ack helpers to daily runtime with inline fallback retained.

Additional batch completed (pulse reset scheduling):
- Expanded `src/features/daily/runtime-daily.js` with `scheduleDailyChallengePulseReset`.
- Delegated inline pulse reset scheduling helper with timer-state synchronization and inline fallback retained.

Additional batch completed (daily bonus helpers):
- Expanded `src/features/daily/runtime-daily.js` with daily bonus helpers:
  - `isDailyBaseBonusActive`
  - `getDailyBaseBonusPoints`
- Delegated inline daily bonus helpers with inline fallback retained.

Additional batch completed (daily completion check):
- Expanded `src/features/daily/runtime-daily.js` with `isDailyChallengeCompletedForDate`.
- Delegated inline daily completion-check helper with inline fallback retained.

Additional batch completed (pulse utility helpers):
- Expanded `src/features/daily/runtime-daily.js` with pulse utility helpers:
  - `getStoredPulseDateKey`
  - `incrementDailyPulseCounter`
- Delegated inline pulse utility helpers with inline fallback retained.

Additional batch completed (player profile start):
- Added `src/features/player/runtime-player.js` with extracted pure player profile and leveling helpers.
- Delegated inline player helpers with inline fallback retained:
  - `createDefaultPlayerProfile`
  - `sanitizePlayerName`
  - `sanitizePlayerProfile`
  - `getPlayerLevelFromCorrectCount`
- Added player runtime asset to service worker cache list and bumped cache name.

Additional batch completed (player avatar helpers):
- Expanded `src/features/player/runtime-player.js` with avatar helpers:
  - `getAvatarById`
  - `getAvatarHtml`
  - `setPlayerAvatarPreview`
- Delegated inline avatar helpers with inline fallback retained.

Additional batch completed (player presentation helpers):
- Expanded `src/features/player/runtime-player.js` with presentation helpers:
  - `renderWelcomePlayerEntry`
  - `refreshSummaryPlayerDisplay`
- Delegated inline player presentation helpers with inline fallback retained.

Additional batch completed (player overlay orchestration):
- Expanded `src/features/player/runtime-player.js` with overlay orchestration helpers:
  - `refreshPlayerOverlayFields`
  - `openPlayerOverlay`
  - `closePlayerOverlay`
- Delegated inline player overlay orchestration helpers with inline fallback retained.

Additional batch completed (leaderboard/history/stats start):
- Added `src/features/leaderboard/runtime-leaderboard.js` for extracted leaderboard/history/stats helpers.
- Delegated inline leaderboard helpers with inline fallback retained:
  - `formatTimestampForDisplay`
  - `buildLeaderboardHtml`
  - `buildGameHistoryHtml`
  - `buildLifetimeStatsHtml`
  - `renderLeaderboardOverlayFromCurrentState`
  - `openLeaderboardOverlay`
- Wired leaderboard feature runtime script before inline app logic.
- Added leaderboard runtime asset to service worker cache list and bumped cache name.

Additional batch completed (leaderboard tab-state wiring):
- Expanded `src/features/leaderboard/runtime-leaderboard.js` with tab/panel activation helpers:
  - `setActiveLeaderboardPanel`
  - `activateDefaultLeaderboardPanel`
- Delegated inline leaderboard tab activation wiring to the leaderboard runtime helper with inline fallback retained.

Additional batch completed (leaderboard interaction wiring):
- Expanded `src/features/leaderboard/runtime-leaderboard.js` with interaction helpers:
  - `bindLeaderboardTabClicks`
  - `closeLeaderboardOverlay`
- Delegated inline leaderboard tab-click binding and overlay close handlers to leaderboard runtime helpers with inline fallback retained.
- Bumped service worker cache name to refresh updated runtime assets.

Additional batch completed (leaderboard initializer wiring):
- Expanded `src/features/leaderboard/runtime-leaderboard.js` with `initializeLeaderboardOverlayBindings` to centralize leaderboard DOM event registration.
- Delegated inline leaderboard DOMContentLoaded initializer block to runtime helper with inline fallback retained.
- Bumped service worker cache name to refresh updated runtime assets.

Additional batch completed (leaderboard fallback cleanup):
- Removed remaining leaderboard-specific fallback event wiring from the generic fallback initializer block.
- Removed unused inline `renderLeaderboardFallback` helper now that leaderboard rendering/open wiring is centralized.
- Kept non-leaderboard fallback handlers unchanged.

Additional batch completed (daily initializer wiring):
- Expanded `src/features/daily/runtime-daily.js` with daily overlay wiring helpers:
  - `closeDailyChallengeOverlay`
  - `initializeDailyChallengeOverlayBindings`
- Delegated inline daily DOMContentLoaded initializer block to daily runtime helper with inline fallback retained.
- Removed duplicate daily overlay fallback handlers from the generic fallback initializer block.
- Bumped service worker cache name to refresh updated runtime assets.

## Phase 7

Goal: extract UI wiring and bootstrap.

Scope:
- DOM cache and renderers in `src/ui/`.
- Event registration and app start in `src/main.js`.

### Phase 7 Status Update

Completed in this iteration:
- Added `src/ui/runtime-ui.js` with extracted generic UI overlay helpers:
  - `showOverlay`
  - `hideOverlay`
  - `initializeHowToPlayOverlayBindings`
  - `initializeFallbackOverlayBindings`
- Wired UI runtime script before inline app logic in `index.source.html`.
- Delegated inline how-to-play overlay and generic fallback overlay initializer blocks with inline fallback retained.
- Added UI runtime asset to service worker cache list and bumped cache name.

Additional batch completed (settings overlay visibility wiring):
- Expanded `src/ui/runtime-ui.js` with `initializeSettingsOverlayBindings` for settings open/close event registration.
- Delegated settings overlay visibility wiring in the inline settings initializer to UI runtime helper with inline fallback retained.
- Bumped service worker cache name to refresh updated runtime assets.

Additional batch completed (settings presentation helpers):
- Expanded `src/ui/runtime-ui.js` with settings presentation helpers:
  - `updateSettingsModeDescription`
  - `syncDifficultyButtonsUI`
  - `syncReviewPreferenceButtonsUI`
- Delegated inline settings presentation sync helpers to UI runtime with inline fallback retained.

Additional batch completed (settings preference listener wiring):
- Expanded `src/ui/runtime-ui.js` with `initializeSettingsPreferenceBindings` to register difficulty/review button listeners.
- Delegated inline settings preference listener wiring to UI runtime helper while keeping state mutation/persistence callbacks inline.
- Bumped service worker cache name to refresh updated runtime assets.

Additional batch completed (player overlay listener wiring):
- Expanded `src/ui/runtime-ui.js` with `initializePlayerOverlayBindings` to register player overlay interaction listeners.
- Delegated inline player overlay listener registration to UI runtime helper while keeping player-state mutation and persistence callbacks inline.
- Bumped service worker cache name to refresh updated runtime assets.

Additional batch completed (lifecycle/bootstrap wiring):
- Expanded `src/ui/runtime-ui.js` with bootstrap helpers:
  - `initializeAppLifecycleBindings`
  - `registerServiceWorkerWithUpdatePrompt`
- Delegated inline lifecycle event and service-worker update prompt wiring to UI runtime helpers with inline fallback retained.
- Bumped service worker cache name to refresh updated runtime assets.

Additional batch completed (app data bootstrap):
- Expanded `src/ui/runtime-ui.js` with `initializeAppDataBootstrap` to centralize startup DB init/load/render behavior.
- Delegated inline startup IIFE to UI runtime helper with inline fallback retained.
- Bumped service worker cache name to refresh updated runtime assets.

Additional batch completed (service-worker update handler wiring):
- Expanded `src/ui/runtime-ui.js` with `attachServiceWorkerUpdatePromptHandlers` and reused it from the UI runtime service-worker registration helper.
- Delegated inline service-worker `updatefound/statechange` prompt wiring to a dedicated helper while preserving the required literal `navigator.serviceWorker.register('service-worker.js')` fallback marker.
- Bumped service worker cache name to refresh updated runtime assets.

Additional batch completed (main bootstrap entry start):
- Replaced `src/main.js` Phase 1 placeholder with browser runtime bootstrap helper (`bootstrapMainInitializers`).
- Wired `src/main.js` before inline app logic and delegated the top-level startup initializer registrations to `MainFeature` with inline fallback retained.
- Added `src/main.js` to service worker cache assets and bumped cache name.

Additional batch completed (main bootstrap expansion):
- Converted inline settings and player startup `DOMContentLoaded` blocks into callable initializer functions.
- Extended `src/main.js` bootstrap helper payload to orchestrate those initializer functions on DOMContentLoaded.
- Kept inline fallback orchestration path aligned and bumped service worker cache name.

Additional batch completed (main section delegation):
- Expanded `src/main.js` with extracted startup section helpers:
  - `initializeSettingsOverlaySection`
  - `initializePlayerOverlaySection`
- Delegated inline settings/player section orchestration in `index.source.html` to `MainFeature` helpers with inline fallback retained.
- Bumped service worker cache name to refresh updated runtime assets.

Additional batch completed (main startup runner):
- Expanded `src/main.js` with `runAppStartup` to orchestrate final startup sequence:
  - app data bootstrap
  - lifecycle bindings
  - service-worker registration
- Delegated final inline startup block in `index.source.html` to `MainFeature.runAppStartup` with inline fallback retained.
- Bumped service worker cache name to refresh updated runtime assets.

## Phase 8

Goal: move question bank out of HTML.

Scope:
- Relocate allQuestions data into `src/data/`.
- Preserve question IDs and selection behavior.

### Phase 8 Status Update

Completed in this iteration:
- Added `src/data/runtime-questions.js` as the runtime question-bank provider (`getAllQuestions`).
- Extracted the inline `allQuestions` bank (including auto-generated expansion block) from `index.source.html` into the data runtime script.
- Wired `index.source.html` to source question data from `window.BibleTriviaData` with a safe empty-array fallback if the data runtime is unavailable.
- Added `src/data/runtime-questions.js` to service worker cache assets and bumped cache name.

Additional batch completed (fallback hardening):
- Added a small inline fallback question set in `index.source.html` so the game remains playable if `src/data/runtime-questions.js` fails to load.
- Updated `src/data/runtime-questions.js` `getAllQuestions` to return defensive copies (including cloned `opts` arrays) to avoid mutating the source bank through runtime state changes.
- Bumped service worker cache name to refresh updated runtime data behavior.

Additional batch completed (question-bank split):
- Added `src/data/questions-bank.js` to hold the extracted full question payload (`allQuestions`).
- Reduced `src/data/runtime-questions.js` to runtime accessor logic that reads from `window.BibleTriviaQuestionBank` and returns defensive copies.
- Wired `index.source.html` to load `src/data/questions-bank.js` before `src/data/runtime-questions.js`.
- Added `src/data/questions-bank.js` to service worker cache assets and bumped cache name.

Additional batch completed (question prep helper extraction):
- Expanded `src/data/runtime-questions.js` with `getPreparedQuestions` to centralize question-source selection (bank vs inline fallback) and stable ID assignment.
- Updated `index.source.html` to prefer `DataFeature.getPreparedQuestions({ fallbackQuestions })` while keeping legacy `getAllQuestions` fallback behavior.
- Bumped service worker cache name to refresh updated question-preparation behavior.

Additional batch completed (fallback payload extraction):
- Added `src/data/fallback-questions.js` to hold the minimal non-empty fallback question set.
- Removed inline fallback question payload from `index.source.html` and switched wiring to `window.BibleTriviaFallbackQuestions`.
- Expanded `src/data/runtime-questions.js` with `getFallbackQuestions` and defaulted `getPreparedQuestions` to that fallback source when no payload override is provided.
- Added `src/data/fallback-questions.js` to service worker cache assets and bumped cache name.

Additional batch completed (question runtime payload helper):
- Expanded `src/data/runtime-questions.js` with `prepareQuestionRuntimePayload` and `buildQuestionsById` to centralize question list + ID map preparation.
- Updated `index.source.html` to prefer the new payload helper and removed the redundant inline ID-assignment loop.
- Kept legacy fallback paths intact for safety when the new helper is unavailable.
- Bumped service worker cache name to refresh updated runtime behavior.

Additional batch completed (generated expansion split):
- Added `src/data/questions-bank-generated.js` containing the large auto-generated question expansion payload.
- Reduced `src/data/questions-bank.js` to base question data plus merge of `window.BibleTriviaGeneratedQuestionExpansion`.
- Wired `index.source.html` to load `src/data/questions-bank-generated.js` before `src/data/questions-bank.js`.
- Added generated expansion asset to service worker cache list and bumped cache name.

Additional batch completed (index bootstrap minimization):
- Added `getQuestionRuntimePayload` in `src/data/runtime-questions.js` to provide a one-call prepared questions payload.
- Simplified `index.source.html` question bootstrap to use `DataFeature.getQuestionRuntimePayload()` and removed multi-branch inline fallback/normalization logic.
- Kept the minimal inline `Map` fallback creation only as a defensive guard.
- Bumped service worker cache name to refresh updated runtime behavior.

Additional batch completed (player avatar options extraction):
- Expanded `src/features/player/runtime-player.js` with `renderPlayerAvatarOptions` to centralize avatar option HTML generation, paging-state UI updates, and option click binding.
- Delegated inline `renderPlayerAvatarOptions` in `index.source.html` to the player runtime helper while preserving the existing inline fallback path.
- Kept avatar persistence/state side effects in inline callback wiring for safety.
- Bumped service worker cache name to refresh updated runtime behavior.

## Deployment and PWA Notes

When runtime switches from inline script to modules or bundles:
- Keep deploy target as `index.html` for GitHub Pages.
- Ensure all new JS assets are published with relative paths.
- Update `service-worker.js` `ASSETS_TO_CACHE` with new files.
- Bump service worker `CACHE_NAME` on deploy-breaking asset changes.
- Update `scripts/test_minified.py` markers that currently assume inline JS markers.

## Phase 9 (In Progress)

Goal: reduce `index.source.html` by removing now-redundant inline fallback implementations.

### Phase 9 Status Update

Completed in this iteration:
- Added runtime dependency guardrails in `src/main.js`:
  - `getMissingRuntimeDependencies`
  - `validateRuntimeDependencies`
  - bootstrap now exits early on missing required runtime APIs.
- Removed inline fallback bodies in `index.source.html` for extracted core helper groups and delegated directly to runtime modules:
  - normalization and high-score helpers
  - player/daily stats sanitizers and default builders
  - date/seed/random helpers
  - streak helper math
  - engine helpers (`selectBalancedQuestionsForMode`, `getCurrentTimeLimit`, `calculatePoints`)
- Removed large duplicate fallback implementations from the second inline startup script and delegated directly to `MainFeature` for:
  - `initializeSettingsOverlaySection`
  - `initializePlayerOverlaySection`
  - `runAppStartup`

Verification completed:
- `py scripts/publish_prep.py`
- `py scripts/test_minified.py index.html index.source.html`

Measured reduction in this iteration:
- `index.source.html` line count: `6807 -> 6302` (reduced by 505 lines).

Additional batch completed:
- Further reduced `index.source.html` by removing more inline fallback bodies and delegating directly to runtime modules:
  - UI/bootstrap helpers (`showOverlay`, `hideOverlay`, overlay/binding initializers, lifecycle/service-worker/bootstrap wrappers)
  - Player presentation/overlay helpers (`getAvatarById`, `getPlayerLevelFromCorrectCount`, `getAvatarHtml`, `renderWelcomePlayerEntry`, `refreshSummaryPlayerDisplay`, `refreshPlayerOverlayFields`, `openPlayerOverlay`, `closePlayerOverlay`)
  - Daily/leaderboard overlay orchestration helpers (`openDailyChallengeOverlay`, `closeDailyChallengeOverlay`, `initializeDailyChallengeOverlayBindings`, `openLeaderboardOverlay`)
- Restored and simplified centralized startup/render delegators after cleanup:
  - `initializeAppDataBootstrap`
  - `bootstrapMainInitializers`
  - `renderLeaderboardOverlayFromCurrentState`

Validation constraints reinforced in this batch:
- Preserved required publish/test marker literals in minified output (including explicit service-worker registration marker) to keep `scripts/test_minified.py` passing.

Measured reduction after this additional batch:
- `index.source.html` line count: `6302 -> 5916` (reduced by 386 lines).
- Cumulative reduction since Phase 9 start: `6807 -> 5916` (reduced by 891 lines).

Additional batch completed:
- Removed remaining fallback-heavy leaderboard/daily/player-avatar wrapper bodies in `index.source.html` and switched them to direct runtime delegation:
  - leaderboard presentation and wiring helpers
  - daily card/leaderboard/pulse helper wrappers
  - player avatar preview/options wrappers
  - daily and leaderboard overlay open/close/wiring wrappers
- Repaired a transient malformed block introduced during refactor and restored the missing `setPlayerNameEditMode` helper.

Verification completed for this batch:
- `py scripts/publish_prep.py`
- `py scripts/test_minified.py index.html index.source.html`

Measured reduction after latest batch:
- `index.source.html` line count: `5916 -> 5367` (reduced by 549 lines).
- Cumulative reduction since Phase 9 start: `6807 -> 5367` (reduced by 1440 lines).

Additional batch completed:
- Executed remaining identified fallback slices in `index.source.html`:
  - player profile wrapper fallbacks (`createDefaultPlayerProfile`, `sanitizePlayerName`, `sanitizePlayerProfile`)
  - daily question orchestration wrapper fallbacks (`selectDailyChallengeQuestions`, `hydrateDailyQuestions`, `getOrCreateDailyChallengeRecord`, `startDailyChallenge`)
  - DBManager validator wrapper fallbacks (all CoreUtils validator guard branches)
- Verified that no remaining feature/core `if (typeof XFeature...=== 'function')` fallback guards remain in `index.source.html` for the targeted runtime namespaces.

Verification completed for this batch:
- `py scripts/publish_prep.py`
- `py scripts/test_minified.py index.html index.source.html`

Measured reduction after this batch:
- `index.source.html` line count: `5367 -> 5202` (reduced by 165 lines).
- Cumulative reduction since Phase 9 start: `6807 -> 5202` (reduced by 1605 lines).

### Phase 9 Next Steps

Priority opportunities to further reduce `index.source.html`:
- Remove the inline DBManager fallback implementation and rely on `src/storage/db-manager.js` runtime initialization only.
- Move remaining inline localStorage load/save helpers to storage runtime modules:
  - `loadDataFromLocalStorage`
  - `saveDataToLocalStorage`
- Extract remaining inline game-loop/orchestration logic to runtime modules (`src/core/runtime-engine.js` and UI/feature runtimes), including:
  - timer lifecycle
  - answer handling
  - end-game/summary/review flow
- Collapse the second inline startup script block into `src/main.js` so `index.source.html` keeps only minimal bootstrap wiring.
- Continue replacing direct DOM/storage-heavy inline plumbing with module delegates to converge on markup-first `index.source.html`.

### Phase 9 Completion Update

Completed in this iteration:
- Collapsed the second inline startup script block in `index.source.html` into the primary runtime script block.
- Kept startup wiring delegated through `MainFeature` while removing duplicate inline script wrappers and reducing split bootstrap surface.
- Preserved required marker literals and guard patterns used by `scripts/test_minified.py`.

Verification completed:
- `py scripts/publish_prep.py`
- `py scripts/test_minified.py index.html index.source.html`

Current boundary to full externalization:
- `scripts/test_minified.py` currently asserts several runtime logic markers/patterns directly in minified `index.html`.
- Full migration of the remaining primary inline script to external runtime files requires first updating marker strategy in the test harness to avoid coupling to inline JS text.

Final completion in this iteration:
- Extracted the remaining primary inline runtime script from `index.source.html` to `src/app-runtime.js`.
- Replaced the large inline `<script>` block with `<script src="src/app-runtime.js"></script>`.
- Added `src/app-runtime.js` to `service-worker.js` cache assets.
- Updated `scripts/test_minified.py` to validate required runtime markers against minified HTML plus referenced local runtime scripts (supports quoted and unquoted `src=` forms), preserving smoke coverage after externalization.

Measured reduction after final extraction:
- `index.source.html` line count: `5082 -> 347`.

Phase 9 status:
- Completed. `index.source.html` is now primarily markup/bootstrap wiring, with runtime logic externalized under `src/` modules.

## Modularization Final Status

Overall project modularization status: **Complete**.

Final state summary:
- `index.source.html` is reduced to markup/bootstrap composition.
- Runtime logic is externalized to `src/` modules, including `src/app-runtime.js` and feature/core/storage runtime files.
- Styles are externalized in `src/ui/styles.css`.
- Build/verification pipeline remains green:
  - `py scripts/publish_prep.py`
  - `py scripts/test_minified.py index.html index.source.html`
