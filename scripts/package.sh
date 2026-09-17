#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$ROOT/dist/jzb-decoder.zip"

mkdir -p "$ROOT/dist"
rm -f "$OUT"

(
  cd "$ROOT"
  zip -r "$OUT" . \
    -x '*.git*' \
    -x 'dist/*' \
    -x 'node_modules/*' \
    -x '*.test.js' \
    -x 'scripts/*' \
    -x 'package.json' \
    -x 'package-lock.json' \
    -x 'docs/*' \
    -x 'icons/icon.svg'
)

echo "Created $OUT"
