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
Limits: the shipped AI cannot play faction cards well, so skirmish opponents are weak; whole games still draw 89-100% (CORE-02), so faction balance cannot be judged on win rate; no interaction UI for the mark action or tile objects; new classes use tinted placeholder sprites. Engine requests from the agents are in `docs/factions/*.md`.
