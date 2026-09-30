# Development direction

Applies to the whole repository. These decisions were confirmed by Scott on 2026-09-29.

- Read GAME.md, docs/DEVELOPMENT.md and docs/CURRENT_GAPS.md before planning work. Read CLAUDE.md for implementation conventions.
- GAME.md owns gameplay direction; docs/DEVELOPMENT.md owns the development process; docs/CURRENT_GAPS.md is the single current gap register. Historical overhaul briefs and task logs are evidence, not the current backlog.
- Continue the recorded direction across prompts. A narrower task or new agent is not a redesign. Honor explicit user changes and update the affected source of truth in the same working slice.
- Ask about unspecified decisions that change player strategy; choose and document routine prototype defaults independently.
- Follow the roadmap in docs/DEVELOPMENT.md: correctness prerequisites, then energy/planning-selected abilities, then card circulation/capacity. Each task names its system and acceptance criteria; identify departures before starting them. Complete the agreed prototype, integrate and verify it, and leave expansion ideas explicit in the backlog. Implement discovered dependencies within the same pass while preserving strategic-decision and balance authority.
- Fix confirmed correctness bugs and core match blockers before unrelated feature expansion. Experiments needed to resolve blockers may proceed.
- Agents may experiment with balance and recommend values; Scott selects changes to shipped defaults.
- Use one implementing agent for shared engine/UI changes. Delegate only when the user authorizes it and tasks are independent, such as changes to separate character assets; one root owns integration.
- Gameplay completion requires an appropriate build, meaningful rule checks, browser interaction/screenshots for visible changes, and simulations/replay checks when balance or AI is affected. Record limitations; do not label blocked verification complete.
- Keep the current gap register updated with implemented, verified, provisional and blocked states, evidence and the next task's acceptance criteria.
- Preserve unrelated work, commit each verified working slice, and stop servers started for verification when finished.
