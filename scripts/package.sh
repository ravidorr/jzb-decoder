#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DIST_DIR="$ROOT/dist/jzb-decoder"
OUT="$ROOT/dist/jzb-decoder.zip"

rm -rf "$DIST_DIR"
mkdir -p "$DIST_DIR/icons"

cp \
  "$ROOT/manifest.json" \
  "$ROOT/devtools.html" \
  "$ROOT/devtools.js" \
  "$ROOT/jzb.js" \
  "$ROOT/panel.html" \
  "$ROOT/panel.js" \
  "$ROOT/panel.css" \
  "$ROOT/PRIVACY.md" \
  "$ROOT/README.md" \
  "$DIST_DIR/"

cp \
  "$ROOT/icons/icon16.png" \
  "$ROOT/icons/icon48.png" \
  "$ROOT/icons/icon128.png" \
  "$DIST_DIR/icons/"

rm -f "$OUT"

(
  cd "$DIST_DIR"
  zip -r "$OUT" .
)

echo "Created $DIST_DIR"
echo "Created $OUT"
