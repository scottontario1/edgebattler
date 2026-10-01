#!/usr/bin/env node
// Deterministic timing-profile comparison for the timed battle prototype.
// Usage: node tools/compare-timed-combat.mjs [seed-count]
import { resolveTimedBattle, TIMED_COMBAT_DEFAULTS, attackInterval } from '../src/timed-battle.js';

const seeds = Math.max(1, Number(process.argv[2]) || 100);
const templates = {
  pike: { cls: 'pikeman', hp: 24, maxHp: 24, str: 8, def: 9, spd: 4, range: [1, 1], stance: 'advance' },
  archer: { cls: 'archer', hp: 18, maxHp: 18, str: 6, def: 3, spd: 7, range: [2, 2], stance: 'hold' },
  cavalry: { cls: 'cavalier', hp: 24, maxHp: 24, str: 8, def: 7, spd: 8, range: [1, 1], stance: 'advance' },
  guard: { cls: 'guard', hp: 30, maxHp: 30, str: 7, def: 11, spd: 3, range: [1, 1], stance: 'hold' },
};
const unit = (id, faction, kind, c, r) => ({ id, faction, ...templates[kind], c, r, energy: 0, maxEnergy: 4, cooldowns: {}, selectedAbilities: [], statuses: {} });
const cases = [
  { name: 'duel-pike-v-cavalry', units: [unit('blue-pike', 'blue', 'pike', 2, 5), unit('red-cavalry', 'red', 'cavalry', 8, 5)] },
  { name: 'ranged-screen', units: [unit('blue-pike-a', 'blue', 'pike', 2, 4), unit('blue-pike-b', 'blue', 'pike', 2, 6), unit('blue-archer', 'blue', 'archer', 1, 5), unit('red-cav-a', 'red', 'cavalry', 9, 4), unit('red-cav-b', 'red', 'cavalry', 9, 6), unit('red-guard', 'red', 'guard', 10, 5)] },
  { name: 'hold-line', units: [unit('blue-cav-a', 'blue', 'cavalry', 2, 4), unit('blue-cav-b', 'blue', 'cavalry', 2, 6), unit('blue-pike', 'blue', 'pike', 1, 5), unit('red-guard-a', 'red', 'guard', 8, 4), unit('red-guard-b', 'red', 'guard', 8, 6), unit('red-archer', 'red', 'archer', 9, 5)] },
];
const profiles = [
  { name: 'three-beat-steady', config: { ...TIMED_COMBAT_DEFAULTS, duration: 18, tick: 0.25, skillTimes: [3, 9, 15], damageScale: 0.35 } },
  { name: 'two-beat-slower', config: { ...TIMED_COMBAT_DEFAULTS, duration: 18, tick: 0.25, skillTimes: [6, 13], damageScale: 0.3, acceleration: 0 } },
  { name: 'three-beat-accelerating', config: { ...TIMED_COMBAT_DEFAULTS, duration: 18, tick: 0.25, skillTimes: [3, 9, 15], damageScale: 0.3, acceleration: 0.3 } },
];
const forecastAttack = (a, d, from) => {
  const distance = Math.abs(from.c - d.c) + Math.abs(from.r - d.r);
  const range = a.range || [1, 1];
  return { atk: { can: distance >= range[0] && distance <= range[1], dmg: Math.max(1, (a.str || 1) - (d.def || 0) + 5), hit: 90, crit: 0 } };
};
function runOne(fixture, profile, seed, swap) {
  const units = fixture.units.map((u) => ({ ...u, faction: swap ? (u.faction === 'blue' ? 'red' : 'blue') : u.faction }));
  const result = resolveTimedBattle({ units, orders: {}, seed, forecastAttack, config: profile.config, attackInterval });
  const alive = result.units.filter((u) => u.hp > 0);
  const blue = alive.filter((u) => u.faction === 'blue'), red = alive.filter((u) => u.faction === 'red');
  const blueHp = blue.reduce((n, u) => n + u.hp, 0), redHp = red.reduce((n, u) => n + u.hp, 0);
  const damage = (side) => units.filter((u) => u.faction === side).reduce((n, u) => n + u.hp, 0) - result.units.filter((u) => u.faction === side).reduce((n, u) => n + u.hp, 0);
  const strikes = result.batches.flatMap((b) => (b.events || []).map((e) => ({ ...e, time: b.time }))).filter((e) => e.type === 'strike');
  const winner = blueHp === redHp ? 'draw' : blueHp > redHp ? 'blue' : 'red';
  return { winner, blueDamage: damage('blue'), redDamage: damage('red'), blueHp, redHp, attacks: strikes.length, hits: strikes.filter((e) => e.hit).length, firstStrike: strikes.length ? Math.min(...strikes.map((e) => e.time)) : result.duration, duration: result.duration };
}
for (const fixture of cases) {
  console.log(`\n${fixture.name} (${seeds} paired seeds)`);
  for (const profile of profiles) {
    const totals = { blueWins: 0, redWins: 0, draws: 0, blueDamage: 0, redDamage: 0, blueHp: 0, redHp: 0, attacks: 0, hits: 0, firstStrike: 0, duration: 0 };
    for (let seed = 1; seed <= seeds; seed += 1) for (const swap of [false, true]) {
      const r = runOne(fixture, profile, seed, swap);
      const blueWon = (r.winner === 'blue') !== swap;
      if (r.winner === 'draw') totals.draws += 1;
      else if (blueWon) totals.blueWins += 1;
      else totals.redWins += 1;
      totals.blueDamage += r.blueDamage; totals.redDamage += r.redDamage;
      totals.attacks += r.attacks; totals.hits += r.hits; totals.firstStrike += r.firstStrike; totals.blueHp += r.blueHp; totals.redHp += r.redHp; totals.duration += r.duration;
    }
    const n = seeds * 2;
    console.log(`${profile.name}: wins=${totals.blueWins}/${totals.redWins}/${totals.draws}; survivor HP=${(totals.blueHp / n).toFixed(1)}:${(totals.redHp / n).toFixed(1)}; avg attacks=${(totals.attacks / n).toFixed(1)}; first strike=${(totals.firstStrike / n).toFixed(1)}s; hit rate=${totals.attacks ? (100 * totals.hits / totals.attacks).toFixed(1) : 0}%; avg damage=${(totals.blueDamage / n).toFixed(1)}:${(totals.redDamage / n).toFixed(1)}; avg duration=${(totals.duration / n).toFixed(1)}s`);
  }
}
