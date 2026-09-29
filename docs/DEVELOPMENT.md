# Durable development direction

Confirmed by Scott on 2026-09-29. The immediate direction is to establish this durable process and complete the agreed gameplay systems. Existing core match blockers must be resolved as part of that work before unrelated expansion.

## Sources of truth

- GAME.md: intended player experience, confirmed gameplay decisions and explicitly provisional rules.
- CURRENT_GAPS.md: one maintained register of remaining gaps and verification evidence.
- AGENTS.md: cross-session instructions; CLAUDE.md: implementation map and conventions.
- gameplay_overhaul/ and design_overhaul/: historical starting gaps, task briefs, logs and screenshots. Preserve them as evidence; their original status is not authoritative for current completion.

Later prompts refine the current objective. They do not silently replace the game direction. When Scott explicitly changes a decision, record the before/after decision and implications in the relevant source of truth. Ask if a request conflicts with a confirmed rule and does not clearly authorize changing it.

## System-first execution

Complete one system, then integrate it. Start each pass by naming the system, relevant confirmed decisions, remaining strategic questions, dependencies and acceptance criteria. A module existing is an implementation milestone, not proof the system is complete. Small commits are useful within the system; do not substitute disconnected feature slices for system completion.

One agent owns coupled engine and UI work. Parallel subagents are appropriate only when authorized and useful for independent work, such as separate character or portrait assets. Define file ownership and contracts first; the root integrates and verifies the result.

## Decision authority and blockers

Ask Scott about unspecified rules that change player strategy, objectives or incentives. Choose routine implementation details independently and label prototype assumptions. Balance experiments may vary rules and report results, but changes to default balance values require Scott's selection.

Confirmed correctness bugs and core match problems block unrelated feature expansion. Examples are valid ranged attacks being skipped, near-universal stalemates and a clogged hand removing meaningful decisions. Focused experiments or system work needed to solve these blockers can proceed.

## Completion and handoff

Require appropriate build/rule checks, demonstrated browser interaction and screenshots for visible changes, and seeded simulations/replay checks for balance or AI changes. Use separate labels for implemented, verified, provisional and blocked. Record evidence with its commit/date and scope; old screenshots do not verify a newer change. Documentation-only changes need consistency and diff checks, not a game server.

Each handoff states what changed, evidence and practical limitations, updates CURRENT_GAPS.md, and recommends one next task with acceptance criteria. Stop verification servers. Preserve historical logs and unrelated working-tree changes.

## Questions still requiring direction

- Which gameplay system should be completed first after confirmed correctness fixes: energy/abilities/orders or the card economy/capacity loop?
- What observable outcomes define an acceptable match: expected duration, tolerable draw rate and meaningful choices at capacity?
- Where should players be able to configure shared ability priorities and per-unit objectives without recurring action micromanagement?

These are open decisions, not permission to invent new gameplay direction.
