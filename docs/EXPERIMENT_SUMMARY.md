# Retained experiment findings

Summarized 2026-10-01. Earlier revisions produced these results; inspect their configurations before comparing with main. Raw data remains under `docs/experiments/` and `docs/experiments/results/`. [Archived narratives](archive/2026-10-01/README.md).

## Skill timelines before the Shards merge

The 900-game suite on `c93bce5` covered three missions, five factions, ten seeds, default/reversed/empty player plans and two timing profiles. All won/replayed, with no contested phase lacking strikes. This also exposes weak difficulty: empty player skills still win.

Steady 0.35 damage: average rounds 6.41/6.23/6.39 and surviving player HP 98.79/99.17/94.39 for default/reversed/empty. Default casts 2,565, skips 4,489 (cooldown 1,645, stance 1,190). Slot casts 1,828/552/185; reversed 380/531/475. Counters included both sides; empty-player casts belong to enemies. Later windows not reached after early completion are not skips.

Accelerating profile: 127.62 versus 113.88 attacks, duration 58.62 versus 56.77 seconds, surviving HP 97.61 versus 98.79. It combined damage scale 0.30 with up to 30% speed acceleration, so cadence's effect cannot be isolated. These are aggregate match durations, not the 18-second phase limit.

[Raw results](experiments/SKILL_TIMELINE_RESULTS.json); [archived analysis](archive/2026-10-01/docs/experiments/SKILL_TIMELINE_FINDINGS.md). `tools/experiment-skill-timelines.mjs` now explicitly enables skills/spells on the newer engine; rerunning does not reproduce the pre-merge economy automatically. Separate player/enemy usage next branch.

## Shards shop and AI

Earlier discrete-AI comparisons found limited income starved upgrades. Fresh 2–3 offers increased approximate buys/combines from 10/2.4 to 44/11.7 in those fixtures and reached tier III. Older AI measurements favored holding tier-I triples before filling classes. Roughly 98% draws against Greedy measured discrete simulations, not timed campaign difficulty. [Parameters/results](archive/2026-10-01/docs/SHARDS_SIM.md); [current entry points](SHARDS_SIM.md).

## Earlier system/faction work

CORE-02 discrete skirmishes drew roughly 89–96%, unresolved at that revision. Candidate movement, deployment, economy, champion, faction and level outputs remain [here](experiments/results/README.md). They motivate remeasurement, not automatic changes to defaults.

Archived SYS/playtest reports retain energy, card-circulation, sprite and mobile checks. Current accepted behavior is in [gameplay](../GAME.md), [combat](COMBAT.md) and [verification](VERIFICATION.md). Old proposals are not the backlog.
