#!/bin/sh
# Regenerates the PNG app icons from the SVG sources in public/.
# Uses `sips`, which ships with macOS. Run from the repo root: sh scripts/make-icons.sh
set -e
cd public
sips -s format png icon.svg --out pwa-192.png -z 192 192 >/dev/null
sips -s format png icon.svg --out pwa-512.png -z 512 512 >/dev/null
sips -s format png icon-maskable.svg --out pwa-maskable-512.png -z 512 512 >/dev/null
sips -s format png icon-apple.svg --out apple-touch-icon.png -z 180 180 >/dev/null
echo "Icons written to public/"
