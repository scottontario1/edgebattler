# Integration verification baseline

Recorded evidence for main `d1f7c64` after merging `gameplay/timed-combat` and `feature/shards`, not fresh tests for this docs-only pass. [Older histories](archive/2026-10-01/README.md).

- Rule suite: 233 tests, 228 passed, zero failures, five existing TODOs. Build passed with a large JavaScript chunk warning (about 963 KB).
- Default Shards-only timed campaign: all 15 faction/mission combinations at seed 7 completed in 3–10 phases, zero active casts and exact replay.
- Explicit skills/spells-restored campaign: all 15 completed in 3–13 phases, 256 total casts and exact replay. Integration checks do not establish balanced difficulty.
- `tools/verify-merged-shards.mjs` and `--mobile`: desktop 1280×800 and portrait 390×844 buy/apply/remove/combine, selected stats, timed playback and replay. Combining uses two logged `grantShard` fixtures, not normal-income acquisition.
- Normal Crown Road browser run: round-four victory, two rallies, saved stats and replay. Restored desktop skills passed `tools/verify-skill-slots.mjs` with explicit skill/spell flags. Earlier phone/short-height skill evidence needs repeating next branch.

Evidence: [desktop](campaign/evidence/merged-shards-desktop.png), [portrait](campaign/evidence/merged-shards-portrait.png), [Crown Road victory](campaign/evidence/crown-road-victory.png). Scripts may overwrite screenshots on later runs; keep evidence tied to its producing revision.

[Performance checks](PERFORMANCE_PASS.md) establish reduced frame/pass/pixel work, not measured GPU utilization. [Historical experiments](EXPERIMENT_SUMMARY.md) cannot certify main's balance. Static phone games currently upload no detailed logs; [retrieval guide](RUNNING_AND_LOGS.md).

This docs pass checks local links, defaults against source, archive coverage and `git diff --check`; it changes no gameplay or dependencies.
