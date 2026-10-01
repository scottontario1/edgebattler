# Next branch — skills, rewards and economy

Planning/TBD register, updated 2026-10-01. Current main behavior is unchanged. Start the gameplay branch from updated main; retain Shards and restore the accepted [sidebar/type-wide skill design](docs/NEXT_SKILLS_BRANCH.md).

## Requested direction

- Increase recurring Supply income above the current 3 per round. Treat “daily gain” as an in-game day/round for this prototype; a real-world daily reward system is not specified.
- Reward defeating enemies with Supply and potentially cards or other loot. Define kill, wave and mission rewards together so campaign progression feels rewarding.
- Lower early-level population capacity, with 2–3 as the starting-cap candidate, and allow resources to purchase additional capacity. Exact caps and level mapping remain TBD: the request may also refer to mission levels 2 and 3.
- Provide enough Supply to recruit, buy Shards and purchase capacity. Increasing income and adding rewards must accompany the lower-cap experiment; avoid an opening where the player cannot build or replace an army.

## Economy decisions TBD

- Recurring income amount, starting Supply and whether the current bank of 30 remains suitable.
- Supply per enemy defeat; whether monsters, ordinary units and elites have different rewards.
- Card reward frequency, eligible faction/neutral/Shards pools, and whether rewards are guaranteed or seeded rolls. Keep spells archived unless separately approved.
- Delivery timing: queue rewards during continuous combat and expose them at a clear planning/regroup boundary as the initial approach to test.
- Overflow when the ordinary hand (8) or shard dock (12) is full: deferred claim, conversion or another explicit rule. Never silently discard a reward.
- Starting population by mission, maximum capacity, upgrade increment, currency/cost curve and where the upgrade is purchased.
- Whether capacity is army-wide or type-specific; start experiments with the existing army-wide population concept.
- Whether Supply/capacity upgrades persist across missions. Current missions reset the army; persistence is a deliberate new decision, not an implied save system.
- Which units count toward a small cap, including champions; adjust authored starting armies and deploy rules together. Do not simply lower the limit while spawning an army above it.

## Prototype and verification

Compare current economy against higher income, defeat rewards and paid capacity using controlled seeds. Separate individual-variable comparisons from a combined playable progression test. Keep a no-purchase path capable of reaching enough rewards to buy the first upgrade.

Track Supply earned by source, spent on recruits/Shards/capacity, unused bank, time to first upgrade, army size, reward overflow, casualties, mission completion and skill-plan impact. Check that upgrades compete meaningfully with other purchases without making recovery impossible or rewarding idle rounds excessively.

Reward each eligible enemy defeat once. Verify simultaneous kills, indirect damage, revived enemies, waves and replay without duplicate grants; define whether “defeat” means final removal for revenants/respawning units. No repeatable reward farming from a single enemy identity. Enemy recruitment remains disabled in authored campaign levels.

Before merge: relevant economy/reward/capacity tests, exact replay with logged rewards/upgrades, build, desktop/phone purchase and claim flows, all faction openings legal under their caps, and representative campaign progression. Publish chosen numbers and remaining limitations in current docs rather than leaving experimental defaults undocumented.
