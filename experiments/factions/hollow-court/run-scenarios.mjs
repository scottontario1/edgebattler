// Single-player Hollow Court scenarios (docs/factions/HOLLOW_COURT.md), in the style of experiments/levels/levels.mjs:
// Blue = the Court player with a scripted plan, Red = a fixed script. Each scenario is played
//   N   naive: default stances, no skill picks, no spells
//   S   skilled: the scenario's plan
//   S-x skilled with one skill removed (per ability id and per tagged manoeuvre)
//   D*  skilled, on the SAME army with the death mechanics removed: all of them (D), or only corpses / Revenant / consume skills /
//       corpse-reading passives (D-corpse, D-revenant, D-consume, D-passive). Stats never change, so the difference is the mechanic.
//   B   the same roles filled by shipped classes (naive), to show the Court's units are not stronger on their own
// The question the scenarios answer is the faction's idea: does killing Court units remove their value? Every game reports the
// value that survived death (corpses made / eaten / expired, HP recovered, Revenant returns, damage dealt after a return).
//   node experiments/factions/hollow-court/run-scenarios.mjs [--seeds 400] [--replay 10] [--suite id] [--out docs/experiments/results/factions/hollow-court]
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createMatch } from '../../../src/match.js';
import { setMap, DEFAULT_MAP } from '../../../src/board.js';
import { setRarityGate } from '../../../src/cards.js';
import { ABILITY_CATALOG } from '../../../src/abilities.js';
import { registerCulture, resetCultures } from '../../../src/cultures.js';
import { UNITS, CHAMPION_TEMPLATES, createRecruitUnit, createChampionUnit, createGradedRecruitUnit } from '../../../src/roster.js';
import { unitCardFor, cardFor } from '../../../src/cards.js';
import { memoryLog, replay } from '../../../src/log.js';
import { buildHollowCourt } from '../../../src/factions/hollow-court.js';
import { courtSkillPicks } from './commander.mjs';

export const CULTURE_OPTIONS = {
  full: {},
  noDeath: { corpses: false, revenant: false, consume: false, corpsePassives: false },
  noCorpses: { corpses: false },
  noRevenant: { revenant: false },
  noConsume: { consume: false },
  noPassives: { corpsePassives: false },
};

const mapCache = new Map([['river_ford', DEFAULT_MAP]]);
export async function loadMaps(names) {
  for (const name of names) if (name && !mapCache.has(name)) mapCache.set(name, (await import(pathToFileURL(resolve('experiments/maps', `${name}.js`)).href)).default);
}

function rosterUnit(u) {
  let rec;
  if (CHAMPION_TEMPLATES[u.cls]) rec = createChampionUnit(u.cls, u.faction, u.c, u.r);
  else if (unitCardFor(u.cls)) rec = (u.stars || 1) > 1 ? createGradedRecruitUnit(u.cls, u.id, u.faction, u.stars) : createRecruitUnit(u.cls, u.id, u.faction, u.c, u.r);
  else rec = structuredClone(UNITS.find((x) => x.id === u.cls));
  rec.id = u.id; rec.faction = u.faction; rec.c = u.c; rec.r = u.r;
  if (u.stance) rec.stance = u.stance;
  if (u.facing) rec.facing = u.facing;
  if (u.role) rec.role = u.role;
  if (u.hp != null) rec.hp = u.hp;
  if (u.objective) rec.objective = { type: 'tile', c: u.objective[0], r: u.objective[1] };
  return rec;
}

/** Register the culture a definition asks for (or none for the shipped-class control). */
function setCulture(def) {
  resetCultures();
  setRarityGate({});
  if (def.culture) registerCulture(buildHollowCourt(CULTURE_OPTIONS[def.culture]));
}

export function buildMatch(def, seed, log = null) {
  setMap(mapCache.get(def.map || 'river_ford'));
  setCulture(def);
  const champions = def.champions || null;
  const m = createMatch({ seed, maxRounds: def.maxRounds ?? 14, log, roster: def.units.map(rosterUnit), ...(champions ? { champions } : {}), meta: { source: 'court-scenario', scenario: def } });
  for (const u of def.units) {
    const rec = m.byId(u.id);
    if (u.energy != null) rec.energy = Math.min(rec.maxEnergy, u.energy);
    if (u.abilities) rec.selectedAbilities = [...u.abilities];
  }
  let n = 0;
  for (const h of def.hand || []) for (let i = 0; i < (h.n || 1); i += 1) {
    const card = structuredClone(cardFor(h.key));
    card.instanceId = `card-hand-${h.faction}-${h.key}-${i}-${++n}`;
    m.sides[h.faction].cards.hand.push(card);
  }
  return m;
}

const matches = (u, step) => (step.unit ? u.id === step.unit : (u.cls === step.cls || u.variantId === step.cls || u.role === step.cls));
function applyStep(m, step) {
  const f = step.faction, actor = `script:${step.round}`;
  if (step.spell) {
    const card = m.sides[f].cards.hand.find((c) => c.id === `spell-${step.spell}`);
    if (card) m.apply({ type: 'spell', faction: f, cardId: card.instanceId, ...(step.unit ? { unitId: step.unit } : { c: step.c, r: step.r }) }, actor);
    return;
  }
  for (const u of m.alive(f).filter((x) => matches(x, step))) {
    if (step.stance) m.apply({ type: 'stance', faction: f, unitId: u.id, stance: step.stance, ...(step.tile ? { tile: step.tile } : {}), ...(step.targetId ? { targetId: step.targetId } : {}) }, actor);
    if (step.facing) m.apply({ type: 'facing', faction: f, unitId: u.id, facing: step.facing }, actor);
    if (step.abilities) {
      const ids = step.abilities.filter((id) => ABILITY_CATALOG[id]); // an ablated culture may not have the skill
      m.apply({ type: 'abilities', faction: f, unitId: u.id, abilityIds: ids }, actor);
    }
  }
}

/** Play one scenario game and summarise it, including the "value that survived death" counters. */
export function playScenario(def, seed, { keepLog = false } = {}) {
  const log = memoryLog();
  const m = buildMatch(def, seed, log.push);
  const factionOf = Object.fromEntries(def.units.map((u) => [u.id, u.faction]));
  const startHp = { blue: m.alive('blue').reduce((s, u) => s + u.hp, 0), red: m.alive('red').reduce((s, u) => s + u.hp, 0) };
  const startUnits = { blue: m.alive('blue').length, red: m.alive('red').length };
  const steps = def.script || [];
  while (!m.over) {
    for (const step of steps.filter((s) => s.round === m.round)) applyStep(m, step);
    // state-aware Court skill selection (see courtSkillPicks): a scripted rule-based player, not an optimiser
    if (def.adaptive) for (const { unitId, abilityIds } of courtSkillPicks(m, 'blue', { ban: def.adaptive.ban || [] })) m.apply({ type: 'abilities', faction: 'blue', unitId, abilityIds }, `script:${m.round}`);
    m.resolveRound();
  }
  const rounds = log.entries.filter((e) => e.t === 'round');
  const summaries = log.entries.filter((e) => e.t === 'summary');
  const batch = (r, type) => r.batches.filter((b) => b.type === type).flatMap((b) => b.events);
  const strikes = rounds.flatMap((r) => batch(r, 'combat').filter((e) => e.type === 'strike').map((e) => ({ ...e, round: r.round })));
  const dealt = { blue: 0, red: 0 };
  for (const s of strikes) dealt[factionOf[s.attackerId]] += s.damage;
  const alive = { blue: m.alive('blue'), red: m.alive('red') };
  let winner = m.winner || 'none';
  if (m.reason === 'army-destroyed' && !alive.blue.length && !alive.red.length) winner = 'mutual';
  const abil = rounds.flatMap((r) => batch(r, 'abilities'));
  const used = abil.filter((e) => e.applied);
  // value that survived death
  const results = rounds.flatMap((r) => batch(r, 'results').map((e) => ({ ...e, round: r.round })));
  const returns = results.filter((e) => e.type === 'return');
  const returnRound = new Map(returns.map((e) => [e.unitId, e.round]));
  const afterReturn = strikes.filter((s) => returnRound.has(s.attackerId) && s.round > returnRound.get(s.attackerId)).reduce((sum, s) => sum + s.damage, 0);
  // HP recovered (derived): per unit and round, hp now minus (hp before minus the damage it took), floored at 0. Includes Mend Bone.
  let healed = 0;
  for (let i = 1; i < summaries.length; i += 1) {
    const prev = new Map(['blue', 'red'].flatMap((f) => summaries[i - 1][f].unitState.map((u) => [u.id, u.hp])));
    const round = rounds[i - 1];
    const took = new Map();
    for (const s of strikes.filter((x) => x.round === round.round)) took.set(s.targetId, (took.get(s.targetId) || 0) + s.damage);
    for (const f of ['blue']) for (const u of summaries[i][f].unitState) {
      if (!prev.has(u.id) || returnRound.get(u.id) === round.round) continue;
      healed += Math.max(0, u.hp - (prev.get(u.id) - (took.get(u.id) || 0)));
    }
  }
  const out = {
    seed, winner, reason: m.reason, rounds: rounds.length,
    survivors: { blue: alive.blue.length, red: alive.red.length }, startUnits,
    hp: { blue: alive.blue.reduce((s, u) => s + u.hp, 0), red: alive.red.reduce((s, u) => s + u.hp, 0) }, startHp, dealt,
    blueDeaths: batch({ batches: rounds.flatMap((r) => r.batches.filter((b) => b.type === 'combat')) }, 'combat').filter((e) => e.type === 'death' && factionOf[e.unitId] === 'blue').length,
    keepRed: m.reason === 'keep-captured' && m.winner === 'red',
    corpsesMade: new Set(summaries.flatMap((s) => (s.objects || []).map((o) => o.id))).size,
    corpsesEaten: used.filter((e) => e.consumed).reduce((s, e) => s + e.consumed, 0),
    corpsesExpired: results.filter((e) => e.type === 'objectExpired').length,
    returns: returns.length, afterReturn, healed,
    abilityUses: used.length, energySpent: used.reduce((s, e) => s + e.cost, 0),
    planFails: log.entries.filter((e) => e.t === 'action' && !e.ok && String(e.actor).startsWith('script')).length,
  };
  if (keepLog) out.log = log;
  return out;
}

export function replayScenario(entries) {
  return replay(entries, { create: (h, push) => { const m = buildMatch(h.scenario, h.seed, push); return m; } });
}

// ---------------------------------------------------------------- CLI
const wilson = (k, n) => { const z = 1.96, p = k / n, d = 1 + z * z / n, c = (p + z * z / (2 * n)) / d, h = z * Math.sqrt(p * (1 - p) / n + z * z / (4 * n * n)) / d; return [Math.max(0, c - h), Math.min(1, c + h)]; };
const mean = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const pct = (x) => `${Math.round(100 * x)}%`;
const f1 = (x) => x.toFixed(1);
function summarise(results) {
  const n = results.length;
  const rate = (w) => results.filter((r) => r.winner === w).length / n;
  const blue = rate('blue');
  return { n, blue, red: rate('red'), mutual: rate('mutual'), none: rate('none'), blueCI: wilson(Math.round(blue * n), n),
    keepRed: results.filter((r) => r.keepRed).length / n,
    rounds: mean(results.map((r) => r.rounds)), surv: mean(results.map((r) => r.survivors.blue)), survRed: mean(results.map((r) => r.survivors.red)),
    hpBlue: mean(results.map((r) => r.hp.blue / r.startHp.blue)), hpRed: mean(results.map((r) => r.hp.red / r.startHp.red)),
    dealtBlue: mean(results.map((r) => r.dealt.blue)), dealtRed: mean(results.map((r) => r.dealt.red)),
    deaths: mean(results.map((r) => r.blueDeaths)),
    made: mean(results.map((r) => r.corpsesMade)), eaten: mean(results.map((r) => r.corpsesEaten)), expired: mean(results.map((r) => r.corpsesExpired)),
    returns: mean(results.map((r) => r.returns)), afterReturn: mean(results.map((r) => r.afterReturn)), healed: mean(results.map((r) => r.healed)),
    uses: mean(results.map((r) => r.abilityUses)), planFails: mean(results.map((r) => r.planFails)) };
}
const delta = (s, base) => {
  if (s === base) return '-';
  const d = s.blue - base.blue, se = Math.sqrt(s.blue * (1 - s.blue) / s.n + base.blue * (1 - base.blue) / base.n);
  return `${d >= 0 ? '+' : ''}${Math.round(100 * d)}pp${Math.abs(d) > 1.96 * se ? '' : ' (ns)'}`;
};

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const argv = process.argv.slice(2);
  const opt = (n, d) => { const i = argv.indexOf(`--${n}`); return i >= 0 ? argv[i + 1] : d; };
  const seeds = Number(opt('seeds', 400)), replayN = Number(opt('replay', 10)), only = opt('suite', 'all');
  const outDir = resolve(opt('out', 'docs/experiments/results/factions/hollow-court'));
  const { SUITES } = await import('./scenarios.mjs');
  const chosen = only === 'all' ? SUITES : SUITES.filter((s) => s.id === only);
  await loadMaps(new Set(SUITES.flatMap((s) => s.variants.map((v) => v.def.map))));
  mkdirSync(outDir, { recursive: true });
  let replayed = 0, replayFail = 0;
  const report = [];
  for (const suite of chosen) {
    const rows = [];
    let base = null;
    for (const variant of suite.variants) {
      const results = [];
      for (let seed = 1; seed <= seeds; seed += 1) {
        const res = playScenario(variant.def, seed, { keepLog: seed <= replayN });
        if (seed <= replayN) {
          const check = replayScenario(res.log.entries);
          replayed += 1;
          if (!check.ok) { replayFail += 1; console.error(`REPLAY MISMATCH ${suite.id} "${variant.label}" seed ${seed}`, JSON.stringify(check.mismatches[0]).slice(0, 300)); }
        }
        delete res.log;
        results.push(res);
      }
      const s = summarise(results);
      if (!base) base = s;
      const ref = variant.vs ? rows.find((x) => x.variant.label.startsWith(`${variant.vs} `))?.s : base;
      rows.push({ variant, s, delta: delta(s, ref || base) });
    }
    const L = [`### ${suite.title}`, '', `_${suite.question}_`, '', `${seeds} seeds per variant (seed drives every die and tie-break; the scenario is fixed). Blue = Court. Blue win has a 95% interval; the change is against the first variant, or against the variant a row names (ns = not significant at 95%).`, '',
      '| variant | Blue win | Red win | none | rounds | Blue survivors | Blue HP left | Red HP left | change in Blue win |', '|---|---|---|---|---|---|---|---|---|'];
    for (const { variant, s, delta: d } of rows) L.push(`| ${variant.label} | ${pct(s.blue)} (${pct(s.blueCI[0])}-${pct(s.blueCI[1])}) | ${pct(s.red)} | ${pct(s.none + s.mutual)} | ${f1(s.rounds)} | ${f1(s.surv)} / ${suite.blueUnits} | ${pct(s.hpBlue)} | ${pct(s.hpRed)} | ${d} |`);
    L.push('', 'Value that survived death (means per game):', '', '| variant | Court units lethally struck | corpses made | eaten | expired unused | HP recovered | Revenant returns | damage dealt after a return | skill uses | failed plan steps |', '|---|---|---|---|---|---|---|---|---|---|');
    for (const { variant, s } of rows) L.push(`| ${variant.label.split(' ')[0]} | ${f1(s.deaths)} | ${f1(s.made)} | ${f1(s.eaten)} | ${f1(s.expired)} | ${f1(s.healed)} | ${s.returns.toFixed(2)} | ${f1(s.afterReturn)} | ${f1(s.uses)} | ${f1(s.planFails)} |`);
    L.push('');
    report.push({ id: suite.id, text: L.join('\n'), data: rows.map((r) => ({ label: r.variant.label, ...r.s })) });
    console.log(L.join('\n'));
  }
  for (const r of report) { writeFileSync(join(outDir, `scenario-${r.id}.md`), `${r.text}\n`); writeFileSync(join(outDir, `scenario-${r.id}.json`), JSON.stringify(r.data, null, 1)); }
  console.log(`\nReplayed ${replayed} scenario logs from their headers: ${replayFail} mismatches`);
  if (replayFail) process.exit(1);
}
