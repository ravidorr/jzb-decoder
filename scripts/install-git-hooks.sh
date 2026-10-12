#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
HOOKS_DIR="$ROOT/.git/hooks"
SOURCE="$ROOT/scripts/git-hooks/pre-commit"
TARGET="$HOOKS_DIR/pre-commit"

if [[ ! -d "$ROOT/.git" ]]; then
  echo "No .git directory found. Run this from a git checkout." >&2
  exit 1
fi

mkdir -p "$HOOKS_DIR"
cp "$SOURCE" "$TARGET"
chmod +x "$TARGET"

echo "Installed pre-commit hook at $TARGET"
