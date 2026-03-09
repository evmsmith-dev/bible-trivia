from pathlib import Path
import re
import sys

source_path = Path(sys.argv[2]) if len(sys.argv) > 2 else Path('index.source.html')
minified_path = Path(sys.argv[1]) if len(sys.argv) > 1 else Path('index.html')


def fail(message: str) -> None:
    print(f"FAIL: {message}")
    sys.exit(1)


def require_any(text: str, marker_group: list[str], label: str) -> None:
    if not any(marker in text for marker in marker_group):
        fail(f"Missing {label}: one of {marker_group}")


def require_regex(text: str, pattern: str, label: str) -> None:
    if not re.search(pattern, text, flags=re.IGNORECASE | re.DOTALL):
        fail(f"Missing {label} (pattern: {pattern})")


if not source_path.exists():
    fail(f"Missing source file: {source_path}")

if not minified_path.exists():
    fail(f"Missing minified file: {minified_path}. Run minification first.")

source = source_path.read_text(encoding='utf-8')
minified = minified_path.read_text(encoding='utf-8')


def build_runtime_surface(html_text: str, html_base_path: Path) -> str:
    parts = [html_text]
    script_paths = []
    for match in re.finditer(r'<script[^>]+\bsrc\s*=\s*(?:["\']([^"\']+)["\']|([^\s>]+))', html_text, flags=re.IGNORECASE):
        script_paths.append(match.group(1) or match.group(2))
    for src in script_paths:
        if re.match(r'^(?:https?:)?//', src, flags=re.IGNORECASE):
            continue
        if src.startswith('data:'):
            continue
        local_path = (html_base_path / src).resolve()
        if local_path.exists():
            parts.append(local_path.read_text(encoding='utf-8'))
    return "\n".join(parts)


runtime_surface = build_runtime_surface(minified, minified_path.parent)
source_runtime_surface = source + "\n" + runtime_surface

source_bytes = len(source.encode('utf-8'))
minified_bytes = len(minified.encode('utf-8'))
if minified_bytes >= source_bytes:
    fail(f"Minified output is not smaller (source={source_bytes}, minified={minified_bytes}).")

required_any_markers = [
    ['id="welcome"', "id='welcome'", 'id=welcome'],
    ['id="question-container"', "id='question-container'", 'id=question-container'],
    ['id="options"', "id='options'", 'id=options'],
    ['const allQuestions=', 'const allQuestions ='],
    [
        "navigator.serviceWorker.register('service-worker.js')",
        'navigator.serviceWorker.register("service-worker.js")',
        "navigator.serviceWorker.register(`service-worker.js`)",
    ],
]

for marker_group in required_any_markers:
    require_any(runtime_surface, marker_group, "core marker in minified/runtime output")

# Daily challenge: core UI and logic markers should survive minification.
daily_feature_markers = [
    ['id="daily-challenge-link"', "id='daily-challenge-link'", 'id=daily-challenge-link'],
    ['id="daily-challenge-overlay"', "id='daily-challenge-overlay'", 'id=daily-challenge-overlay'],
    ['id="daily-start-btn"', "id='daily-start-btn'", 'id=daily-start-btn'],
    ["GAME_MODE_DAILY='daily'", 'GAME_MODE_DAILY="daily"', 'GAME_MODE_DAILY=`daily`'],
    ['startDailyChallenge(', 'openDailyChallengeOverlay('],
]

for marker_group in daily_feature_markers:
    require_any(runtime_surface, marker_group, "daily challenge marker in minified/runtime output")

# Player profile: welcome entry and overlay controls must be present.
player_profile_markers = [
    ['id="player-entry-btn"', "id='player-entry-btn'", 'id=player-entry-btn'],
    ['id="player-entry-level"', "id='player-entry-level'", 'id=player-entry-level'],
    ['id="summary-player-level"', "id='summary-player-level'", 'id=summary-player-level'],
    ['id="player-overlay"', "id='player-overlay'", 'id=player-overlay'],
    ['id="player-name-input"', "id='player-name-input'", 'id=player-name-input'],
    ['renderWelcomePlayerEntry(', 'refreshSummaryPlayerDisplay('],
]

for marker_group in player_profile_markers:
    require_any(runtime_surface, marker_group, "player profile marker in minified/runtime output")

# Streak systems: HUD, bonus logic, and carryover banner are all required.
streak_markers = [
    ['id="streak-hud"', "id='streak-hud'", 'id=streak-hud'],
    ['id="streak-hud-bonus"', "id='streak-hud-bonus'", 'id=streak-hud-bonus'],
    ['Next bonus at 3'],
    ['getStreakBonus(', 'STREAK_BONUS_TABLE'],
    ['streak-carryover-banner'],
]

for marker_group in streak_markers:
    require_any(runtime_surface, marker_group, "streak marker in minified/runtime output")

# Guard against regression: summary carryover banner must require an active bonus.
source_carryover_guard_pattern = (
    r"showCarryoverBanner\s*=\s*showRestartSameButton\s*&&\s*carryoverStreak\s*>\s*0\s*&&\s*carryoverBonus\s*>\s*0"
)
minified_carryover_guard_pattern = (
    r"showCarryoverBanner\s*=\s*showRestartSameButton\s*&&\s*carryoverStreak\s*>\s*0\s*&&\s*carryoverBonus\s*>\s*0"
)
require_regex(source_runtime_surface, source_carryover_guard_pattern, "source/runtime streak carryover guard")
require_regex(runtime_surface, minified_carryover_guard_pattern, "minified/runtime streak carryover guard")

# Guard against regression: Home from summary should refresh welcome player entry.
source_home_refresh_pattern = (
    r"getElementById\(\s*[\"']restart-change[\"']\s*\)\.addEventListener\(\s*[\"']click[\"']\s*,"
    r".*?renderWelcomePlayerEntry\s*\(\s*\)"
)
minified_home_refresh_pattern = (
    r"getElementById\(\s*[\"'`]restart-change[\"'`]\s*\)\.addEventListener\(\s*[\"'`]click[\"'`].*?renderWelcomePlayerEntry\(\s*\)"
)
require_regex(source_runtime_surface, source_home_refresh_pattern, "source/runtime Home handler welcome-player refresh")
require_regex(runtime_surface, minified_home_refresh_pattern, "minified/runtime Home handler welcome-player refresh")

source_script_count = len(re.findall(r'<script\\b', source, flags=re.IGNORECASE))
minified_script_count = len(re.findall(r'<script\\b', minified, flags=re.IGNORECASE))
if source_script_count != minified_script_count:
    fail(
        f"Script tag count changed (source={source_script_count}, minified={minified_script_count})."
    )

source_style_count = len(re.findall(r'<style\\b', source, flags=re.IGNORECASE))
minified_style_count = len(re.findall(r'<style\\b', minified, flags=re.IGNORECASE))
if source_style_count != minified_style_count:
    fail(
        f"Style tag count changed (source={source_style_count}, minified={minified_style_count})."
    )

reduction = ((source_bytes - minified_bytes) / source_bytes) * 100
print("PASS: Minified HTML is smaller and passed smoke checks.")
print(f"Size: {source_bytes} -> {minified_bytes} bytes ({reduction:.2f}% reduction)")
