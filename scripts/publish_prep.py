from pathlib import Path
import json
import re
import subprocess
import sys

ROOT = Path(__file__).resolve().parent.parent
PACKAGE_JSON_PATH = ROOT / "package.json"
PACKAGE_LOCK_PATH = ROOT / "package-lock.json"
SERVICE_WORKER_PATH = ROOT / "service-worker.js"


def run(cmd: list[str]) -> None:
    result = subprocess.run(cmd, cwd=ROOT)
    if result.returncode != 0:
        raise SystemExit(result.returncode)


def parse_semver(version: str) -> tuple[int, int, int]:
    match = re.fullmatch(r"(\d+)\.(\d+)\.(\d+)", version.strip())
    if not match:
        raise ValueError(f"Unsupported version format: {version!r}. Expected MAJOR.MINOR.PATCH")
    major, minor, patch = match.groups()
    return int(major), int(minor), int(patch)


def bump_patch_version(version: str) -> str:
    major, minor, patch = parse_semver(version)
    return f"{major}.{minor}.{patch + 1}"


def read_json(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path: Path, payload: dict) -> None:
    # Keep deterministic formatting with trailing newline.
    path.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")


def update_versions() -> tuple[str, str]:
    package_json = read_json(PACKAGE_JSON_PATH)
    current_version = str(package_json.get("version", "")).strip()
    if not current_version:
        raise ValueError("package.json is missing a valid version")

    next_version = bump_patch_version(current_version)
    package_json["version"] = next_version
    write_json(PACKAGE_JSON_PATH, package_json)

    package_lock = read_json(PACKAGE_LOCK_PATH)
    package_lock["version"] = next_version
    root_package = package_lock.get("packages", {}).get("")
    if isinstance(root_package, dict):
        root_package["version"] = next_version
    write_json(PACKAGE_LOCK_PATH, package_lock)

    service_worker_text = SERVICE_WORKER_PATH.read_text(encoding="utf-8")
    service_worker_text, replacements = re.subn(
        r'(const\s+CACHE_NAME\s*=\s*"bible-trivia-cache-v)(\d+\.\d+\.\d+)(";)',
        rf"\g<1>{next_version}\g<3>",
        service_worker_text,
        count=1,
    )
    if replacements != 1:
        raise ValueError("service-worker.js CACHE_NAME version token not found or ambiguous")
    SERVICE_WORKER_PATH.write_text(service_worker_text, encoding="utf-8")

    return current_version, next_version


if __name__ == "__main__":
    previous_version, next_version = update_versions()

    # Build deployable minified index.html from index.source.html.
    run([sys.executable, "scripts/minify_safe.py", "--source", "index.source.html", "--minify-js", "--output", "index.html"])

    # Verify the deployable index.html still contains key app markers.
    run([sys.executable, "scripts/test_minified.py", "index.html", "index.source.html"])

    print(f"Version bumped: {previous_version} -> {next_version}")
    print("Publish prep complete: index.html is minified and verified.")
