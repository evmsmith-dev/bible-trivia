from pathlib import Path
import argparse
import re

import minify_html


parser = argparse.ArgumentParser(description="Minify index.html with optional JS minification.")
parser.add_argument("--source", default="index.source.html", help="Source HTML path")
parser.add_argument("--output", default="index.html", help="Output HTML path")
parser.add_argument(
    "--minify-external-css",
    action="store_true",
    help="Minify external CSS file and rewrite generated HTML to reference it",
)
parser.add_argument("--css-source", default="src/ui/styles.css", help="External CSS source path")
parser.add_argument("--css-output", default="src/ui/styles.min.css", help="External CSS output path")
parser.add_argument(
    "--minify-js",
    action="store_true",
    help="Also minify inline JavaScript (more aggressive)",
)
parser.add_argument(
    "--minify-external-js",
    action="store_true",
    help="Minify local external JavaScript files and rewrite generated HTML to reference them",
)
args = parser.parse_args()

source_path = Path(args.source)
out_path = Path(args.output)
css_source_path = Path(args.css_source)
css_output_path = Path(args.css_output)

if not source_path.exists():
    raise SystemExit(f"Missing source file: {source_path}")


def minify_css_text(css_text: str) -> str:
    # Keep this conservative to avoid changing stylesheet behavior.
    css_text = re.sub(r"/\*[\s\S]*?\*/", "", css_text)
    css_text = re.sub(r"\s+", " ", css_text)
    css_text = re.sub(r"\s*([{}:;,>+~])\s*", r"\1", css_text)
    css_text = re.sub(r";}", "}", css_text)
    return css_text.strip()


def rewrite_css_href(html_text: str, old_href: str, new_href: str) -> tuple[str, int]:
    escaped_href = re.escape(old_href)
    pattern = re.compile(rf"(<link[^>]+href=)([\"']?)({escaped_href})([\"']?)", flags=re.IGNORECASE)

    def _repl(match: re.Match[str]) -> str:
        prefix = match.group(1)
        quote_a = match.group(2) or ""
        quote_b = match.group(4) or quote_a
        return f"{prefix}{quote_a}{new_href}{quote_b}"

    return pattern.subn(_repl, html_text, count=1)


def get_local_script_sources(html_text: str) -> list[str]:
    sources: list[str] = []
    for match in re.finditer(
        r"<script[^>]+\bsrc\s*=\s*(?:\"([^\"]+)\"|'([^']+)'|([^\s>]+))",
        html_text,
        flags=re.IGNORECASE,
    ):
        src = match.group(1) or match.group(2) or match.group(3)
        if not src:
            continue
        if re.match(r"^(?:[a-z]+:)?//", src, flags=re.IGNORECASE):
            continue
        if src.startswith("data:"):
            continue
        if src.endswith(".min.js"):
            continue
        if not src.endswith(".js"):
            continue
        if src not in sources:
            sources.append(src)
    return sources


def minify_js_text(js_text: str) -> str:
    wrapped = f"<script>{js_text}</script>"
    minified_wrapped = minify_html.minify(wrapped, minify_js=True, minify_css=False)
    match = re.fullmatch(r"<script>([\s\S]*)</script>", minified_wrapped.strip(), flags=re.IGNORECASE)
    if not match:
        raise SystemExit("Unable to minify JavaScript content using script wrapper")
    return match.group(1).strip()


def to_min_js_path(script_src: str) -> str:
    script_path = Path(script_src)
    if script_path.suffix.lower() == ".js":
        return script_path.with_suffix(".min.js").as_posix()
    return f"{script_src}.min.js"


def rewrite_script_src(html_text: str, old_src: str, new_src: str) -> tuple[str, int]:
    escaped_src = re.escape(old_src)
    pattern = re.compile(rf"(<script[^>]+\bsrc=)([\"']?)({escaped_src})([\"']?)", flags=re.IGNORECASE)

    def _repl(match: re.Match[str]) -> str:
        prefix = match.group(1)
        quote_a = match.group(2) or ""
        quote_b = match.group(4) or quote_a
        return f"{prefix}{quote_a}{new_src}{quote_b}"

    return pattern.subn(_repl, html_text, count=1)

source = source_path.read_text(encoding="utf-8")
minified = minify_html.minify(source, minify_js=args.minify_js, minify_css=True)

if args.minify_external_css:
    if not css_source_path.exists():
        raise SystemExit(f"Missing CSS source file: {css_source_path}")
    css_source = css_source_path.read_text(encoding="utf-8")
    css_minified = minify_css_text(css_source)
    css_output_path.parent.mkdir(parents=True, exist_ok=True)
    css_output_path.write_text(css_minified, encoding="utf-8")

    minified, replacements = rewrite_css_href(minified, args.css_source, args.css_output)
    if replacements != 1:
        raise SystemExit(
            "Could not rewrite stylesheet href in generated HTML. "
            f"Expected one link to {args.css_source}."
        )

js_source_total_bytes = 0
js_minified_total_bytes = 0
js_file_count = 0
if args.minify_external_js:
    script_sources = get_local_script_sources(source)
    source_root = source_path.parent
    for script_src in script_sources:
        script_source_path = source_root / script_src
        if not script_source_path.exists():
            raise SystemExit(f"Missing JavaScript source file: {script_source_path}")

        script_output_rel = to_min_js_path(script_src)
        script_output_path = source_root / script_output_rel
        script_output_path.parent.mkdir(parents=True, exist_ok=True)

        script_source = script_source_path.read_text(encoding="utf-8")
        script_minified = minify_js_text(script_source)
        script_output_path.write_text(script_minified, encoding="utf-8")

        minified, replacements = rewrite_script_src(minified, script_src, script_output_rel)
        if replacements != 1:
            raise SystemExit(
                "Could not rewrite script src in generated HTML. "
                f"Expected one script to {script_src}."
            )

        js_file_count += 1
        js_source_total_bytes += len(script_source.encode("utf-8"))
        js_minified_total_bytes += len(script_minified.encode("utf-8"))

out_path.write_text(minified, encoding="utf-8")

source_bytes = len(source.encode("utf-8"))
minified_bytes = len(minified.encode("utf-8"))
reduction = ((source_bytes - minified_bytes) / source_bytes) * 100

print(f"Wrote {out_path}")
print(f"Mode: minify_js={args.minify_js}")
if args.minify_external_css:
    css_source_bytes = len(css_source.encode("utf-8"))
    css_minified_bytes = len(css_minified.encode("utf-8"))
    css_reduction = ((css_source_bytes - css_minified_bytes) / css_source_bytes) * 100
    print(f"Wrote {css_output_path}")
    print(
        f"CSS size: {css_source_bytes} -> {css_minified_bytes} bytes "
        f"({css_reduction:.2f}% reduction)"
    )
if args.minify_external_js and js_file_count > 0:
    js_reduction = ((js_source_total_bytes - js_minified_total_bytes) / js_source_total_bytes) * 100
    print(f"Wrote {js_file_count} external JavaScript minified files")
    print(
        f"JS size: {js_source_total_bytes} -> {js_minified_total_bytes} bytes "
        f"({js_reduction:.2f}% reduction)"
    )
print(f"Size: {source_bytes} -> {minified_bytes} bytes ({reduction:.2f}% reduction)")
