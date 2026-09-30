// Explain how games progress or stall. Reads the JSONL logs a simulator run wrote.
//   node tools/sim/inspect.mjs <run dir>            aggregate engagement profile over every game
//   node tools/sim/inspect.mjs <game.jsonl> [--board 1,5,10] [--events]   one game, round by round
// Aggregate output: how many rounds contain any strike, the round of first contact, kills per round,
// movement outcomes by reason, tile occupancy heat, strike hit/damage by attacker->target class.
// Single game output: per-round table (units, HP, strikes, deaths, holds) and ASCII boards.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fromJSONL } from '../../src/log.js';
import { LAYOUT, W, H } from '../../src/board.js';

const argv = process.argv.slice(2);
const target = resolve(argv.find((a) => !a.startsWith('--')) || '.');
const opt = (name) => { const i = argv.indexOf(`--${name}`); return i >= 0 ? argv[i + 1] : null; };
const isDir = statSync(target).isDirectory();
const files = isDir ? readdirSync(target).filter((f) => f.endsWith('.jsonl')).map((f) => join(target, f)) : [target];

const clsOf = (id) => (/pikeman|pike_/.test(id) ? 'pikeman' : /archer/.test(id) ? 'archer' : /cavalier|cav_/.test(id) ? 'cavalier' : id === 'brenna' ? 'paladin' : id === 'dreg' ? 'barbarian' : id.replace(/^\w+-u?r?\d+-/, ''));
const facOf = (id, summaryRow) => (summaryRow.blue.unitState.some((u) => u.id === id) ? 'blue' : summaryRow.red.unitState.some((u) => u.id === id) ? 'red' : null);
const mean = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const f1 = (x) => x.toFixed(1);

/** Facts about one game: per round strikes, deaths, holds, first contact and unit positions. */
function analyse(entries) {
  const header = entries.find((e) => e.t === 'header');
  const result = entries.find((e) => e.t === 'result');
  const rounds = entries.filter((e) => e.t === 'round');
  const summaries = new Map(entries.filter((e) => e.t === 'summary').map((s) => [s.round, s]));
  const table = [];
  const cls = new Map(); // unit id -> class, learned from summaries of the class-name-bearing ids
  const facByUnit = new Map();
  for (const s of summaries.values()) for (const f of ['blue', 'red']) for (const u of s[f].unitState) facByUnit.set(u.id, f);
  for (const rd of rounds) {
    const ev = Object.fromEntries(rd.batches.map((b) => [b.type, b.events]).reverse());
    const combat = rd.batches.filter((b) => b.type === 'combat').flatMap((b) => b.events);
    const movement = rd.batches.filter((b) => b.type === 'movement').flatMap((b) => b.events);
    const strikes = combat.filter((e) => e.type === 'strike');
    const s = summaries.get(rd.round);
    table.push({
      round: rd.round, strikes: strikes.length, hits: strikes.filter((x) => x.hit).length, dmg: strikes.reduce((a, x) => a + x.damage, 0),
      deaths: combat.filter((e) => e.type === 'death').length, pos: new Map(movement.map((e) => [e.unitId, [e.to.c, e.to.r]])), moves: movement.filter((e) => e.type === 'move').length,
      holds: movement.filter((e) => e.type === 'hold').length, holdReasons: movement.filter((e) => e.type === 'hold').map((e) => e.reason),
      moveTiles: movement.filter((e) => e.type === 'move').reduce((a, e) => a + (e.path?.length || 0), 0),
      units: s ? { blue: s.blue.units, red: s.red.units } : null, hp: s ? { blue: s.blue.hp, red: s.red.hp } : null,
      captures: rd.batches.flatMap((b) => b.events).filter((e) => e.type === 'capture').length, combat, movement, strikeEvents: strikes,
    });
  }
  return { header, result, table, summaries, facByUnit };
}

function board(summary) {
  const grid = LAYOUT.map((row) => [...row].map((t) => ({ G: '.', R: ':', W: '~', B: '=', F: '"', M: '^', V: 'v', C: '@', K: '$' }[t])));
  const sym = { pikeman: 'p', archer: 'a', cavalier: 'l', paladin: 'h', barbarian: 'h' };
  for (const f of ['blue', 'red']) for (const u of summary[f].unitState) {
    const ch = sym[clsOf(u.id)] || '?';
    grid[u.r][u.c] = f === 'blue' ? ch.toUpperCase() : ch;
  }
  return grid.map((row, r) => `${String(r).padStart(2)} ${row.join(' ')}`).join('\n') + `\n   ${[...Array(W).keys()].map((c) => String(c % 10)).join(' ')}`;
}

function single(file) {
  const a = analyse(fromJSONL(readFileSync(file, 'utf8')));
  const h = a.header;
  console.log(`${file}\nseed ${h.seed}  blue ${h.blue}  red ${h.red}  result ${a.result ? `${a.result.winner || 'draw'} (${a.result.reason}) after round ${a.result.round}` : 'unfinished'}`);
  console.log('round strikes hit dmg deaths moves(tiles) holds  units b/r   hp b/r   holds by reason');
  for (const t of a.table) {
    const reasons = {};
    for (const r of t.holdReasons) reasons[r] = (reasons[r] || 0) + 1;
    console.log(`${String(t.round).padStart(5)} ${String(t.strikes).padStart(7)} ${String(t.hits).padStart(3)} ${String(t.dmg).padStart(3)} ${String(t.deaths).padStart(6)} ${String(t.moves).padStart(5)}(${String(t.moveTiles).padStart(3)}) ${String(t.holds).padStart(5)}  ${t.units ? `${String(t.units.blue).padStart(3)}/${String(t.units.red).padEnd(3)}` : ''}  ${t.hp ? `${String(t.hp.blue).padStart(4)}/${String(t.hp.red).padEnd(4)}` : ''}  ${Object.entries(reasons).map(([k, v]) => `${k}:${v}`).join(' ')}`);
  }
  for (const r of (opt('board') || '').split(',').filter(Boolean).map(Number)) {
    const s = a.summaries.get(r);
    if (s) console.log(`\nEnd of round ${r}  (UPPER = blue, lower = red; p pike, a archer, l cavalier, h champion)\n${board(s)}`);
  }
  if (argv.includes('--events')) for (const t of a.table.filter((x) => x.strikes)) {
    console.log(`\nRound ${t.round} strikes:`);
    for (const e of t.strikeEvents) console.log(`  ${e.attackerId} -> ${e.targetId}: ${e.hit ? (e.crit ? 'CRIT ' : 'hit ') : 'miss'} ${e.damage}${e.flank && e.flank !== 'front' ? ` (${e.flank} +${e.flankBonus})` : ''}${e.warded ? ' [ward]' : ''}${e.braceReduction ? ` [brace -${e.braceReduction}]` : ''}${e.barrierReduction ? ` [barrier -${e.barrierReduction}]` : ''}`);
  }
}

function aggregate(files) {
  const games = files.map((f) => analyse(fromJSONL(readFileSync(f, 'utf8'))));
  const n = games.length;
  const maxRound = Math.max(...games.map((g) => g.table.length));
  console.log(`${n} games from ${target}`);
  // Engagement profile by round.
  console.log('\nRound  games  P(any strike)  mean strikes  mean deaths  mean units b/r   mean holds  mean moved tiles');
  for (let r = 1; r <= maxRound; r += 1) {
    const rows = games.map((g) => g.table[r - 1]).filter(Boolean);
    if (!rows.length) continue;
    if (r > 12 && r % 3 && r !== maxRound) continue;
    console.log(`${String(r).padStart(5)} ${String(rows.length).padStart(6)}  ${(100 * rows.filter((x) => x.strikes).length / rows.length).toFixed(0).padStart(11)}%  ${f1(mean(rows.map((x) => x.strikes))).padStart(11)}  ${f1(mean(rows.map((x) => x.deaths))).padStart(11)}  ${f1(mean(rows.map((x) => x.units.blue))).padStart(8)}/${f1(mean(rows.map((x) => x.units.red))).padEnd(6)}  ${f1(mean(rows.map((x) => x.holds))).padStart(10)}  ${f1(mean(rows.map((x) => x.moveTiles))).padStart(14)}`);
  }
  const firstContact = games.map((g) => (g.table.find((t) => t.strikes)?.round ?? null)).filter((x) => x != null);
  const quiet = games.map((g) => g.table.filter((t) => !t.strikes).length / Math.max(1, g.table.length));
  const strikeRounds = games.map((g) => g.table.filter((t) => t.strikes).length);
  console.log(`\nFirst strike: round ${f1(mean(firstContact))} on average (${firstContact.length}/${n} games ever fight)`);
  console.log(`Rounds with no strike at all: ${(100 * mean(quiet)).toFixed(0)}% of rounds; strike rounds per game ${f1(mean(strikeRounds))}`);
  const lateGames = games.filter((g) => g.table.length >= 20);
  if (lateGames.length) {
    const late = lateGames.flatMap((g) => g.table.slice(14));
    console.log(`Rounds 15+: strikes/round ${f1(mean(late.map((x) => x.strikes)))}, deaths/round ${(mean(late.map((x) => x.deaths))).toFixed(2)}, P(any strike) ${(100 * late.filter((x) => x.strikes).length / late.length).toFixed(0)}% (${lateGames.length} games)`);
  }
  // Movement outcomes.
  const reasons = {};
  let moves = 0;
  for (const g of games) for (const t of g.table) { moves += t.moves; for (const r of t.holdReasons) reasons[r] = (reasons[r] || 0) + 1; }
  const holds = Object.values(reasons).reduce((a, b) => a + b, 0);
  console.log(`\nMovement decisions: ${moves} moves, ${holds} holds (${(100 * holds / (moves + holds)).toFixed(0)}% of decisions)`);
  for (const [k, v] of Object.entries(reasons).sort((a, b) => b[1] - a[1])) console.log(`  ${String(v).padStart(7)}  ${k}`);
  // Strike table.
  const pair = {};
  for (const g of games) for (const t of g.table) for (const e of t.strikeEvents) {
    const key = `${clsOf(e.attackerId)} -> ${clsOf(e.targetId)}`;
    const p = (pair[key] ||= { n: 0, hit: 0, dmg: 0, flank: 0, dead: 0 });
    p.n += 1; p.hit += e.hit ? 1 : 0; p.dmg += e.damage; p.flank += e.flank && e.flank !== 'front' ? 1 : 0;
  }
  console.log('\nStrikes by class pair (observed)   n   hit%   dmg/strike   flank%');
  for (const [k, p] of Object.entries(pair).sort((a, b) => b[1].n - a[1].n)) console.log(`  ${k.padEnd(28)} ${String(p.n).padStart(5)}  ${(100 * p.hit / p.n).toFixed(0).padStart(4)}%  ${(p.dmg / p.n).toFixed(1).padStart(8)}  ${(100 * p.flank / p.n).toFixed(0).padStart(6)}%`);
  // Where strikes happen: across the river, on or beside the bridge, at a keep, or in open land.
  const kinds = { 'archer across water': 0, 'melee, attacker or target on bridge': 0, 'melee at a keep': 0, 'melee on land': 0, 'archer on land': 0 };
  let located = 0;
  const water = (c, r) => 'WB'.includes(LAYOUT[r]?.[c] ?? 'G');
  for (const g of games) for (const t of g.table) for (const e of t.strikeEvents) {
    const a = t.pos.get(e.attackerId), d = t.pos.get(e.targetId);
    if (!a || !d) continue;
    located += 1;
    const dist = Math.abs(a[0] - d[0]) + Math.abs(a[1] - d[1]);
    const tiles = [LAYOUT[a[1]][a[0]], LAYOUT[d[1]][d[0]]];
    if (dist === 2) {
      const mids = [[a[0], d[1]], [d[0], a[1]]].filter(([c, r]) => (c === a[0] && r === d[1]) || (c === d[0] && r === a[1]));
      const between = dist === 2 && (a[0] === d[0] || a[1] === d[1]) ? [[(a[0] + d[0]) / 2, (a[1] + d[1]) / 2]] : mids;
      kinds[between.some(([c, r]) => water(c, r)) ? 'archer across water' : 'archer on land'] += 1;
    } else if (tiles.includes('B')) kinds['melee, attacker or target on bridge'] += 1;
    else if (tiles.some((x) => x === 'C' || x === 'K')) kinds['melee at a keep'] += 1;
    else kinds['melee on land'] += 1;
  }
  console.log('\nWhere strikes happen (' + located + ' located strikes)');
  for (const [k, v] of Object.entries(kinds)) console.log(`  ${(100 * v / Math.max(1, located)).toFixed(0).padStart(3)}%  ${k}`);
  // Occupancy heat: share of unit-rounds spent on each tile, blue and red side by side.
  const heat = { blue: Array.from({ length: H }, () => Array(W).fill(0)), red: Array.from({ length: H }, () => Array(W).fill(0)) };
  let total = 0;
  for (const g of games) for (const s of g.summaries.values()) for (const f of ['blue', 'red']) for (const u of s[f].unitState) { heat[f][u.r][u.c] += 1; total += 1; }
  const glyph = (v) => (v === 0 ? '.' : v < total * 0.0015 ? '-' : v < total * 0.004 ? '+' : v < total * 0.01 ? '*' : '#');
  console.log('\nWhere units spend the game (share of unit-rounds: . none, - <0.15%, + <0.4%, * <1%, # more)  blue | red');
  for (let r = 0; r < H; r += 1) console.log(`${String(r).padStart(2)}  ${heat.blue[r].map(glyph).join(' ')}   |   ${heat.red[r].map(glyph).join(' ')}    ${LAYOUT[r]}`);
  // Keep pressure.
  // Resource and capacity pressure at each round end (planning has not started for the next round).
  console.log('\nResource and capacity pressure (share of round ends)     population  at cap(10)  hand size  hand full(8)  supply  supply>=6  reserves  spells in hand');
  for (const f of ['blue', 'red']) {
    const rows = games.flatMap((g) => [...g.summaries].filter(([r]) => r > 0).map(([, s]) => s[f]));
    const share = (fn) => `${(100 * rows.filter(fn).length / rows.length).toFixed(0)}%`;
    console.log(`  ${f.padEnd(5)} ${' '.repeat(50)} ${f1(mean(rows.map((s) => s.population))).padStart(6)}  ${share((s) => s.population >= 10).padStart(9)}  ${f1(mean(rows.map((s) => s.hand.length))).padStart(9)}  ${share((s) => s.hand.length >= 8).padStart(11)}  ${f1(mean(rows.map((s) => s.supply))).padStart(6)}  ${share((s) => s.supply >= 6).padStart(8)}  ${f1(mean(rows.map((s) => s.reserves.length))).padStart(8)}  ${f1(mean(rows.map((s) => s.hand.filter((c) => c.startsWith('spell')).length))).padStart(13)}`);
  }
  const KEEPS = keepTiles();
  console.log('\nKeep pressure (share of round ends, all games)');
  for (const f of ['blue', 'red']) {
    const enemy = f === 'blue' ? 'red' : 'blue';
    const [kc, kr] = KEEPS[f];
    let rows = 0, own = 0, foe = 0, adj = 0, within2 = 0, champ = 0, hpSum = 0;
    for (const g of games) for (const [round, s] of g.summaries) {
      if (round === 0) continue;
      rows += 1;
      const on = s[f].unitState.find((u) => u.c === kc && u.r === kr);
      if (on) { own += 1; hpSum += on.hp; if (on.id === (f === 'blue' ? 'brenna' : 'dreg')) champ += 1; }
      if (s[enemy].unitState.some((u) => u.c === kc && u.r === kr)) foe += 1;
      const dists = s[enemy].unitState.map((u) => Math.abs(u.c - kc) + Math.abs(u.r - kr));
      if (dists.some((d) => d === 1)) adj += 1;
      if (dists.some((d) => d <= 2)) within2 += 1;
    }
    const pc = (x) => `${(100 * x / rows).toFixed(0)}%`;
    console.log(`  ${f} keep ${kc},${kr}: defender on it ${pc(own)} (champion ${pc(champ)}, mean HP ${f1(hpSum / Math.max(1, own))}), enemy adjacent ${pc(adj)}, enemy within 2 ${pc(within2)}, enemy on it at round end ${pc(foe)}`);
  }
  console.log(`  keep captures: ${games.filter((g) => g.result?.reason === 'keep-captured').length}/${n} games; army-destroyed: ${games.filter((g) => g.result?.reason === 'army-destroyed').length}; draws: ${games.filter((g) => !g.result?.winner).length}`);
}

function keepTiles() {
  const out = {};
  for (let r = 0; r < H; r += 1) for (let c = 0; c < W; c += 1) { if (LAYOUT[r][c] === 'C') out.blue = [c, r]; if (LAYOUT[r][c] === 'K') out.red = [c, r]; }
  return out;
}

if (isDir) aggregate(files); else single(files[0]);
