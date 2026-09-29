# Chronicle of Ashvale — game spec

## Pitch

A fantasy tactics game combining Advance Wars-style territory, terrain, and army positioning with a random card recruitment system inspired by Teamfight Tactics. Players build an army by drawing unit cards, recruiting into a paid reserve bench, deploying near controlled locations, and optionally combining three matching units to upgrade them. Spell cards support the formation, and transferable skill cards can customize the shared loadout of a unit type. Units fight automatically according to their stances and abilities.

The main decisions are what to deploy, where to deploy it, what to combine, how to arrange the army, and when to spend a spell. A player should be able to command an army of 10 or more units without individually selecting Move, Attack, and Wait for every unit. One **Resolve battle** action commits the plan and runs the combat phase for both armies.

Presentation: an illustrated fantasy army on a readable square-grid battlefield, with Fire Emblem-style characters and a persistent card dock. The map remains a tactical space with roads, forests, bridges, villages, and keeps; it is not just a staging board for a detached arena battle.

## Design status

The card system, upgrades, stances, abilities, and shared automatic battle phase below are the intended direction. They are not implemented yet. Rules marked as **prototype defaults** are starting points for testing, not final balance decisions.

The current demo already supports manual tile movement, attack forecasts, resolved exchanges with counters and follow-ups, Wait, End turn, enemy movement and attacks, unit death, and victory/defeat. Those systems provide a foundation for the new loop. Individual manual attacks and waits must stop being required as the primary way to play.

## Confirmed direction from design elicitation

- First version: single player against an AI commander, on a persistent tactical map.
- Primary objective: capture or destroy the enemy keep; other maps may later define different objectives.
- Each round gives units one automatic activation, which may execute several eligible abilities plus a basic attack. Planning repositioning and automatic stance-driven movement have separate full movement allowances. Resolve both armies' movement together, then their combat together.
- Energy accumulates across turns. Several positioning and charging rounds can lead into a sustained engagement with energy and cooldown management.
- Cards come from a shared recruitment pool. Resource costs and a population limit gate army building; exact amounts remain balance decisions.
- Ordinary unit deaths are permanent for the match. Hero champions can respawn at base; delay, resource cost, and respawn state remain open.
- Paid reserve units and deployed units can participate in combinations. Combining is optional: three ordinary Pikemen may be preferable to one upgraded Pikeman.
- Players arrange abilities left to right, with the leftmost having highest priority. Units may have several active abilities, passives, or toggles. Equipped skills currently apply to all instances of a unit type; more granular loadouts may come later.
- HP, energy, cooldowns, and statuses persist across rounds. Recovery abilities run during normal activations, even without a nearby enemy. A two-turn cooldown used in round 5 is ready again in round 7.
- Units may withdraw through controlled reinforcement locations into recovering/charging reserves and may be sold or recycled into a card of the same grade. Refunds, card repayment, and preserved state remain open.
- Spell cards are queued during planning and resolve when battle starts. Skill cards are transferable equipment; their type-wide scope is distinct from one-shot spells.
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
2. **Planning.** Recruit reserve units, deploy or withdraw units, optionally combine duplicates, queue spells, equip or transfer skills, and optionally change positions, stances, objectives, or ability priority. Existing orders remain in effect. The player may finish immediately if the current plan is satisfactory.
3. **Automatic battle.** Press **Resolve battle** once. Lock card play and orders, resolve queued spells at battle start, resolve both armies' movement together, then resolve both armies' combat together. Evaluate prioritized abilities, attacks, reactions, and deaths under explicit simultaneous-resolution rules. The player can inspect, pause presentation, change playback speed, or skip animations without changing the result.
4. **Results and next round.** Apply captures and rewards, report losses and upgrades, and check victory conditions. If the match continues, advance the round and return to planning.

There is no requirement to mark every friendly unit as finished. A unit without a new order uses its existing stance and objective. An army with no cards or resources available can still resolve its battle.

The first version is single-player against an enemy commander. Implemented: the enemy draws from its own seeded hand, gains Supply each round, and recruits and deploys unit cards (most expensive affordable first) at its keep and any red-held village, subject to the same population cap; it does not yet cast spells or equip skills. Proposed fairness baseline: the enemy recruits and plans under the same core rules. Enemy recruitment and orders lock before battle begins. Shared combat replaces the current sequence of manually ordered player attacks followed by an enemy-only action phase. Competitive multiplayer is outside the first implementation slice.

## Cards, hand, and resources

### Card types

| Type | Played onto | Result | Upgrade rule |
|---|---|---|---|
| Unit | Paid reserve bench, then a legal deployment tile | Creates a persistent unit that can be deployed | Three matching paid reserve/deployed units at the same star level may combine |
| Spell | A valid unit, tile, or area | Queues a one-use effect for battle start | Never combines or gains stars |
| Skill | A compatible unit-type loadout | Equips a transferable ability shared by its instances | No combination rule specified; do not assume three-of-a-kind applies |

Cards must identify their name, type, cost, and effect. Unit cards also show class, star level, attack range, default stance, and a short ability description. Spell cards show target restrictions and duration. The card art should match the battlefield sprite and portrait. Skill cards equip transferable abilities, currently shared by instances of a unit type. Enchantment cards could apply persistent modifications. Storage, costs, compatibility, slot limits, and exact ownership/grade scope still need definition.

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

Deployed units may withdraw through a controlled base or reinforcement point into reserves. Reserves can recover and accumulate energy. Eligible units can also be sold or recycled into a card of the same grade, preserving the existence of upgraded cards rather than breaking every unit back into 1-star copies.

**Implemented (prototype defaults):** a deployed recruit standing on a controlled keep or village tile can Withdraw (W) to the bench with its HP, energy, cooldowns and statuses intact; it keeps its population slot. Benched units recover 4 HP and 1 energy per round (`RESERVE_HEAL`, `RESERVE_ENERGY` in `src/ui.js`) and tick cooldowns; redeploying restores exactly that state. Champions cannot be benched. Selling/recycling is not implemented.

Reserve capacity, reserve population cost, recovery/energy rates, withdrawal timing, and any extra deployment charge are unresolved. Selling/recycling must define whether resources are refunded, whether the resulting card must be paid for again, and what happens to HP, energy, cooldowns, and statuses. Keep these rules explicit so the system does not accidentally grant an instant full heal or unlimited refunds. Spells, enchantments, and equipment need an explicit inventory model rather than silently being treated as reserve units.

Prototype deployment rules:

- Initial reinforcements may enter on the player's keep or designated starting deployment tiles.
- Captured villages can provide additional deployment locations. Capture is recorded at the end of a battle phase when a living unit occupies the objective; control persists until recaptured.
- A controlled location offers its own tile and adjacent orthogonal tiles, subject to occupation, map boundaries, and the unit's movement type.
- Deploy only onto empty, traversable tiles in a controlled deployment area. Never deploy directly onto enemy units or onto impassable water.
- A newly deployed unit can act in that round's automatic battle.
- Use a population limit with higher-star units costing more population. Exact star costs, class variation, commander cost, and the population cap remain open. Show the projected population change for recruitment, deployment, and combinations; do not assume every upgrade frees exactly two slots.

One unit occupies one tile. Friendly units may pass through allies when movement rules permit, but may not finish on an occupied tile. During planning, players can move units immediately within their movement allowance to arrange the formation. When battle begins, stances can cause units to advance, retreat, or maintain range automatically. Planning repositioning and automatic movement each have their own full movement allowance. Track both allowances independently so repeated planning moves cannot reset that phase's budget. A unit that spends its planning allowance can still use its automatic allowance once resolution begins.

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

Upgrades improve a defined class stat table and may strengthen existing abilities. A star upgrade should create a stronger specialist, not simply triple every statistic. Proposed health inheritance: apply the inputs' combined current-HP/max-HP ratio to the upgraded maximum HP. The result uses the shared skill loadout for its unit type, so merging differently equipped individual copies is not a required feature yet. Exact scope across star levels, ability-priority scope, and enchantment inheritance remain open. Per-instance HP, energy, cooldowns, and statuses still require inheritance rules; do not assume an upgrade heals, refills energy, resets cooldowns, or cleanses effects for free.

Hero champions are distinct from ordinary recruits and can respawn at base after death. Automatic respawn after a delay and paid respawn are both candidates; their star progression, resource penalty, and reset state remain undecided. The current demo's immediate defeat on losing Brenna is a legacy rule, not the intended normal outcome of champion death.

## Spells

Spells are single-use tactical cards. They have no star level, do not combine, and do not require duplicate collection. Each spell defines a cost, target type, effect, and duration. Duplicate spells remain separate playable cards.

Initial examples, with values to be tuned:

- **Mend:** restore HP to a friendly unit, capped at maximum HP.
- **Ward:** protect one friendly unit during the upcoming battle phase.
- **Fireburst:** damage enemies in a clearly previewed tile area.

Spells are queued during planning and resolve when battle starts. Preview affected tiles and targets and show pending casts in the dock. Persistent effects such as Ward explicitly last through the upcoming battle phase. Spells are not cast interactively during automatic resolution.

Define precisely when card/resource payment becomes committed and whether queued spells can be cancelled or retargeted before Resolve battle. Also define whether a spell tracks a selected unit or a fixed tile and how simultaneous healing, protection, and damage interact. Consuming a card and paying its cost must happen exactly once. Deaths and victory checks follow the agreed batch-resolution timing, not the order of animation playback.

Spells provide direct intervention without introducing a per-unit manual action queue. More complex effects such as displacement, summons, or terrain creation come after the initial targeting and duration rules work.

## Persistent energy, recovery, and cooldowns

Every unit has its own persistent energy pool. The typical maximum is around 3–4 energy; casters may have larger pools. Energy gains have a per-turn baseline, with additional energy possible from attacks, taking damage, abilities, and class-specific triggers. The exact baseline, gain timing, starting energy, and overflow behavior remain open.

Ordinary movement and basic attacks are normally available without an energy cost. Enhanced actions, abilities, and some stance effects can spend energy. Each effect needs an explicit cost, legal trigger, and cooldown. Energy does not reset between battle phases, so a formation may spend several rounds moving and charging before a sustained fight.

HP, cooldowns, statuses, and energy persist across rounds. Recovery abilities matter between engagements; there is no assumed automatic full heal. Recovery skills run as part of normal activations, even when no enemy is nearby, and reserves can recover and charge under rates still to be specified.

Concrete design example supplied by the user:

> **Pike — Rally:** restore 10 HP to the Pike; gain 1 energy this turn and next; cooldown 2 turns.

Cooldown convention: using Rally in round 5 makes it unavailable in round 6 and ready in round 7. Recovery happens during the normal activation, including rounds without nearby enemies. Rally's energy cost, exact automatic trigger, and placement within simultaneous ability resolution still need definition. Whether cooldowns tick while stunned and how reserve cooldowns advance remain open. A cavalry flanking bonus is another intended example, with its trigger and reward to be specified. These examples express roles and timing, not implemented or fully balanced abilities.

## Stances, objectives, and automatic abilities

Stances are persistent behavioral orders. Each class has a sensible default, so newly deployed units can participate immediately. Changing a stance during planning is optional and free in the initial prototype.

| Stance | Movement intent | Combat intent |
|---|---|---|
| Advance | Move toward the assigned objective or enemy front | Attack a useful reachable target while respecting terrain and range |
| Defend / Hold | Hold the assigned position; do not chase | Attack from current range and use permitted defensive reactions |
| Protect | Stay near an assigned ally or objective | Prioritize enemies threatening that subject without abandoning the protection area |

Defaults should reflect roles: frontline melee advances, archers maintain useful firing range, and an objective defender holds. Orders may name a tile, objective, or ally; losing an assigned target falls back to the class default. Stances never bypass occupation, movement costs, or attack range.

Units may have several abilities, including active skills, passives, and toggles. Players arrange abilities in a visible left-to-right order, with the leftmost having highest priority during automatic resolution. The resolver must evaluate that order against costs, cooldowns, valid targets, and trigger conditions. During the activation, a unit may execute multiple eligible abilities in priority order, constrained by energy and cooldowns, and also make a basic attack. Exact timing relative to attacks, evaluation passes, and repeat-cast limits remain open; resolve a bounded sequence so energy-generating abilities cannot cause an infinite action loop.

Passives and toggles need their own trigger/upkeep semantics instead of being implicitly treated as ordinary casts. Ability order persists between turns; changing it is optional planning work, not a required per-unit action. Trigger controls remain an experiment: test simpler built-in conditions on some units, such as Pikemen, and more configurable behavior on others, such as Cavaliers.

Potential skill-card example: a Pike starts with Rally, and the player equips **Barrier: block f(x) damage** when the situation calls for it. Barrier's scaling formula, duration, cost, trigger, and stack behavior remain open. Equipped skills currently apply to all instances of a unit type rather than one particular soldier. Skill cards are transferable equipment. Owner/faction scope, whether all star levels and future recruits inherit the skill, shared versus per-instance priority, slot count, class restrictions, transfer costs, and cooldown handling on transfer remain open. More granular per-instance loadouts may come later.

Expose ready/cooling-down status in inspection and show an ability label when it fires. Support applying a stance to a selected group or role later; do not require assigning it again to every unit every round.

## Automatic battle rules

Resolve one bounded tactical exchange per round on the persistent map, rather than fighting until one army disappears. Survivors retain their resulting position, HP, energy, cooldowns, statuses, and ability configuration for the next planning stage. Repeated rounds of positioning and charging transition into sustained engagement; battle resolution does not reset either army.

**Resolution contract:**

1. Lock plans and queued cards for both armies. Resolve queued spells at battle start using explicitly defined batching and target rules.
2. Resolve automatic movement for both armies together. Units follow their stances using their separate automatic movement allowance. Movement intentions come from a shared board snapshot; contested destinations, crossing paths, and occupied cells need explicit collision rules.
3. Resolve combat for both armies together. Each unit has one bounded activation opportunity with multiple eligible prioritized abilities and a basic attack. Partition preparation, healing, protection, attacks, and reactions into defined simultaneous batches or timing windows; their exact ordering remains open.
4. Apply each batch consistently to authoritative state, then handle deaths, objective ownership, and victory at the defined boundaries. Decide explicitly whether a lethally hit unit's already-declared action still resolves. Code iteration order and animation order must not decide this implicitly.
5. Finish after the round's bounded action opportunities. Preserve survivors' state and return to planning. Abilities and reactions need finite limits and cannot generate an endless chain.

Reuse weapon range, terrain defense, the weapon triangle, and hit/critical calculations where they fit. The demo's sequential attacker-counter-follow-up exchange is a foundation, not the settled timing rule for simultaneous combat. Decide how speed, follow-ups, counters, and energy earned from incoming damage interact with simultaneous actions before adapting that resolver. Proposed reaction limits remain balance candidates.

Target choice must respect stance before optimizing damage. Keep deterministic priorities for kills, class matchups, terrain, and protecting the assigned subject. Do not let every unit blindly chase the weakest enemy across the map.

Battle logic computes authoritative simultaneous batches independently of animation, then produces events with explicit batch membership for presentation. Events may be shown sequentially for readability, but playback order cannot change the simultaneous outcome. Presentation consumes movement, attack, ability, damage, and death events. Faster playback and skipping must lead to the same authoritative final state. A seeded random source makes draws and combat reproducible for debugging.

## Card dock and battlefield UI

The card dock is a core part of the planning interface, not an inspect-only popup.

- **Bottom hand dock:** visible card faces, card count, costs, Supply total, affordability, and combination indicators. Reserve space for it when framing the map.
- **Play interactions:** drag a card onto a target on desktop; also support click/tap a card, then click/tap the destination. Show legal tiles, an effect preview, and a clear cancel action. Keyboard equivalents should be available.
- **Selected card detail:** readable effect text, stats or spell duration, and the reason a target is invalid. A card must not be consumed by a failed drop.
- **Paid reserve bench:** distinguish recruited units from unplayed hand cards; show recovery/energy state, withdrawal and recycle options, and available field/bench triples without forcing a combination. Provide an explicit upgrade preview, survivor choice, and recycling cost/refund preview.
- **Queued spells:** show committed targets, effects, and resource reservations clearly, with cancel/retarget controls if those rules permit.
- **Type-wide skill equipment:** show which unit types inherit an equipped skill, its slots/compatibility, and the effect of transferring it. Keep this distinct from one-shot spell targeting.
- **Army controls:** a compact stance/objective panel for the selected unit, population use, visible stars, current/max energy, and a reorderable ability row with costs and per-instance cooldowns; shared skill loadouts must be clearly identified. Inspection remains available without requiring orders for every unit.
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
2. **Simultaneous round and energy:** one Resolve battle command, separate planning/automatic movement allowances, persistent stances, per-unit energy/cooldowns, simultaneous movement and combat batches, enemy planning, and event-driven playback. Complete a match without manually issuing attacks or waits.
3. **Optional combinations:** matching across paid reserves and the field, survivor/destination choices, star stats, population changes, inheritance rules, and visible upgrade markers. Verify that available triples can be kept separate and each upgrade requires an explicit choice.
4. **Spells and ability loadouts:** queued battle-start spells, multiple automatic abilities plus attacks, reorderable priorities, passives/toggles, Rally-style recovery, and transferable type-wide skill cards. Include explicit targeting, duration, energy costs, cooldowns, and reaction limits.
5. **Territory and pacing:** captured deployment locations, resource/draw/population balance, reserve recovery and recycling, champion respawn, and readable battle summaries. Confirm positioning and energy accumulation matter alongside card luck; ordinary casualties remain permanent.
6. **Presentation and expansion:** group orders, mobile dock polish, matching portraits, sound, dialogue, additional classes, and multiple maps. Save/load and campaign progression follow once the core match loop is stable.

**Implemented: match controller, AI and data.** `src/match.js` now owns all match state and rules for both the browser and the headless simulator; `src/ai/commander.js` provides passive, greedy and heuristic commanders for either side; every game (browser or simulated) is logged as JSON Lines and can be replayed from its seed and actions (`src/log.js`, `tools/sim/`). First simulation findings (100 games, heuristic vs greedy, 30-round cap, both side assignments): 96% of games hit the round cap. Causes to tune: a champion standing on its own keep takes 0 damage from recruits (13 DEF + 3 castle DEF against 16 attack), so keeps are almost never taken; hands fill with unplayable cards once population reaches the cap (65-80 blocked draws per game); Supply sits at the 6 cap most of the game.

Keep card/inventory, orders, and battle state independent of DOM handlers. The current turn flow in `src/ui.js` should move into a dedicated game-state controller as automatic resolution is introduced. Reuse `src/rules.js` and `src/combat.js`; adapt `src/ai.js` for both stance-driven friendly decisions and enemy planning.

## Decisions to tune through the prototype

The intended direction is fixed: random shared-pool cards, paid reserves, controlled-location deployment, optional three-of-a-kind unit upgrades, weighted population, persistent energy and ability priorities, and one bounded automatic activation per unit per round, with separate planning/automatic movement budgets and simultaneous movement then combat. Ordinary deaths are permanent; hero champions can respawn. The following remain adjustable:

- Draw counts, pool weights, resource types and costs, banking, hand/bench limits, and population values.
- Exact planning and automatic movement distances, simultaneous collision rules, and the usefulness of each stance.
- Energy gain timing, ability trigger complexity by unit type, action/repeat-cast limits, passive/toggle rules, and reserve recovery rates.
- Type-wide skill scope, shared priority versus per-instance priority, slots, costs, compatibility, and transfer/cooldown semantics; enchantment rules.
- Exact star stat gains and per-instance HP/energy/status/cooldown inheritance during combinations.
- Reserve withdrawal, selling/recycling refunds, same-grade card repayment and retained state, and inventory-capacity handling.
- Simultaneous spell/ability/attack timing, reactions, follow-ups, lethal-action rules, target tracking, and mutual-victory outcomes.
- Whether territory later produces resources, additional draws, or only deployment access.
- Champion count, respawn delay/cost/reset state, and base-defeat rules.
- Enemy information, projected actions, and possible fog of war; compare visibility treatments through playtests.
- Optional rerolls and longer-term campaign rewards.

Evaluate these against a concrete goal: the player should spend a short planning turn making a handful of meaningful decisions, then understand how those decisions shaped the automatic battle.
