# Current gameplay and design gaps

Baseline reviewed: codex/gamegaps, d39fab9, 2026-09-29. This register replaces historical task tables as the current backlog. Review evidence is source inspection and saved screenshots; two targeted Node checks verified the archer targeting failure and lack of field baseline energy. No fresh browser or broad simulation run was performed in that review.

Current implementation update: CORE-01 and SYS-01 are now verified with fresh browser, rule and simulation evidence. See SYS01_VERIFICATION.md.

## Implemented foundation

Shared match controller, seeded cards, paid reserves, deployment, optional combinations, spell queue, type-wide Barrier, simultaneous basic combat, Protect stance, reserve recovery, symmetric champion respawn and capture checks, AI commanders and replayable logs exist. Browser/build/replay success was reported by the implementing agent at d39fab9; this review did not independently repeat that complete validation. SYS-01 energy/planning-selected kits are now implemented and verified on 2026-09-29; current evidence is in SYS01_VERIFICATION.md.

## CORE-01: Eligible attack targeting

Status: implemented and verified, 2026-09-29. Legal targets are filtered before ranking; both factions, invalid explicit/friendly targets, out-of-range and simultaneous lethal behavior have rule checks and browser evidence. See SYS01_VERIFICATION.md.
Acceptance: select among eligible enemy targets before ranking; cover adjacent blocker plus valid ranged target, no eligible target, and both factions. Preserve simultaneous lethal resolution and deterministic replay.

## CORE-02: Match pacing and keep pressure

Status: reported core blocker; balance choices provisional.
Historical baseline reported 96% draws; the final SYS-01 run draws 89/100 at 30 rounds despite 11 captures. Ordinary basic recruits still struggle with defensive keeps; enhancements/flanks now create some counterplay. Do not automatically adopt lower defense, siege bonuses or score victory.
Acceptance: agree the attacking counterplay, run paired-seed/side-swapped experiments against passive, greedy and heuristic policies, report capture rate, draws, duration and tradeoffs, and let Scott select defaults.

## SYS-01: Energy and planning-selected abilities

Status: implemented and verified, 2026-09-29.
Scott approved the complete MVP package in ABILITY_PROPOSAL.md. Baseline energy, paid kits, atomic per-unit/group selection, persistent suspended bundles, fixed phases, Brace Hold, Charge triggers, facing/flanks and reduced Advance movement are integrated into the shared engine and UI. Heuristic commanders use logged planning actions; greedy remains a recruit-only baseline. Type-wide equipment remains distinct. No automatic priority editor.
Evidence: 18 rule checks and production build pass; three-round normal browser log replays exactly; combat fixture and inspected desktop/short/portrait screenshots; 100 paired-seed, side-swapped simulations replay exactly. See SYS01_VERIFICATION.md and design_overhaul/evidence/sys01-*.
Limits: Cavalier movement does not optimize flank opportunities; that remains future scope. Champions have no active kit. The system is verified at approved prototype values, not declared balanced. Final run still draws 89/100 and blocks about 70 draws per side per game.

## SYS-02: Capacity, reserves and card circulation

Status: partially implemented; reported core blocker at capacity.
Reserves use population; withdrawal does not free capacity. Recycling/selling and disposal/exchange of unusable cards are absent. Hands and Supply reportedly remain capped for much of a match.
Acceptance: decide retained state, card/currency return and repayment rules, implement the selected options, preserve optional triples and weighted population, and demonstrate meaningful choices at cap with simulation evidence.

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
GAME.md now reflects automatic rounds, recruitment, champion respawn, reserve gains, approved ability contracts and current milestones. Deferred UI/recycling/timing rules remain explicitly intended or open. Historical task logs remain unchanged intentionally.
Acceptance: GAME.md consistently distinguishes current behavior, intended rules and provisional defaults; every current gap has evidence/status and a next action.

## Recommended next task

Proceed to SYS-02 card circulation/capacity. Confirm strategic recycle/return/repayment/state rules before implementing them; preserve optional triples and weighted population, demonstrate choices at capacity and report blocked draws/resource use through seeded replay runs. CORE-02 and CORE-03 still block unrelated expansion. CORE-01 and SYS-01 are verified prerequisites; do not reopen them without new evidence or explicit redirection.
