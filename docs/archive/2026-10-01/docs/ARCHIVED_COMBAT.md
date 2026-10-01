> Historical snapshot archived 2026-10-01. Earlier revisions/proposals, not current main. [Current docs index](../../../README.md).

# Archived skills and spells

Status: retained and disabled in normal main gameplay, by Scott's instruction on2026-09-30. Shards is the active system. This archive is code/data behind explicit switches; the implementation and its meaningful tests stay in the repository so restoration does not require recovering deleted files.

Browser restoration, per game URL:

- `?campaign=road&you=crown&skills=1` restores active kits, energy HUD, the sidebar's shared-type skill cards, and3/9/15s skill markers.
- Add `spells=1` to restore spell draws, targeting and queued resolution. It works independently of skills.
- `combat=classic` independently selects the discrete combat resolver.

Engine restoration: pass `abilities:true` and/or `spells:true` to createMatch, createCampaignMatch, createLevelMatch or createSkirmish. Explicit `spells:false` allows skills without spells. Older ability-oriented engine tests retain the compatibility default that spells follow abilities when omitted; normal browser play explicitly passes both flags false. The exported `setAbilitiesEnabled` switch remains available for old skill experiments.

Retained implementations: src/abilities.js (active kits/spells/equipment), src/skill-slots.js (type timelines), src/ui/abilities.js/css and src/ui/skill-icons.js (editor), src/match.js (validated actions and timing), and spell/skill cards in src/cards.js. Registered culture spell data remains present. The archived Barrier card can be restored through a custom draw pool containing `barrier`; normal pools exclude it. Tests exercise skill scheduling, energy/cooldowns, spell restoration and replay. Monster/faction identity passives remain active in normal gameplay.

Archived browser checks: PORT=5180 node tools/verify-skill-slots.mjs and tools/verify-timed-spell.mjs explicitly restore skills/spells. Default integration checks: tools/verify-merged-shards.mjs and --mobile exercise Shards buy/apply/remove/combine, selected-unit stats, timed combat and replay. The two grantShard actions in the browser combine check are a logged verification fixture, not normal player income.

Historical experiment results in SKILL_TIMELINE_RESULTS.json measure the prior gameplay branch with skills enabled before the newer Shards shop merge. They are retained as evidence, not main's balance certification. Current main campaign verification runs all15 mission/faction combinations both with archived systems off and restored; all complete and replay. Persistent replay headers carry current feature choices. Pre-merge logs using a different card-dealing algorithm may require their original revision; retained skill code does not guarantee replay compatibility across all historical economy versions.
