# Gameplay direction

Current main, reviewed 2026-10-01. Supersedes the append-only prototype notes retained in [the archive](docs/archive/2026-10-01/GAME.md).

## Playable loop

Select Classic Ashvale, Argent Crown, White Fang, Iron League or Hollow Court, then play a campaign or skirmish. Three authored campaign missions—Road, Woods and Pass—travel south to north on 12×18 maps (high row numbers to low): engage, regroup/rally, advance. Each mission has three encounter positions; Road begins with fixed single waves, Woods and Pass add two-wave encounters. Enemies mix monsters and rival faction units, exclude the selected player culture and never recruit.

Checkpoints let the player regroup and optionally rally nearby units for +4 HP once before explicitly continuing north. Casualties/state persist within a mission; the next mission starts a fresh army with the chosen faction and seed. There is no full campaign save/resume. Experimental scenario levels remain available; historical results describe their original revisions.

## Planning and battle

Position recruits, choose stance/facing and manage the army through the left sidebar. Selecting a unit shows stats; desktop action controls follow the selected unit above the map. Mobile uses compact controls/popovers. End Round runs continuous battle for up to 18 seconds, with repeated basic attacks governed by Speed and class. Elimination can end it early. Movement and attacks use a deterministic simulation, followed by planning. [Combat rules](docs/COMBAT.md).

Shards are active customization: four seeded types from eight, shared by both sides; 2–3 fresh shop offers each round; dock capacity 12; three applied shards per base combat class. Three matching dock shards upgrade a tier. [Shards rules](docs/SHARDS.md).

Active skills, spell cards, energy selection and the three-slot editor are retained behind restoration switches. Faction/monster identity passives remain enabled. Next branch adds skills back: the sidebar is the primary editor and all units of a type share the order. Skills and spells are independently gated; restoring skills does not itself restore spell draws. [Next-branch requirements](docs/NEXT_SKILLS_BRANCH.md).

## Economy and persistence

Supply starts at 3, gains 3 per round and accumulates to 30; refunds may exceed that bank cap. Population capacity is 10, reserve 8. Ordinary hands hold eight cards, drawing five initially and three subsequently; fresh shard offers sit outside the cap and replace unbought offers on refresh. One cycle per round is shared between hand and reserve. Reserve cycling refunds investment and gives an unpaid replacement of the same type/rarity/grade; it requires a free ordinary hand slot.

Per-unit match statistics retain damage dealt/taken and, when enabled, active ability usage, including fallen/combined records. Damage counts strike damage after mitigation, including overkill. The latest completed report is stored at `battler:last-result` in that browser origin's localStorage and replaces the previous report. It is not a campaign save or server-side history. Detailed logging currently requires the development server; [running and logs](docs/RUNNING_AND_LOGS.md).

## Direction

Timings and balance remain provisional. Improve encounters so planning choices matter, retain replay and test desktop/phone. Scott selects shipped balance changes; agents may run labelled experiments. [Current gaps](docs/CURRENT_GAPS.md) is the active backlog; [development](docs/DEVELOPMENT.md) records the work sequence.
