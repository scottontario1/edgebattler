# What to look at when you review the UI

Run `npm run dev` and open http://localhost:5173. Check each of the three layouts: a normal desktop window (L), a window about 900x420 or a phone on its side (S), and a narrow/portrait window or phone (P). Before-screenshots are in `evidence/before-*.png`, after-screenshots in `evidence/int-*.png` and `evidence/after-TASK-*.png`.

## 1. First load
- The HUD appears at all (before this pass it crashed on load).
- Bottom tray shows **Supply / Population / Reserve / Locations** and five hand cards. Unit, spell and skill cards should look clearly different (blue, violet, gold top edge, "UNIT/SPELL/SKILL" labels) and each has a cost gem.
- Map is framed **above** the tray, not running under it.
- The unit card (Brenna) is bottom-right at L, above the tray, not over your army.
- Units carry small plates: stance icon and four energy diamonds on your units; stars on 2-star units; grey/blue/red pennants on villages and the keep.

## 2. Planning tray
- Click the chevron at the tray's top right: it collapses to one row and the map should grow back to fill the space. Expand again.
- At S the tray should start collapsed.
- Click each card type: the detail bar under the cards explains it (Barrier: pick a unit type and press Equip; Mend: press Choose target and click a blue unit; a unit card: press Recruit).
- Set supply to 0 mentally by buying things: an unaffordable card should dim and show "Short".
- Recruit a unit, then click its reserve card and click a highlighted tile next to your keep or a captured village to deploy.
- Check that nothing overlaps the tray at P and that the strips scroll sideways.

## 3. Combine (three of a kind)
- Recruit three of the same unit (for example three Archers, or Pikemen): a gold "Combine ... x3" pill appears.
- The dialog should open above the tray with Keep / Place choices and a before-to-after stat grid. Try each radio; Combine now and Cancel should both close it.

## 4. Spells and queue
- Queue Mend on a unit: a chip with the spell name and target appears with a cancel x. Cancelling returns the card to your hand.

## 5. Unit panels
- Hover units (the card follows the hover) and press I or click Inspect: the whole sheet should be visible above the tray, including Stance, Energy, Abilities, Statuses and Stars.
- Roster (top right at L, strip at P): star pips on upgraded units, stance dots, a red pulse on badly hurt units, grey for spent units.

## 6. Battle
- Press Resolve battle (or Enter). Expect: "Battle begins" banner, the phase pill turns crimson, the tray dims with "Battle in progress", floating numbers over units, then a "Planning" banner.
- Right column under the roster: a short log of what happened (captures, losses, respawn timer). It fades after about 7 seconds.
- Force an ending if you want to see the banners: in the console run `__ui.feed.banner('Victory','The enemy keep has fallen',0)`, and the same with `'Defeat'`.

## 7. Things I would look at critically
- **Density:** plates on every blue unit (stance + 4 energy diamonds) may be too much; the overlap-fading helps but tell me if you would rather show them only on hover/selection.
- **Phone layout (P):** the hand row is only about 60px tall and about two cards wide, and gets tighter when a skill loadout chip is showing. This is the weakest layout.
- **Short layout (S):** the tray starts collapsed so the map is usable; you must expand it to play cards.
- **Colour clash:** spell-target and deploy-target tiles still use the same cyan as movement range.
- **Unit card position at L:** it now sits bottom-right; if you prefer it back at the bottom-left, it is one rule in `src/style.css` (`.dock`).
- **Stance button:** still a plain "Stance - advance" button in the action column with no icon or colour change.
- **Reserve cards** show a glyph rather than the unit portrait.

## Console shortcuts for testing
`__ui.state`, `__ui.cardState` (get/set), `__ui.commands.toggleTray()`, `__ui.feed.pop('12','pike_b1')`, `__ui.territory.set('3,7','blue')` then `__ui.refresh()`.
