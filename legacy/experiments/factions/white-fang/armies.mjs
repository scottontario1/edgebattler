// Starting armies and match construction for the White Fang experiments (paired simulations and tests).
//
// The shipped roster (src/roster.js UNITS) is Brenna + 2 Pikemen + Archer + Cavalier (blue) against Dreg + Pikeman + 2 Archers +
// Cavalier (red). Both named champions cannot be on the field at once (their ids are unique), so every army here is described by
// its kind and placed on a side:
//   'base'    plain classes, Brenna as champion (the baseline army the clans are measured against)
//   'baseDreg'plain classes, Dreg as champion (control: isolates what swapping the champion alone does)
//   'fang'    Dreg as champion (Blood Challenge kit), Pikemen -> White Fang Reavers, Archers -> Fang Hunters, the Cavalier stays
//   'fang2'   the same, with Dreg's mirror twin `dreg2` as champion (mirror matches only; needs registerMirrorChampion())
// Each side keeps the recruit positions of the shipped roster for its side, so the starting geometry is the shipped one.
import { registerCulture, unregisterCulture, culturePool } from '../../../src/cultures.js';
import { UNITS, createRecruitUnit, createChampionUnit } from '../../../src/roster.js';
import { initializeAbilityState } from '../../../src/abilities.js';
import { CULTURE_ID } from '../../../src/factions/white-fang.js';

const CLAN_CLASS = { pikeman: 'fangReaver', archer: 'fangHunter' };
const SLOT = { blue: { champion: [5, 9] }, red: { champion: [10, 3] } };
export const MIRROR_ID = 'fang-mirror';
export const MIRROR_CHAMPION = 'dreg2';

/** A second Dreg for mirror matches: same stats and weapon, own id, the same Blood Challenge / Warlord's Rush kit. */
export function registerMirrorChampion(fangDef) {
  const dreg = UNITS.find((u) => u.id === 'dreg');
  registerCulture({
    id: MIRROR_ID,
    champions: { [MIRROR_CHAMPION]: { name: 'Dreg (twin)', title: 'Barbarian', cls: 'barbarian', faction: 'red', look: dreg.look,
      stats: { hp: dreg.hp, str: dreg.str, skl: dreg.skl, spd: dreg.spd, def: dreg.def, res: dreg.res, mov: dreg.mov }, weapon: dreg.weapon } },
    abilities: fangDef.abilities.filter((a) => a.units?.includes('dreg')).map((a) => ({ ...a, id: `${a.id}2`, units: [MIRROR_CHAMPION] })),
  });
}
export const unregisterMirrorChampion = () => unregisterCulture(MIRROR_ID);

const dregRecord = (faction, id = 'dreg') => {
  const [c, r] = SLOT[faction].champion;
  const base = structuredClone(UNITS.find((u) => u.id === 'dreg'));
  return { ...base, id, faction, c, r, ...(id === 'dreg' ? {} : { name: 'Dreg (twin)', champion: true }) };
};
const brennaRecord = (faction) => {
  const [c, r] = SLOT[faction].champion;
  return { ...structuredClone(UNITS.find((u) => u.id === 'brenna')), faction, c, r };
};

/** Roster for one side. `kind` is base | baseDreg | fang | fang2. */
export function armyFor(kind, faction) {
  const recruits = UNITS.filter((u) => u.faction === faction && !['brenna', 'dreg'].includes(u.id));
  const champion = kind === 'base' ? brennaRecord(faction) : kind === 'fang2' ? dregRecord(faction, MIRROR_CHAMPION) : dregRecord(faction);
  const clan = kind === 'fang' || kind === 'fang2';
  const out = [champion];
  for (const u of recruits) {
    const key = clan && CLAN_CLASS[u.cls] ? CLAN_CLASS[u.cls] : u.cls;
    if (key === u.cls) { out.push(structuredClone(u)); continue; }
    const rec = createRecruitUnit(key, u.id, faction, u.c, u.r);
    rec.look = u.look;
    if (u.cls === 'archer') rec.weapon = u.weapon; // keep the side's own bow (red starts with a Steel Bow)
    out.push(rec);
  }
  return out.map((u) => initializeAbilityState(u));
}

/** Card pool for a side: the clan pool for 'fang'/'fang2', otherwise undefined (the shared pool). */
export const poolFor = (kind) => (kind === 'fang' || kind === 'fang2' ? culturePool(CULTURE_ID) : undefined);
export const championFor = (kind) => (kind === 'base' ? 'brenna' : kind === 'fang2' ? MIRROR_CHAMPION : 'dreg');

/** createMatch options for `blueKind` v `redKind`. */
export function matchOptions(blueKind, redKind) {
  const pools = {};
  if (poolFor(blueKind)) pools.blue = poolFor(blueKind);
  if (poolFor(redKind)) pools.red = poolFor(redKind);
  return { roster: [...armyFor(blueKind, 'blue'), ...armyFor(redKind, 'red')], champions: { blue: championFor(blueKind), red: championFor(redKind) }, ...(Object.keys(pools).length ? { pools } : {}) };
}
export { createChampionUnit };
