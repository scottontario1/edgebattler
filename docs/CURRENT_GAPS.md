# Current gameplay and design gaps

Baseline reviewed: codex/gamegaps, d39fab9, 2026-09-29. This register replaces historical task tables as the current backlog. Review evidence is source inspection and saved screenshots; two targeted Node checks verified the archer targeting failure and lack of field baseline energy. No fresh browser or broad simulation run was performed in that review.

Current implementation update: CORE-01, SYS-01 and the approved SYS-02 cycling scope are verified with fresh browser, rule and simulation evidence. See SYS01_VERIFICATION.md and SYS02_VERIFICATION.md.

## Implemented foundation

Shared match controller, seeded cards, paid reserves, deployment, optional combinations, spell queue, type-wide Barrier, simultaneous basic combat, Protect stance, reserve recovery, symmetric champion respawn and capture checks, AI commanders and replayable logs exist. Browser/build/replay success was reported by the implementing agent at d39fab9; this review did not independently repeat that complete validation. SYS-01 energy/planning-selected kits are now implemented and verified on 2026-09-29; current evidence is in SYS01_VERIFICATION.md.

## CORE-01: Eligible attack targeting

Status: implemented and verified, 2026-09-29. Legal targets are filtered before ranking; both factions, invalid explicit/friendly targets, out-of-range and simultaneous lethal behavior have rule checks and browser evidence. See SYS01_VERIFICATION.md.
Acceptance: select among eligible enemy targets before ranking; cover adjacent blocker plus valid ranged target, no eligible target, and both factions. Preserve simultaneous lethal resolution and deterministic replay.

## CORE-02: Match pacing and keep pressure

Status: reported core blocker; balance choices provisional.
Historical baseline reported 96% draws; the final SYS-01 run draws 89/100 at 30 rounds despite 11 captures. Ordinary basic recruits still struggle with defensive keeps; enhancements/flanks now create some counterplay. Do not automatically adopt lower defense, siege bonuses or score victory.
Experiment evidence (branch sim/combat-experiments, 2026-09-30; provisional, nothing adopted): docs/experiments/BASELINE.md and COMBAT_CASES.md. The 89% draw rate reproduces; the equal-player (mirror) stalemate is a replacement/capacity equilibrium that terrain, champion removal and extra cards do not fix; the keep is a stat cliff (recruit attack 16 v champion Def 13 + castle 3). Candidate cards (Whetstone, Bulwark, Set Spears, Momentum) are in docs/experiments/CANDIDATES.md and are not in the default pool. Economy sweep done (docs/experiments/ECONOMY_AND_LEVELS.md): population cap 4–28, Supply 1–12, hand 4–16, draws 1–8, damage x1–x4 and AI aggression do not break the equal-player stalemate; forward reinforcement points plus aggression do (draws 90% to 53–65%). Forward-deployment experiment done (docs/experiments/DEPLOY_AND_MUSTER.md): village radius N=1..6 on village_chain, ridge_line and River Ford, 100 paired seeds per cell; radius alone does not break the mirror stalemate (best cell 67% draws; River Ford 95–99% at every N) but cuts draws v greedy to 27–71% at N=5–6. Nothing adopted; switches off by default. Next: the keep/champion cliff.
Acceptance: agree the attacking counterplay, run paired-seed/side-swapped experiments against passive, greedy and heuristic policies, report capture rate, draws, duration and tradeoffs, and let Scott select defaults.

## SYS-01: Energy and planning-selected abilities

Status: implemented and verified, 2026-09-29.
Scott approved the complete MVP package in ABILITY_PROPOSAL.md. Baseline energy, paid kits, atomic per-unit/group selection, persistent suspended bundles, fixed phases, Brace Hold, Charge triggers, facing/flanks and reduced Advance movement are integrated into the shared engine and UI. Heuristic commanders use logged planning actions; greedy remains a recruit-only baseline. Type-wide equipment remains distinct. No automatic priority editor.
Evidence: 18 rule checks and production build pass; three-round normal browser log replays exactly; combat fixture and inspected desktop/short/portrait screenshots; 100 paired-seed, side-swapped simulations replay exactly. See SYS01_VERIFICATION.md and design_overhaul/evidence/sys01-*.
Limits: Cavalier movement does not optimize flank opportunities; that remains future scope. Champions have no active kit. The system is verified at approved prototype values, not declared balanced. Final run still draws 89/100 and blocks about 70 draws per side per game.

## SYS-02: Capacity, reserves and card circulation

Status: approved cycling scope implemented and verified, 2026-09-29; capacity pressure remains.
One shared free cycle per planning turn exchanges hand cards or refunds paid bench units into unpaid same-type/rarity/grade cards. Refund investment survives combinations/deployment/withdrawal; repurchase starts fresh. Optional triples, weighted population and bench recovery remain. Bench cycling requires a free hand slot; hand cycling works at full hand but does not create a slot. See GAME.md for the approved contract and SYS02_VERIFICATION.md for evidence.
Evidence: 28 rule checks, production build, desktop/portrait/short browser flows, normal browser replay and 200 paired side-swapped simulation replays pass. Heuristic blocked draws average 64.78 with cycling vs 65.82 without; both draw 89%. AI used hand cycles but no bench cycles in these runs, so strategic bench value is not established by those simulations. Hand+population cap pressure remains; future population progression is deferred.

## SYS-03: Persistent orders and combat intent

Status: engine capability ahead of human UI.
Engine supports tile objectives and arbitrary friendly Protect subjects. Human stance controls cycle Advance/Hold/Protect Brenna; persistent destination and subject assignment are not exposed. Route/target previews, blocked-action explanations and playback controls remain gaps against GAME.md.
Acceptance: choose a destination and friendly subject through normal UI, persist orders without reissuing every round, show intent/collision limitations and fallback behavior, and verify desktop/portrait interaction.

## CORE-03: Simultaneous timing and victory

Status: strategic decision plus implementation gap.
Spells resolve blue then red; keep-win checks return the first winning faction. Mutual capture and interacting cross-faction spell effects need explicit rules. Basic strikes already apply simultaneous damage; do not discard that behavior accidentally.
Acceptance: confirm spell timing and mutual-victory policy, test swapped faction assignments and simultaneous keep occupation, and preserve deterministic replay.

## DES-01: Readability and art consistency

Status: partial, based on saved evidence rather than fresh browser verification.
Desktop cards and state plates improved. Portrait mode is crowded; reserve/card/portrait artwork is inconsistent with battlefield sprites. Deployment and spell overlays share movement cyan. Historical reports of absent Protect UI are superseded by later code.
Acceptance: distinct intent overlays, readable portrait planning flow, matched character artwork, and updated interaction evidence at the documented landscape/short/portrait sizes.

## DOC-01: Documentation reconciliation

Status: substantially reconciled, 2026-09-29.
GAME.md now reflects automatic rounds, recruitment, champion respawn, reserve gains, approved ability contracts and current milestones. Approved cycling/refund/repayment rules are implemented; remaining UI and cross-faction timing rules remain explicitly intended or open. Historical task logs remain unchanged intentionally.
Acceptance: GAME.md consistently distinguishes current behavior, intended rules and provisional defaults; every current gap has evidence/status and a next action.

## Recommended next task

Proceed to CORE-02 keep pressure and CORE-03 victory semantics. Agree counterplay and acceptable completion/duration outcomes, compare paired seeds with side swaps against passive/greedy/heuristic policies, and present evidence before changing defaults. Capacity pressure remains a limitation of the approved SYS-02 rules. CORE-01, SYS-01 and SYS-02 are verified prerequisites; do not reopen them without new evidence or explicit redirection.

## FAC-01: Factions in the game (added 2026-09-30, branch faction_overhaul)

Status: implemented and playable for playtesting; balance and AI are open.
Four factions (Argent Crown, White Fang Clans, Iron League, Hollow Court) are merged from their branches, selectable in the start menu (skirmish v classic or v each other) and playable through 24 levels. Defaults for the open design questions are listed in FACTIONS.md section 10. Evidence: `npm test` (tests/faction-*.test.mjs, tests/culture*.test.mjs, tests/setup-levels.test.mjs), byte-identical classic simulations, browser checks of the menu, skirmishes and levels.
Limits: the shipped AI now picks faction abilities and recruits faction classes from data (categories, kits) but is still untuned, so skirmish opponents are weak; whole games still draw 89-100% (CORE-02), so faction balance cannot be judged on win rate; no interaction UI for the mark action or tile objects; supplied character art is integrated for 24 character/creature identities; classes without dedicated source art keep placeholders (docs/art/FACTION_SPRITES.md). Engine requests from the agents are in `docs/factions/*.md`.


## CAM-01: Faction-selectable campaign playtest

Status: implemented and verified for the playtest scope, 2026-09-30; browser evidence recorded in docs/campaign/VERIFICATION.md.
User explicitly promoted this system ahead of skirmish pacing. Campaign menu supports all five factions and three 12x18 south-to-north missions. Fixed enemy encounters never recruit; later missions have varied waves. Cleared positions pause for regrouping, one optional nearby +4 HP rally, and explicit Continue north. Wave/encounter state is authoritative and logged, and victory requires all encounters plus the declared north exit. Next mission preserves faction and seed. Existing standalone Levels and Skirmish are retained.
Evidence: tests/campaign.test.mjs covers 15 faction/mission setups, checkpoint recovery/transition rules, safe local spawn fallback, early-exit prevention and 30 complete seeded playthrough/replays (3 missions x 5 factions x 2 seeds). Browser verification uses tools/verify-campaign.mjs with normal march/resolve/regroup/rally controls. Production build passes; complete suite has 181 passing checks, zero failures and five existing TODO checks. Desktop, short landscape and portrait interactions are inspected; the short-landscape full mission log replays exactly.
Limits: early playtest difficulty, fresh army per mission, no saved unlocks, enemy waves now mix seven neutral monster types, Corpsehounds and rival faction troops; simple monster passives are implemented (MON-01); active powers and difficulty tuning remain open. Missing faction art still uses baseline assets. Skirmish CORE-02/03 and general SYS-03 arbitrary order controls remain open. Campaign gives a whole-army checkpoint order; it does not complete the general order editor.
Next acceptance: collect human playtest feedback on approach readability, wave difficulty, recovery and each faction's learning curve before changing mission balance or adding persistence.


## ART-02: Supplied faction sprites and campaign monsters

Status: implemented and verified, 2026-09-30. Luna agents prepared independent sprite assets and monster definitions, with one root integrating rendering and encounters. All 24 runtime cutouts and matching thumbnails load; identity lookup follows spriteKey/variantId before base class. Card, reserve, deployed and inspected portraits share the supplied artwork. Campaign enemy factions exclude the player selection; monsters have no player cards. Authored waves and rival choices are replayed from the original log header.
Evidence: 181 checks pass, zero failures, five existing TODOs; 30 full seeded campaign playthrough/replays; all 24 live browser sprites match identities; full Court/pass browser victory at round 20 with two regroup/rallies, six waves and exact replay; generic 3D monster fallback verified. See docs/campaign/VERIFICATION.md.
Limits: missing dedicated class/champion source art retains previous fallbacks, new monsters use shared melee rules plus one named passive each (MON-01), native monster colors rely on team rings for allegiance, and campaign balance is provisional. Next: human playtest encounter difficulty/readability, then supply missing class art or refine creature kit designs.


## MON-01: Simple monster kits

Status: implemented and verified, 2026-09-30. User explicitly requested a Luna monster_unit_designer agent; it owns monster data, trigger tests and docs/MONSTER_KITS.md, while root owns shared UI integration. Eight enemy creatures each have one named automatic passive. Existing post-movement passive hooks handle adjacency, movement, stance, HP and corpse triggers; no new combat phases or player cards. Kit names appear on monster cards and full trigger/effect text appears in inspection.
Evidence: full seeded campaign checks and browser Court/pass completed with all six waves, two regroup/rallies, round-20 victory and exact replay. Desktop Ogre inspection shows Crushing Blows. Production build and 184 checks pass, zero failures and five existing TODOs. Trigger-edge checks cover all eight kits; an actual seeded Ogre strike gains exactly 1 damage; monster inspection templates and desktop/portrait browser interactions expose the kits.
Limits: prototype values, no active energy-based monster powers yet; Corpsehounds depend on existing Hollow Court corpse markers. Next acceptance: human playtest kit readability and counterplay before tuning difficulty or adding active mechanics.


## PLAY-01: Human campaign feedback, army controls and statistics

Status: implemented and verified, 2026-09-30. Actions follow selected units on desktop; left portraits group exact variants, display recruited field/bench counts and expose type planning/orders/deployment. Selected-unit and team statistics include logged strike damage, successful active ability counts and leaders; last completed mission is stored locally. Luna supplied independent stats and rendering work, with root integrating match/UI. Supply bank rises from 6 to 30 at unchanged +3/turn, explicitly requested by Scott. Legacy header-defined banks replay and restore current settings.
Evidence: production build and 193 passing checks, zero failures and five existing TODOs; thirty campaign playthrough/replays; exact replay of Scott's saved Crown/road round-8 victory; normal browser type controls and statistics, full round-11 new-bank Crown/road win with two regroup/rallies, exact replay and saved stats; desktop/portrait/high-resolution screenshots. Details in docs/PLAYTEST_FEEDBACK_VERIFICATION.md.
Limits: type orders apply to field units; reserves are managed through their deploy choices. Small screens retain the bottom action row. Stats are per unit identity, with post-mitigation strike damage including overkill; passive evaluations and unattributed spells are not unit active-ability uses. Last-result storage is local and overwrites the previous result. Bank change is not a declaration of skirmish balance.
Next: playtest action placement, army management and readability with a larger recruited army; measure GPU usage on Scott's hardware at the same view/settings before adding further quality tiers.

## PERF-01: Three.js quick wins

Status: implemented with rendering-work validation, 2026-09-30. User explicitly requested a Luna game-development performance pass with internet research. Official Three.js docs informed adaptive buffer pixel budget, multi-pass counters and effect skipping. Idle planning 30 fps / playback and dragging 60 fps, 1.6M backing-pixel cap, AO/denoise samples 16→8, and disabled Painterly pass skipping are live. Dynamic shadows remain to preserve moving geometry.
Evidence: build, normal controls and screenshot verification. At 2552x1238 CSS pixels, measured backing area is 1,599,896 pixels (ratio 0.711638), versus 3,159,376 at ratio1. P/H toggles reduce measured draw work and restore the original rendering path. See docs/PERFORMANCE_PASS.md.
Limits: GPU utilization percentage was not measured; headless timings are not a device GPU benchmark. Large 3D canvases soften under the pixel budget; HUD remains at browser resolution. Next: compare local GPU usage during planning/playback with the same camera/viewport.
