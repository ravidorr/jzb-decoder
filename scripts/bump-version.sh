#!/usr/bin/env bash
set -euo pipefail

if [[ $# -ne 1 ]]; then
  echo "Usage: $0 <patch|minor|major>" >&2
  exit 1
fi

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
node "$ROOT/scripts/bump-version.js" "$1"
