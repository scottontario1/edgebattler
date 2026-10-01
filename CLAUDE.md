# Implementation guide

Reviewed against main `d1f7c64`, 2026-10-01. [Current docs](docs/README.md); [historical implementation guide](docs/archive/2026-10-01/CLAUDE.md).

## Stack and modules

Plain JavaScript ES modules, Three.js `^0.170.0`, Vite `^6.0.0`, Node's test runner. Check the lockfile for resolved versions. Commands: `npm run dev`, `npm run build`, `npm test`. Simulation tooling lives under `tools/sim/` and `experiments/`.

- `src/main.js`, `src/menu.js`, `src/setup.js`: entry, selection and match construction.
- `src/game.js`: scene/playback and browser flags. `src/ui.js`, `src/ui/`: sidebar, stats, planning and shop.
- `src/match.js`: authoritative validated actions, economy, phase boundaries and state summary. UI operations must use replayable match actions.
- `src/timed-battle.js`: continuous simulation. `src/battle.js`, `src/combat.js`: strikes/discrete support.
- `src/skill-slots.js`, `src/abilities.js`, `src/ui/abilities.js`, `src/ui/skill-icons.js`: retained timelines, kits/spells and editor.
- `src/shards.js`, `src/cards.js`, `src/upgrades.js`: passive customization, cards and upgrades.
- `src/campaign.js`, `src/level-maps.js`, `src/levels.js`: authored progression/maps and scenarios.
- `src/factions/`, `src/cultures.js`, `src/passives.js`, `src/monsters.js`, `src/roster.js`: culture registration, identity and passives.
- `src/battle-stats.js`, `src/log.js`, `vite.config.js`: statistics, replay and development-only ingestion.

## Defaults and test construction

Normal browser play explicitly disables abilities/spells and uses continuous combat. Pure engine `createMatch` and older simulators default to discrete resolution; pass `combat: {duration:18}` for continuous runs. Ability tests opt in. Browser `skills=1` and `spells=1` independently restore systems; `combat=classic` selects discrete battles. Old experiment defaults do not define current play.

Skill grouping uses type identity (variant, named unit or class); shard application uses base `cls`. Preserve that distinction and inheritance across field/bench/recruitment/respawn. Log feature choices and check exact replay when modifying either system.

## Art and rendering

Supplied sprites are camera-facing transparent cutouts on a 3D map. Match variant/unit/sprite identity before generic class fallback. Faction art keeps native palettes; rings show allegiance. Preserve `design_assets/` sources. [Current faction pipeline](docs/art/FACTION_SPRITES.md) lists coverage; missing designs use fallbacks. `sprites=0` enables generic 3D models.

Planning targets 30 FPS, playback/dragging 60, hidden pages pause, backing buffers cap at 1.6 million pixels. DOM HUD resolution is independent. GTAO/denoise use eight samples; disabled Painterly skips its pass. Shadows refresh on displayed frames. `P` toggles Painterly, `H` shadows. Development `window.__game.renderStats` measures submitted work, not GPU utilization. [Performance evidence](docs/PERFORMANCE_PASS.md).

## Verification

Read [development](docs/DEVELOPMENT.md) before changing behavior. [Integration evidence](docs/VERIFICATION.md) is a recorded baseline, not fresh tests for future edits. Check source tests/build, browser interactions and simulations/replays appropriate to the change. Docs-only edits need consistency, local-link and diff checks. Keep user playtest servers running unless asked to stop them; stop temporary verification servers you start.
