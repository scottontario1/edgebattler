# Factions and unit identity

Five selections are integrated: Classic Ashvale (`classic`), Argent Crown (`crown`), White Fang (`fang`), Iron League (`league`) and Hollow Court (`court`). They are selectable in the menu/campaign. [Earlier proposal and chronology](docs/archive/2026-10-01/FACTIONS.md).

The engine calls playable factions **cultures**, because `faction` already denotes `blue`/`red`. Registration owns class/variant data, champions, passives and recruitment pools. Source: `src/factions/`, `src/cultures.js`, `src/roster.js`, `src/setup.js`. Read current data for exact numbers rather than old proposal tables.

Crown emphasizes formations/protection; Fang movement/pressure; League prepared positions; Court attrition/death-related value. Active kits/spells remain in data but are disabled in normal main play. Identity passives, stats, categories and champions remain active. Shards group by base class; restored skill plans distinguish specific unit types/variants.

Campaign opponents mix rival units and eight neutral monsters in fixed waves without recruitment. Player recruits retain faction identity. Specific supplied art precedes class fallback; [coverage and missing designs](docs/art/FACTION_SPRITES.md). [Monster passives](docs/MONSTER_KITS.md) remain active independently of the skill switch.

[Retained experiment findings](docs/EXPERIMENT_SUMMARY.md) and [archived implementation records](docs/archive/2026-10-01/README.md) preserve earlier work. Active-skill results do not certify current Shards-only balance.
