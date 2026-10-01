// Star grades: what a three-of-a-kind upgrade adds to a unit's stats and how much population it costs.

export const UPGRADE_MAX_STARS = 3;

/** Population cost by star tier. */
export const UPGRADE_POPULATION_BY_STARS = Object.freeze({ 1: 1, 2: 2, 3: 3 });

/** Stat growth per extra star. Upgrades are a focused improvement, not a tripling of every stat. */
export const STAR_STAT_GROWTH = Object.freeze({
  maxHp: 8,
  hp: 8,
  str: 2,
  mag: 1,
  skl: 1,
  spd: 1,
  def: 2,
  res: 1,
  mov: 0,
});
