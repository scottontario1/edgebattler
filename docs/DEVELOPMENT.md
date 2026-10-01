# Development direction

Updated 2026-10-01 after integrating continuous combat and Shards into main. [Gameplay](../GAME.md) owns behavior; [current gaps](CURRENT_GAPS.md) owns unresolved work. [Old roadmap](archive/2026-10-01/docs/DEVELOPMENT.md).

## Next work sequence

1. Start a new branch from updated main to restore skills and prototype rewards/economy from [branch.next.md](../branch.next.md). Higher recurring Supply, enemy-defeat rewards and lower early population with paid upgrades are requested; exact values remain TBD. Keep Shards and identity passives while implementing the accepted sidebar/type-wide three-slot design. [Requirements](NEXT_SKILLS_BRANCH.md).
2. Fix integration blockers: timing, target validity, reserve/recruit/respawn inheritance, panel overlap, playback locking and replay.
3. Run controlled encounter/order experiments with explicit flags and parameters. Strengthen challenges where empty plans remain equally successful; historical all-win suites do not prove good balance.
4. Verify desktop/phone, build, rule tests and replay before merging. Keep spells separately archived until restoration is requested.

Scott owns strategic direction and shipped balance. Agents choose routine prototype details and run labelled experiments. User instructions supersede old proposals. Do not silently ship experiment winners; record decisions/evidence.

## Working and evidence

Use one owner for coupled engine/UI integration. Delegate only when authorized with discrete ownership. Preserve unrelated work and checkouts used by other tasks. Commit verified slices. Keep user playtest servers alive; stop temporary verification servers you start.

Results identify revision, flags, seed/faction/map, policy and limitations. Preserve raw data/screenshots and summarize conclusions in current docs. Browser checks do not establish GPU utilization or broad balance; replay of current rules does not certify historical economy logs.

Docs-only changes need local-link, consistency and diff checks. Gameplay changes need appropriate tests/build; visible changes need browser interactions; economy/AI/timing changes need deterministic simulations/replays. [Recorded evidence](VERIFICATION.md) is a baseline, not a substitute for checking future changes.
