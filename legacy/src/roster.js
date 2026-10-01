import {STAR_STAT_GROWTH,UPGRADE_POPULATION_BY_STARS} from './upgrades.js';
// Unit data: class templates, the starting roster and record constructors. Plain data only (no
// Three.js), shared by the 3D view (src/units.js), the match controller and the Node simulator.

// `cls` picks the 3D model and portrait gear (models.js MODEL_SPECS); `title` is what the UI
// shows. Brenna and Dreg are the two named heroes. Everything else is an unnamed recruit: a class
// template (RECRUIT) plus a per-unit look, so more can be recruited in play the same way.
export const RECRUIT = {
  pikeman: { name: 'Pikeman', title: 'Recruit', lv: 2, hp: 24, str: 8, mag: 0, skl: 5, spd: 4, def: 9, res: 1, mov: 4, weapon: 'Iron Pike' },
  archer: { name: 'Archer', title: 'Recruit', lv: 2, hp: 18, str: 6, mag: 0, skl: 8, spd: 7, def: 3, res: 1, mov: 5, weapon: 'Longbow' },
  cavalier: { name: 'Cavalier', title: 'Recruit', lv: 3, hp: 24, str: 8, mag: 0, skl: 5, spd: 8, def: 7, res: 1, mov: 7, weapon: 'Iron Lance' },
};
// Culture variants (src/cultures.js): { base, name, title, delta, stats, weapon, passives, culture }. Empty in the game, so
// every recruit is a plain class template; a variant recruits as its base class (kits, sprites and movement follow `cls`).
export const VARIANTS = {};
export const registerVariants = (defs) => { for (const [key, d] of Object.entries(defs)) VARIANTS[key] = d; };
export const resetVariants = () => { for (const k of Object.keys(VARIANTS)) delete VARIANTS[k]; };
export const variantOver = (key) => {
  const v = VARIANTS[key];
  if (!v) return null;
  const t = { ...RECRUIT[v.base], ...(v.stats || {}) };
  for (const [stat, d] of Object.entries(v.delta || {})) t[stat] = (t[stat] ?? 0) + d;
  return { ...t, ...(v.name ? { name: v.name } : {}), ...(v.title ? { title: v.title } : {}), ...(v.weapon ? { weapon: v.weapon } : {}),
    variantId: key, ...(v.culture ? { culture: v.culture } : {}), ...(v.passives ? { passives: v.passives } : {}), ...(v.onDeath ? { onDeath: v.onDeath } : {}) };
};
const recruit = (cls, id, faction, c, r, look, over = {}) => {
  const t = { ...RECRUIT[cls], ...over };
  return { id, cls, classId: cls, variantId: t.variantId ?? cls, faction, c, r, name: t.name, title: t.title, lv: t.lv, hp: t.hp, maxHp: t.hp, str: t.str, mag: t.mag, skl: t.skl,
    spd: t.spd, def: t.def, res: t.res, mov: t.mov, weapon: t.weapon, look, stars: 1, population: 1, state: 'field', energy: 0, maxEnergy: 4,
    selectedAbilities: [], stance: t.stance ?? (cls === 'archer' ? 'hold' : 'advance'), cooldowns: {}, statuses: {},
    ...(t.culture ? { culture: t.culture } : {}), ...(t.passives ? { passives: t.passives } : {}), ...(t.onDeath ? { onDeath: t.onDeath } : {}) }; // stance matches UNIT_CARDS defaultStance
};

export const UNITS = [
  { id: 'brenna', name: 'Brenna', title: 'Paladin', cls: 'paladin', faction: 'blue', c: 5, r: 9, lv: 4,
    hp: 28, maxHp: 28, str: 9, mag: 0, skl: 5, spd: 3, def: 13, res: 1, mov: 4, weapon: 'Iron Sword',
    look: { skin: '#f0cdb4', hair: '#c9b6e6', eyes: '#5a64c8', style: 'long' } },
  recruit('pikeman', 'pike_b1', 'blue', 3, 9, { skin: '#e8b995', hair: '#6b4226', eyes: '#4a6a9a', style: 'short' }),
  recruit('pikeman', 'pike_b2', 'blue', 4, 10, { skin: '#c68f63', hair: '#2b2018', eyes: '#4a3524', style: 'short' }),
  recruit('archer', 'archer_b1', 'blue', 1, 9, { skin: '#f0cdb4', hair: '#b5462b', eyes: '#3f7a4a', style: 'short' }),
  recruit('cavalier', 'cav_b1', 'blue', 3, 7, { skin: '#d9a57c', hair: '#3a2a1e', eyes: '#5a7a3a', style: 'short' }),

  { id: 'dreg', name: 'Dreg', title: 'Barbarian', cls: 'barbarian', faction: 'red', c: 10, r: 3, lv: 5,
    hp: 27, maxHp: 27, str: 9, mag: 0, skl: 4, spd: 2, def: 12, res: 0, mov: 4, weapon: 'Steel Axe',
    look: { skin: '#d8a98a', hair: '#9c4722', eyes: '#5b7088', style: 'long', beard: true } },
  recruit('pikeman', 'pike_r1', 'red', 9, 6, { skin: '#d8a98a', hair: '#2b2b2b', eyes: '#5a4a3a', style: 'short' }, { lv: 3 }),
  recruit('archer', 'archer_r1', 'red', 12, 4, { skin: '#e9c2a0', hair: '#1f1a24', eyes: '#8a2f3a', style: 'long' }, { weapon: 'Steel Bow' }),
  recruit('archer', 'archer_r2', 'red', 11, 1, { skin: '#c98d62', hair: '#7a5a3a', eyes: '#3a2a1a', style: 'short' }),
  recruit('cavalier', 'cav_r1', 'red', 12, 2, { skin: '#e0b090', hair: '#5a3820', eyes: '#6a4a2a', style: 'short' }, { weapon: 'Steel Lance', lv: 4 }),
];

const defaultLook = (cls) => UNITS.find((u) => u.cls === cls)?.look
  || { skin: '#d8a98a', hair: '#4a3524', eyes: '#3f7a4a', style: 'short' };

/** Build a persistent recruit record from the same class template used by the starting roster. */
export function createRecruitUnit(key, id, faction, c, r, over = {}) {
  const variant = variantOver(key);
  const cls = variant ? VARIANTS[key].base : key;
  if (!RECRUIT[cls]) throw new Error(`Unknown recruit class: ${key}`);
  return recruit(cls, id, faction, c, r, defaultLook(cls), { ...(variant || {}), ...over });
}

/** Prototype champion respawn: rebuild the named hero at full HP and empty combat resources. */
// Extra champions registered by cultures (src/cultures.js): id -> unit record template. Empty in the game.
export const CHAMPION_TEMPLATES = {};
export const registerChampions = (defs) => { for (const [id, d] of Object.entries(defs)) CHAMPION_TEMPLATES[id] = d; };
export const resetChampions = () => { for (const k of Object.keys(CHAMPION_TEMPLATES)) delete CHAMPION_TEMPLATES[k]; };
/** A champion unit record for a registered champion id, placed at c, r for `faction`. */
export function createChampionUnit(id, faction, c, r) {
  const t = CHAMPION_TEMPLATES[id];
  if (!t) throw new Error(`Unknown champion: ${id}`);
  return { ...structuredClone(t), id, faction, c, r, hp: t.maxHp, stars: 1, population: 1, state: 'field', energy: 0, maxEnergy: 4,
    selectedAbilities: [], stance: 'advance', cooldowns: {}, statuses: {}, champion: true };
}
export function createHeroRespawnData(id, c, r) {
  if (CHAMPION_TEMPLATES[id]) return { ...createChampionUnit(id, CHAMPION_TEMPLATES[id].faction ?? 'blue', c, r), planningMoved: false, done: false, moved: false };
  const hero = UNITS.find((unit) => unit.id === id && ['paladin', 'barbarian'].includes(unit.cls));
  if (!hero) throw new Error(`Unknown hero champion: ${id}`);
  return {
    ...structuredClone(hero), c, r, hp: hero.maxHp, energy: 0, maxEnergy: 4,
    cooldowns: {}, statuses: {}, selectedAbilities: [], stance: 'advance', state: 'field', population: 1,
    planningMoved: false, done: false, moved: false,
  };
}

/** Fresh same-grade recruitment, including stat growth. No recycled instance state is copied. */
export function createGradedRecruitUnit(cls,id,faction,stars=1) {
  const unit=createRecruitUnit(cls,id,faction,0,0);
  for(let tier=1;tier<stars;tier+=1) {
    for(const [stat,growth] of Object.entries(STAR_STAT_GROWTH)) {
      if(stat!=='hp'&&Number.isFinite(unit[stat])) unit[stat]+=growth;
    }
  }
  unit.hp=unit.maxHp;unit.stars=stars;unit.population=UPGRADE_POPULATION_BY_STARS[stars];
  return unit;
}
