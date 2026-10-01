# Shards experiments

Run `node tools/sim/shards.mjs [seeds]` (default 100 seeds, both side assignments). It compares shard AI versus Greedy, no-shard AI versus Greedy, and shard AI versus no-shard AI, reporting outcomes, rounds and shard actions. Inspect the runner before use. Record discrete/continuous combat and active skill/spell flags. Pure match construction defaults to discrete, unlike browser main.

Earlier comparisons/commands are [archived](archive/2026-10-01/docs/SHARDS_SIM.md). [Summary](EXPERIMENT_SUMMARY.md): fresh offers improved buying/combining; old discrete Greedy matches had high draws. These do not establish current timed campaign balance.

[Current defaults](SHARDS.md); [integration checks](VERIFICATION.md). Next branch should compare skills-on/spells-off/Shards-on against current main with controlled seeds and separate player/enemy usage.
