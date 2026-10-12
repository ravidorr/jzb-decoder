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
    \( +clone -crop "${w}x${h}+${x}+${y}" +repage -resize 3% -resize 3400% -blur 0x4 \) \
    -geometry "+${x}+${y}" -compose over -composite \
    "$output"
}

cover_region () {
  local input="$1"
  local output="$2"
  local x="$3"
  local y="$4"
  local w="$5"
  local h="$6"
  local right="$((x + w))"
  local bottom="$((y + h))"

  magick "$input" -fill '#252526' -draw "rectangle ${x},${y} ${right},${bottom}" "$output"
}

WORK="$(mktemp "${TMPDIR:-/tmp}/jzb-redact.XXXXXX.png")"
NEXT="$(mktemp "${TMPDIR:-/tmp}/jzb-redact-next.XXXXXX.png")"
trap 'rm -f "$WORK" "$NEXT"' EXIT

cp "$INPUT" "$WORK"

if [[ "$WIDTH" == "1024" && "$HEIGHT" == "661" ]]; then
  pixelate_regions=(
    # Request list titles and subtitles
    "8 172 268 235"
    # Metadata visitor value
    "468 298 430 22"
  )
  cover_regions=(
    # Request URL row and decoded JSON through bottom of panel
    "348 318 668 343"
    # Sidebar list item title and URL preview
    "8 198 272 205"
  )
else
  pixelate_regions=(
    "$(scale_x 0.01) $(scale_y 0.26) $(scale_w 0.26) $(scale_h 0.34)"
    "$(scale_x 0.46) $(scale_y 0.455) $(scale_w 0.42) $(scale_h 0.028)"
  )
  cover_regions=(
    "$(scale_x 0.34) $(scale_y 0.58) $(scale_w 0.65) $(scale_h 0.41)"
  )
fi

for region in "${pixelate_regions[@]}"; do
  read -r x y w h <<< "$region"
  pixelate_region "$WORK" "$NEXT" "$x" "$y" "$w" "$h"
  mv "$NEXT" "$WORK"
done

for region in "${cover_regions[@]}"; do
  read -r x y w h <<< "$region"
  cover_region "$WORK" "$NEXT" "$x" "$y" "$w" "$h"
  mv "$NEXT" "$WORK"
done

mkdir -p "$(dirname "$OUTPUT")"
cp "$WORK" "$OUTPUT"

echo "Redacted screenshot written to $OUTPUT"
