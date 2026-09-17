#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
MANIFEST="$ROOT/dist/jzb-decoder/manifest.json"

if [[ ! -f "$MANIFEST" ]]; then
  echo "Missing packaged manifest: $MANIFEST" >&2
  exit 1
fi

node -e "
const fs = require('fs');
const manifest = JSON.parse(fs.readFileSync('$MANIFEST', 'utf8'));
const gecko = manifest.browser_specific_settings?.gecko;

if (!gecko?.id) {
  console.error('Packaged manifest is missing browser_specific_settings.gecko.id');
  process.exit(1);
}

const required = gecko.data_collection_permissions?.required;
if (!Array.isArray(required) || !required.includes('none')) {
  console.error('Packaged manifest must declare data_collection_permissions.required including \"none\"');
  process.exit(1);
}

console.log('Package manifest verification passed');
"
