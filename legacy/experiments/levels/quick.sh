#!/bin/sh
# Compact view while tuning: label, Blue win, change. usage: sh experiments/levels/quick.sh [suite] [seeds]
node experiments/combat/run.mjs --file experiments/levels/levels.mjs --suite ${1:-all} --seeds ${2:-100} | awk -F'|' '/^###/{print} /^\| (N|S|C)[ -]/{printf "%-60s %-18s %s\n", substr($2,1,60), $5, $12}'
