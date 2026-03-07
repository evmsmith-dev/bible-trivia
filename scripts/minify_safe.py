from pathlib import Path
import argparse

import minify_html


parser = argparse.ArgumentParser(description="Minify index.html with optional JS minification.")
parser.add_argument("--source", default="index.source.html", help="Source HTML path")
parser.add_argument("--output", default="index.html", help="Output HTML path")
parser.add_argument(
    "--minify-js",
    action="store_true",
    help="Also minify inline JavaScript (more aggressive)",
)
args = parser.parse_args()

source_path = Path(args.source)
out_path = Path(args.output)

if not source_path.exists():
    raise SystemExit(f"Missing source file: {source_path}")

source = source_path.read_text(encoding="utf-8")
minified = minify_html.minify(source, minify_js=args.minify_js, minify_css=True)
out_path.write_text(minified, encoding="utf-8")

source_bytes = len(source.encode("utf-8"))
minified_bytes = len(minified.encode("utf-8"))
reduction = ((source_bytes - minified_bytes) / source_bytes) * 100

print(f"Wrote {out_path}")
print(f"Mode: minify_js={args.minify_js}")
print(f"Size: {source_bytes} -> {minified_bytes} bytes ({reduction:.2f}% reduction)")
