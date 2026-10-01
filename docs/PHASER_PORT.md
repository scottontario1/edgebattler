# Phaser port: architecture and work plan

Status: in progress on branch `claude/project-thread-23j745` (base: local `main` 1cd4e22, which already
contains the merged Shards work). The Three.js game is frozen in `legacy/` as the behavioural reference;
`PROJECT_KNOWLEDGE.md` describes it system by system and is the spec for this port.

## Framework research (checked 2026-10-01)

Phaser is an open-source, MIT-licensed JavaScript/TypeScript HTML5 **2D** framework; its own docs explicitly say it is not a built-in 3D engine. The project is currently pinned by the lockfile to Phaser 4.2.1. The port therefore uses the authored 2D character sprites and a hand-authored oblique 2D board view, not a Three.js-compatible 3D scene. This is a product/presentation change to keep in mind during playtests.

The Phaser v4 scene model provides lifecycle, display list, cameras, scene-local input, loader, clock and tweens. We'll use scenes for boot/battle transitions, the Scene Input Plugin for pointer interaction, Scale Manager for responsive canvases, and ordinary image/sprite/tilemap game objects for the field. Core simulation stays outside Phaser. Phaser's built-in Tilemap supports orthogonal, isometric, hexagonal and staggered maps with camera culling; our current grid has custom terrain/object rules, so a direct Tiled conversion is optional rather than a prerequisite.

Phaser 4 is a major renderer/API change from v3: it replaces pipelines with render nodes, unifies FX and masks into filters, and changes camera and tint APIs. Use v4.2.1 documentation/examples and avoid copy-pasting v3 tutorials without checking the migration guide. Avoid pixel-perfect hit testing for every unit because Phaser documents that it is expensive; use explicit hit areas unless sprite-alpha selection is needed.

Official sources: [Phaser overview](https://docs.phaser.io/), [v4.2.1 release](https://phaser.io/download/release/v4.2.1), [scene concepts](https://docs.phaser.io/phaser/concepts/scenes), [scale manager](https://docs.phaser.io/phaser/concepts/scale-manager), [input concepts](https://docs.phaser.io/phaser/concepts/input), [tilemaps](https://docs.phaser.io/api-documentation/class/tilemaps-tilemaplayer), [v3→v4 migration guide](https://github.com/phaserjs/phaser/blob/master/changelog/v4/4.0/MIGRATION-GUIDE.md).

## Goals

1. Same game, new engine: Phaser 4 (4.2.x) renders the battlefield; game rules stay pure JavaScript.
2. Clean architecture: no process-global mutable state, small modules with one job, readable code.
3. Proven behaviour: the ported rules replay the legacy engine's recorded games exactly
   (`tests/fixtures/golden/`, see "Parity" below).

Scope of this pass is the game as it is normally played today: faction select, the three campaign
missions and AI skirmishes on River Ford, continuous 18-second combat, Shards, three-unit upgrades,
cycling, champions, monsters and faction passives, deterministic logs and replay. Archived systems stay
in `legacy/` until they are ported in a later pass: skill kits / skill slots and spells (off in normal
play), the discrete (non-timed) combat engine, the 24 scenario levels and `experiments/`. The core is
designed so skills can come back (energy, per-type slots and skill windows are reserved hooks), but no
skill effects are implemented here.

## Layers

```
src/core/        pure rules engine. No DOM, no Phaser, no module-level mutable state.
  content/       data: terrain, maps, weapons, classes, monsters, shards, cards, factions, missions
  rules/         board, movement/range, combat forecast, passives
  battle/        target selection, strike resolution, continuous (timed) battle simulation
  economy/       cards (draws, hand, bench, cycling), shards, upgrades
  match/         the match controller: state, actions, round resolution, campaign, objects, stats
  ai/            commanders (greedy, heuristic) acting through match.apply
  log/           JSON Lines log, replay
  setup/         content context + factories: createSkirmish, createCampaign
src/game/        Phaser 4 presentation. Reads core state and events; never changes rules state.
  main.js        bootstrap: parse launch options, start Phaser, mount HUD
  scenes/        Boot (preload), Battle (world); menus are DOM
  world/         projection, terrain, props, unit views, overlays, camera, picking
  playback/      turns a round's event batches into a timeline of tweens
  hud/           DOM HUD: pure template functions of view-model data + one stylesheet per component
  app/           session (owns the match, AI, log), view-model builders, input -> actions
tests/           node:test. tests/core (unit), tests/parity (golden replays), tests/game (pure view code)
legacy/          the frozen Three.js game (npm run legacy:dev / legacy:test)
```

Dependency rule: `game -> core`, never the reverse. Inside core: `content <- rules <- battle <- match`,
`economy` depends on `content` only, `ai` and `log` depend on `match`. Tests may import `legacy/src`
for differential checks, production code never does.

## Core conventions

- **Content context instead of registries.** Legacy registers cultures, weapons, classes, cards and
  passives into module globals (`registerCulture`, `prepareFactions`, `setMap`, `setCardLimits`,
  `setAbilitiesEnabled`, `EXPERIMENT_RULES`). The port builds an immutable context once per match:
  `createContent({ cultures, rarityGate })` returns frozen lookup tables, and `createBoard(map)` returns
  the grid. Every rule receives what it needs as arguments. Two matches with different maps and
  cultures must be able to run side by side in one process (there is a test for this).
- **Plain data state.** Units, sides, territory and objects are plain JSON-compatible records owned by
  the match. View code holds ids, never record references it mutates.
- **Determinism.** Randomness only through explicit RNG objects from `src/core/util/rng.js`, seeded
  exactly as legacy seeds them (per-side card streams, battle/tick streams). Same call order as legacy:
  the golden logs depend on it. No `Math.random`, no Date, no iteration over unordered state that
  legacy iterated in insertion order without preserving that order.
- **Actions in, events out.** Planning goes through `match.apply(action, actor)` returning
  `{ ok: true, ...result }` or `{ ok: false, reason }` (every attempt is logged). `match.resolveRound()`
  returns presentation batches `[{ type, events, time? }]`. Event and action shapes match the legacy log
  schema (schema 4) and may only add fields.
- **Style.** ES modules, named exports, 2-space indent, lines under ~120 columns, one statement per line,
  descriptive names (no legacy one-liner style), JSDoc `@typedef` for the main records, files under
  ~400 lines, comments that explain why. Prefer small pure functions; keep mutation inside the match.
- **Tests.** `npm test` runs `tests/**/*.test.mjs` with `node:test`. Port the meaningful legacy rule
  tests for each system (rewritten against the new API) and add differential tests that run the same
  inputs through `legacy/src` and `src/core`.

## Parity

`legacy/tools/golden.mjs` recorded 50 legacy games (30 campaign: 3 missions x 5 factions x seeds 7/19,
blue driven by the heuristic commander plus checkpoint orders; 20 skirmishes: 5 faction pairings x
seeds 3/11 x heuristic-vs-greedy and heuristic-vs-heuristic, `maxRounds` 30). All use
`combat: { duration: 18 }`, skills and spells off. `tests/parity/golden.mjs` replays a log through any
`create(header, push)` factory and checks that every logged action result, round batch, summary and
result is reproduced (the new engine may add fields, never change or drop them).

Acceptance for the core: all 50 golden games replay with `ok: true`, and the ported AI, given the same
match states, chooses the same actions (so a full AI game recorded by the new engine equals the golden
log). Regenerate fixtures only from `legacy/` and only on purpose: `node legacy/tools/golden.mjs`.

## Presentation

- **Phaser 4.2** (`phaser` npm package). Read `node_modules/phaser/skills/<topic>/SKILL.md` for the v4
  API (filters replace FX/BitmapMask; no Mesh/Plane; `setTintFill` -> `setTint` + `setTintMode`).
- **Projection.** Oblique top-down: tile `(c, r)` maps to screen `x = c * TILE_W`, `y = r * TILE_H` with
  `TILE_W = 96`, `TILE_H = 72` (rows foreshortened like the legacy 40-degree camera). Upright sprites
  stand on the tile centre with their manifest foot anchor; depth = screen y. Constants live in
  `src/game/world/projection.js`.
- **Art.** Unit sprites and portraits come from `public/sprites/manifest.json` (Brenna, Dreg, shipped
  recruits, `_red` recruit variants) and `public/sprites/factions-manifest.json` (24 faction and monster
  identities: anchor, height, foot width, portrait crop). Identity resolution order is
  spriteKey -> variantId -> unitId -> class (legacy `src/sprite-art.js`). Terrain is painted
  procedurally from `public/textures/painted/*` (soft-light detail over base colours). Source art in
  `design_assets/` is never edited.
- **HUD.** DOM overlay above the canvas (`#hud`). Each component is a pure `render(viewModel) -> html`
  function plus a stylesheet; `src/game/app/` builds the view model from match state and dispatches
  actions. Legacy `src/ui/*` templates and `src/style.css` tokens are the visual reference. Layouts:
  desktop landscape, short landscape (`max-height: 500px`), portrait phone; type floor 11px for anything
  the player reads, controls 32px (44px under `pointer: coarse`).
- **Playback.** Resolve computes the whole round first, then plays the batches. Animation never changes
  rules state or rolls dice; the view reconciles to the final match state when playback ends.

## Verification

- `npm test` (core + view-model tests, parity). `npm run build`.
- Browser: `PORT=<free port> node node_modules/vite/bin/vite.js &` (start vite directly so `$!` is the
  server pid; stop it with `kill <pid>` when done; never `pkill` by name, other sessions run servers),
  then `PORT=<port> node tools/shot.mjs out.png 1280 800 "<query>"` (Linux Chrome + SwiftShader; prints
  page errors, exits nonzero on them). Check 1280x800 and 390x844.

## Work plan

Each system is ported on its own branch in its own worktree from the shared port baseline, reviewed, then
cherry-picked into `claude/project-thread-23j745`. Keep gameplay/content, Phaser world, HUD and session
logic on separate module boundaries.

| Wave | Branch | System | Status |
|---|---|---|---|
| 1 | `port/core-content` | util/rng, content (weapons, classes, heroes, monsters, shard and card catalogues, factions, missions), content context, movement/range, forecast, passives | Integrated |
| 1 | `port/world` | Phaser bootstrap, Boot scene, projection, terrain/props rendering, unit views, camera, picking, overlays | Integrated; demo launch only |
| 1 | `port/hud` | DOM HUD components and styles from view-model fixtures, start menu | Integrated; requires app/session view models |
| 2 | `port/economy` | cards, cycling, shards, upgrades | Integrated as pure helpers |
| 2 | `port/battle` | target selection, strikes, occupancy contention, continuous battle simulation | In progress |
| 3 | `port/match` | match controller, campaign, objects, stats, log/replay, setup factories, golden parity | Not started |
| 4 | `port/ai` | greedy and heuristic commanders, AI parity | Not started |
| 4 | `port/integration` | session, view models, planning input, playback, end screens, logging | Not started |

## Progress snapshot

- Phaser is pinned to 4.2.1. The root app no longer depends on Three.js; the old project and its own
  dependency lock remain under `legacy/`.
- Core content, board, movement, forecast, passives and economy use explicit context/state inputs. The
  Phaser world slice renders maps and unit snapshots, and the HUD is a standalone DOM presentation layer.
- **The port is not yet a playable game.** The entry currently starts the world demo. Match creation,
  deployment/recruit actions, live combat, campaign progression, AI turns and end-to-end replay are later
  dependencies in the table.
- First Vite production build completed with Node 22.12 and Vite 6.4.3. It emitted one 1.74 MB JS chunk
  (about 402 KB gzip) and the normal Vite large-chunk warning. No tests or browser playthrough have been
  run on the new port in this pass; the existing fixture/test scaffolding remains available for later
  parity and mobile verification.
