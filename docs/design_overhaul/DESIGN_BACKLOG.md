# Design backlog: visual and UI overhaul after the card-driven gameplay pass

Scope: Luna's gameplay overhaul (`docs/gameplay_overhaul/`, commit `5633fdb`) replaced the manual Attack / Wait / End turn loop with a planning tray (hand, Supply, reserves, spells, skills, combine), a single "Resolve battle" command, persistent unit state (stance, energy, stars, statuses) and village ownership. It added about 1,000 lines of markup and 95 lines of CSS on top of the old HUD without a design pass. Luna could not run the game (`npm run build` failed on a WSL Node launcher), so none of it was ever seen in a browser.

Evidence lives in `docs/design_overhaul/evidence/` (`before-*.png` were captured against the fixed baseline; the raw crash has no screenshot). Viewports used everywhere: **L** = 1280x800 landscape, **S** = 900x420 short landscape, **P** = 390x844 portrait phone. Ownership: TASK-001..006 briefs are in `tasks/`; anything in `src/ui.js`, `src/style.css`, `index.html`, `src/camera.js`, `src/game.js` is root-owned integration (section at the end).

Severity: Critical = blocks play or use, High = core flow is hard to read or use, Medium = works but poor, Low = polish.

| ID | Sev | Gap | Task |
|---|---|---|---|
| DES-001 | Critical | UI crashes on load (`canAfford` never imported) | root, fixed |
| DES-002 | High | Hand cards are tiny, clipped and look identical | TASK-001 |
| DES-003 | High | Tray, unit card, sheet and camera framing collide | TASK-002, TASK-003, root |
| DES-004 | High | New persistent state is invisible on the map | TASK-006 |
| DES-005 | High | Inspect sheet is half hidden and omits the new state | TASK-003 |
| DES-006 | Medium | Battle has no readable results and the tray never reflects it | TASK-004, TASK-002 |
| DES-007 | Medium | Roster strip carries no state | TASK-003 |
| DES-008 | Medium | Combine, spell queue and skill loadouts are inline micro-controls | TASK-005, TASK-001 |
| DES-009 | Medium | Type below 10px and touch targets below 36px | TASK-001, 003, 005 |
| DES-010 | Low | Stale wording and hint bar hidden behind the tray | root |
| DES-011 | Low | Layout numbers hard-coded and out of sync | root, TASK-002 |
| DES-012 | Low | Stance control has no state affordance | root |

---

## DES-001 (Critical) UI crashes on load: `canAfford` is not imported
- **Screens:** everything. The HUD's first `refresh()` throws in `renderPlanning`, so no tray, card, roster or actions render; the 3D scene still draws.
- **Evidence:** `ReferenceError: canAfford is not defined at ui.js:354` (headless page error on every load of `5633fdb`). `src/ui.js` used `canAfford` in three places (`renderPlanning`, `renderActions`) but imported nothing for it from `cards.js`. Luna's logs record "browser-level gameplay unverified".
- **Change that caused it:** TASK-005 integration.
- **Status:** fixed in `35e6e42` (one import). Every other item below was found after that fix.

## DES-002 (High) Hand cards are tiny, clipped and look identical
- **Screens:** planning tray at L, S and P (`before-landscape.png`, `before-skill-selected.png`).
- **Evidence:**
  - Cards are 142x64 with 8-9px text (`.plan-cost` 8px, `.unaffordable` 8px, `small` 9px, `.skill-entry span` 8px). The Barrier text ends mid-word ("reduce incomin...") at every size.
  - Unit, spell and skill cards share one background and border; only Barrier gets a faint gold border. The type is only readable from a 24px glyph.
  - The cost is a corner caption; the "Short" flag is a second 8px caption in the opposite corner and the card does not change when it is unaffordable.
  - The portrait strip is 32x48 inside a 64px card, so a Pikeman and an Archer card differ only in the name line.
  - At P only two cards fit and the third is cut off with no scroll affordance.
- **Change that caused it:** `renderPlanning` template (TASK-005) plus the 95 CSS lines appended to `style.css`.

## DES-003 (High) Bottom-of-screen collisions: tray, unit card, inspect sheet, camera
- **Screens:** L, S, P.
- **Evidence:**
  - The tray is 134px tall at L (`before-landscape.png`) but `insets().bottom` in `camera.js` is still 118px (L) and 190px (P), values from before the tray existed. The map's front row runs under the tray at L; at P the map gets about 300px of a 844px screen (`before-portrait.png`).
  - The unit card (300x~100) and terrain chip float over the player's start area: at L the card covers the archer, two pikemen and the blue keep (`before-spell-target.png`).
  - `.dock` was moved up with a hard-coded `+150px` (uncommitted edit in the working tree), which does not follow the tray height.
  - The inspect sheet sits at `z-index: auto` under the tray (`z-index: 4`), so its stat grid and weapon row are cut off (`before-inspect.png`, also DES-005).
  - At S the tray covers the bottom half of the map (`before-short.png`).
- **Change that caused it:** the planning dock was added as a full-width bottom panel without updating camera insets, dock offsets or sheet stacking.

## DES-004 (High) New persistent state is invisible on the map
- **Screens:** battlefield at all sizes.
- **Evidence:** stance, energy, stars, statuses (Barrier, Ward) and village ownership exist only as text in the unit card. The map shows a hp bar and a faction ring, so a 2-star Pikeman, a Barrier-protected archer and a Hold-stance unit all look identical (`before-battle.png`). Villages and the keep show no owner after capture; `updateTerritory()` changes state and nothing else. The deploy-target and spell-target highlights reuse the cyan movement colour, so they look like movement range (`before-spell-target.png` shows cyan on all blue units for Mend).
- **Change that caused it:** persistent state added in `units.js`/`abilities.js`/`ui.js` with no in-world representation.

## DES-005 (High) Inspect sheet is half hidden and omits the new state
- **Screens:** inspect sheet (I) at L and S.
- **Evidence:** `before-inspect.png`: the sheet's bottom edge is under the tray, hiding the Str/Mag/Skl/Spd/Def/Res grid and the weapon row; only portrait, HP and MOV remain. Even when fully visible the sheet lists no stance, energy, ability order, statuses, star tier or population cost, which are the new core stats. The unit card shows only `EN` and `STANCE` as plain text.

## DES-006 (Medium) Battle results are unreadable and the tray ignores the phase
- **Screens:** L, P during and after "Resolve battle".
- **Evidence:** `before-battle.png`: the phase pill turns red but the tray stays fully bright and clickable-looking (`renderPlanning` runs regardless of phase; only the JS ignores clicks). Round results (captures, losses, respawn timer, blocked draws, Rally heals) are written to `state.notice`, which shows only as a single 10px ellipsised line in the tray prompt, or as a `title` tooltip on the phase pill. There is no log and no per-strike readout; the only in-battle feedback is a 1.1s "Battle begins" banner and floating numbers. Victory and Defeat use the same banner as "Planning".

## DES-007 (Medium) Roster strip carries no state
- **Screens:** roster grid (L, top right), strip (P).
- **Evidence:** ten identical portrait tiles; the only states are greyed-out (acted) and dead. Hero and recruit are indistinguishable except by portrait; there is no star, stance or low-HP marker, and the portrait strip does not show reserves at all. Tiles are 34x38 (below the 44px coarse-pointer target).

## DES-008 (Medium) Combine, spell queue and skill loadouts are inline micro-controls
- **Screens:** tray footer at L, S, P.
- **Evidence:** the combine flow is a single row containing two raw `<select>` elements, a truncated preview string, and two buttons, all 9-10px, squeezed into a 20px-high row that also holds the card detail bar and skill loadouts. The queued-spell cancel button is 17x17px. The skill transfer UI is a raw `<select>` + "Move" button inside a 320px chip. At P `.plan-detail small` and `.plan-prompt` are hidden to make room, so the player loses the explanation of what to do.

## DES-009 (Medium) Type below 10px and touch targets below 36px
- **Evidence:** 12 declarations at 8-9px in `hand.css`/`upgrade.css` (counted in the split CSS: `.plan-cost` 8, `.unaffordable` 8, `.skill-entry span` 8, `.no-skills` 8, `.queued-spell` 9, `.upgrade-choice label` 9 and 8 at P, `.upgrade-preview` 9, `.tag` 9). `.queue-cancel` 17px, skill `select`/`button` ~20px high, roster tiles 34x38. The HUD tokens set `--touch: 36px` (44px coarse) but none of the new controls use it.

## DES-010 (Low) Stale wording and hint bar
- `index.html` label says "Turn" (`#turn-no`) while `GAME.md` and the banners say "round". The hint bar at bottom-center is positioned at `bottom: edge + 2px`, i.e. underneath the tray at L, so it is never visible; its text still mentions removed keys.

## DES-011 (Low) Layout numbers hard-coded and out of sync
- `.dock` bottom `+150px`, portrait `+152px`, tray `min-height 130` / `max-height 156`, camera `insets()` 118/190 and short-landscape values were each typed separately. Baseline fix (`35e6e42`) drives `.dock` from `--tray-h`; `camera.js` still needs `trayInset()` (root integration).

## DES-012 (Low) Stance control has no state affordance
- Stance is a button in the action column that reads "Stance · advance" and flips to "hold" on click. There is no icon change, no colour difference, and no Protect option; the state is invisible outside the label.

---

## Root-owned integration (after the parallel tasks)
- `camera.js`: replace fixed bottom insets with `trayInset()` from `src/ui/tray.js`; re-measure on tray changes.
- `style.css`/`index.html`: dock placement, hint bar, "Round" wording, stance button styling (DES-010, DES-011, DES-012), z-order of sheet vs tray.
- `ui.js`: pass new `banner` kinds, the fuller `choice` model and any data the tasks request in their logs.
- Removal of dead rules left in `style.css` after the split.
