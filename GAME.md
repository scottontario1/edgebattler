# Chronicle of Ashvale — game spec

## Pitch
A fantasy turn-based tactics game on a square grid, in the spirit of Advance Wars (map control, terrain, clear turn phases) with Fire Emblem–style western-fantasy characters (portraits, classes, stats, weapon triangle).

## Core loop (planned)
Player phase: select unit → see blue move / red attack range → move → attack, wait or use item → end turn. Enemy phase: AI moves. Win by routing the enemy boss or seizing the castle.

## Units (current demo)
| Class | Move type | Range | Notes |
|---|---|---|---|
| Lord | foot | 1 | Lose if they fall |
| Knight | armor | 1 | High DEF, no mountains (no knights fielded in chapter I) |
| Paladin | armor | 1 | Brenna: sword; armored like a knight (design_assets/brenna paladin.png) |
| Barbarian | armor | 1 | Dreg: axe; armored like a knight (design_assets/dreg barbarian.png) |
| Archer | foot | 2 | Can't counter at range 1 |
| Mage / Shaman | foot | 1–2 | Magic hits RES |
| Cavalier | mounted | 1 | MOV 7, slowed by forest |
| Brigand / Warlord | foot / armor | 1 | Axes |

## Terrain
Plains, Road, Bridge (cost 1) · Forest (DEF +1, AVO +20, cost 2) · Mountain (DEF +2, AVO +30, cost 3, foot only) · Village · Castle (DEF +3) · River (impassable).

## Art direction
Illustrated 2.5D tactics (Fire Emblem / Unicorn Overlord / Triangle Strategy): heroic ~3.75-head figures, painted anime faces, matte cloth/fur, cel-shaded metal, inked outlines, bold silhouettes. The KayKit chibi bodies are being phased out; new characters are built on `tools/blender/humanoid.py`.

Previous notes:
Low-poly, flat-shaded procedural models; warm sunlight; parchment and gold UI; painted SVG bust portraits. Camera: orthographic, tilted 52°.

## Milestones (vertical slices)
1. ✅ Visual demo: map, units, portraits, hover card, range preview
2. Select, move and animate a unit along the path; end turn
3. Combat forecast + combat resolution (hit/crit/damage), HP changes, unit death
4. Simple enemy AI (charge nearest target in range)
5. Win/lose conditions, chapter intro/outro dialogue with portraits
6. Polish: sound, battle animation zoom-in, particle effects
