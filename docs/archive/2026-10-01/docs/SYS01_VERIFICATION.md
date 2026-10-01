> Historical snapshot archived 2026-10-01. Earlier revisions/proposals, not current main. [Current docs index](../../../README.md).

# SYS-01 verification — 2026-09-29

Scope: approved planning-selected active kits, persistent energy/cooldowns, temporary Brace Hold, Charge Advance/movement requirement, cardinal facing/passive flanking, reduced Advance movement, legal ranged targeting, AI and exact replay. All default kit values match Scott's approval. No keep, hand or population balance changes.

## Rule and build checks

npm test: 18 passing checks, including both factions' legal targeting and integrated attack enhancements, simultaneous lethal strikes, atomic group edits, unaffordable retained bundles, cooldown timing, explicit/useful Rally, Brace without incoming attacks, Ward/Brace/Barrier stacking, low-HP lethal protection, multi-pick Cavalier phases, final-step facing, movement allowances, reserve preservation and corrupted-event replay detection.

npm run build passes. Vite retains its existing large-bundle warning; no bundling work was included. Log schema 2 is required; pre-change schema 1 logs are rejected explicitly. Replays now compare actions, complete battle events, unit positions/facing/picks/cooldowns, reserve state, summaries and results, rather than only aggregate HP/counts.

## Browser evidence

Run Vite, then node tools/verify-abilities.mjs. Normal seeded play uses actual editor buttons and three Resolve battle rounds: group Rally at energy 1, energy 4 after its first activation/refresh, group Brace commitment, persistent Advance restored, cooldown tick and movement on the following round. Facing can be changed without spending energy. The resulting three-round browser log replays exactly (sys01-play-replay.json).

node tools/verify-abilities.mjs --mobile checks 390x844 portrait and 900x420 short landscape: no horizontal overflow, unaffordable Apply disabled, readable costs/facing, vertically scrollable panel. Desktop is 1280x800. Screenshots were inspected visually, not just generated.

node tools/verify-abilities.mjs --combat uses an explicitly controlled presentation fixture (positions, starting HP/energy) to expose all attack effects without waiting for random engagement. It verifies Archer ignores an adjacent enemy and casts against the legal ranged one; Cavalier heals 12 -> 18 through Second Wind, moves, commits Charge and qualifies for a rear flank. Its seeded enhanced strike misses, correctly retaining payment/cooldown. Next planning shows persistent paid picks suspended at energy 1 against cost 3, alongside last-battle explanations. This fixture is not claimed as a normally replayable seeded game; the separate normal play log is replay-verified.

Evidence in design_overhaul/evidence: sys01-desktop.png, sys01-archer.png, sys01-cavalier.png, sys01-round4.png, sys01-portrait.png, sys01-short.png, sys01-combat-plan.png, sys01-combat.png and their text/JSON results. Browser scripts now fail on page errors and failed evaluated assertions. No page errors occurred in the final runs.

## Simulations and practical limits

Final command: node tools/sim/run.mjs --games 50 --blue heuristic --red greedy --swap --verify --out logs/sim/sys01-final. Seeds 1-50, both policy/faction assignments, 30-round limit: 100 games, zero replay failures; 6 blue captures, 5 red captures, 89 draws. Mean duration 29.37 resolved rounds; reporting now counts resolved rounds rather than the next planning round.

Heuristic wins 12% as blue and 10% as red against greedy, not a proof of faction balance. Heuristic averages 31.20/32.02 successful ability executions and 21.20/24.74 energy spent per game depending on faction. Most attempted repeats are cooldown/trigger skips; these reasons are logged. Greedy deliberately does not choose active abilities. Combined side-assignment averages: blue/red blocked draws 69.60/70.27 and capped energy 182.08/188.95, including refresh/reserve/Rally overflow. Runs were generated against the verified working tree before the feature commit; their HEAD metadata identifies the base commit. Raw ignored logs remain in logs/sim/sys01-final; committed summary is sys01-simulation.json.

For a limited paired comparison, the first 10 seeds in both assignments drew 16/20 after this system, versus 18/20 after only the archer fix. This changes several mechanics and is too small to isolate an ability's balance effect. It does not establish that stalemates are solved. The historical 96% draw report used a different baseline.

CORE-02 keep pressure/stalemates, SYS-02 hand circulation, and CORE-03 cross-faction spell timing/mutual capture remain open. Future Cavalier flank-seeking movement, arbitrary human objectives, playback controls, art and portrait polish remain deferred. Existing occupied-start movement blocking remains a documented rule, not simultaneous path-following.

Next: confirm SYS-02 recycle/card repayment/state rules, then implement circulation choices at hand/population capacity with browser and paired simulation evidence. Stop verification servers after capture.
