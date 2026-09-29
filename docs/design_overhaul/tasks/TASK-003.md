# TASK-003: Unit card, inspect sheet, roster strip, terrain chip, shared icon set

- **Gap IDs:** DES-003 (unit card), DES-005, DES-007, DES-009
- **Wave / dependencies:** wave 1; depends on: None
- **Log (append only):** `docs/design_overhaul/task_log/TASK-003.log`

## Visual goal
Show the new persistent unit state (stars, stance, energy, statuses) clearly in the unit card, the roster tiles and the inspect sheet, fix the inspect sheet being cut off, and create the shared inline-SVG icon vocabulary that the on-map plates (TASK-006) will reuse. Make the unit card compact so it costs less map area.

## Context files to read first
- `src/ui/unitpanels.js`, `src/ui/unitpanels.css` (current markup and styles)
- `src/units.js` (unit record fields: `stars`, `population`, `energy`, `maxEnergy`, `stance`, `abilityOrder`, `cooldowns`, `statuses` map, `state`)
- `src/abilities.js` (ability and status names/catalogs you can import for labels; read-only)
- `src/ui.js`: `renderCard`, `renderSheet`, `addRosterUnit`, `refresh` (how your functions are called and how roster buttons are decorated)
- `docs/design_overhaul/evidence/before-inspect.png`, `before-landscape.png`, `before-portrait.png`, `before-short.png`
- `docs/design_overhaul/DESIGN_BACKLOG.md` (gap descriptions and evidence)

## Files you may edit (exclusive ownership)
- `src/ui/unitpanels.js`
- `src/ui/unitpanels.css`
- `src/ui/icons.js`

## Files you must not edit
`src/ui/tray.*`, `src/ui/hand.*`, `src/ui/feed.*`, `src/ui/upgrade.*`, `src/ui/plates.*`, `src/ui.js`, `src/style.css`.

## Styling and layout steps
1. `src/ui/icons.js` (new, pure functions returning inline SVG strings, `currentColor` fills, viewBox 16x16, `aria-hidden`): `stanceIcon('advance'|'hold'|'protect')` (three clearly different silhouettes), `starPips(n, max=3)`, `energyPips(cur, max)` (filled/empty diamonds), `statusIcon('barrier'|'ward'|...)` with a generic fallback, `heartIcon`, `boltIcon`. Export a `ICONS` map too. Each icon must be legible at 12px. No fonts, no images.
2. Unit card (`unitCardHTML`): at most 96px tall at L and 84px at S/P, width at most 300px at L. Layout: portrait 60x72 (S/P 52x62), name + star pips + side tag, class/level line, HP bar (at least 8px tall, numeric `hp/max` at 12px+), then one row of state chips: stance chip (icon + word), energy pips, and one chip per active status (icon + short name, `title` with the full effect and duration). Missing fields (`stance`, `energy`, `statuses`) must simply omit the chip.
3. Faction colouring: blue/red top hairline stays; the bar colour follows faction as today.
4. Inspect sheet (`sheetHTML`): all content visible. Add `z-index: 6` (above the tray at 4) and a max-height of `calc(100% - 2*var(--edge) - var(--tray-h, 0px) - 8px)` so it never sits under the tray, with internal scrolling (`overflow: auto`) when needed. New rows below the stat grid: Stance (icon + word), Energy (pips + `n/max`), Abilities (from `abilityOrder`, names title-cased; "None" when empty), Statuses (chips), Stars/Population (`2★ · Pop 2`). Keep the existing stat grid, weapon row and close button (`data-act="close"`).
5. Roster (`rosterMiniHTML`, `decorateRoster`): tile 38x44 at L (44x48 under coarse pointer), portrait plus a star-pip overlay at the bottom-left when `stars >= 2`, a stance dot top-right for blue units, a red low-HP tick (`hp/maxHp < 0.35`, class `.low`) as a 3px inner border pulse. Keep `.done` (greyed) and `.dead` states. At P the strip stays a horizontal scroller.
6. Terrain chip: keep behaviour; type at least 11px; contrast check on the map (dark panel background).
7. Forecast (`forecastHTML`) keeps its content; raise `.fc-note` and labels to 11px and align its panel width to the card (300px L).
8. Do not position `.dock` (root owns it). Design the card to work both at the bottom-left (S) and at the bottom-right (L, root will move it there).

## Measurable acceptance criteria
- C1. Unit card height (`#card` `getBoundingClientRect().height`) at most 96px (L) and 84px (S, P) for Brenna (hero with energy) and for a recruit with a status; width at most 300px at L.
- C2. A unit with `stars: 2`, `stance: 'hold'`, `energy: 2/4` and `statuses: { barrier: ... }` (set on `__ui.units.byId.get('pike_b1').data`, then `__ui.refresh()`) shows a star element, a stance chip with an SVG icon, four energy pips (two filled), and a status chip. Chips are absent for a unit without those fields.
- C3. Inspect sheet at L and S: the bottom of `#sheet` is above the top of `#planning` (`sheet.bottom <= tray.top`), and every stat in the grid plus the weapon row is inside the viewport (screenshot plus rect check); it shows Stance, Energy, Abilities, Statuses, Stars.
- C4. Inspect sheet at P: bottom sheet, max-height 72%, all rows reachable by scrolling, close button at least 44x44.
- C5. Roster tiles: at least 38x44 at L; a star overlay on the 2-star unit; a `.low` tile when hp < 35%; `.done` and `.dead` still greyed (verify by toggling `data.done`, `data.hp = 0`).
- C6. `icons.js`: `stanceIcon` returns three visibly different SVG strings (compare the three outputs), all icon functions return valid inline SVG with `viewBox`; a render of all icons at 12px and 24px in one screenshot (build a temporary test via `document.body.insertAdjacentHTML` in the STEPS `eval`, screenshot it) shows them legible.
- C7. No text below 10px in `#card`, `#sheet`, `.roster`, `.chip` (measure); primary values (HP numbers, stat values) at least 12px.
- C8. Screenshots at L, S, P: card, forecast (`?select=cav_b1&act=attack`), inspect sheet, roster. Zero page errors; `npm run build` passes.

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
