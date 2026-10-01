# Current gaps

Reviewed 2026-10-01 against merged main `d1f7c64`. [Superseded status history](archive/2026-10-01/docs/CURRENT_GAPS.md).

## Next branch: skills

Active kits are retained but disabled by default. Restore through the army sidebar: three shared type slots at 3/9/15 seconds and selected-unit stats. Preserve Shards and separate spell gating. [Acceptance criteria](NEXT_SKILLS_BRANCH.md) covers inheritance, failure feedback, boundaries, phone layout and experiments.

## Rewards and economy — next branch

Increase recurring Supply, add enemy-defeat rewards (Supply/cards), test early population caps around 2–3 and paid capacity upgrades. Values, level mapping, reward delivery/overflow and cross-mission persistence remain TBD in [branch.next.md](../branch.next.md). Current main still uses +3 Supply/round and population 10.

## Gameplay and correctness

- **Campaign pressure / CORE-02:** integration completes all 15 faction/mission combinations, but earlier skill experiments also won with empty player plans. Add harder controlled encounters where timing matters. Earlier discrete skirmish draw rates of roughly 89–96% were unresolved at that revision; remeasure timed/Shards skirmishes before claiming they persist or are fixed.
- **CORE-03 spell/capture ordering:** restored spells resolve Blue then Red; mutual victory/capture uses first-winning-side checks. Define/test an explicit policy before expanding cross-side effects or enabling spells normally. Same-time basic attacks are simultaneous already.
- **Coverage:** five integration TODOs remain, including ranged-only shield behavior and classic movement toward nearest Manhattan targets across blocked river routes. Timed pursuit improvements do not prove all classic pathing resolved.
- **Orders:** stance/facing and type plans work; a full arbitrary tile/target editor remains deferred.
- **Persistence:** latest completed report only; no full campaign save/resume or durable multi-match history.

## Observability and devices

- **Phone logging:** development play posts JSONL to `/__log`; production/static builds disable it and have no ingestion endpoint. Those games may only have origin-local reports. Add deliberate export/upload and capture policy before claiming remote logs available. [Retrieval limits](RUNNING_AND_LOGS.md).
- **Performance:** frame/pixel/pass reductions implemented; no measured GPU percentage comparison on the user's device. Profile actual hardware and representative battles. Build still warns about a large chunk.
- **Art:** missing dedicated faction/champion designs use fallbacks. Preserve native colors/identity lookup; [asset coverage](art/FACTION_SPRITES.md).
- **Mobile:** merged portrait Shards/stats flows passed; recheck restored skills against the army rail/actions on phone and short desktop viewports.

## Implemented foundation

Faction select, three northbound missions, scripted mixed waves, monster passives, rallies, continuous attacks, supply bank 30, army sidebar/stat reports, shard shop/dock/combines, rendering quick wins and replay are integrated. Skills/spells are archived behind flags. [Verification](VERIFICATION.md) records checked behavior; [experiment summary](EXPERIMENT_SUMMARY.md) explains historical limits.
