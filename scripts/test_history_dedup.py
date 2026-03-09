from pathlib import Path
import re
import sys


ROOT = Path(__file__).resolve().parent.parent
SOURCE_RUNTIME_PATH = ROOT / "src" / "app-runtime.js"
MINIFIED_RUNTIME_PATH = ROOT / "src" / "app-runtime.min.js"


def fail(message: str) -> None:
    print(f"FAIL: {message}")
    raise SystemExit(1)


def read_required(path: Path) -> str:
    if not path.exists():
        fail(f"Missing file: {path}")
    return path.read_text(encoding="utf-8")


def require_regex(text: str, pattern: str, label: str) -> None:
    if not re.search(pattern, text, flags=re.DOTALL):
        fail(f"Missing {label} (pattern: {pattern})")


def forbid_regex(text: str, pattern: str, label: str) -> None:
    if re.search(pattern, text, flags=re.DOTALL):
        fail(f"Unexpected {label} (pattern: {pattern})")


def main() -> None:
    source_runtime = read_required(SOURCE_RUNTIME_PATH)
    minified_runtime = read_required(MINIFIED_RUNTIME_PATH)

    # Source runtime should stamp a newly inserted IndexedDB id onto each in-memory history record.
    require_regex(
        source_runtime,
        r"const\s+insertedId\s*=\s*await\s+DBManager\.addGameRecord\(record\);\s*"
        r"if\s*\(\s*insertedId\s*!==\s*undefined\s*&&\s*insertedId\s*!==\s*null\s*\)\s*\{\s*"
        r"record\.id\s*=\s*insertedId;",
        "source history id stamping after IndexedDB insert",
    )

    # Normal endGame flow should not call saveData twice (saveHighScore already persists data).
    require_regex(
        source_runtime,
        r"await\s+saveHighScore\(\);\s*await\s+reloadGameHistory\(\);",
        "source endGame normal-mode single-save sequence",
    )
    forbid_regex(
        source_runtime,
        r"await\s+saveHighScore\(\);\s*await\s+saveData\(\);\s*await\s+reloadGameHistory\(\);",
        "source endGame double-save sequence",
    )

    # Minified runtime should preserve the same regression guards.
    require_regex(
        minified_runtime,
        r"let\s+insertedId\s*=\s*await\s+DBManager\.addGameRecord\(record\)",
        "minified history id stamping after IndexedDB insert",
    )
    require_regex(
        minified_runtime,
        r"await\s+saveHighScore\(\),await\s+reloadGameHistory\(\)",
        "minified endGame normal-mode single-save sequence",
    )
    forbid_regex(
        minified_runtime,
        r"await\s+saveHighScore\(\),await\s+saveData\(\),await\s+reloadGameHistory\(\)",
        "minified endGame double-save sequence",
    )

    print("PASS: Duplicate-history regression checks passed.")


if __name__ == "__main__":
    main()
