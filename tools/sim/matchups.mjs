// Analytic strike table from the shared combat forecast: damage, hit chance and expected damage of one
// strike for every attacker -> defender class pair on plains, forest and castle, plus how many
// successful strikes / expected strike-rounds a single attacker needs to kill.
//   node tools/sim/matchups.mjs [--stars 1,1] [--json]
import { forecast } from '../../src/combat.js';
import { UNITS, createRecruitUnit, createGradedRecruitUnit } from '../../src/roster.js';
import { LAYOUT, W, H } from '../../src/board.js';

const argv = process.argv.slice(2);
const starsArg = (argv[argv.indexOf('--stars') + 1] || '1,1').split(',').map(Number);
const tileOf = (letter) => { for (let r = 0; r < H; r += 1) { const c = LAYOUT[r].indexOf(letter); if (c >= 0) return [c, r]; } return null; };
const TERRAINS = [['plains', 'G'], ['forest', 'F'], ['castle', 'C']];
const mk = (cls, faction, stars) => {
  if (cls === 'brenna' || cls === 'dreg') return structuredClone(UNITS.find((u) => u.id === cls));
  return stars > 1 ? createGradedRecruitUnit(cls, `${faction}-${cls}`, faction, stars) : createRecruitUnit(cls, `${faction}-${cls}`, faction, 0, 0);
};
const CLASSES = ['pikeman', 'archer', 'cavalier', 'brenna', 'dreg'];
export function strikeTable(atkStars = 1, defStars = 1) {
  const rows = [];
  for (const a of CLASSES) for (const d of CLASSES) {
    for (const [name, letter] of TERRAINS) {
      const [tc, tr] = tileOf(letter);
      const atk = mk(a, 'blue', a === 'brenna' || a === 'dreg' ? 1 : atkStars);
      const def = mk(d, 'red', d === 'brenna' || d === 'dreg' ? 1 : defStars);
      def.c = tc; def.r = tr;
      const range = a === 'archer' ? 2 : 1;
      const from = [tc + (range === 2 ? 2 : 1), tr];
      const f = forecast(atk, def, from);
      const dmg = f.atk.dmg, hit = f.atk.hit / 100;
      const ev = dmg * hit + (f.atk.crit / 100) * hit * dmg * 2;
      rows.push({ atk: a, def: d, terrain: name, dmg, hit: f.atk.hit, crit: f.atk.crit, ev: +ev.toFixed(2), hp: def.hp,
        hitsToKill: dmg ? Math.ceil(def.hp / dmg) : Infinity, roundsToKill: ev ? +(def.hp / ev).toFixed(1) : Infinity });
    }
  }
  return rows;
}

if (import.meta.url === `file://${process.argv[1].replace(/\\/g, '/')}` || process.argv[1]?.endsWith('matchups.mjs')) {
  const rows = strikeTable(starsArg[0], starsArg[1]);
  if (argv.includes('--json')) console.log(JSON.stringify(rows, null, 1));
  else {
    console.log(`One strike, attacker stars ${starsArg[0]} vs defender stars ${starsArg[1]} (champions are 1 star). dmg = damage on a hit, ev = expected damage per strike, rounds = strike-rounds for one attacker to kill on average`);
    for (const [name] of TERRAINS) {
      console.log(`\n${name}:`);
      console.log('  attacker \\ defender'.padEnd(22) + CLASSES.map((c) => c.padStart(20)).join(''));
      for (const a of CLASSES) {
        console.log(`  ${a.padEnd(20)}` + CLASSES.map((d) => {
          const r = rows.find((x) => x.atk === a && x.def === d && x.terrain === name);
          return `${r.dmg}dmg ${String(r.hit).padStart(3)}% ev${r.ev.toFixed(1)} ${String(r.roundsToKill).padStart(4)}r`.padStart(20);
        }).join(''));
      }
    }
  }
}
