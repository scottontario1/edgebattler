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

## Shard shop deal (added after the income finding)

Income was limited by the hand, not Supply: the hand sat at 7 of 8 with unit cards the population cap kept the AI from
recruiting, so about 65 draws per game were blocked and only about 10 shards were bought. Now `dealShards()` in
`src/cards.js` gives every side 2-3 shard cards at the start of each round (and in the opening hand; `CARD_LIMITS.shardsMin/Max`),
placed at the left of the hand row. They ignore the hand cap, so hand size varies. Unbought shard cards are replaced next round
(a shop refresh). Regular draws no longer contain shards, and shard types still come from the match's seeded 4-of-8 subset.

Result (25 seeds x 2 sides): shard AI buys about 44 shards per game and combines about 11.7 times, reaching tier III;
it was 10 buys and 2.4 combines before.
