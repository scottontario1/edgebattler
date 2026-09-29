# TASK-004: Battle presentation: phase pill, banners, floating numbers, round results feed

- **Gap IDs:** DES-006
- **Wave / dependencies:** wave 1; depends on: None
- **Log (append only):** `docs/design_overhaul/task_log/TASK-004.log`

## Visual goal
Make the automatic battle readable. The player must see when the phase changes, what happened this round (captures, losses, heals, respawn timer, blocked draws) in a persistent but unobtrusive log, and get distinct banners for Battle begins, Planning, Victory and Defeat. Floating numbers must be legible over bright grass and distinguish damage, crits, misses, heals and status effects.

## Context files to read first
- `src/ui/feed.js` and `src/ui/feed.css` (current pop/banner/phase code)
- `src/ui.js`: `resolveBattle`, `showSpellEvents`, `checkEnd`, every place that sets `state.notice`, and where `pop(...)`, `banner(...)` and `feed.sync(...)` are called
- `docs/design_overhaul/evidence/before-battle.png`, `before-landscape.png`, `before-portrait.png`
- `src/style.css` `.turn`, `.objective`, `.roster` rules (read only: your feed panel must not overlap them)
- `docs/design_overhaul/DESIGN_BACKLOG.md` (gap descriptions and evidence)

## Files you may edit (exclusive ownership)
- `src/ui/feed.js`
- `src/ui/feed.css`

## Files you must not edit
`src/ui/*` other modules, `src/ui.js`, `src/style.css`, `index.html`. The words "Turn"/"Round" in `index.html` belong to root.

## Styling and layout steps
1. `sync(s)`: keep updating the turn number, the phase pill text/class and its `title`. Additionally: when `s.notice` changes to a new non-empty string, split it on ` · ` and push each part into the feed as an entry with an icon by keyword (Captured/Lost village = flag; fallen = skull; returns = crown; Hand full/blocked = card; Rally/heal = plus). Keep at most 4 entries visible; each fades out after 7s (pause the timer while hovered, no timer at all if `prefers-reduced-motion` keeps them until the next round begins). The feed is a `<div class="feed" role="log" aria-live="polite">` you create once and append to `document.querySelector('.hud')`.
2. Feed placement: L = right column under the roster panel (top about 148px, width 250px, right edge aligned with `.turn`); S = hidden except the newest single entry as a one-line chip at top-center under the objective; P = one-line strip under the roster strip, newest entry only, with a `+N` count button that expands the rest. It has `pointer-events: none` except on the P `+N` button. Do not overlap `.objective`, `.turn`, `.roster`, `#card`, `#planning` (rect checks).
3. Phase pill: Planning = blue as today; Battle = crimson with a 6px pulsing dot and the word "Battle"; while `s.busy` in the player phase (a move animation) no change. Add `Victory` (gold) / `Defeat` (grey-red) pill states when `s.over` is set (infer from the last banner kind).
4. `banner(text, sub, ms, kind)`: new optional fourth argument `kind`; when omitted infer from the text (`/victory/i` -> victory, `/defeat/i` -> defeat, `/battle/i` -> battle, else planning). Styles: battle = crimson bar with crossed-swords glyph, planning = blue bar, victory = gold bar with laurel-like ornament (CSS only), defeat = dark red bar; the title uses Cinzel 40-56px, subtitle 14px+; entry animation at most 350ms; `role="status"`. Victory/defeat (`ms === 0`) banners persist and include a visible "Restart (R)" button (`<button class="banner-restart" data-act="restart">`); because `ui.js` only wires `[data-act]` clicks on other containers, also attach a click listener to that button in `feed.js` that dispatches a `keydown` event for `r` on `window`.
5. `pop(text, id, cls)`: keep the signature. Improve legibility: 24px+ Cinzel, a dark 2px outline made with `-webkit-text-stroke` or layered `text-shadow`, damage = white with red outline, `.crit` = gold and larger with a small burst, `.miss` = grey italic, `.heal` = mint with a plus, add `.ward` and `.barrier` (cyan/gold), and stagger overlapping pops on the same unit (offset by 14px vertical per active pop on that unit, tracked in a `Map`). Pops must clamp to the viewport (never off-screen).
6. All entries and banners readable at contrast at least 4.5:1 against their backgrounds.

## Measurable acceptance criteria
- D1. Drive a real battle at L (`document.querySelector('[data-act=resolve]').click()`, wait 7s) and capture (a) mid-battle showing the Battle pill and a banner, (b) after: the Planning banner and at least one feed entry if the round produced any notice. Also call `__ui.feed.sync({phase:'player',turn:2,notice:'Captured village at 4,6 · Grunt fallen · Brenna returns in round 4 for 1 Supply',busy:false,over:false})` and screenshot: three entries with three different icons.
- D2. The feed never overlaps the objective, turn panel, roster, unit card or tray at L, S, P (report the rect checks for each pair, with numbers).
- D3. An entry disappears after 7s (poll `.feed .entry` count at 0s and 8s); with `prefers-reduced-motion` the entry persists until replaced (emulate through the CSS media only if you can; otherwise show the rule in the CSS and say so).
- D4. Banners: the four kinds are visually distinct (four screenshots via `__ui.feed.banner('Victory','The enemy keep has fallen',0)` etc.); Cinzel title at least 40px at L (32px at P); the restart button exists on victory/defeat, is at least 44px tall, and dispatches a `keydown` `r` (verify with a listener added in `eval`).
- D5. Pops: compute the text contrast of `.pop` against the worst-case background using the outline (report your method); call `__ui.feed.pop('12', 'pike_r1')` twice quickly: the two elements have different `top` values (at least 14px apart); a pop for a unit near the top edge is clamped inside the viewport (`top >= 12`).
- D6. `feed.sync` still updates `#turn-no` text and `#phase` class (`blue`/`red` and new states) exactly as before.
- D7. Zero page errors across all runs; `npm run build` passes.

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
