# Faction sprite assets

Current pipeline/coverage reviewed 2026-10-01. The earlier general asset research is [archived](../archive/2026-10-01/docs/asset-pipeline-plan.md).

`tools/assets/prep_faction_sprites.py` builds the faction runtime cutouts and card portrait thumbnails in `public/sprites/factions/`, with their shared lookup metadata in `public/sprites/factions-manifest.json`. It also writes identical metadata under `src/art/factions-manifest.json` for the renderer module, since Vite public assets are served by URL. It reads the original PNGs under `design_assets/factions/`; it never modifies the design sources. Runtime cutouts retain RGBA transparency and original colors. The pipeline trims transparent margins, Lanczos-downscales, and writes a separate square portrait crop for every entry. The manifest records source path, trim box, output size, foot anchor, foot span, visible height and portrait crop coordinates.

Human art is scaled so the marked head top to opaque boot line is 1.05 world units. Mounted art uses 1.38 units from rider head top to hoof line, preserving the horse and tack at their drawn size. Creature and armored giant entries are scaled by their whole opaque drawing height; their world heights are Rat 0.42, Spider 0.58, Hyena Goblin 1.05, Corpsehound 1.12, Werewolf 1.22, Moth Bear 1.30, Ogre 1.65, Relic Walker 1.65 and Bog Golem 1.75. These values are prototype presentation scales; no colors are globally recolored.

Faction ID mappings with matching supplied designs:

- Argent Crown: `crownPike` → pikeman sheet, `crownGuard` → infantry sheet, `oathsworn` → heavy infantry sheet, `crownArcher` → archer sheet, `crownCavalier` → cavalier sheet.
- White Fang: `fangReaver`, `fangAxeguard`, `fangBerserker`, and `fangHunter` each use their named sheets.
- Iron League: `pavise`, `coil`, `sapper`, and `relicWalker` use their named sheets.
- Hollow Court: `feralGhoul`, `necromancer`, `mourningKnight`, and `corpsehound` use their named sheets. Corpsehound has a runtime key although it is an enemy creature rather than a faction recruit.
- Monsters: `monsterRat`, `monsterSpider`, `monsterHyenaGoblin`, `monsterBogGolem`, `monsterOgre`, `monsterWerewolf`, and `monsterMothBear` use their named sheets.

No dedicated designs were supplied for Argent `bannerman` and `battleCleric`, White Fang `wolfRider` and `fangShaman`, Iron League `leaguePike`, `artificer`, and `dragoon`, or Hollow Court `graveguard`, `wight`, and `wraith`. These are not assigned a different character's art in this manifest. Champion-specific alternate designs were not supplied either; existing champion presentation remains the caller's choice. There are no red recolors for these new factions, since the designs have distinct native palettes and the old global blue-to-red transform would damage them.
