# Campaign playtest verification — 2026-09-30

Reviewed and extended `origin/faction_overhaul` from `1cc5f96`; the prior main was `a060fd9`. Luna agents supplied a read-only branch/campaign review and the independent three-map file. One root integrated the coupled match and UI changes.

## Delivered scope

Campaign is the default menu tab. Five selectable factions can play three authored 12x18 missions in sequence. Each mission has three northward encounter positions; mission one uses single fixed patrols, missions two and three add varied second waves. Enemies never recruit or receive replacement cards. Cleared positions pause for village regrouping, optional one-use nearby recovery and explicit continuation. Friendly combat state persists within missions; next-mission links preserve faction/seed and start a fresh army.

## Checks

- Production build passes. Vite retains its existing large-chunk advisory.
- Full suite: 181 tests, 176 pass, zero failures, five existing TODO tests.
- Campaign-specific checks: legal starts and distinct occupied tiles for all 15 faction/mission combinations; enemy recruitment prohibition; checkpoint recovery and transition restrictions; local fallback spawn placement; prevention of premature exit victory.
- 30 complete seeded rule playthroughs: three missions × five factions × seeds 7 and 19. All finish with campaign victory and replay exactly through the default replay entry point. The basic plan marches the army and selects legal non-Hold kits; it does not depend on buying extra units. This demonstrates completion, not human balance.
- Desktop browser: Crown Road played through normal March, Resolve battle, Regroup, Rally and Continue controls. Victory in round 10; next link is Wooded Approach with Crown and the same seed. Screenshot: evidence/crown-road-victory.png.
- Short landscape 960x480 browser: Hollow Court Northern Pass completes in round 26, visits both regroup checkpoints and all six authored waves, and its normal browser log replays exactly. `node tools/verify-campaign.mjs pass court 960 480` verifies this flow. Screenshot: evidence/court-pass-victory.png.
- Portrait 390x844 browser: selecting White Fang from the menu launches Wooded Approach with White Fang and zero enemy cards; March and the faction champion's ability editor open correctly. Screenshots: evidence/menu-fang.png, evidence/fang-woods-mobile.png and evidence/fang-abilities-mobile.png.
- Final desktop and portrait screenshots inspected; no page/runtime errors on successful verification runs. Campaign controls have reserved camera space and remain usable in the tested sizes.

## Review fixes

Campaign logs now reconstruct campaign map, faction, roster and waves automatically. Fallback enemy spawns stay near their authored positions. Final victory uses the declared exit and requires all encounters. Campaign continuation checks stage bounds. Map dressing only places River Ford's island and waterfall on River Ford, preventing stray river scenery on campaign maps.

## Limits and next playtest

Difficulty, fixed troop compositions and one-use +4 HP checkpoint recovery are prototype values. Each mission starts a fresh army; saved progression, unlocks, cross-mission army persistence and faction-specific enemy waves are deferred. The earlier skirmish stalemate and simultaneous mutual-victory questions remain open. Faction art still partly reuses baseline assets. Test human learning, losses and recovery tradeoffs before tuning mission values.
