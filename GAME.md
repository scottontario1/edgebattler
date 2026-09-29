# Chronicle of Ashvale — game spec

## Pitch

A fantasy tactics game combining Advance Wars-style territory, terrain, and army positioning with a random card recruitment system inspired by Teamfight Tactics. Players build an army by drawing unit cards, recruiting into a paid reserve bench, deploying near controlled locations, and optionally combining three matching units to upgrade them. Spell cards support the formation, and potential skill cards let players customize unit abilities. Units fight automatically according to their stances and abilities.

The main decisions are what to deploy, where to deploy it, what to combine, how to arrange the army, and when to spend a spell. A player should be able to command an army of 10 or more units without individually selecting Move, Attack, and Wait for every unit. One **Resolve battle** action commits the plan and runs the combat phase for both armies.

Presentation: an illustrated fantasy army on a readable square-grid battlefield, with Fire Emblem-style characters and a persistent card dock. The map remains a tactical space with roads, forests, bridges, villages, and keeps; it is not just a staging board for a detached arena battle.

## Design status

The card system, upgrades, stances, abilities, and shared automatic battle phase below are the intended direction. They are not implemented yet. Rules marked as **prototype defaults** are starting points for testing, not final balance decisions.

The current demo already supports manual tile movement, attack forecasts, resolved exchanges with counters and follow-ups, Wait, End turn, enemy movement and attacks, unit death, and victory/defeat. Those systems provide a foundation for the new loop. Individual manual attacks and waits must stop being required as the primary way to play.

## Confirmed direction from design elicitation

- First version: single player against an AI commander, on a persistent tactical map.
- Primary objective: capture or destroy the enemy keep; other maps may later define different objectives.
- Each round gives units one automatic activation. Players may reposition units within their movement allowance during planning; stances govern behavior once battle begins and can permit further movement. The budget shared by planning and battle movement still needs definition.
- Energy accumulates across turns. Several positioning and charging rounds can lead into a sustained engagement with energy and cooldown management.
- Cards come from a shared recruitment pool. Resource costs and a population limit gate army building; exact amounts remain balance decisions.
- Ordinary unit deaths are permanent for the match. Hero champions can respawn at base; delay, resource cost, and respawn state remain open.
- Paid reserve units and deployed units can participate in combinations. Combining is optional: three ordinary Pikemen may be preferable to one upgraded Pikeman.
- Players arrange a unit's abilities left to right, with the leftmost having highest priority. Units may have several abilities, including passives or toggles.
- HP, energy, cooldowns, and statuses persist across rounds. Recovery needs a defined ability, spell, or other recovery mechanism.
- Enemy information and potential fog of war will be tested; full visibility is not a settled rule.

## Design pillars

- **Position matters.** Terrain, choke points, attack range, formation, and reinforcement locations decide battles alongside unit strength.
- **Adapt to the draw.** Cards create different tactical opportunities each round. Saving a duplicate, reinforcing a weak flank, and spending a spell should compete for resources.
- **Build an army over time.** Units, damage, upgrades, and captured territory persist between rounds within a match.
- **Command through intent.** Stances and objectives guide automatic decisions. The player gives useful orders rather than approving every action.
- **Make automation understandable.** Show intended routes, threatened targets, the acting unit, and combat results. Explain why a unit held position or could not attack.

## Round structure

A round has four stages:

1. **Refresh and draw.** Grant the round's deployment resource, draw cards into the hand, and refresh round-based actions. Show the incoming cards and current resource total.
2. **Planning.** Recruit reserve units, deploy units, optionally combine duplicates, cast spells, and optionally change positions, stances, objectives, or ability priority. Existing orders remain in effect. The player may finish immediately if the current plan is satisfactory.
3. **Automatic battle.** Press **Resolve battle** once. Lock card play and orders, then resolve movement, attacks, automatic abilities, counters, and deaths for both armies. The player can inspect, pause presentation, change playback speed, or skip animations without changing the result.
4. **Results and next round.** Apply captures and rewards, report losses and upgrades, and check victory conditions. If the match continues, advance the round and return to planning.

There is no requirement to mark every friendly unit as finished. A unit without a new order uses its existing stance and objective. An army with no cards or resources available can still resolve its battle.

The first version is single-player against an enemy commander. Proposed fairness baseline: the enemy recruits and plans under the same core rules. Enemy recruitment and orders lock before battle begins. Shared combat replaces the current sequence of manually ordered player attacks followed by an enemy-only action phase. Competitive multiplayer is outside the first implementation slice.

## Cards, hand, and resources

### Card types

| Type | Played onto | Result | Upgrade rule |
|---|---|---|---|
| Unit | Paid reserve bench, then a legal deployment tile | Creates a persistent unit that can be deployed | Three matching paid reserve/deployed units at the same star level may combine |
| Spell | A valid unit, tile, or area | Applies the described one-use effect | Never combines or gains stars |

Cards must identify their name, type, cost, and effect. Unit cards also show class, star level, attack range, default stance, and a short ability description. Spell cards show target restrictions and duration. The card art should match the battlefield sprite and portrait. Skill and enchantment cards are additional possibilities under consideration: skill cards equip abilities, while enchantments would apply persistent modifications. Their storage, costs, and inheritance rules need definition.

Draws come from a defined recruitment pool for the match. Start with a small, weighted pool of the existing recruit classes and a few spells. Randomness should offer useful choices without requiring a matching triple to survive the first rounds. There is no paid shop, reroll system, or deck-building screen required for the first prototype.

**Prototype defaults:**

- Start with a five-card hand; draw three cards at the start of each later round.
- Keep unplayed cards between rounds. Cap the hand at eight cards; draw only into free slots and show when the hand prevented further draws. Do not silently discard existing cards.
- Use one resource, **Supply**, for units and spells. Gain three Supply per round, with a bank cap of six. Initial Supply is three.
- Give initial unit cards costs in the 1–3 range and spells costs in the 1–2 range. Actual class costs, pool weights, and rewards require balance testing.
- Start without additional draw or income from captured villages. Add territory income only after the base draw and deployment loop is understandable.

Retaining cards and Supply lets the player save for combinations or expensive reinforcements. The UI always shows current Supply, affordability, and how much a play will consume.

## Deploying units and controlling territory

Playing a unit card pays its recruitment cost and creates a unit on the reserve bench. The bench holds paid units; it is distinct from the hand of unplayed cards. Deploying a reserve unit places it on a legal field tile, with its sprite, occupied tile, and initial threat range previewed before commitment. Whether direct hand-to-field recruitment is also offered as a shortcut remains a UI choice. Invalid or cancelled recruitment/deployment consumes nothing.

Reserve capacity, whether bench units consume population, whether they regenerate energy or HP, and any extra deployment charge are unresolved. Spells, enchantments, and equipment need an explicit inventory model rather than silently being treated as reserve units.

Prototype deployment rules:

- Initial reinforcements may enter on the player's keep or designated starting deployment tiles.
- Captured villages can provide additional deployment locations. Capture is recorded at the end of a battle phase when a living unit occupies the objective; control persists until recaptured.
- A controlled location offers its own tile and adjacent orthogonal tiles, subject to occupation, map boundaries, and the unit's movement type.
- Deploy only onto empty, traversable tiles in a controlled deployment area. Never deploy directly onto enemy units or onto impassable water.
- A newly deployed unit can act in that round's automatic battle.
- Use a population limit with higher-star units costing more population. Exact star costs, class variation, commander cost, and the population cap remain open. Show the projected population change for recruitment, deployment, and combinations; do not assume every upgrade frees exactly two slots.

One unit occupies one tile. Friendly units may pass through allies when movement rules permit, but may not finish on an occupied tile. During planning, players can move units immediately within their movement allowance to arrange the formation. When battle begins, stances can cause units to advance, retreat, or maintain range automatically. How much allowance is left for automatic movement after manual repositioning must be settled before implementation; avoid accidental unlimited movement through repeated planning drags.

Deployment and movement must share the map's terrain registry and movement rules. Roads and bridges are fast routes, forests provide cover and slow movement, and mountains restrict heavy or mounted troops. A captured reinforcement point creates a meaningful new front.

## Three-of-a-kind upgrades

Three copies of the **same unit identity at the same star level** combine into one unit at the next star level. Matching is based on the card's class/variant identifier, not its displayed recruit name or portrait.

Prototype progression:

- Three 1-star Pikemen produce one 2-star Pikeman.
- Three 2-star Pikemen produce one 3-star Pikeman, requiring nine original 1-star copies in total.
- Three stars is the prototype maximum.
- Different classes, variants, factions, or star levels cannot combine. Spell cards never participate.

Eligible copies are paid units on the reserve bench or battlefield. Unplayed cards in the hand are potential recruits, not free upgrade ingredients. Combining itself has no additional fee in the proposed baseline; all participating units have already been paid for.

Combining is always the player's choice. Having three matches highlights an available upgrade; recruiting or deploying a third copy must not silently consume the existing units. The player can retain three Pikemen for coverage or combine them into one stronger Pikeman. Star progression remains the three-of-a-kind rule, but each further combination also requires a deliberate choice.

Preview the consumed copies, resulting stars/stats, and population change. The player chooses the survivor or reserve destination. Proposed location rule: preserve one participating field unit's tile and orders, or keep a reserve result on the bench; moving a result from the bench to the field still requires a legal controlled deployment location. Exact bench/field destination restrictions remain open.

Upgrades improve a defined class stat table and may strengthen existing abilities. A star upgrade should create a stronger specialist, not simply triple every statistic. Proposed health inheritance: apply the inputs' combined current-HP/max-HP ratio to the upgraded maximum HP. Energy, skills, enchantments, cooldowns, statuses, and ability-order inheritance require explicit rules; do not assume an upgrade heals, refills energy, resets cooldowns, or cleanses effects for free.

Hero champions are distinct from ordinary recruits and can respawn at base after death. Automatic respawn after a delay and paid respawn are both candidates; their star progression, resource penalty, and reset state remain undecided. The current demo's immediate defeat on losing Brenna is a legacy rule, not the intended normal outcome of champion death.

## Spells

Spells are single-use tactical cards. They have no star level, do not combine, and do not require duplicate collection. Each spell defines a cost, target type, effect, and duration. Duplicate spells remain separate playable cards.

Initial examples, with values to be tuned:

- **Mend:** restore HP to a friendly unit, capped at maximum HP.
- **Ward:** protect one friendly unit during the upcoming battle phase.
- **Fireburst:** damage enemies in a clearly previewed tile area.

Prototype timing: spells resolve when confirmed during planning. Persistent effects such as Ward explicitly last through the next battle phase. Preview affected tiles and targets; cancelling leaves the card and Supply intact. After confirmation, apply the effect and consume the card once. Spells cannot be cast during automatic resolution. A lethal spell removes its victim and triggers the same victory checks as other deaths.

Spells provide direct intervention without introducing a per-unit manual action queue. More complex effects such as displacement, summons, or terrain creation come after the initial targeting and duration rules work.

## Persistent energy, recovery, and cooldowns

Every unit has its own persistent energy pool. The typical maximum is around 3–4 energy; casters may have larger pools. Energy gains have a per-turn baseline, with additional energy possible from attacks, taking damage, abilities, and class-specific triggers. The exact baseline, gain timing, starting energy, and overflow behavior remain open.

Ordinary movement and basic attacks are normally available without an energy cost. Enhanced actions, abilities, and some stance effects can spend energy. Each effect needs an explicit cost, legal trigger, and cooldown. Energy does not reset between battle phases, so a formation may spend several rounds moving and charging before a sustained fight.

HP, cooldowns, statuses, and energy persist across rounds. Recovery abilities matter between engagements; there is no assumed automatic full heal. Units can use their priorities to recover or prepare even when enemies are not in range.

Concrete design example supplied by the user:

> **Pike — Rally:** restore 10 HP to the Pike; gain 1 energy this turn and next; cooldown 2 turns.

Rally's energy cost, automatic trigger, activation timing, and the exact two-turn cooldown convention still need definition. A cavalry flanking bonus is another intended example, with its trigger and reward to be specified. These examples express roles and timing, not implemented or fully balanced abilities.

## Stances, objectives, and automatic abilities

Stances are persistent behavioral orders. Each class has a sensible default, so newly deployed units can participate immediately. Changing a stance during planning is optional and free in the initial prototype.

| Stance | Movement intent | Combat intent |
|---|---|---|
| Advance | Move toward the assigned objective or enemy front | Attack a useful reachable target while respecting terrain and range |
| Defend / Hold | Hold the assigned position; do not chase | Attack from current range and use permitted defensive reactions |
| Protect | Stay near an assigned ally or objective | Prioritize enemies threatening that subject without abandoning the protection area |

Defaults should reflect roles: frontline melee advances, archers maintain useful firing range, and an objective defender holds. Orders may name a tile, objective, or ally; losing an assigned target falls back to the class default. Stances never bypass occupation, movement costs, or attack range.

Units may have several abilities, including active skills, passives, and toggles. Players arrange abilities in a visible left-to-right order, with the leftmost having highest priority during automatic resolution. The resolver must evaluate that order against costs, cooldowns, valid targets, and trigger conditions. Whether it executes only the first eligible active ability, multiple affordable abilities, or an ability plus a basic attack is still open.

Passives and toggles need their own trigger/upkeep semantics instead of being implicitly treated as ordinary casts. Ability order persists between turns; changing it is optional planning work, not a required per-unit action.

Potential skill-card example: a Pike starts with Rally, and the player equips **Barrier: block f(x) damage** when the situation calls for it. Barrier's scaling formula, duration, cost, trigger, and stack behavior remain open. Skill cards would customize a particular unit's loadout; slot count, class restrictions, transferability, and loss on death or combination must be decided before implementation.

Expose ready/cooling-down status in inspection and show an ability label when it fires. Support applying a stance to a selected group or role later; do not require assigning it again to every unit every round.

## Automatic battle rules

Resolve one bounded tactical exchange per round on the persistent map, rather than fighting until one army disappears. Survivors retain their resulting position, HP, energy, cooldowns, statuses, and ability configuration for the next planning stage. Repeated rounds of positioning and charging transition into sustained engagement; battle resolution does not reset either army.

**Prototype resolution contract:**

1. Lock deployment, spells, and orders; snapshot both sides' plans and establish a stable initiative order.
2. Each living unit gets one scheduled activation: evaluate stance-driven movement, then evaluate abilities in the player's chosen priority order and perform eligible combat actions. The movement budget shared with planning and the number of active skills/basic attacks within that activation remain open. If nothing is legal, hold automatically.
3. Alternate faction priority for ties each round; never give the player army the entire first-action advantage by default. Movement contention is settled in this documented order, and actions use the current board after previous events.
4. Apply damage, reactions, status changes, and deaths before the next activation. A defeated unit loses its pending activation. Every event has stable tie-breaking so the same seed and orders produce the same result.
5. Finish when all scheduled activations are handled, then resolve objective ownership and round results. Counters and abilities must have finite limits and cannot generate an endless reaction chain.

Reuse weapon range, terrain defense, the weapon triangle, hit/critical calculations, counters, and speed follow-ups from the current demo where they fit. An attack exchange may include its permitted follow-up strikes; those are part of the activation, not another movement turn. Prototype limit: one counter reaction per unit per round, separate from its scheduled activation. Recheck legal range and living targets as the board changes.

Target choice must respect stance before optimizing damage. Keep deterministic priorities for kills, class matchups, terrain, and protecting the assigned subject. Do not let every unit blindly chase the weakest enemy across the map.

Battle logic produces an ordered event stream independently of animation. Presentation consumes movement, attack, ability, damage, and death events. Faster playback and skipping must lead to the same authoritative final state. A seeded random source makes draws and combat reproducible for debugging.

## Card dock and battlefield UI

The card dock is a core part of the planning interface, not an inspect-only popup.

- **Bottom hand dock:** visible card faces, card count, costs, Supply total, affordability, and combination indicators. Reserve space for it when framing the map.
- **Play interactions:** drag a card onto a target on desktop; also support click/tap a card, then click/tap the destination. Show legal tiles, an effect preview, and a clear cancel action. Keyboard equivalents should be available.
- **Selected card detail:** readable effect text, stats or spell duration, and the reason a target is invalid. A card must not be consumed by a failed drop.
- **Paid reserve bench:** distinguish recruited units from unplayed hand cards; show available field/bench triples without forcing a combination. Provide an explicit upgrade preview and survivor choice.
- **Army controls:** a compact stance/objective panel for the selected unit, population use, visible stars, current/max energy, and a reorderable ability row with costs and cooldowns. Inspection remains available without requiring orders for every unit.
- **Primary action:** one prominent **Resolve battle** button, with optional confirmation when important cards or Supply remain unused. Do not block it because units lack manual orders.
- **Battle presentation:** collapse the hand into a compact summary, identify the acting unit in the roster and on the map, and keep action labels and damage readable. Pan only when needed to reveal the action; offer playback controls.
- **Results:** show captures, losses, and the reason for victory or defeat. Provide a clickable/tappable restart button as well as the keyboard shortcut.

On narrow screens, use a horizontal card strip with an expandable detail view. Fit the hand, selected-unit detail, and primary action into a coordinated bottom area rather than stacking independent panels over most of the battlefield. The map camera must respect those insets.

Input priority depends on intent: when playing a card or assigning a destination, legal tile targets take precedence over tall sprites covering them. When selecting or targeting a unit, identify it through its foot marker and sprite. Always preview the actual destination or target before committing.

## Current demo foundation

Two named heroes and three recruit classes are already present. Recruits use templates in `RECRUIT` (`src/units.js`) and may appear in either army. The current roster is fixed; random recruitment and dynamic deployment are future work.

| Class | Move type | Current range | Tactical role |
|---|---|---|---|
| Pikeman | Foot | 1 | Frontline defense; proposed anti-cavalry ability |
| Archer | Foot | 2 | Ranged support; cannot counter adjacent attackers |
| Cavalier | Mounted | 1 | Mobility and reinforcement-point pressure; forest movement is expensive |
| Brenna, Paladin | Armor | 1 | Named player commander and defensive support |
| Dreg, Barbarian | Armor | 1 | Named enemy commander and melee pressure |

Future classes may include mage, knight, healer, and flying units. Add them after the initial three recruit cards support a complete match.

Current terrain includes plains, roads, bridges, forests, mountains, villages, and keeps. Use `src/terrain.js` for terrain effects and `src/rules.js` for movement costs rather than duplicating balance values in this document. The current map is 16 × 12 tiles; each tile is one world unit.

Current demo outcomes are routing the enemy or occupying its keep; losing Brenna currently causes defeat. The intended standard match is won by capturing or destroying the enemy keep, while hero champions can respawn. Future maps may declare other objectives. Maps should declare commanders, deployment zones, capture locations, and victory conditions as data. Define exactly when occupation counts as a capture or win, and report that reason to the player.

## Art direction

Illustrated 2.5D tactics inspired by Fire Emblem, Unicorn Overlord, and Triangle Strategy. Painted anime characters stand as transparent sprites on a 3D map with soft terrain detail, strong silhouettes, and consistent anatomical scale. The current sprite pipeline is documented in `docs/asset-pipeline-plan.md`; Blender models remain available as a fallback and reference.

Card faces, battlefield units, and portraits should share the same character artwork. Stars, stance markers, faction colors, and contact shadows must remain readable at normal tactical zoom. Avoid oversized heads, glossy toy shading, and a mix of detailed heroic characters with differently proportioned recruits.

Upgraded units need an obvious star badge and a restrained visual accent. The first prototype can reuse the base sprite; it does not require a new illustration for every star level. Spell effects should communicate their area and duration without hiding occupied tiles.

## Implementation milestones

### Existing foundation

- Visual battlefield, sprites, portraits, selection, range overlays, and inspection.
- Manual movement with path animation; Wait and End turn.
- Attack forecasts and resolved combat, counters, follow-ups, HP changes, and deaths.
- Basic enemy decisions and scenario victory/defeat.

### New direction: build one playable slice at a time

1. **Hand, reserves, and deployment:** card data, seeded draw, resource costs, paid reserves, population, the bottom dock, placement previews, and dynamic unit creation. Start with the three existing recruit classes and legal starting deployment tiles.
2. **Automatic round and energy:** one Resolve battle command, planning repositioning, persistent default stances, per-unit energy/cooldowns, bounded activations for both armies, enemy planning, and event-driven playback. Complete a match without manually issuing attacks or waits.
3. **Optional combinations:** matching across paid reserves and the field, survivor/destination choices, star stats, population changes, inheritance rules, and visible upgrade markers. Verify that available triples can be kept separate and each upgrade requires an explicit choice.
4. **Spells and ability loadouts:** planning spells, several automatic abilities per unit, reorderable priorities, passives/toggles, Rally-style recovery, and the potential skill-card system. Include explicit targeting, duration, energy costs, cooldowns, and reaction limits.
5. **Territory and pacing:** captured deployment locations, resource/draw/population balance, reserve limits, champion respawn, and readable battle summaries. Confirm positioning and energy accumulation matter alongside card luck; ordinary casualties remain permanent.
6. **Presentation and expansion:** group orders, mobile dock polish, matching portraits, sound, dialogue, additional classes, and multiple maps. Save/load and campaign progression follow once the core match loop is stable.

Keep card/inventory, orders, and battle state independent of DOM handlers. The current turn flow in `src/ui.js` should move into a dedicated game-state controller as automatic resolution is introduced. Reuse `src/rules.js` and `src/combat.js`; adapt `src/ai.js` for both stance-driven friendly decisions and enemy planning.

## Decisions to tune through the prototype

The intended direction is fixed: random shared-pool cards, paid reserves, controlled-location deployment, optional three-of-a-kind unit upgrades, weighted population, persistent energy and ability priorities, and one automatic activation per unit per round. Ordinary deaths are permanent; hero champions can respawn. The following remain adjustable:

- Draw counts, pool weights, resource types and costs, banking, hand/bench limits, and population values.
- Movement allowance shared between immediate planning moves and stance-driven battle movement.
- Energy gain timing, ability triggers/action limits, cooldown tick convention, passive/toggle rules, and recovery timing.
- Skill/enchantment cards: inventory, equipment slots, costs, transferability, and loss/inheritance rules.
- Exact star stat gains and HP/energy/status/cooldown/loadout inheritance during combinations.
- Initiative speed rules, reaction limits, and the usefulness of each stance.
- Whether territory later produces resources, additional draws, or only deployment access.
- Champion count, respawn delay/cost/reset state, and base-defeat rules.
- Enemy information, projected actions, and possible fog of war; compare visibility treatments through playtests.
- Optional rerolls and longer-term campaign rewards.

Evaluate these against a concrete goal: the player should spend a short planning turn making a handful of meaningful decisions, then understand how those decisions shaped the automatic battle.
