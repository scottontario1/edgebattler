# TASK-005: Queued spells, upgrade prompts and the combine dialog

- **Gap IDs:** DES-008, DES-009
- **Wave / dependencies:** wave 2; depends on: TASK-002 (tray must leave `.planning` overflow visible and publish `--tray-h`)
- **Log (append only):** `docs/design_overhaul/task_log/TASK-005.log`

## Visual goal
Replace the inline tangle of tiny selects with a proper flow: queued spells as readable chips with a real cancel control, an unmissable "Combine" prompt when three copies exist, and a floating dialog (anchored above the tray) that lets the player choose the surviving copy and destination with big controls and shows a clear before/after preview.

## Context files to read first
- `src/ui/upgrade.js`, `src/ui/upgrade.css` (current)
- `src/ui/tray.js`, `src/ui/tray.css` (finished by TASK-002: where your fragments are placed; the tray footer is `.plan-foot`)
- `src/ui.js`: `renderPlanning` (the `choice` model incl. `records` and `preview`), `makeUpgradeChoices`, `applyUpgrade`, the planning `click`/`change` handlers
- `src/upgrades.js` `previewUpgrade` return shape (`ok`, `reason`, `stars`, `unit`, `population`, `supplyCost`)
- `docs/design_overhaul/evidence/before-landscape.png`, `before-portrait.png`; read the finished TASK-002 screenshots `after-TASK-002-*.png` for the tray look
- `docs/design_overhaul/DESIGN_BACKLOG.md` (gap descriptions and evidence)

## Files you may edit (exclusive ownership)
- `src/ui/upgrade.js`
- `src/ui/upgrade.css`

## Files you must not edit
`src/ui/tray.*`, `src/ui/hand.*`, other modules, `src/ui.js`, `src/style.css`.

## Styling and layout steps
1. `queuedHTML`: each queued spell is a chip with a spell glyph (inline SVG), spell name (12px), target name (11px muted) and a cancel button at least 28x28 (44x44 coarse) with `aria-label="Cancel <spell>"`; the chip row wraps to a scrollable single line (no vertical growth). Empty state renders nothing.
2. `upgradePromptsHTML`: a gold pill button "Combine <Name> x3" with a 3-star glyph; subtle pulse (respect reduced motion); at least 32px tall.
3. `upgradeChoiceHTML`: render a dialog `<div class="upgrade-dialog" role="dialog" aria-label="Combine units">` positioned `position: absolute; left: 0; right: 0 (or width 420px max, centred); bottom: calc(100% + 8px)` relative to `.planning` (which is `position: absolute`; if the dialog would be clipped, that is a TASK-002 contract failure: report it as a blocker). Contents: title "Combine <Name> x3 -> <N>★" (Cinzel 16px), a "Keep" segmented group (radio inputs with `data-upgrade-survivor`, one option per copy: name + id + hp) and a "Place" segmented group (radio inputs with `data-upgrade-destination`: "Reserve bench" / "Keep field tile", hidden when not possible), a before/after stat grid (HP, STR, DEF at least; read from `choice.records` and `choice.preview.unit`, tolerate missing fields), a population line ("Population 8 -> 6"), and buttons "Combine now" (`data-act="confirmUpgrade"`, primary) and "Cancel" (`data-act="cancelUpgrade"`). Radios must fire `change` with `.value` so `ui.js` keeps working with no edits. If `choice.ok` is false show `choice.summary` as a warning line and disable Combine now.
4. All text at least 11px (labels), values 13px; controls at least 36px tall (44 coarse). The dialog gets a scrim-free elevation (shadow + gold hairline), an entry animation of at most 160ms, and traps nothing (Esc is handled by `ui.js`).
5. Responsive: L max width 460px; S max width 420px and max-height 60% of the viewport height with internal scroll; P full width minus edges, max-height 55% of the viewport, internal scroll.

## Measurable acceptance criteria
- E1. Force the state: put three pikemen in the reserve via `__ui.cardState.reserves` (copy the shape of an existing reserve entry from `__ui.cardState` after recruiting one, or use `createRecruitUnit`-style records with `unitId:'pikeman'`, `stars:1`), `__ui.refresh()`: a `.upgrade-prompt` appears; clicking it opens `.upgrade-dialog`. Screenshots at L, S, P of the prompt and the open dialog.
- E2. The dialog is fully inside the viewport at L, S, P (rect within `0..innerWidth/innerHeight`), does not overlap the roster or objective at L, and is not clipped by the tray (its computed `overflow` ancestors: report the chain).
- E3. Choosing a different Keep radio and a different Place radio updates `__ui.state.upgradeChoice.survivorId` / `.destination` (through the unchanged `change` handler), and the preview text/stat grid re-renders.
- E4. `Combine now` and `Cancel` work through `data-act` (click each; state changes: `upgradeChoice` null after either).
- E5. Queued spells: queue Mend via the UI (select Mend card, "Choose target", click a blue unit) and screenshot: chip shows glyph, spell name, target; cancel button >= 28x28 (>= 44 coarse at P); clicking it restores the card (`__ui.cardState.hand` regains it).
- E6. No text below 10px in your markup; labels >= 11px; buttons/radios >= 36px tall (>= 44 coarse). Contrast >= 4.5:1 for label text (report method).
- E7. Zero page errors; `npm run build` passes.

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
