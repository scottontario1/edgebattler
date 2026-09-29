# Current gameplay and design gaps

Baseline reviewed: codex/gamegaps, d39fab9, 2026-09-29. This register replaces historical task tables as the current backlog. Review evidence is source inspection and saved screenshots; two targeted Node checks verified the archer targeting failure and lack of field baseline energy. No fresh browser or broad simulation run was performed in that review.

## Implemented foundation

Shared match controller, seeded cards, paid reserves, deployment, optional combinations, spell queue, type-wide Barrier, simultaneous basic combat, Protect stance, reserve recovery, symmetric champion respawn and capture checks, AI commanders and replayable logs exist. Browser/build/replay success was reported by the implementing agent at d39fab9; this review did not independently repeat that complete validation. Energy-driven multi-ability management is incomplete.

## CORE-01: Eligible attack targeting

Status: confirmed correctness gap; blocks unrelated expansion.
Archer chooses the nearest adjacent enemy and skips its attack even when another enemy is at valid range 2 (src/battle.js). Targeted Node reproduction yielded zero archer strikes.
Acceptance: select among eligible enemy targets before ranking; cover adjacent blocker plus valid ranged target, no eligible target, and both factions. Preserve simultaneous lethal resolution and deterministic replay.

## CORE-02: Match pacing and keep pressure

Status: reported core blocker; balance choices provisional.
The implementing agent reported 96% draws in 100 games at a 30-round cap, including defensive keep immunity to ordinary recruits. Do not automatically adopt lower defense, siege bonuses or score victory.
Acceptance: agree the attacking counterplay, run paired-seed/side-swapped experiments against passive, greedy and heuristic policies, report capture rate, draws, duration and tradeoffs, and let Scott select defaults.

## SYS-01: Energy, abilities and priorities

Status: partially implemented; agreed player experience incomplete.
No baseline energy accrues to field units; Rally costs zero and generates energy, while Barrier is an automatic passive reduction. No human ability-priority editor or energy-consuming active kit. Confirmed direction requires charging over turns and sustained engagement with cooldown/energy decisions.
Acceptance: document gain/spend/timing and active/passive semantics, implement the chosen system, expose priority and cooldown state, demonstrate charge -> spend -> recover across rounds, and verify AI uses the same rules. Shared type-wide priorities, enable/disable controls without a reserve threshold, usefulness-based Rally and coverage of all three recruits are confirmed. Concrete kits require Scott's approval; ABILITY_PROPOSAL.md records the pending proposal. Do not silently turn Barrier into an active ability.

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

Status: partial; durable process and opening GAME.md status reconciled in this documentation pass.
Other GAME.md foundation/milestone paragraphs retain legacy manual-loop wording and need a dedicated source-backed pass. Historical task logs remain unchanged intentionally.
Acceptance: GAME.md consistently distinguishes current behavior, intended rules and provisional defaults; every current gap has evidence/status and a next action.

## Recommended next task

Fix CORE-01 as a contained correctness prerequisite using the acceptance criteria above. The confirmed active system is then SYS-01 energy/abilities/priorities, followed by SYS-02 card circulation/capacity. Complete necessary dependencies in the same system pass; elicit unresolved strategic choices before implementing them. Every task names this roadmap position and its acceptance criteria. See DEVELOPMENT.md for the current roadmap; do not start unrelated expansion while core match blockers persist.
