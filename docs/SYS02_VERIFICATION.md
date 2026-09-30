# SYS-02 approved cycling verification

Verified 2026-09-29 on codex/gamegaps, based on df216a6. GAME.md records the approved rules. The implementation commit containing this document is the verified slice.

## Implemented scope

One shared free cycle per side per planning turn; hand replacement in place; paid bench refund into an unpaid same-type/rarity/grade card; invested-cost tracking through combinations, deployment and withdrawal; fresh graded repurchase; recipe pricing; overflow refunds with paused normal income. All current cards are common with unchanged pool weights. No paid reroll shop or population levelling. Failed actions are atomic and do not consume randomness. Optional triples and weighted population remain.

## Checks and evidence

- 28 rule checks pass (18 existing ability/targeting checks plus 10 cycling checks). Cases include full hands, unchanged RNG on rejection, shared allowance, grade-3 refunds above six, recipe prices, fresh graded stats, zero-refund starting units, paid investment preservation, optional combination investment, both factions and replay.
- Production build passes.
- tools/verify-cycling.mjs uses real UI controls to recruit, optionally combine into a paid 2★ bench survivor, preview refund, cycle, repurchase, resolve a round and use the refreshed allowance. Two free starting Pikemen plus one purchased Pikeman combine into 2★ with actual investment 1; refund 1 yields an unpaid 2★ Pikeman costing 3. Repurchase has 32/32 HP, zero energy and empty cooldowns. The normal browser log replays exactly through its recorded round/bench cycle. The later refreshed hand cycle is also asserted by browser automation.
- Inspected screenshots at 1280×800, 390×844 and 900×420 have usable cycle controls and no horizontal page overflow. Evidence: design_overhaul/evidence/sys02-bench-preview.png, sys02-replacement.png, sys02-desktop.png, sys02-portrait.png and sys02-short.png. Matching text outputs and sys02-verification.json record assertions and metrics.
- 200 simulator games replay exactly: seeds 1–50, heuristic vs greedy, both side assignments, 30-round limit. One 100-game run enables heuristic cycling; the other disables it via commander parameters. Greedy stays recruit-only. Cycling alters the subsequent seeded draw stream, so these are paired initial seeds rather than identical later hands.

## Measured limits

Both runs draw 89/100. Mean rounds are 29.19 with cycling and 29.37 without. Heuristic blocked draws decrease from 65.82 to 64.78 per game; Supply spent rises from 27.01 to 27.73. Heuristic uses 9.84 hand cycles per game; neither policy uses bench cycles in these runs. Final heuristic Supply remains near six (5.94 enabled, 5.95 disabled). Win splits are blue/red 2/9 enabled vs 6/5 disabled; this small sample does not establish faction balance or a better strategy.

The system is implemented and verified, but these results do not establish strategic bench value or solve pacing/capacity pressure. With full hand and population, bench cycling is blocked until a hand slot is freed; in-place hand cycling alone cannot guarantee that. Same-identity replacements are legal, and the single current skill can cycle back to itself. Expensive upgraded replacements may remain unaffordable without refund overflow. Future population levels and richer rarity pools remain deferred.

## Next task

CORE-02 keep counterplay and CORE-03 victory semantics remain blockers to unrelated expansion. Agree attacking counterplay and acceptable duration/completion outcomes, compare paired seeds and side swaps against passive/greedy/heuristic policies, and have Scott select defaults. Do not adopt siege bonuses, lower keep defense or score victory without that decision.
