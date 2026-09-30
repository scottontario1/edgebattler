# The default game is untouched (checked 2026-09-30)

Command, run on this branch (commit 7908de6, culture module present but never registered) and on a `git archive` of commit 7e9d663:

```
node tools/sim/run.mjs --games 30 --blue heuristic --red greedy --swap --seed 1 --out <dir> --verify
```

| check | result |
|---|---|
| games per run | 60 (30 seeds, side-swapped); both runs: blue 1, red 3, draw 56, replay failures 0 |
| `summary.csv` | `cmp` identical |
| game logs | 60 of 60 identical from the second line on (`diff` of `tail -n +2`) |
| log headers | 60 of 60 identical except the `commit` field (`7908de6` v none in the archive) |
| `npm test` | 87/87 (61 shipped checks unchanged + 26 Hollow Court checks) |
| shared engine files | none edited (`git diff --stat 7e9d663` touches only `src/factions/`, `tests/faction-hollow-court.test.mjs`, `experiments/factions/hollow-court/`, `docs/factions/`, `docs/experiments/results/factions/hollow-court/`) |
