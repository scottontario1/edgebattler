# TASK-001: Hand cards, reserve cards and card detail bar

- **Gap IDs:** DES-002, DES-008 (skill loadouts), DES-009
- **Wave / dependencies:** wave 1; depends on: None
- **Log (append only):** `docs/design_overhaul/task_log/TASK-001.log`

## Visual goal
Make the hand read like a hand of cards. Unit, spell and skill cards must be recognisable at a glance by colour and shape, show their cost as a clear badge, show affordability, and show their full effect text without clipping. Reserve cards become the same card family. The selected-card detail bar and the type-wide skill loadout controls become legible, properly sized controls.

## Context files to read first
- `src/ui/hand.js` (current templates) and `src/ui/hand.css`
- `src/cards.js` (`UNIT_CARDS`, `SPELL_CARDS`, `SKILL_CARDS`: what a card object contains: `type`, `name`, `class`, `stars`, `range`, `cost`, `effect`, `target`, `duration`, `defaultStance`, `instanceId`)
- `src/ui.js` `renderPlanning` (how your functions are called) and the `planning.addEventListener` click/change handlers (the `data-*` contract)
- `docs/design_overhaul/evidence/before-landscape.png`, `before-skill-selected.png`, `before-portrait.png`
- `src/portraits.js` only to know what the unit portrait SVG looks like (do not edit)
- `docs/design_overhaul/DESIGN_BACKLOG.md` (gap descriptions and evidence)

## Files you may edit (exclusive ownership)
- `src/ui/hand.js`
- `src/ui/hand.css`

## Files you must not edit
Everything else, in particular `src/ui/tray.*` (the tray shell and its height budget belong to TASK-002; your card height budget is 96px at L and 84px at S/P), `src/ui.js`, `src/style.css`.

## Styling and layout steps
1. Card anatomy (landscape): width 132-156px, height at most 96px, radius `--radius`. A 3px top edge in the card-type colour: unit = faction blue (`--blue`), spell = arcane violet-blue (choose one hex and use it consistently), skill = brass gold (`--gold`). Type label ("UNIT", "SPELL", "SKILL") in 10px uppercase letter-spaced text.
2. Portrait/glyph block at least 44px wide (portrait fills its block, cropped to the face); spell and skill glyphs become inline SVG icons (not the current unicode-on-diamond) that read at 24px.
3. Cost badge: a gem or circle at least 22px across in the top-right corner with the number at 13px bold and a tiny "S" or supply mark; unaffordable cards (model `!canAfford`) get `opacity` at most 0.7, desaturate, a red-tinted badge and a text "Short by N" is not required: a `Short` label at least 10px that does not overlap the cost.
4. Name 12-13px display font, one line with ellipsis and a `title` attribute of the full name; effect text 11px, two lines clamped, with the full text in `title` and always in the detail bar when the card is selected.
5. States: hover lifts 2px with brighter border, `.selected` gets a cyan 2px ring plus glow, `:focus-visible` outline, `:active` press. Transitions at most 120ms.
6. Reserve cards: same family, single row, with star pips (unicode ★ is fine), hp and energy as two small values (no 9px text), selected ring identical to the hand.
7. Detail bar (`detailHTML`): one clear row with name, class/effect line, "Equip for" control and the Equip button. Selects and buttons at least 32px tall (44px coarse), 12px text. Disabled state visibly disabled with a `title` saying why.
8. Loadouts (`loadoutsHTML`): each equipped skill as a chip with the type name, skill name, and a real move control (select + "Move" button at least 32px tall). The empty state "No type-wide skills equipped" at 11px, muted.
9. Responsive: S = cards 118px wide, 84px tall; P = cards 112px wide, at most 84px tall, horizontally scrollable strips with `scroll-snap-type: x proximity` and a visible fade on the clipped edge; hide the `Range` clause, never the name or cost.

## Measurable acceptance criteria
- A1. At L, the computed `font-size` of every element inside `.plan-card` and `.reserve-card` is at least 10px; the card name and cost number are at least 12px and 13px respectively (measure and list).
- A2. The three card types have three different computed top-border colours (measure `getComputedStyle(card).borderTopColor` or the ::before colour) and different label text.
- A3. No card name is clipped without ellipsis: for every `.plan-card b`, `scrollWidth <= clientWidth + 1` or `text-overflow: ellipsis` with a `title` equal to the full name. The Barrier effect text is fully readable in the detail bar when selected (screenshot).
- A4. An unaffordable card (set `__ui.cardState.supply = 0`, `__ui.refresh()`) has computed `opacity <= 0.7` and shows `Short` without overlapping the cost badge (bounding boxes do not intersect).
- A5. Card height at most 96px (L) and 84px (S, P); at P, the first card is fully visible with the second partially visible, and the strip scrolls horizontally (`scrollWidth > clientWidth`).
- A6. Every button/select in `.plan-detail`, `.skill-loadouts`, `.reserve-strip` is at least 32px tall at L (at least 44px under emulated coarse pointer at P: `shot.mjs` emulates touch, check the value).
- A7. Selecting a card, selecting a reserve (put one in via `__ui.cardState`), equipping Barrier and moving it to another type still work through the unchanged `data-*` hooks (click each once, confirm `__ui.state` / loadouts change).
- A8. Screenshots at L, S and P with (a) the default hand, (b) the skill card selected, (c) a reserve card present and selected, (d) an unaffordable state; all read as one family. Zero page errors; `npm run build` passes.

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
