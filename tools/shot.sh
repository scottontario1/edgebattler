#!/usr/bin/env bash
# Headless screenshot of the running dev server (npm run dev on :5173).
# Usage: tools/shot.sh <out.png> [width] [height] [query]
#   tools/shot.sh docs/redesign/after-landscape.png 1280 800
#   tools/shot.sh /tmp/zoom.png 1280 800 'zoom=2.4&focus=8,6'
# Uses SwiftShader so it works without a GPU and never touches the interactive browser pane.
set -e
out="$1"; w="${2:-1280}"; h="${3:-800}"; q="${4:-}"
chrome="/c/Program Files/Google/Chrome/Application/chrome.exe"
[ -x "$chrome" ] || chrome="$(command -v chromium || command -v google-chrome)"
prof="${TEMP:-/tmp}/shotprof-$$"
"$chrome" --headless=new --use-angle=swiftshader --enable-unsafe-swiftshader --hide-scrollbars \
  --window-size="$w,$h" --virtual-time-budget=15000 --user-data-dir="$prof" \
  --screenshot="$(cd "$(dirname "$out")" && pwd)/$(basename "$out")" \
  "http://localhost:5173/${q:+?$q}" 2>/dev/null | grep -v '^$' || true
rm -rf "$prof"
