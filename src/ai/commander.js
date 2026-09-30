// AI commanders: decide one side's planning actions for a round. A commander never touches state
// directly; it calls `act(action)`, which is the match controller's `apply` (src/match.js), so AI
// moves are validated, logged and replayed exactly like a human's. Works for either faction.
//
//   const plan = COMMANDERS[name];   plan(match, faction, { act, params, rng })
//
// Policies: passive (baseline, does nothing), greedy (units only: most expensive affordable card,
// deployed nearest the front), heuristic (all card types, stances, withdraw, combine; tunable).
import { findTile } from '../board.js';
import { computeRange, MOVE_COST, MOVE_TYPE } from '../rules.js';
import { UNIT_CARDS, CARD_LIMITS, previewCycle } from '../cards.js';
import { findUpgradeMatches } from '../upgrades.js';

export const DEFAULT_PARAMS = Object.freeze({
  cycling: true,       // set false for matched-seed circulation comparisons
  mix: { pikeman: 0.5, archer: 0.3, cavalier: 0.2 }, // target share of the recruit army
  mendBelow: 0.6,       // Mend a unit under this HP ratio (and missing at least 6 HP)
  retreatBelow: 0.3,    // withdraw / fall back under this HP ratio
  wardMinThreats: 2,    // Ward a unit that at least this many foes can reach
  fireburstMin: 10,     // cast Fireburst only when it would deal at least this much total damage
  combineAtPop: 8,      // combine triples once population reaches this (frees slots)
  guardChampion: 1,     // units set to Protect the champion when foes are near it
  threatRange: 6,       // "near" for the champion guard
  seizeRatio: 1.3,      // march on the enemy keep when own field HP >= enemy field HP x this
  archerHoldRange: 5,   // archers hold while a foe is within this many tiles
});

const manhattan = (a, b) => Math.abs(a.c - b.c) + Math.abs(a.r - b.r);
const other = (f) => (f === 'blue' ? 'red' : 'blue');
const KEEP = { get blue() { return findTile('C'); }, get red() { return findTile('K'); } }; // follows the active map
const nearestFoeDistance = (m, f, c, r) => m.alive(other(f)).reduce((best, o) => Math.min(best, Math.abs(o.c - c) + Math.abs(o.r - r)), 99);

// Deploy a reserve on the legal tile closest to the enemy (greedy and heuristic share this).
function deployReserve(m, f, act, reserve) {
  const tiles = m.deploymentTiles(f)
    .filter(([c, r]) => m.canDeployAt(f, reserve.id, c, r).ok)
    .sort((a, b) => nearestFoeDistance(m, f, ...a) - nearestFoeDistance(m, f, ...b) || a[1] - b[1] || a[0] - b[0]);
  return tiles.length ? act({ type: 'deploy', faction: f, reserveId: reserve.id, c: tiles[0][0], r: tiles[0][1] }) : { ok: false };
}

function recruitAndDeploy(m, f, act, card) {
  const res = act({ type: 'recruit', faction: f, cardId: card.instanceId });
  if (!res.ok) return false;
  const reserve = m.sides[f].cards.reserves.find((u) => u.id === res.reserveId);
  deployReserve(m, f, act, reserve);
  return true;
}

export function passive() {}

export function greedy(m, f, { act }) {
  const order = ['cavalier', 'archer', 'pikeman'];
  for (let guard = 0; guard < 20; guard += 1) {
    const cards = m.sides[f].cards;
    if (m.population(f) >= CARD_LIMITS.populationCap) break;
    const card = order.map((id) => cards.hand.find((c) => c.type === 'unit' && c.unitId === id && c.cost <= cards.supply)).find(Boolean);
    if (!card || !m.deploymentTiles(f).some(([c, r]) => !m.unitAt(c, r))) break;
    if (!recruitAndDeploy(m, f, act, card)) break;
  }
}

export function heuristic(m, f, { act, params = {} }) {
  const P = { ...DEFAULT_PARAMS, ...params, mix: { ...DEFAULT_PARAMS.mix, ...(params.mix || {}) } };
  const side = () => m.sides[f];
  const hand = () => side().cards.hand;
  const supply = () => side().cards.supply;
  const mine = () => m.alive(f);
  const foes = () => m.alive(other(f));
  const champion = () => m.byId(m.champion(f));

  // 1. Combine triples once population is getting tight.
  if (m.population(f) >= P.combineAtPop) {
    for (const ids of findUpgradeMatches(m.armyRecords(f))) {
      const recs = ids.map((id) => m.armyRecords(f).find((u) => u.id === id));
      const field = recs.filter((u) => u.state !== 'reserve').sort((a, b) => b.hp - a.hp);
      const survivor = field[0] || recs.sort((a, b) => b.hp - a.hp)[0];
      act({ type: 'combine', faction: f, ids, survivorId: survivor.id, destination: field.length ? 'field' : 'reserve' });
    }
  }

  // 2. Withdraw badly hurt recruits standing on a controlled tile; they recover on the bench.
  for (const u of mine()) {
    if (u.id !== m.champion(f) && u.hp / u.maxHp < P.retreatBelow && m.canWithdraw(f, u)) act({ type: 'withdraw', faction: f, unitId: u.id });
  }

  // 3. Spells worth their Supply.
  const threatCount = new Map();
  for (const o of foes()) {
    const rr = computeRange(o, m.board(), o.mov);
    const reach = new Set([...rr.move, ...rr.attack].map(([c, r]) => `${c},${r}`));
    for (const u of mine()) if (reach.has(`${u.c},${u.r}`)) threatCount.set(u.id, (threatCount.get(u.id) || 0) + 1);
  }
  const castable = (id) => hand().find((c) => c.id === `spell-${id}` && c.cost <= supply());
  let card = castable('fireburst');
  if (card) {
    let best = null;
    for (const center of foes()) {
      for (const [dc, dr] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const at = { c: center.c + dc, r: center.r + dr };
        const score = foes().filter((o) => manhattan(o, at) <= 1).reduce((s, o) => s + Math.min(o.hp, 6), 0);
        if (!best || score > best.score) best = { ...at, score };
      }
    }
    if (best && best.score >= P.fireburstMin) act({ type: 'spell', faction: f, cardId: card.instanceId, c: best.c, r: best.r });
  }
  card = castable('mend');
  if (card) {
    const hurt = mine().filter((u) => u.maxHp - u.hp >= 6 && u.hp / u.maxHp < P.mendBelow).sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)[0];
    if (hurt) act({ type: 'spell', faction: f, cardId: card.instanceId, unitId: hurt.id });
  }
  card = castable('ward');
  if (card) {
    const target = mine().filter((u) => (threatCount.get(u.id) || 0) >= P.wardMinThreats)
      .sort((a, b) => (threatCount.get(b.id) || 0) - (threatCount.get(a.id) || 0) || a.hp - b.hp)[0];
    if (target) act({ type: 'spell', faction: f, cardId: card.instanceId, unitId: target.id });
  }

  // 4. Barrier on the most numerous recruit type.
  const skill = hand().find((c) => c.type === 'skill' && c.cost <= supply());
  if (skill) {
    const counts = {};
    for (const u of m.armyRecords(f)) if (UNIT_CARDS[u.cls]) counts[u.cls] = (counts[u.cls] || 0) + 1;
    const equipped = (t) => (side().loadouts[t] || []).some((x) => x.id === skill.skillId);
    const type = Object.entries(counts).filter(([t]) => !equipped(t)).sort((a, b) => b[1] - a[1])[0]?.[0];
    if (type) act({ type: 'equip', faction: f, cardId: skill.instanceId, unitType: type });
  }

  // Use the same one-per-round cycling action as the player, preserving duplicates.
  if(P.cycling && side().cards.cyclesRemaining>0) {
    const hurt=side().cards.reserves.find(u=>u.hp!=null&&u.hp/u.maxHp<P.retreatBelow
      && previewCycle(side().cards,{source:'bench',id:u.id}).ok);
    if(hurt) act({type:'cycle',faction:f,source:'bench',id:hurt.id});
    else {
      const unwanted=hand().find(c=> {
        if(!previewCycle(side().cards,{source:'hand',id:c.instanceId}).ok) return false;
        if(c.type==='skill') return ['pikeman','archer','cavalier'].every(cls=>(side().loadouts[cls]||[]).some(s=>s.id===c.skillId));
        if(c.type==='spell') return c.id==='spell-mend'&&mine().every(u=>u.hp===u.maxHp);
        const owned=m.armyRecords(f).filter(u=>u.cls===c.unitId&&(u.stars||1)===(c.stars||1)).length;
        const duplicates=hand().filter(o=>o.unitId===c.unitId&&o.stars===c.stars).length;
        return owned+duplicates<3 && (c.cost>supply()||owned/Math.max(1,m.armyRecords(f).length)>(P.mix[c.unitId]||0));
      });
      if(unwanted) act({type:'cycle',faction:f,source:'hand',id:unwanted.instanceId});
    }
  }

  // 5. Redeploy rested reserves, then recruit toward the target mix.
  for (const reserve of [...side().cards.reserves]) {
    if (reserve.hp == null || reserve.hp / reserve.maxHp >= 0.7) deployReserve(m, f, act, reserve);
  }
  for (let guard = 0; guard < 20; guard += 1) {
    const counts = {};
    let total = 0;
    for (const u of m.armyRecords(f)) if (UNIT_CARDS[u.cls]) { counts[u.cls] = (counts[u.cls] || 0) + 1; total += 1; }
    const room = CARD_LIMITS.populationCap - m.population(f);
    const affordable = hand().filter((c) => c.type === 'unit' && c.cost <= supply() && (UNIT_CARDS[c.unitId]?.population || 1) <= room);
    if (!affordable.length || !m.deploymentTiles(f).some(([c, r]) => !m.unitAt(c, r))) break;
    const deficit = (c) => (P.mix[c.unitId] || 0) - (counts[c.unitId] || 0) / Math.max(1, total + 1);
    affordable.sort((a, b) => deficit(b) - deficit(a) || b.cost - a.cost);
    if (!recruitAndDeploy(m, f, act, affordable[0])) break;
  }

  // 6. Stances and objectives.
  const hpOf = (list) => list.reduce((s, u) => s + u.hp, 0);
  const seize = hpOf(mine()) >= hpOf(foes()) * P.seizeRatio;
  const enemyKeep = KEEP[other(f)];
  const champ = champion();
  const champThreatened = champ && champ.hp > 0 && foes().some((o) => manhattan(o, champ) <= P.threatRange);
  const guards = champThreatened
    ? mine().filter((u) => u.id !== champ.id && u.cls === 'pikeman').sort((a, b) => manhattan(a, champ) - manhattan(b, champ)).slice(0, P.guardChampion).map((u) => u.id)
    : [];
  for (const u of mine()) {
    let want = { stance: 'advance' };
    const nearest = foes().reduce((best, o) => Math.min(best, manhattan(o, u)), 99);
    if (guards.includes(u.id)) want = { stance: 'protect', targetId: champ.id };
    else if (u.id !== m.champion(f) && u.hp / u.maxHp < P.retreatBelow && champ && champ.hp > 0) want = { stance: 'protect', targetId: champ.id };
    else if (u.cls === 'archer' && nearest <= P.archerHoldRange) want = { stance: 'hold' };
    else if ((seize || u.cls === 'cavalier') && enemyKeep && nearest > 3) want = { stance: 'advance', tile: enemyKeep };
    const same = u.stance === want.stance
      && (want.targetId ? u.objective?.targetId === want.targetId : true)
      && (want.tile ? u.objective?.type === 'tile' && u.objective.c === want.tile[0] && u.objective.r === want.tile[1] : want.stance !== 'advance' || !u.objective);
    if (!same) act({ type: 'stance', faction: f, unitId: u.id, ...want });
  }
  // Optional kit selections use the same validated, logged planning actions as the player.
  for(const u of mine()) {
    const near=foes().some(o=>manhattan(o,u)<=u.mov+2);
    const picks=[];
    if(u.cls==='pikeman') {picks.push('rally');if(near&&u.energy>=2&&u.hp/u.maxHp<0.8) picks.push('brace');}
    if(u.cls==='archer'&&near&&u.energy>=2) picks.push('focusedShot');
    if(u.cls==='cavalier') {
      if(near&&u.stance==='advance'&&u.energy>=2) picks.push('charge');
      if(u.hp<=u.maxHp/2&&u.energy>=(picks.length?3:1)) picks.push('secondWind');
    }
    if(JSON.stringify(picks)!==JSON.stringify(u.selectedAbilities||[])) act({type:'abilities',faction:f,unitId:u.id,abilityIds:picks});
  }
}

export const COMMANDERS = { passive, greedy, heuristic };

/** Run a commander for one side's planning stage. Returns the number of accepted actions. */
export function runCommander(m, faction, name, params = {}) {
  const plan = COMMANDERS[name];
  if (!plan) throw new Error(`Unknown commander: ${name}`);
  let accepted = 0;
  const act = (action) => { const res = m.apply(action, `ai:${name}`); if (res.ok) accepted += 1; return res; };
  plan(m, faction, { act, params });
  return accepted;
}

export { MOVE_COST, MOVE_TYPE };
