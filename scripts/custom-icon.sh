#!/bin/sh
# Turns assets/icon-chrome-source.jpg into the app's default icons (macOS: uses sips).
# Usage: npm run icons:custom
set -e
cd "$(dirname "$0")/.."
SRC=assets/icon-chrome-source.jpg
OUT=public/icons

for size in 180 192 512; do
  sips -s format png -z "$size" "$size" "$SRC" --out "$OUT/icon-$size.png" >/dev/null
done
cp "$OUT/icon-180.png" "$OUT/chrome-180.png"

# Maskable (Android): motif inside the 80 % safe zone, padded with the icon's black background.
sips -s format png -z 410 410 "$SRC" --out /tmp/glass-remote-maskable.png >/dev/null
sips --padToHeightWidth 512 512 --padColor 000000 /tmp/glass-remote-maskable.png --out "$OUT/icon-maskable-512.png" >/dev/null
rm /tmp/glass-remote-maskable.png
echo "✓ icons from $SRC"
