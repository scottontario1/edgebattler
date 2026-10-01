# Monster kits

Reviewed 2026-10-01: these identity passives remain enabled in Shards-only main. Active monster skills are not implemented.

Campaign monsters carry one named passive each. src/monsters.js defines the display name, short description, and the existing src/passives.js data contract. createMonsterUnit attaches fresh passive data to each encounter unit; monsters remain enemy-only and gain no cards or registered culture.

| Monster | Passive | Rule |
|---|---|---|
| Ashvale Rat | Pack Scavenger | +10 Hit while adjacent to an ally. |
| Cave Spider | Web Ambush | +10 Hit while it did not move this battle. |
| Hyena Goblin | Pack Tactics | +1 damage while adjacent to an ally. |
| Bog Golem | Mudstone Guard | Takes 2 less damage per strike while holding. |
| Ogre | Crushing Blows | Ignores 1 Defense on every strike. |
| Werewolf | Blood Frenzy | +2 damage strictly below half HP. |
| Moth Bear | Thick Hide | Takes 1 less damage per strike strictly below half HP. |
| Corpsehound | Grave Scent | +2 damage while a corpse is within 2 Manhattan tiles. |

Effects are temporary battle statuses applied after movement and before strikes. Movement, stance, adjacency, HP, and nearby corpse checks use existing passive hooks; no new target, resource, or combat phases are required. Fixed encounter guards usually Hold, so the selected triggers support their authored engagement behavior. HP comparisons are strict: exactly half HP does not activate Blood Frenzy or Thick Hide.
