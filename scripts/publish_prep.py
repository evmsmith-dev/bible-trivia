from pathlib import Path
import subprocess
import sys

ROOT = Path(__file__).resolve().parent.parent


def run(cmd: list[str]) -> None:
    result = subprocess.run(cmd, cwd=ROOT)
    if result.returncode != 0:
        raise SystemExit(result.returncode)


if __name__ == "__main__":
    # Build deployable minified index.html from index.source.html.
    run([sys.executable, "scripts/minify_safe.py", "--source", "index.source.html", "--minify-js", "--output", "index.html"])

    # Verify the deployable index.html still contains key app markers.
    run([sys.executable, "scripts/test_minified.py", "index.html", "index.source.html"])

    print("Publish prep complete: index.html is minified and verified.")
