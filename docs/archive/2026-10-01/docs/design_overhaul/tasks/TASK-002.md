> Historical snapshot archived 2026-10-01. Earlier revisions/proposals, not current main. [Current docs index](../../../../../README.md).

# TASK-002: Planning tray shell: ledger, collapse, battle lock, height budget

- **Gap IDs:** DES-003 (tray), DES-006 (locked state), DES-011
- **Wave / dependencies:** wave 1; depends on: None
- **Log (append only):** `docs/design_overhaul/task_log/TASK-002.log`

## Visual goal
Turn the planning tray into a compact command bar. It shows Supply, Population, Reserve and Locations as a readable ledger, can be collapsed to a single row, visibly locks during battle, and keeps a fixed height budget so the rest of the HUD and the camera can position themselves from its measured height. Other modules render into its slots (hand, reserves, detail, queued spells, upgrade prompts, upgrade choice, loadouts); do not change what they render.

## Context files to read first
- `src/ui/tray.js`, `src/ui/tray.css` (current shell) and the style rules in `src/style.css` for `.actions`, `.dock` (read only)
- `src/ui.js`: `renderPlanning` (the model `m` it builds and passes to `trayHTML` / `applyTrayState`), the `commands.toggleTray` command (its `data-act="toggleTray"` hook already exists)
- `src/camera.js` `insets()` (read only: it will use your `trayInset()`)
- `docs/design_overhaul/evidence/before-landscape.png`, `before-short.png`, `before-portrait.png`, `before-battle.png`
- `GAME.md` sections on Supply, Population, reserve capacity
- `docs/design_overhaul/DESIGN_BACKLOG.md` (gap descriptions and evidence)

## Files you may edit (exclusive ownership)
- `src/ui/tray.js`
- `src/ui/tray.css`

## Files you must not edit
`src/ui/hand.*`, `src/ui/upgrade.*` and all other modules (they fill your slots), `src/ui.js`, `src/style.css`, `src/camera.js`.

## Styling and layout steps
1. Ledger row (height at most 40px): Supply as a gold gem + number (at least 20px display font) + label "Supply"; Population as `5/10` (14px+) with a 48x6px meter bar under or beside it (fill = pop/cap; turns `--warm` at 80%+, red at cap); Reserve `n/8` and Locations `n` as compact labelled chips (11px+ labels). Separators are hairlines, not empty space.
2. Prompt: the `m.prompt` sentence right-aligned in the ledger row, 11px+, one line with ellipsis and a `title` with the full text; at P it must not disappear: it moves to a second line inside the tray only when it fits the height budget, otherwise it shows as a `title` plus an ellipsised single line under the ledger.
3. Collapse: a toggle button `<button class="tray-toggle" data-act="toggleTray" aria-expanded aria-controls="planning-body">` (chevron icon, at least 32x32, 44x44 coarse) in the ledger. Collapsed (`.planning.collapsed`): only the ledger row is visible (height at most 44px) and the strips are `display: none` (use a wrapper `#planning-body` you add in `trayHTML`).
4. Lock: `.planning.locked` (battle phase): the body strips get `opacity <= 0.55`, `pointer-events: none`, `filter: saturate(0.6)`; the prompt slot shows "Battle in progress" (add that text to `trayHTML` when `m.phase !== 'player'`); a 2px animated gold progress stripe along the top edge (respect reduced motion).
5. Height budget (`#planning` `offsetHeight`, expanded): at most 172px at L, 150px at S, 190px at P; collapsed at most 44px. The body is a flex column that gives the hand strip all remaining height. Do **not** set `overflow: hidden` on `.planning` itself: TASK-005 anchors a combine dialog above it (`bottom: calc(100% + 8px)`); clip the inner strips instead.
6. Layout: L `left: edge`, `right: edge + 168px` (the action column is 150px wide plus gap); S right offset 58px (icon action column); P full width above the action row (`bottom: edge + touch + 5px`). Keep these positions in your CSS (the base file no longer positions the tray).
7. `applyTrayState` keeps setting `--tray-h` from `offsetHeight`; also run it on window `resize` and via a `ResizeObserver` (create the observer once, guarded by a module flag) so the variable stays correct when the tray content changes size. `trayInset()` returns the pixels from the screen bottom to the tray's top edge (already implemented; keep it correct while collapsed and under the P layout).
8. Panel look: keep the navy panel; increase separation between ledger and body with a hairline; hand strip on the left, reserve strip in a bordered inset on the right that is at least 120px wide at L.

## Measurable acceptance criteria
- B1. `#planning` `getBoundingClientRect().height` expanded is at most 172 (L), 150 (S), 190 (P); collapsed at most 44 at all three (measure with `__ui.commands.toggleTray()`).
- B2. `document.documentElement.style.getPropertyValue('--tray-h')` equals the rounded `offsetHeight` after: initial load, collapsing, expanding, selecting a card, and a window resize (report the five readings).
- B3. In the battle phase (`__ui.state.phase = 'battle'; __ui.refresh()`) the body has `pointer-events: none` and computed `opacity <= 0.55`, and the text "Battle in progress" is present; returning to `'player'` restores both.
- B4. The ledger: Supply number font-size at least 20px, Population value at least 14px, every other ledger text at least 11px; meter bar element width at least 40px and its fill width equals `pop/cap` within 2px (measure with `__ui.cardState.population` set to 0, 5, 10).
- B5. `.tray-toggle` is at least 32x32 at L and 44x44 at P, has `aria-expanded` that flips, and is keyboard-focusable with a visible focus ring.
- B6. Nothing inside the tray causes horizontal scroll of the page; the hand and reserve strips remain reachable (hand strip `clientWidth > 200` at L).
- B7. `trayInset()` evaluated from the console (import via `await import('/src/ui/tray.js')`) returns within 2px of `innerHeight - #planning.getBoundingClientRect().top`.
- B8. Screenshots at L, S, P in three states: expanded, collapsed, locked. Zero page errors; `npm run build` passes.

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
