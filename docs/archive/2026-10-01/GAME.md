> Historical snapshot archived 2026-10-01. Earlier revisions/proposals, not current main. [Current docs index](../../README.md).

# Chronicle of Ashvale — game spec

## Pitch

A fantasy tactics game combining Advance Wars-style territory, terrain, and army positioning with a random card recruitment system inspired by Teamfight Tactics. Players build an army by drawing unit cards, recruiting into a paid reserve bench, deploying near controlled locations, and optionally combining three matching units to upgrade them. Spell cards support the formation, and Shards (docs/SHARDS.md) replace skills: shard cards go into a 10-slot dock, are applied to a unit class for a class-wide passive bonus (Might, Guard, Vigor, Swiftness, Focus, Bulwark, Renewal, Thorns) and three of a kind combine into the next tier. Units fight automatically according to their stances and abilities.

The main decisions are what to deploy, where to deploy it, what to combine, how to arrange the army, and when to spend a spell. A player should be able to command an army of 10 or more units without individually selecting Move, Attack, and Wait for every unit. One **Resolve battle** action commits the plan and runs the combat phase for both armies.

Presentation: an illustrated fantasy army on a readable square-grid battlefield, with Fire Emblem-style characters and a persistent card dock. The map remains a tactical space with roads, forests, bridges, villages, and keeps; it is not just a staging board for a detached arena battle.

## Design status

The current prototype implements seeded cards, paid reserves, deployment, optional upgrades, queued spells, shared skills, stances, automatic rounds, enemy recruitment, reserve recovery and champion respawn. Planning-selected active kits, persistent energy/cooldowns, facing, passive flanks and reduced Advance battle movement are implemented. Arbitrary persistent human objectives remain incomplete. Rules marked as **prototype defaults** are starting points for testing, not final balance decisions. See `docs/CURRENT_GAPS.md` for current implementation and verification gaps, and `docs/DEVELOPMENT.md` for the confirmed development process.

The primary loop is planning followed by one Resolve battle action. The shared match controller drives browser and simulator behavior; manual exchanges remain legacy foundations rather than the required player flow. The sections below include intended rules and provisional details that must be reconciled against the current gap register before implementation.

## Confirmed direction from design elicitation

- First version: single player against an AI commander, on a persistent tactical map.
- Primary objective: capture or destroy the enemy keep; other maps may later define different objectives.
- Players select active abilities during planning for the MVP; player-managed ability prioritization is deferred. Movement and combat still resolve automatically for both armies. Planning uses the full movement allowance; advancing units have a separate battle movement allowance of approximately two-thirds of planning movement, using max(1, round(MOV * 2/3)) movement-cost points with existing terrain costs; tune later.
- Energy accumulates across turns. Several positioning and charging rounds can lead into a sustained engagement with energy and cooldown management.
- Cards come from a shared recruitment pool. Resource costs and a population limit gate army building; exact amounts remain balance decisions.
- Ordinary unit deaths are permanent for the match. Hero champions can respawn at base; current delay, cost and reset state are prototype defaults below.
- Paid reserve units and deployed units can participate in combinations. Combining is optional: three ordinary Pikemen may be preferable to one upgraded Pikeman.
- Units may have active abilities and passives; players pick active abilities in planning instead of arranging automatic priorities for the MVP. Type-wide skill equipment remains shared. For now, picks are per unit with group/apply-to-class controls; multiple picks resolve in fixed effect phases. Picks persist when unaffordable but suspend execution until energy recovers. New planning selections must fit their total cost into available energy. Brace temporarily forces defensive/Hold for that battle; Cavalier Charge requires Advance already selected. Cavalier flanking is passive on side/back attacks, including Charge. Automatic movement updates facing to its final step; stationary units retain planning facing. Facing locks before attacks; the final-step interpretation and prototype package were approved on 2026-09-29.
- HP, energy, cooldowns, and statuses persist across rounds. Recovery abilities run during normal activations, even without a nearby enemy. A two-turn cooldown used in round 5 is ready again in round 7.
- Units may withdraw through controlled reinforcement locations into recovering/charging paid reserves. One shared free cycle per planning turn exchanges a hand card or refunds a bench unit into an unpaid random card of the same type, rarity and star grade.
- Spell cards are queued during planning and resolve when battle starts. Skill cards are transferable equipment; their type-wide scope is distinct from one-shot spells.
- Enemy information and potential fog of war will be tested; full visibility is not a settled rule.


## Campaign playtest (2026-09-30)

Scott explicitly prioritized selectable factions and playable south-to-north campaign encounters. The main menu now opens Campaign: choose Ashvale, Argent Crown, White Fang, Iron League or Hollow Court and play three authored missions. The earlier 24 standalone scenarios remain in Levels; Skirmish remains separate.

The player always controls Blue as the human team, with the selected faction's champion, recruits, abilities and draw pool. Each mission starts a fresh five-unit army at the south keep. March north assigns persistent Advance orders toward the current checkpoint; individual movement, stances and planning abilities can refine that plan. The North Road teaches a screened advance through fixed patrols; The Wooded Approach adds second waves and forest approaches; The Northern Pass adds a bridge with alternate routes and mixed waves.

Campaign enemies never recruit, draw replacements or respawn champions. Fixed guards Hold their authored positions and attack through normal combat rules. Clear every wave at a position, regroup at its village, then explicitly Continue north to open the next encounter. Wave transitions preserve friendly HP, losses, energy, reserves and cards within the mission. New waves appear before the next planning phase, not during combat playback. All encounters must be cleared before a living friendly unit can win at the north exit. The victory panel links to the next mission with the same faction and seed.

Prototype rally rule: once per cleared village, when a survivor is within two Manhattan tiles, Rally restores up to 4 HP to living allies within that radius. It does not revive casualties or recover distant units. Existing unit Rally abilities, healing spells, reserve recovery and champion respawn remain available. The 90-round mission cap is a safety limit; roster sizes, wave compositions and checkpoint recovery are playtest values, not final balance. Progress/unlocks and army persistence between missions are deferred.

## Design pillars

- **Position matters.** Terrain, choke points, attack range, formation, and reinforcement locations decide battles alongside unit strength.
- **Adapt to the draw.** Cards create different tactical opportunities each round. Saving a duplicate, reinforcing a weak flank, and spending a spell should compete for resources.
- **Build an army over time.** Units, damage, upgrades, and captured territory persist between rounds within a match.
- **Command through intent.** Stances and objectives guide automatic decisions. The player gives useful orders rather than approving every action.
- **Make automation understandable.** Show intended routes, threatened targets, the acting unit, and combat results. Explain why a unit held position or could not attack.

## Round structure

A round has four stages:

1. **Refresh and draw.** Grant the round's deployment resource, draw cards into the hand, and refresh round-based actions. Show the incoming cards and current resource total.
2. **Planning.** Recruit reserve units, deploy or withdraw units, optionally combine duplicates, queue spells, equip or transfer skills, and optionally change positions, stances, objectives, or selected active abilities. Existing orders remain in effect. The player may finish immediately if the current plan is satisfactory.
3. **Automatic battle.** Press **Resolve battle** once. Lock card play and orders, resolve queued spells at battle start, resolve both armies' movement together, then resolve both armies' combat together. Resolve planning-selected abilities, attacks, reactions, and deaths under explicit simultaneous-resolution rules. The player can inspect, pause presentation, change playback speed, or skip animations without changing the result.
4. **Results and next round.** Apply captures and rewards, report losses and upgrades, and check victory conditions. If the match continues, advance the round and return to planning.

There is no requirement to mark every friendly unit as finished. A unit without a new order uses its existing stance and objective. An army with no cards or resources available can still resolve its battle.

The first version is single-player against an enemy commander using the same match rules. Default red policy is greedy (recruit/deploy); heuristic also uses spells, equipment, stances, combinations, withdrawal and planning-selected abilities. Either faction can use any policy in simulations. Enemy planning locks before battle begins. Competitive multiplayer remains outside MVP scope.

## Cards, hand, and resources

### Card types

| Type | Played onto | Result | Upgrade rule |
|---|---|---|---|
| Unit | Paid reserve bench, then a legal deployment tile | Creates a persistent unit that can be deployed | Three matching paid reserve/deployed units at the same star level may combine |
| Spell | A valid unit, tile, or area | Queues a one-use effect for battle start | Never combines or gains stars |
| Skill | A compatible unit-type loadout | Equips a transferable ability shared by its instances | No combination rule specified; do not assume three-of-a-kind applies |

Cards must identify their name, type, cost, and effect. Unit cards also show class, star level, attack range, default stance, and a short ability description. Spell cards show target restrictions and duration. The card art should match the battlefield sprite and portrait. Skill cards equip transferable abilities, currently shared by instances of a unit type. Enchantment cards could apply persistent modifications. Storage, costs, compatibility, slot limits, and exact ownership/grade scope still need definition.

Draws come from a defined recruitment pool for the match. Start with a small, weighted pool of the existing recruit classes and a few spells. Randomness should offer useful choices without requiring a matching triple to survive the first rounds. There is no paid shop or paid reroll system required for the first prototype. Instead, the approved MVP offers one shared free card cycle per planning turn.

**Prototype defaults:**

- Start with a five-card hand; draw three cards at the start of each later round.
- Keep unplayed cards between rounds. Cap the hand at eight cards; draw only into free slots and show when the hand prevented further draws. Do not silently discard existing cards.
- Use one resource, **Supply**, for units and spells. Gain three Supply per round, with a normal bank cap of six. Initial Supply is three. Full bench refunds may exceed six; normal income pauses above the cap and never removes stored Supply.
- Give initial unit cards costs in the 1–3 range and spells costs in the 1–2 range. Actual class costs, pool weights, and rewards require balance testing.
- Start without additional draw or income from captured villages. Add territory income only after the base draw and deployment loop is understandable.

Retaining cards and Supply lets the player save for combinations or expensive reinforcements. The UI always shows current Supply, affordability, and how much a play will consume.

## Deploying units and controlling territory

Playing a unit card pays its recruitment cost and creates a unit on the reserve bench. The bench holds paid units; it is distinct from the hand of unplayed cards. Deploying a reserve unit places it on a legal field tile, with its sprite, occupied tile, and initial threat range previewed before commitment. Whether direct hand-to-field recruitment is also offered as a shortcut remains a UI choice. Invalid or cancelled recruitment/deployment consumes nothing.

Deployed units may withdraw through a controlled base or reinforcement point into reserves. Reserves can recover and accumulate energy. Eligible units can also be sold or recycled into a card of the same grade, preserving the existence of upgraded cards rather than breaking every unit back into 1-star copies.

**Implemented (prototype defaults):** a deployed recruit standing on a controlled keep or village tile can Withdraw (W) to the bench with its HP, energy, cooldowns and statuses intact; it keeps its population slot. Benched units recover 4 HP and 2 energy per planning refresh (baseline 1 plus reserve bonus 1 in src/match.js), plus a pending Rally bonus, and tick cooldowns; redeploying restores picks, facing and that carried state. Champions cannot be benched. Bench cycling is implemented under the approved contract below.

Current prototype bench cap is 8, reserves retain their population cost, withdrawal occurs during planning, and deployment has no additional Supply cost. Paid bench units persist between turns, enabling optional matching triples; unpaid hand cards are not combination ingredients.

### Approved cycling contract (implemented SYS-02)

- Each side receives one free cycle per planning turn, shared between hand and bench. It refreshes next turn without accumulating. Cycling is optional and never automatically combines a triple.
- A hand cycle replaces one unpaid card in place, including at the eight-card hand limit. A bench cycle requires a free hand slot; if blocked, nothing is lost and neither allowance nor random sequence advances. Deployed units must first legally withdraw to cycle.
- The random replacement preserves card type (unit/spell/skill), rarity and unit star grade, using the existing weighted pool filtered by type and rarity. It may be the same identity again. Rarity is independent of stars; all current prototype definitions are common. Spells and skills do not gain stars.
- Cycling a paid bench unit removes that instance, frees its weighted population and bench slot, and refunds its actual invested Supply. Combination investments sum across the three inputs. Free starting units refund zero; deployment and withdrawal preserve investment.
- The replacement enters the hand unpaid. Its unit price is the replacement class's normal cost times the recipe: 1★ ×1, 2★ ×3, 3★ ×9. Refund and replacement price can differ. Recruit it again before deploying; ordinary population and bench limits still apply.
- Repurchasing creates a fresh unit at its retained grade with full grade-adjusted HP, zero energy, empty cooldowns, selections and statuses, and fresh instance identity/default orders. It does not carry the recycled unit's combat state. Normal withdrawal/redeployment continues to preserve state instead.
- Full refunds may temporarily exceed the six-Supply bank cap. Income pauses until the bank falls below six; it never clips the refund. A replacement costing more than six can remain unaffordable without refund overflow; no extra income rule is implied.

At simultaneous hand/population capacity, hand cycling changes options but does not create a hand slot, and bench cycling is blocked until one is available. This constraint is approved; it is not a claim that circulation solves all capacity or pacing problems. Future player levels that unlock more population are deferred pending design and balancing. Spells, enchantments and equipment remain distinct from reserve units.

Prototype deployment rules:

- Initial reinforcements may enter on the player's keep or designated starting deployment tiles.
- Captured villages can provide additional deployment locations. Capture is recorded at the end of a battle phase when a living unit occupies the objective; control persists until recaptured.
- A controlled location offers its own tile and adjacent orthogonal tiles, subject to occupation, map boundaries, and the unit's movement type.
- Deploy only onto empty, traversable tiles in a controlled deployment area. Never deploy directly onto enemy units or onto impassable water.
- A newly deployed unit can act in that round's automatic battle.
- Use a population limit with higher-star units costing more population. Exact star costs, class variation, commander cost, and the population cap remain open. Show the projected population change for recruitment, deployment, and combinations; do not assume every upgrade frees exactly two slots.

One unit occupies one tile. Friendly units may pass through allies when movement rules permit, but may not finish on an occupied tile. During planning, players can move units immediately within their movement allowance to arrange the formation. When battle begins, stances can cause units to advance, retreat, or maintain range automatically. Planning repositioning uses the full movement allowance. Advancing units receive a separate automatic movement allowance of approximately two-thirds of planning movement; rounding and terrain-cost treatment remain tunable. Track both allowances independently so repeated planning moves cannot reset that phase's budget. A unit that spends its planning allowance can still use its automatic allowance once resolution begins.

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

Upgrades improve a defined class stat table and may strengthen existing abilities. A star upgrade should create a stronger specialist, not simply triple every statistic. Proposed health inheritance: apply the inputs' combined current-HP/max-HP ratio to the upgraded maximum HP. The result uses the shared skill loadout for its unit type, so merging differently equipped individual copies is not a required feature yet. Exact scope across star levels, planned-ability inheritance, and enchantment inheritance remain open. Per-instance HP, energy, cooldowns, and statuses still require inheritance rules; do not assume an upgrade heals, refills energy, resets cooldowns, or cleanses effects for free.

Hero champions respawn symmetrically after two rounds for 1 Supply at an available controlled deployment location. They return at full HP with cleared picks/cooldowns and 1 energy from their arrival baseline. Champion death alone is not defeat. Values remain prototype defaults.

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

**Approved MVP defaults (2026-09-29):** max energy 4; initial 0 before round-1 +1; field +1 each planning refresh; reserves gain baseline plus extra +1; overflow clamps. Newly recruited reserves start at 0, and deployment does not grant a second refresh. Pending Rally energy is consumed exactly once at the next refresh. Ordinary movement and basic attacks are free.

Units retain HP, energy, picks, facing and cooldowns across rounds and withdrawal. Recovery does not imply a full heal. A cooldown of 2 used in round 5 is unavailable in 6 and ready in 7.

- Pikeman Rally: selected active, cost 0, cooldown 2; heal 10 and gain 1 energy now and next refresh, only when useful.
- Pikeman Brace: cost 2, cooldown 2; commit before movement, temporarily Hold and absorb 4 total incoming basic damage this battle. Paid even without attacks; normal stance resumes afterward.
- Archer Focused Shot: cost 2, cooldown 2; legal ranged basic strike gains 4 damage and 20 hit percentage points, capped at 100.
- Cavalier Charge: cost 2, cooldown 2; requires pre-existing Advance, actual automatic movement and a legal melee target; ordinary strike gains 4 damage.
- Cavalier Second Wind: cost 1, cooldown 3; heal 6 at or below half HP, including outside combat.
- Cavalier Flank: passive 4 damage from a target's side/back, stacking with Charge before critical multiplication.

Ward halves incoming damage first. Active Brace and purchased passive Barrier (2 absorption) then reduce the battle's total damage; unused protection expires. Attack enhancements expire after the battle. Full selection, payment and execution contracts are in docs/ABILITY_PROPOSAL.md.

## Stances, objectives, and automatic abilities

Stances are persistent behavioral orders. Each class has a sensible default, so newly deployed units can participate immediately. Changing a stance during planning is optional and free in the initial prototype.

| Stance | Movement intent | Combat intent |
|---|---|---|
| Advance | Move toward the assigned objective or enemy front | Attack a useful reachable target while respecting terrain and range |
| Defend / Hold | Hold the assigned position; do not chase | Attack from current range and use permitted defensive reactions |
| Protect | Stay near an assigned ally or objective | Prioritize enemies threatening that subject without abandoning the protection area |

Defaults should reflect roles: frontline melee advances, archers maintain useful firing range, and an objective defender holds. Orders may name a tile, objective, or ally; losing an assigned target falls back to the class default. Stances never bypass occupation, movement costs, or attack range.

For the MVP, players pick active abilities during planning and combat executes the committed choices automatically. Player-managed ability prioritization is deferred and may be revisited later. Units may still have several available active abilities and passives. Picks are per unit for now, with group selection/apply-to-class controls. Multiple picked abilities resolve in fixed effect phases. Picks persist until changed, including when unaffordable; execution suspends until energy recovers. New selections must fit their total energy cost during planning. Picking/cancelling is free; costs commit only for legal executions. Freeze total paid-bundle affordability before recovery and suspend all paid picks together when short. Invalid target/trigger/stance skips cost no energy or cooldown. Do not block free movement/basic attacks or require reselecting suspended abilities. Resolve a bounded sequence; energy-generating abilities must not create infinite action loops.

Passives need explicit triggers and upkeep, distinct from planning-selected active casts. Shared skill equipment does not automatically imply shared active selection. The previously confirmed shared ability-priority editor and enable/disable automation are superseded for the MVP by planning selection; keep them as a deferred option. There is no minimum-energy reserve threshold control in the initial prototype. Design selection so the player can still resolve a round without clicking through every unit.

Purchased Barrier is transferable type-wide equipment with two loadout slots per type. Every friendly instance of the type, including future recruits and star levels, inherits its passive 2 total absorption per battle. Transfer is free and moves the item out of the old type. More granular equipment and additional skill cards remain future scope.

## Automatic battle rules

Resolve one bounded tactical exchange per round on the persistent map, rather than fighting until one army disappears. Survivors retain their resulting position, HP, energy, cooldowns, statuses, and ability configuration for the next planning stage. Repeated rounds of positioning and charging transition into sustained engagement; battle resolution does not reset either army.

**Resolution contract:**

1. Lock plans and queued cards for both armies. Resolve queued spells at battle start using explicitly defined batching and target rules.
2. Commit ready affordable Brace before movement. Resolve movement from a shared starting snapshot: occupied starting tiles block entry even if the occupant leaves; contested destinations use seeded priority. Advance uses its reduced movement-cost allowance. Accepted movement sets facing from the final step.
3. Resolve selected recovery (Rally/Second Wind), then legal attack enhancements, then one basic strike per living unit against the shared post-move snapshot. Paid-bundle eligibility is fixed before recovery. No user-managed priority or repeat-cast chain.
4. Commit simultaneous strike damage: both declared strikes still resolve even when lethal. Clean up protection/enhancements, handle deaths/capture/victory, then refresh if play continues. Cross-faction spell interactions and mutual keep captures remain unresolved under CORE-03. Animation order never changes strike outcomes.
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
- **Army controls:** a compact stance/objective panel for the selected unit, population use, visible stars, current/max energy, and planning ability picks with costs, per-instance cooldowns, stance constraints and visible facing/flank previews; shared skill loadouts must be clearly identified. Inspection remains available without requiring orders for every unit.
- **Primary action:** one prominent **Resolve battle** button, with optional confirmation when important cards or Supply remain unused. Do not block it because units lack manual orders.
- **Battle presentation:** collapse the hand into a compact summary, identify the acting unit in the roster and on the map, and keep action labels and damage readable. Pan only when needed to reveal the action; offer playback controls.
- **Results:** show captures, losses, and the reason for victory or defeat. Provide a clickable/tappable restart button as well as the keyboard shortcut.

On narrow screens, use a horizontal card strip with an expandable detail view. Fit the hand, selected-unit detail, and primary action into a coordinated bottom area rather than stacking independent panels over most of the battlefield. The map camera must respect those insets.

Input priority depends on intent: when playing a card or assigning a destination, legal tile targets take precedence over tall sprites covering them. When selecting or targeting a unit, identify it through its foot marker and sprite. Always preview the actual destination or target before committing.

## Current demo foundation

Two named heroes and three recruit classes are already present. Recruits use templates in `RECRUIT` (`src/units.js`) and may appear in either army. A starting roster is augmented by seeded recruitment and dynamic deployment. Pure templates are in src/roster.js; the browser view is in src/units.js.

| Class | Move type | Current range | Tactical role |
|---|---|---|---|
| Pikeman | Foot | 1 | Frontline defense; proposed anti-cavalry ability |
| Archer | Foot | 2 | Ranged support; cannot counter adjacent attackers |
| Cavalier | Mounted | 1 | Mobility and reinforcement-point pressure; forest movement is expensive |
| Brenna, Paladin | Armor | 1 | Named player commander and defensive support |
| Dreg, Barbarian | Armor | 1 | Named enemy commander and melee pressure |

Future classes may include mage, knight, healer, and flying units. Add them after the initial three recruit cards support a complete match.

Current terrain includes plains, roads, bridges, forests, mountains, villages, and keeps. Use `src/terrain.js` for terrain effects and `src/rules.js` for movement costs rather than duplicating balance values in this document. The current map is 16 × 12 tiles; each tile is one world unit.

Current outcomes are either faction occupying the enemy keep at battle end, or eliminating all enemy field/reserve units with no pending champion respawn. The intended standard match is won by capturing or destroying the enemy keep, while hero champions can respawn. Future maps may declare other objectives. Maps should declare commanders, deployment zones, capture locations, and victory conditions as data. Define exactly when occupation counts as a capture or win, and report that reason to the player.

## Art direction

Illustrated 2.5D tactics inspired by Fire Emblem, Unicorn Overlord, and Triangle Strategy. Painted anime characters stand as transparent sprites on a 3D map with soft terrain detail, strong silhouettes, and consistent anatomical scale. The current sprite pipeline is documented in `docs/asset-pipeline-plan.md`; Blender models remain available as a fallback and reference.

Card faces, battlefield units, and portraits should share the same character artwork. Stars, stance markers, faction colors, and contact shadows must remain readable at normal tactical zoom. Avoid oversized heads, glossy toy shading, and a mix of detailed heroic characters with differently proportioned recruits.

Upgraded units need an obvious star badge and a restrained visual accent. The first prototype can reuse the base sprite; it does not require a new illustration for every star level. Spell effects should communicate their area and duration without hiding occupied tiles.

## Implementation status and roadmap

Implemented: seeded hand/Supply, paid reserves and deployment; optional combinations; queued spells and type-wide skills; persistent stances; shared automatic rounds; champion respawn; planning-selected kits, energy, cooldowns, facing and passive flanking. src/match.js owns rules for browser and simulator. src/ui.js only presents planning and plays event batches. Legacy manual exchange helpers are not the normal round flow.

SYS-01 is implemented and verified; see docs/SYS01_VERIFICATION.md for rule, browser and replay evidence. SYS-02 cycling is also implemented and verified; see docs/SYS02_VERIFICATION.md. Core match pacing and victory semantics are the next work. CORE-02 stalemates and CORE-03 cross-faction timing/mutual capture remain unresolved. Persistent arbitrary orders, playback controls and art/mobile polish follow the durable roadmap in docs/DEVELOPMENT.md. Historical overhaul task lists are not current completion status.

## Decisions to tune through the prototype

The intended direction is fixed: random shared-pool cards, paid reserves, controlled-location deployment, optional three-of-a-kind unit upgrades, weighted population, persistent energy and planning-selected active abilities, and one bounded automatic activation per unit per round, with separate planning/automatic movement budgets and simultaneous movement then combat. Ordinary deaths are permanent; hero champions can respawn. The following remain adjustable:

- Draw counts, pool weights, resource types and costs, banking, hand/bench limits, and population values.
- Exact planning and automatic movement distances, simultaneous collision rules, and the usefulness of each stance.
- Energy gain timing, ability trigger complexity by unit type, action/repeat-cast limits, passive/toggle rules, and reserve recovery rates.
- Additional skill compatibility, slots/costs, transfer/cooldown semantics for future active equipment, and enchantment rules. MVP pick affordability and bundle suspension are approved above.
- Exact star stat gains and per-instance HP/energy/status/cooldown inheritance during combinations.
- Cycle allowance and capacity values, replacement pool diversity, and future population progression. Refund, repayment and fresh-state semantics are approved above; do not silently change them.
- Simultaneous spell/ability/attack timing, reactions, follow-ups, lethal-action rules, target tracking, and mutual-victory outcomes.
- Whether territory later produces resources, additional draws, or only deployment access.
- Champion count, respawn delay/cost/reset state, and base-defeat rules.
- Enemy information, projected actions, and possible fog of war; compare visibility treatments through playtests.
- Optional rerolls and longer-term campaign rewards.

Evaluate these against a concrete goal: the player should spend a short planning turn making a handful of meaningful decisions, then understand how those decisions shaped the automatic battle.


## Campaign creatures and supplied faction art (2026-09-30)

Campaign encounters now mix enemy-only monsters with troops from three other factions, selected deterministically from the mission and seed. The selected player faction is excluded from enemy faction choices. The North Road introduces rats, spiders and goblins beside faction infantry; Rally in the Woods adds hunters and a golem; the Northern Pass combines larger creatures and ranged troops across six waves. Enemies still hold fixed engagements and never recruit. Regroup/rally and south-to-north objectives are unchanged.

Seven neutral creatures and the Hollow Court Corpsehound use prototype stat envelopes in src/monsters.js, shared existing melee attack rules and no player ability kits or recruitment cards. This makes their visual and stat identities playable; the simple passive kits below are now implemented, while active creature abilities and balanced difficulty remain future playtest work. Source sheets map to 24 runtime sprites and matching portraits via docs/art/FACTION_SPRITES.md. Native colors are preserved; team rings and portrait borders identify allegiance. Missing character art retains existing fallbacks. The optional 3D comparison mode uses a generic infantry model for monsters.


## Monster kit prototype (2026-09-30)

Scott requested a monster_unit_designer agent to create one or two simple abilities/passives per creature. The first playable slice gives each of the eight creatures one named automatic passive, using the existing post-movement/pre-strike passive system. It costs no energy and is evaluated afresh each battle. Inspect an enemy to read the exact trigger and effect. See docs/MONSTER_KITS.md for the complete kits and prototype numbers. Rat/Goblin reward adjacent allies; Spider rewards remaining stationary; Golem reduces incoming damage on Hold; Ogre pierces a little Defense; Werewolf and Moth Bear gain bonuses strictly below half HP; Corpsehound rewards nearby corpse markers. Monster base stats, wave compositions and player/skirmish defaults remain unchanged. These are prototype encounter mechanics for human playtesting, not final balance.


## Human playtest feedback (2026-09-30)

Scott's first campaign playtest requests a nearby action bar, left-side recruited-unit portraits with type management, character and army performance stats, lower GPU cost and a larger Supply bank. The default bank is now 30 (previously 6); income remains 3 per turn and refunds may still exceed the bank. Header-defined bank limits are honored when replaying older logs and restored afterward.

Desktop actions follow the selected unit above its drawing. Friendly portraits are grouped by exact variant on the left, with counts for field/bench, next-unit selection, shared type ability planning, Advance/Hold group orders and reserve deployment. Ability group controls respect variant identity, rather than conflating units sharing a base combat class. Small screens retain their bottom action row and use a separate type-management popup.

Selected units expose strike damage dealt/taken and successful active ability uses. Army Stats shows character totals and leaders for each team; fallen/combined-away characters retain their historical totals. Strike totals use logged post-mitigation damage, including overkill; spells belong to the army and passive evaluations are not active ability uses. A completed mission's report is saved locally for the Last completed mission button. Future missions overwrite that saved report; it is not a cross-mission save system. Existing development JSONL logs preserve older playtests.

Rendering uses Three.js with Vite. Idle planning targets 30 fps; playback/dragging targets 60. The 3D backing buffer caps at 1.6M pixels, native HUD resolution is preserved, AO/denoise sample counts are 8, and disabled Painterly skips its pass. Larger canvas views can be slightly softer. Hardware GPU percentage remains a local playtest measurement; see docs/PERFORMANCE_PASS.md.

## Shards (SHARD-01)
Skills (planning-selected ability kits and the Barrier card) are removed from play. Shard cards (8 types, tiers I-III) are bought with Supply into a shard dock (10 slots), applied to a unit class (3 shards per class; every unit of the class, on the field, on the bench or recruited later, gets the bonus), removed back to the dock, or combined three-into-one. See docs/SHARDS.md for the rules and engine API.


## Timed combat experiment (2026-09-30)

Scott requested a separate experimental branch with TFT-like continuous battles. On `gameplay/timed-combat`, the browser uses timed combat by default; `?combat=classic` retains the discrete resolver for comparison. The pure match/simulator factory keeps its existing default and opts in with `combat: {duration:18}`. The timed resolver is now merged to main with Shards as the active system; skills and spells are archived by default.

Ending planning starts an 18-second combat clock. Units pursue enemies in legal one-tile steps approximately every 0.8 seconds, route around occupied friendly tiles, maintain weapon ranges and attack on individual readiness timers. Speed and class determine cadence: `clamp(2.8 - 0.12*(SPD-4) + classDelay, 1.2, 3.5)` seconds, with +0.1 for Pikemen, -0.15 for cavalry and +0.3 for Knights/Berserkers. First attacks become ready at 0.75 seconds; readiness stays armed while no target is legal. Every attack recalculates legal targets; same-timestamp attacks resolve simultaneously. Each strike uses 35% of existing damage after flat passive mitigation, with the usual hit/crit/weapon rules. Barrier and Brace are finite damage pools across the entire phase, not replenished on every tick.

Three skill windows occur at 3, 9 and 15 seconds. This archived experiment can enable kits alongside Shards with `?skills=1`; normal main gameplay keeps kits off. Each unit has three skill slots mapped to 3/9/15s. Units start with a default timeline from their kit; players drag skills from their kit into slots or select a skill then its slot. Moving a skill replaces that slot and empties its previous slot. Empty slots are allowed; one copy of a skill can be scheduled. In the restored skills mode, sidebar changes save immediately to all units of the exact type, including future recruits. Layout changes are permitted regardless of current energy/cooldown; execution still checks both. Each window grants one capped energy, checks defensive, recovery and enhancement skills against the current combat state, and attempts only the skill in the corresponding slot. Failed triggers skip that slot rather than retrying at later windows; existing cooldowns still count planning rounds. These values and automatic-kit rules are provisional and expressly authorized for experimentation, not final balance decisions. Spells and Pearl recovery resolve once at battle start; Shards keep their existing class/stat rules.

Combat ends early when an opposing army is eliminated. Empty-field regroup movement can continue to the checkpoint and finishes after arrival/idle; wave spawning, corpse creation, revenants, champion respawn, capture checks, income and card draws remain round-boundary actions. Inputs stay locked during playback. The shop folds during combat, the HUD retains the fighting round/economy, and a visible countdown marks upcoming skill windows. Fixed 0.25-second simulation ticks and logged configuration/events make playback speed and frame rate independent of results. Hidden tabs pause the visible clock. See docs/experiments/TIMED_COMBAT.md for comparisons, checks and limitations.

2026-09-30 sidebar refinement: timed combat has one saved skill order per exact unit type (variant, including champions, rather than all units of a broad class). Clicking an army portrait or field unit opens skill cards and selected-unit stats to the right of the army rail. Drag/drop, select/place and clearing save immediately for all matching friendly field/bench units and future recruits. Energy, HP, cooldowns and combat statistics stay individual. Existing unit-scoped timed replays retain their recorded rules.

## Main integration: Shards replaces skills and spells (2026-09-30)

Scott approved merging gameplay/timed-combat and feature/shards into main. Normal browser play keeps the continuous 18-second combat phase, basic attack cadence, campaign flow, monster/faction passives and selected-unit statistics. Shards are the active upgrade system. Skills, spell cards, energy HUD and skill-window markers are disabled. Shared type timelines, active kits, spell data/queue/targeting and their tests are retained as archived opt-in functionality; see docs/ARCHIVED_COMBAT.md. Add `skills=1` and/or `spells=1` to a game URL to restore them independently. Shards use a seeded four-of-eight subset, a twelve-slot dock, three applied shards per class and two-to-three fresh shard offers each round outside the ordinary hand cap.
