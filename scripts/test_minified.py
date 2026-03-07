from pathlib import Path
import re
import sys

source_path = Path(sys.argv[2]) if len(sys.argv) > 2 else Path('index.source.html')
minified_path = Path(sys.argv[1]) if len(sys.argv) > 1 else Path('index.html')


def fail(message: str) -> None:
    print(f"FAIL: {message}")
    sys.exit(1)


if not source_path.exists():
    fail(f"Missing source file: {source_path}")

if not minified_path.exists():
    fail(f"Missing minified file: {minified_path}. Run minification first.")

source = source_path.read_text(encoding='utf-8')
minified = minified_path.read_text(encoding='utf-8')

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
    if not any(marker in minified for marker in marker_group):
        fail(f"Missing marker in minified output: one of {marker_group}")

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
