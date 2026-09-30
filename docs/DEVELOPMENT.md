# Durable development direction

Confirmed by Scott on 2026-09-29. The immediate direction is to establish this durable process and complete the agreed gameplay systems. Existing core match blockers must be resolved as part of that work before unrelated expansion.

## Sources of truth

- GAME.md: intended player experience, confirmed gameplay decisions and explicitly provisional rules.
- CURRENT_GAPS.md: one maintained register of remaining gaps and verification evidence.
- AGENTS.md: cross-session instructions; CLAUDE.md: implementation map and conventions.
- gameplay_overhaul/ and design_overhaul/: historical starting gaps, task briefs, logs and screenshots. Preserve them as evidence; their original status is not authoritative for current completion.

Later prompts refine the current objective. They do not silently replace the game direction. When Scott explicitly changes a decision, record the before/after decision and implications in the relevant source of truth. Ask if a request conflicts with a confirmed rule and does not clearly authorize changing it.

## System-first execution

Complete one system, then integrate it. Completion means the agreed prototype scope works and is verified; expansion ideas remain backlog items, rather than requiring every related future feature. Implement dependencies discovered during the pass as part of that same pass. Record added scope and preserve the existing authority boundary: dependencies do not authorize changing strategic design or default balance without Scott. Start each pass by naming the system, relevant confirmed decisions, remaining strategic questions, dependencies and acceptance criteria. A module existing is an implementation milestone, not proof the system is complete. Small commits are useful within the system; do not substitute disconnected feature slices for system completion.

One agent owns coupled engine and UI work. Parallel subagents are appropriate only when authorized and useful for independent work, such as separate character or portrait assets. Define file ownership and contracts first; the root integrates and verifies the result.

## Decision authority and blockers

Ask Scott about unspecified rules that change player strategy, objectives or incentives. Choose routine implementation details independently and label prototype assumptions. Balance experiments may vary rules and report results, but changes to default balance values require Scott's selection.

Confirmed correctness bugs and core match problems block unrelated feature expansion. Examples are valid ranged attacks being skipped, near-universal stalemates and a clogged hand removing meaningful decisions. Focused experiments or system work needed to solve these blockers can proceed.

## Completion and handoff

Require appropriate build/rule checks, demonstrated browser interaction and screenshots for visible changes, and seeded simulations/replay checks for balance or AI changes. Use separate labels for implemented, verified, provisional and blocked. Record evidence with its commit/date and scope; old screenshots do not verify a newer change. Documentation-only changes need consistency and diff checks, not a game server.

Each implementation task names the active roadmap system and its acceptance criteria. Each handoff states what changed, evidence and practical limitations, updates CURRENT_GAPS.md and this roadmap, and recommends one next task with acceptance criteria. Identify proposed departures from the roadmap before starting them; explicit user redirection takes precedence. Stop verification servers. Preserve historical logs and unrelated working-tree changes.

## Active roadmap

Confirmed order from elicitation answers 11A then B, 12A, 13A, 14B and 15C:

1. **Verified prerequisite:** CORE-01 eligible ranged targeting. Scope is the targeting failure, deterministic behavior and integrated verification.
2. **Completed system: SYS-01 energy, planning-selected abilities, cooldowns, stance constraints and facing.** Complete the agreed prototype, including needed dependencies, before advancing to the next system. Acceptance: define gain/spend/activation timing and chosen active/passive behavior; implement persistent energy and cooldowns; let the player select active abilities during planning without compulsory per-unit click-through; enforce Brace/Charge stances, side/back facing and approximately two-thirds advancing battle movement; demonstrate charge -> spend -> recover over multiple rounds in the browser; verify both factions use the same rules through meaningful rule checks and seeded AI/replay runs. The full MVP package was approved on 2026-09-29 and implemented; see ABILITY_PROPOSAL.md and SYS01_VERIFICATION.md. Existing persistent tile orders are dependencies only where this scope requires them.
3. **Completed system: SYS-02 card circulation, capacity, reserves and recycling.** Approved shared one-cycle allowance, same-type/rarity/grade replacement, full invested refund, unpaid recipe pricing, fresh repurchase, hand-slot requirement and overflow banking are implemented and verified. Optional triples and weighted population remain. See SYS02_VERIFICATION.md for tests, browser flow and paired simulations. Capacity pressure remains a measured limitation.
4. **Active next: core match pacing:** CORE-02 and CORE-03 remain blockers to unrelated expansion. Investigate and resolve them within the relevant system where necessary; experiments can proceed throughout. Scott selects changes to default balance.
5. **Active user-directed playtest system (2026-09-30):** faction-selectable south-to-north campaign with authored non-recruiting encounters, waves and regroup/rally checkpoints. Three missions integrate the faction_overhaul foundation. Acceptance: menu faction choice launches the selected army, encounters cannot be skipped, casualties/state persist within a mission, next mission preserves faction choice, build/rules/browser interactions and seeded replay pass. This explicit request promotes campaign work ahead of the remaining skirmish pacing investigations; it does not settle their balance choices.
6. **Deferred:** automatic ability prioritization, remaining arbitrary persistent-order UI, art/readability polish, new classes, campaign progression/save and multiplayer expansion. Move a deferred item into the active system when it is a necessary dependency and record why.

Evaluate balance experiments on match completion, duration, faction viability, success of different strategies and meaningful decisions at capacity. A lower draw rate alone is not enough. Numerical targets and test coverage thresholds remain to be defined; do not fabricate them as confirmed requirements.

## Questions still requiring direction

- SYS-01 package is approved and implemented. Automatic priority editing and future Cavalier flank-seeking movement remain deferred.
- What observable outcomes define an acceptable match: expected duration, tolerable draw rate and meaningful choices at capacity?
- What attacking counterplay and simultaneous/mutual-victory semantics should CORE-02/CORE-03 adopt? Population progression and paid rerolls remain deferred.

These are open decisions, not permission to invent new gameplay direction.

## Decision change: 2026-09-29

Scott explicitly replaced automatic ability prioritization with planning-selected abilities for the MVP, replaced opposite-ally flanking with side/back attacks, added Brace/Charge stance constraints, and reduced advancing battle movement from a separate full allowance to approximately two-thirds of planning movement. Update implementation and verification around these rules; do not reintroduce the previous design through a later task prompt.

Follow-up answers 22A, 23B, 24A with energy exception, 25A with movement rotation, 26B and 27A confirm the selection/facing/stance rules above. Future Cavalier auto-battle AI should prefer flanks; do not treat that future preference as a reason to reopen automatic ability prioritization.

SYS-01 completed on 2026-09-29 with rule checks, browser evidence and seeded replay verification. SYS-02 is now also implemented and verified. Next, investigate keep pressure with paired, side-swapped experiments; report completion, duration, captures and capacity decisions for Scott to choose defaults. Core pacing and simultaneous victory remain open.

SYS-02 decision clarification (2026-09-29): bench units are already paid; cycling refunds actual investment and returns an unpaid random replacement of equal type, rarity and stars. One shared free cycle per turn; bench cycling requires a free hand slot. Replacement prices follow the three-copy recipe; repurchase resets combat state. Full refunds may exceed the bank cap. All current rarities are common; future population-level progression is deferred. These approvals replace the earlier open recycling questions.


User-promoted campaign slice (2026-09-30): supplied faction/creature art and mixed fixed engagements are playable. The user next requested simple monster kits; MON-01 adds one named passive per creature with existing battle hooks and visible enemy inspection. This scope takes precedence for the campaign playtest while skirmish CORE-02/03 remain open. Verify trigger boundaries, actual combat effects, campaign completion/replay and inspector readability; collect human playtest feedback before further tuning.


Human campaign playtest feedback (2026-09-30) promotes PLAY-01 and PERF-01: nearby action controls, grouped friendly army management, battle statistics, bank30 at unchanged income3, and Three.js quick wins researched by Luna. Verify legal group actions, type identity, old/new replay compatibility, stats retention/save, visible controls across screen sizes and rendering workload. Current pass does not resolve skirmish victory/balance or cross-mission persistence.
