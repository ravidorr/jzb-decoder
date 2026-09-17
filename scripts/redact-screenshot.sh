#!/usr/bin/env bash
set -euo pipefail

if [[ $# -lt 2 ]]; then
  echo "Usage: $0 <input-image> <output-image>" >&2
  exit 1
fi

INPUT="$1"
OUTPUT="$2"

if [[ ! -f "$INPUT" ]]; then
  echo "Input file not found: $INPUT" >&2
  exit 1
fi

WIDTH="$(magick identify -format '%w' "$INPUT")"
HEIGHT="$(magick identify -format '%h' "$INPUT")"

scale_x () {
  python3 -c "import math; print(math.floor($WIDTH * $1))"
}

scale_y () {
  python3 -c "import math; print(math.floor($HEIGHT * $1))"
}

scale_w () {
  python3 -c "import math; print(max(1, math.floor($WIDTH * $1)))"
}

scale_h () {
  python3 -c "import math; print(max(1, math.floor($HEIGHT * $1)))"
}

pixelate_region () {
  local input="$1"
  local output="$2"
  local x="$3"
  local y="$4"
  local w="$5"
  local h="$6"

  magick "$input" \
    \( +clone -crop "${w}x${h}+${x}+${y}" +repage -resize 6% -resize 1700% -blur 0x3 \) \
    -geometry "+${x}+${y}" -compose over -composite \
    "$output"
}

WORK="$(mktemp "${TMPDIR:-/tmp}/jzb-redact.XXXXXX.png")"
NEXT="$(mktemp "${TMPDIR:-/tmp}/jzb-redact-next.XXXXXX.png")"
trap 'rm -f "$WORK" "$NEXT"' EXIT

cp "$INPUT" "$WORK"

# Regions are tuned for the Decipher JZB panel layout in DevTools screenshots.
regions=(
  # Request list titles and subtitles with deployment paths / URLs
  "$(scale_x 0.01) $(scale_y 0.26) $(scale_w 0.26) $(scale_h 0.34)"
  # Metadata: visitor value
  "$(scale_x 0.46) $(scale_y 0.455) $(scale_w 0.42) $(scale_h 0.028)"
  # Metadata: request URL value
  "$(scale_x 0.38) $(scale_y 0.575) $(scale_w 0.60) $(scale_h 0.10)"
  # JSON: visitor_id and nested visitor props
  "$(scale_x 0.42) $(scale_y 0.685) $(scale_w 0.56) $(scale_h 0.12)"
  # JSON: tabId, frameId, sessionId
  "$(scale_x 0.42) $(scale_y 0.805) $(scale_w 0.56) $(scale_h 0.09)"
  # JSON: second event identifiers
  "$(scale_x 0.38) $(scale_y 0.88) $(scale_w 0.60) $(scale_h 0.11)"
)

for region in "${regions[@]}"; do
  read -r x y w h <<< "$region"
  pixelate_region "$WORK" "$NEXT" "$x" "$y" "$w" "$h"
  mv "$NEXT" "$WORK"
done

mkdir -p "$(dirname "$OUTPUT")"
cp "$WORK" "$OUTPUT"

echo "Redacted screenshot written to $OUTPUT"
