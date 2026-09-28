# Chronicle of Ashvale — game spec

## Pitch
A fantasy turn-based tactics game on a square grid, in the spirit of Advance Wars (map control, terrain, clear turn phases) with Fire Emblem–style western-fantasy characters (portraits, classes, stats, weapon triangle).

## Core loop (planned)
Player phase: select unit → see blue move / red attack range → move → attack, wait or use item → end turn. Enemy phase: AI moves. Win by routing the enemy or seizing the castle.

## Units (current demo)
No named cast beyond two heroes. Everything else is an unnamed, recruitable troop class: a template in
`RECRUIT` (`src/units.js`) plus a per-unit look (skin, hair, eyes), built on the shared humanoid
(`tools/blender/humanoid.py`) in `tools/blender/build_recruits.py`. Either army fields them and they can
be recruited in play by instantiating the template.

| Class | Move type | Range | Notes |
|---|---|---|---|
| Pikeman (recruit) | foot | 1 | Pike (lance triangle), solid DEF |
| Archer (recruit) | foot | 2 | Can't counter at range 1 |
| Cavalier (recruit) | mounted | 1 | MOV 7, slowed by forest, rides the barded horse |
| Paladin, Brenna (named, blue) | armor | 1 | Sword; design_assets/brenna paladin.png |
| Barbarian, Dreg (named, red) | armor | 1 | Axe; design_assets/dreg barbarian.png |

Ideas for later classes on the same humanoid: mage, wyvern rider, knight, healer.

## Terrain
Plains, Road, Bridge (cost 1) · Forest (DEF +1, AVO +20, cost 2) · Mountain (DEF +2, AVO +30, cost 3, foot only) · Village · Castle (DEF +3) · River (impassable).

## Art direction
Illustrated 2.5D tactics (Fire Emblem / Unicorn Overlord / Triangle Strategy): heroic ~3.75-head figures, painted anime faces, matte cloth/fur, cel-shaded metal, inked outlines, bold silhouettes. Every character is built on `tools/blender/humanoid.py` (the old KayKit chibi bodies are gone).

Previous notes:
Low-poly, flat-shaded procedural models; warm sunlight; parchment and gold UI; painted SVG bust portraits. Camera: orthographic, tilted 52°.

## Milestones (vertical slices)
1. ✅ Visual demo: map, units, portraits, hover card, range preview
2. Select, move and animate a unit along the path; end turn
3. Combat forecast + combat resolution (hit/crit/damage), HP changes, unit death
4. Simple enemy AI (charge nearest target in range)
5. Win/lose conditions, chapter intro/outro dialogue with portraits
6. Polish: sound, battle animation zoom-in, particle effects
