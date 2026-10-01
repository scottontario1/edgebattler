#!/usr/bin/env bash
# Headless screenshot of the running dev server (npm run dev on :5173); see tools/shot.mjs.
# Usage: tools/shot.sh <out.png> [width] [height] [query] [waitMs]
#   tools/shot.sh docs/redesign/after-landscape.png 1280 800
#   tools/shot.sh /tmp/zoom.png 1280 800 'zoom=2.2&focus=12,2'
# Portrait sizes (width < height, < 700px) emulate a touch phone. Prints page errors.
exec node "$(dirname "$0")/shot.mjs" "$@"
