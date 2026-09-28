# Working rules for this project

- Stack: Three.js + Vite, plain JS modules in `src/`. Terrain, props and portraits are procedural (primitives + SVG). Unit models are CC0 KayKit GLBs in `public/models/kaykit/` (credit new assets in `CREDITS.md`); ask before adding other binary assets.
- Read `GAME.md` before starting a feature and build one milestone slice at a time.
- After each visible change: start the `vite` preview (`.claude/launch.json`), screenshot it, and check the console for errors before reporting done.
- Hover and click the affected units/tiles to verify interactions, not just the first frame.
- Commit after every working slice.
- Give sizes, colors and speeds as concrete numbers. Tiles are 1 world unit; the map is 16 x 12 (`src/map.js` LAYOUT).

## Layout
- `src/map.js`: terrain layout, tile meshes, props (trees, mountains, villages, castles, bridge), water and flag animation
- `src/textures.js`: high-res canvas textures (grass, dirt, rock, stone, wood, riverbed, water normal map)
- `src/main.js`: renderer + post-processing (GTAO ambient occlusion, bloom, SMAA, 1.5–2x supersampling); H toggles HD
- `src/units.js`: unit roster/stats and procedural low-poly figures (fallback; M toggles)
- `src/models.js`: loads KayKit GLB characters per unit (gear visibility, weapon attachment, idle animations)
- `src/portraits.js`: SVG bust portraits generated from each unit's `look`
- `src/ui.js`: cursor, hover/select, movement/attack range, unit card, terrain panel, roster
- `src/camera.js`: ortho camera, wheel zoom, right-drag pan
