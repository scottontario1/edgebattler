# Testing the shard draw with the simulator

`node tools/sim/shards.mjs [seeds]` (default 100 seeds, each played with both side assignments) runs the real match rules
headless and reports, per matchup: wins, losses, draws, average rounds, and how many shard actions the shard AI logs per
game (`buyShard`, `applyShard`, `combineShards`).

Matchups: shard AI vs greedy, no-shard AI vs greedy (baseline), shard AI vs no-shard AI (head to head).
`--verify`-style replay checks stay in `npm run sim` / `tests/shards.test.mjs`.

## Shard subset per match

Each match offers only 4 of the 8 shard types, picked from the seed (`pickShardSubset(seed)` in `src/shards.js`, set by
`SHARD_RULES.poolTypes`). Both sides draw from the same four, each weighted x2 in the pool so shards stay roughly a third of
draws. The subset is written to the log header (`shardSubset`) and replay reuses it. Pass `createMatch({shardSubset:[...ids]})`
to force a set; `pickShardSubset(seed, 8)` gives all eight.

## Findings (25 seeds x 2 sides, 2026-09-30)

| Version | combines/game | shards applied/game |
|---|---|---|
| all 8 types, AI applies on buy | 0.10 | 9.8 |
| 4-type subset, AI applies on buy | 0.34 | 10.0 |
| 4-type subset, AI holds tier I shards for sets (`shardHold: 4`) | 2.44 | 4.2 |

Games still end in a draw about 98% against greedy (the existing pacing problem, CORE-02). Shard AI vs no-shard AI: 10 wins,
0 losses, 40 draws.
