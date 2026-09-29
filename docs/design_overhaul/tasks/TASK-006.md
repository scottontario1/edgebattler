# TASK-006: On-map plates: stance, energy, stars, statuses and village ownership markers

- **Gap IDs:** DES-004
- **Wave / dependencies:** wave 2; depends on: TASK-003 (uses `src/ui/icons.js`)
- **Log (append only):** `docs/design_overhaul/task_log/TASK-006.log`

## Visual goal
Make the persistent state visible where the player looks: on the battlefield. Each unit gets a small plate (stars, stance, energy, status) and each village / keep / camp shows who controls it. Plates must be unobtrusive (10 units on screen) and must never block picking or clicks.

## Context files to read first
- `src/ui/plates.js` (stub: `createPlates`, `update(t)`, `sync(state)`)
- `src/ui/icons.js` (finished by TASK-003: `stanceIcon`, `starPips`, `energyPips`, `statusIcon`); read TASK-003 screenshots `after-TASK-003-*.png`
- `src/ui.js`: where `createPlates` is called (`territory` is a `Map` of `"c,r" -> "blue"|"red"|null` for `V`/`C`/`K` tiles), `refresh()` calls `plates.sync(state)`, `update(t)` calls `plates.update(t)` every frame
- `src/units.js`: `headPos(id)`, `list`, `byId`, the 3D hp bar (`hpBar`, near the base, do not overlap it), and `toWorld` in `src/map.js`/`tileTop`
- `src/sprites.js` (billboard size, so plates sit clear of the sprite head), `docs/design_overhaul/evidence/before-battle.png`, `before-spell-target.png`
- `docs/design_overhaul/DESIGN_BACKLOG.md` (gap descriptions and evidence)

## Files you may edit (exclusive ownership)
- `src/ui/plates.js`
- `src/ui/plates.css`

## Files you must not edit
`src/ui/icons.js` (owned by TASK-003: import it, do not edit), other modules, `src/ui.js` (import your CSS from `plates.js` with a bare css import statement, so no ui.js change is needed), `src/units.js`, `src/style.css`.

## Styling and layout steps
1. Overlay layer: create once a `<div class="plates" aria-hidden="true">` appended to `deps.container` (`.hud` has `pointer-events: none` for itself; keep the layer `pointer-events: none`), `position: fixed; inset: 0; z-index: 1` (below panels). Reuse DOM nodes per unit id (a `Map`); create on first sight, remove when the unit is gone (`hp <= 0` or missing from `units.byId`).
2. Per-frame `update(t)`: project `units.headPos(id)` (a `THREE.Vector3` above the sprite head; add an 8-12px screen offset upward) with `deps.camera`; set `transform: translate3d(x px, y px, 0) translate(-50%, -100%)`; only write style when the rounded position changes; hide when the point is outside the viewport or behind the camera. Never allocate per frame (reuse a `THREE.Vector3`).
3. Plate content (height at most 16px, font at least 10px): a pill with, in this order: star pips only when `stars >= 2` (gold); stance icon (blue units always; red units only when hovered/selected); energy pips only when `maxEnergy > 0` and the unit is blue (max 4 diamonds, 5px each); status icons (barrier/ward) only when a status is active. When nothing applies the plate is not shown for red units, and blue units with no extras show only the stance icon. Faction accent = 2px bottom border in `--blue` / `--red`. Selected unit's plate is 1.15x scale with a gold border; hovered red unit's plate appears.
4. Territory markers: for every entry of `deps.territory`, a small pennant/flag glyph (inline SVG, 18x22) projected at the tile centre (`toWorld(c, r)` + `tileTop`) with a 6px upward offset, coloured by owner: blue, red, or neutral grey with a dashed outline; on a state change play a 400ms scale-in (reduced motion: none). Keep and camp (`K`/`C`) use a crown-shaped variant. Markers hide when a unit stands on the tile (the plate replaces it).
5. Overlap control: after computing positions each frame (or every 4th frame), if two plates' rects overlap by more than 30% of the smaller, fade the one with lower priority (red before blue, unselected before selected) to `opacity: 0.25`.
6. `sync(state)`: use for `state.selectedId`, `state.hoverId`, `state.phase` (hide all plates for 400ms when a banner is shown? No: keep them); no gameplay reads beyond `units.list[].data`.
7. Dark/bright ground contrast: the plate background is `rgba(11,18,34,0.82)` with a 1px gold hairline; text/icons ivory. Contrast >= 4.5:1.

## Measurable acceptance criteria
- F1. Plates and markers render at L, S, P with zero page errors, and clicking a unit through/under a plate still selects it (click the unit; `__ui.state.selectedId` changes).
- F2. `pointer-events` computed is `none` for the layer and all children; z-index below `.panel` elements (compare computed z-index of `.plates` with `#planning`).
- F3. Data mapping: set `pike_b1` to `stars 2`, `stance 'hold'`, `energy 3/4`, and a `barrier` status; the plate for it shows a star element, the hold icon, three filled + one empty energy pips, and a status icon (DOM assertions plus a zoomed screenshot). A red unit with no extras has no plate until hovered (`__ui.state.hoverId = 'dreg'; __ui.refresh()`).
- F4. Territory: `__ui.territory.set('3,7','blue')` etc. changes marker colours (blue/red/neutral) after `__ui.refresh()`; a marker is hidden when a unit stands on it.
- F5. Performance: over 300 frames the plate module allocates no new DOM nodes (count `document.querySelectorAll('.plates *').length` before/after) and does not write style for a stationary camera (count `MutationObserver` records on `.plates` over 1s: at most 2 per plate).
- F6. Plate height at most 16px and every text/icon at least 10px; at most 30% overlap between visible plates in the default L layout (report the max pairwise overlap).
- F7. Plates track movement: move a unit with `__ui.units.moveAlong('pike_b1',[[3,8],[4,8]])`-style call or a click-move and confirm the plate follows within 1 frame (position equals the projected head point +- 2px).
- F8. Screenshots at L, S, P (P: plates still legible, fewer than 40% of the map hidden). `npm run build` passes.

## Ground rules (apply to every task)
- Project: `C:\Code\3D_game`, a Three.js + Vite fantasy tactics game. Read `CLAUDE.md` (layout section) and the design tokens at the top of `src/style.css` (`--panel`, `--gold`, `--ivory`, `--muted`, `--cyan`, `--blue`, `--red`, `--warm`, `--font-display` Cinzel, `--font-ui` Inter, `--edge`, `--touch`). Reuse them; do not invent a second palette. Read `docs/design_overhaul/DESIGN_BACKLOG.md` (your gap IDs) before starting.
- Background: the card-driven gameplay overhaul by another agent was never run in a browser. The baseline commit `35e6e42` fixed its load crash and split the HUD into template modules in `src/ui/*.js` + `src/ui/*.css`. Your job is the visual and layout design of one of those modules. **Do not change game behaviour.**
- **You may edit only the files listed under "Files you may edit"** (plus new files in `docs/design_overhaul/evidence/` whose names start with `after-TASK-00X-`, and your own log). You must not edit `src/ui.js`, `src/style.css`, `index.html`, `src/camera.js`, `src/game.js`, any other `src/ui/*` file, `DESIGN_BACKLOG.md`, `task_list.md` or another task's log. If your design needs a change there (a new field in the data `ui.js` passes in, a class on a shared element, a camera inset), do not make it: record it as an **integration request** in your log and final report and design so the page still works without it.
- **Contracts stay stable.** Exported function names and argument shapes, and the `data-*` attributes / `data-act` values that `ui.js` listens for (listed in each module's header comment), must keep working. You may add new markup, classes, `aria-*` attributes and new optional model fields (treat missing fields as absent).
- No new binary assets, no external fonts/libraries, no images: use CSS, inline SVG and unicode. Respect `@media (prefers-reduced-motion: reduce)`.
- Typography and targets (measured, see acceptance): no text below 10px anywhere in your module; text the player must read to act (names, costs, values, button labels) at least 11px, primary numbers at least 13px; interactive controls at least 32px in the smaller dimension (44px under `@media (pointer: coarse)`). Contrast of text on its background at least 4.5:1 (7:1 is not required).
- Viewports: **L** 1280x800, **S** 900x420 (short landscape), **P** 390x844 (portrait phone; `shot.mjs` emulates touch when width < height and < 700). The three layouts are separate `@media` blocks in your CSS; the query strings to copy are already at the bottom of your CSS file. No horizontal page scroll at any of them.
- Verification tools (the Vite dev server is **already running on port 5173**; do not start another; if connections are refused, stop and report a blocker):
  - Screenshot: `node tools/shot.mjs docs/design_overhaul/evidence/after-TASK-00X-name.png 1280 800 "" 10000` (wait 10s so sprites load). `STEPS` env var scripts input, e.g. `STEPS='[["eval","document.querySelectorAll(\".plan-card\")[2].click()"],["wait",500]]'`; `eval` is synchronous only and prints its JSON result. Look at every screenshot with the Read tool.
  - Dev-only state access on the page: `window.__ui` = `{ state, feed, plates, commands, refresh, territory, units, cardState (get/set), skillLoadouts (get/set) }`; `window.__game` = `{ THREE, scene, camera, renderer, units }`. After changing `__ui.cardState` or `__ui.state`, call `__ui.refresh()`.
  - Useful states: click a hand card via `document.querySelectorAll('.plan-card')[i].click()`; `document.querySelector('[data-act=targetSpell]').click()`; `[data-act=resolve]` runs a battle (about 6s). Query flags: `select=brenna`, `act=inspect`.
  - Measure with `eval`, e.g. `JSON.stringify([...document.querySelectorAll('.plan-card *')].map(e=>parseFloat(getComputedStyle(e).fontSize)).filter(x=>x<11))`.
  - `npm run build` must pass at the end; `node --check <file>` for each JS file you touch. Zero page errors in every screenshot run (`shot.mjs` prints "page errors:" if any).
- Log: append one line per milestone to your log with an ISO timestamp, `YYYY-MM-DDTHH:MM:SSZ <task>: <what/verified>`. Never rewrite earlier lines. Do not touch other logs.
- Final report (your last message, under 300 words): what you built, the measured results against each acceptance criterion (pass/fail with numbers), screenshot filenames, integration requests, blockers. Do not claim a criterion you did not measure.
