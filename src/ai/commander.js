// AI commanders: decide one side's planning actions for a round. A commander never touches state
// directly; it calls `act(action)`, which is the match controller's `apply` (src/match.js), so AI
// moves are validated, logged and replayed exactly like a human's. Works for either faction.
//
//   const plan = COMMANDERS[name];   plan(match, faction, { act, params, rng })
//
// Policies: passive (baseline, does nothing), greedy (units only: most expensive affordable card,
// deployed nearest the front), heuristic (all card types, stances, withdraw, combine; tunable).
import { findTile, inBounds, terrainAt } from '../board.js';
import { EXPERIMENT_RULES } from '../match.js';
import { computeRange, MOVE_COST, MOVE_TYPE } from '../rules.js';
import { UNIT_CARDS, CARD_LIMITS, previewCycle, unitCardFor } from '../cards.js';
import { categoryOf, metaOf } from '../categories.js';
import { weaponOf } from '../combat.js';
import { findUpgradeMatches } from '../upgrades.js';
import { ABILITY_CATALOG, ABILITIES, SPELL_CATALOG, selectedCost, kitFor } from '../abilities.js';

export const DEFAULT_PARAMS = Object.freeze({
  cycling: true,       // set false for matched-seed circulation comparisons
  mix: { pikeman: 0.5, archer: 0.3, cavalier: 0.2 }, // target share of the recruit army (shipped classes)
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
// Faction classes: a card's class (a variant recruits as its base class) and the target share of that class in the army.
const classOfCard = (c) => unitCardFor(c.unitId)?.base ?? c.unitId;
// Share for a class the `mix` param does not name (faction classes). Kept out of DEFAULT_PARAMS so shipped logs stay byte-identical.
const CATEGORY_MIX = { melee: 0.5, ranged: 0.3, mounted: 0.2, caster: 0.15, support: 0.1 };
const mixOf = (P, cls) => P.mix[cls] ?? (P.mixByCategory ?? CATEGORY_MIX)[categoryOf(cls)] ?? 0;
const isCultureAbility = (a) => !ABILITIES[a.id] && a.id !== 'setSpears' && a.id !== 'momentum';
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

// With the experimental Muster action on, a front-line unit with the energy places the reserve next to itself when that
// tile is clearly closer to the enemy than any deployment tile; otherwise the reserve deploys as usual.
function placeReserve(m, f, act, reserve) {
  const cfg = EXPERIMENT_RULES.muster;
  if (cfg) {
    const cost = MOVE_COST[MOVE_TYPE[reserve.unitId] || 'foot'];
    const deployBest = Math.min(99, ...m.deploymentTiles(f).filter(([c, r]) => m.canDeployAt(f, reserve.id, c, r).ok).map(([c, r]) => nearestFoeDistance(m, f, c, r)));
    let best = null;
    for (const u of m.alive(f)) {
      if ((cfg.classes && !cfg.classes.includes(u.cls)) || (u.cooldowns?.muster || 0) > 0 || (u.energy || 0) < cfg.cost) continue;
      for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const c = u.c + dc, r = u.r + dr;
        if (!inBounds(c, r) || m.unitAt(c, r) || cost[terrainAt(c, r)] === undefined) continue;
        const d = nearestFoeDistance(m, f, c, r);
        if (!best || d < best.d) best = { unitId: u.id, c, r, d };
      }
    }
    if (best && best.d <= deployBest - 2) {
      const res = act({ type: 'muster', faction: f, unitId: best.unitId, reserveId: reserve.id, c: best.c, r: best.r });
      if (res.ok) return res;
    }
  }
  return deployReserve(m, f, act, reserve);
}

function recruitAndDeploy(m, f, act, card) {
  const res = act({ type: 'recruit', faction: f, cardId: card.instanceId });
  if (!res.ok) return false;
  const reserve = m.sides[f].cards.reserves.find((u) => u.id === res.reserveId);
  placeReserve(m, f, act, reserve);
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
  // Faction spells (registered by a culture): friendly heals go to the most hurt unit, friendly status spells to the unit nearest the enemy.
  for (const c of [...hand()].filter((x) => x.type === 'spell' && !['spell-mend', 'spell-ward', 'spell-fireburst'].includes(x.id) && x.cost <= supply())) {
    const sp = SPELL_CATALOG[c.id.replace('spell-', '')];
    if (!sp || sp.target !== 'friendly-unit') continue;
    let target;
    if (sp.effect?.type === 'heal') target = mine().filter((u) => u.maxHp - u.hp >= Math.ceil(sp.effect.amount / 2)).sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)[0];
    else target = mine().filter((u) => foes().some((o) => manhattan(o, u) <= u.mov + 3)).sort((a, b) => Math.min(...foes().map((o) => manhattan(o, a))) - Math.min(...foes().map((o) => manhattan(o, b))))[0];
    if (target) act({ type: 'spell', faction: f, cardId: c.instanceId, unitId: target.id });
  }

  // 4. Barrier on the most numerous recruit type.
  const skill = hand().find((c) => c.type === 'skill' && c.cost <= supply());
  if (skill) {
    const counts = {};
    for (const u of m.armyRecords(f)) if (unitCardFor(u.cls)) counts[u.cls] = (counts[u.cls] || 0) + 1;
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
        const owned=m.armyRecords(f).filter(u=>(u.variantId??u.cls)===c.unitId&&(u.stars||1)===(c.stars||1)).length;
        const duplicates=hand().filter(o=>o.unitId===c.unitId&&o.stars===c.stars).length;
        return owned+duplicates<3 && (c.cost>supply()||owned/Math.max(1,m.armyRecords(f).length)>mixOf(P,classOfCard(c)));
      });
      if(unwanted) act({type:'cycle',faction:f,source:'hand',id:unwanted.instanceId});
    }
  }

  // 5. Redeploy rested reserves, then recruit toward the target mix.
  for (const reserve of [...side().cards.reserves]) {
    if (reserve.hp == null || reserve.hp / reserve.maxHp >= 0.7) placeReserve(m, f, act, reserve);
  }
  for (let guard = 0; guard < 20; guard += 1) {
    const counts = {};
    let total = 0;
    for (const u of m.armyRecords(f)) if (unitCardFor(u.cls)) { counts[u.cls] = (counts[u.cls] || 0) + 1; total += 1; }
    const room = CARD_LIMITS.populationCap - m.population(f);
    const affordable = hand().filter((c) => c.type === 'unit' && c.cost <= supply() && (unitCardFor(c.unitId)?.population || 1) <= room);
    if (!affordable.length || !m.deploymentTiles(f).some(([c, r]) => !m.unitAt(c, r))) break;
    const deficit = (c) => mixOf(P, classOfCard(c)) - (counts[classOfCard(c)] || 0) / Math.max(1, total + 1);
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
    ? mine().filter((u) => u.id !== champ.id && (u.cls === 'pikeman' || (categoryOf(u) === 'melee' && u.cls !== 'paladin' && u.cls !== 'barbarian' && u.cls !== 'pikeman'))).sort((a, b) => manhattan(a, champ) - manhattan(b, champ)).slice(0, P.guardChampion).map((u) => u.id)
    : [];
  for (const u of mine()) {
    let want = { stance: 'advance' };
    const nearest = foes().reduce((best, o) => Math.min(best, manhattan(o, u)), 99);
    if (guards.includes(u.id)) want = { stance: 'protect', targetId: champ.id };
    else if (u.id !== m.champion(f) && u.hp / u.maxHp < P.retreatBelow && champ && champ.hp > 0) want = { stance: 'protect', targetId: champ.id };
    else if ((u.cls === 'archer' || categoryOf(u) === 'ranged' || categoryOf(u) === 'caster' || categoryOf(u) === 'support') && nearest <= P.archerHoldRange) want = { stance: 'hold' };
    else if ((seize || u.cls === 'cavalier' || categoryOf(u) === 'mounted') && enemyKeep && nearest > 3) want = { stance: 'advance', tile: enemyKeep };
    // A faction class may prefer to hold (League) or press on (Fang) when nothing above applies (the keep march still applies).
    if (metaOf(u).aiStance === 'hold' && want.stance === 'advance' && !want.tile) want = { stance: 'hold' };
    const same = u.stance === want.stance
      && (want.targetId ? u.objective?.targetId === want.targetId : true)
      && (want.tile ? u.objective?.type === 'tile' && u.objective.c === want.tile[0] && u.objective.r === want.tile[1] : want.stance !== 'advance' || !u.objective);
    if (!same) act({ type: 'stance', faction: f, unitId: u.id, ...want });
  }
  // Optional kit selections use the same validated, logged planning actions as the player.
  for(const u of mine()) {
    const near=foes().some(o=>manhattan(o,u)<=u.mov+2);
    const picks=[];
    if(u.cls==='pikeman') {
      picks.push('rally');
      // Experimental kit (registered only by experiments/candidates): Set Spears when a Cavalier is coming.
      const horse=ABILITY_CATALOG.setSpears&&foes().some(o=>o.cls==='cavalier'&&manhattan(o,u)<=o.mov+2)&&u.energy>=ABILITY_CATALOG.setSpears.cost;
      if(horse) picks.push('setSpears');
      else if(near&&u.energy>=2&&u.hp/u.maxHp<0.8) picks.push('brace');
    }
    if(u.cls==='archer'&&near&&u.energy>=2) picks.push('focusedShot');
    if(u.cls==='cavalier') {
      if(near&&u.stance==='advance'&&u.energy>=2) picks.push('charge');
      if(u.hp<=u.maxHp/2&&u.energy>=(picks.length?3:1)) picks.push('secondWind');
    }
    if(u.cls==='cavalier'&&ABILITY_CATALOG.momentum&&near&&u.stance==='advance'&&selectedCost({selectedAbilities:picks})+ABILITY_CATALOG.momentum.cost<=u.energy) picks.push('momentum');
    culturePicks(m, f, u, picks, foes, mine, act);
    if(JSON.stringify(picks)!==JSON.stringify(u.selectedAbilities||[])) act({type:'abilities',faction:f,unitId:u.id,abilityIds:picks});
  }
}

/**
 * Faction abilities (any kit ability that is not a shipped one): chosen from the unit's kit by what the ability data says it needs, so every
 * culture is playable without AI code of its own. An ability is picked when it is affordable and off cooldown, its `requires` are met by the
 * unit's current stance, HP, tile and surroundings, and it has something to do (a foe in reach, a hurt friend, a corpse, a mark target).
 * No-op when no culture ability is registered, so classic games are unchanged.
 */
function culturePicks(m, f, u, picks, foes, mine, act) {
  const kit = kitFor(u).filter(isCultureAbility);
  if (!kit.length) return;
  const reach = (weaponOf(u).rng?.[1] ?? 1) + u.mov;
  const nearFoes = foes().filter((o) => manhattan(o, u) <= reach + 1);
  const engaged = nearFoes.length > 0;
  const friends = mine().filter((o) => o.id !== u.id);
  const hurtNear = (radius, min, self) => mine().some((o) => (o.id !== u.id || self) && manhattan(o, u) <= radius && o.maxHp - o.hp >= min);
  let spent = selectedCost({ selectedAbilities: picks });
  const worth = (a) => {
    const q = a.requires || {};
    if (q.stance && u.stance !== q.stance) return false;
    if (q.hpBelow !== undefined && !(u.hp < u.maxHp * q.hpBelow)) return false;
    if (q.hpAbove !== undefined && !(u.hp > u.maxHp * q.hpAbove)) return false;
    if (q.moved && !(u.stance === 'advance' && engaged)) return false;
    if (q.target && !engaged) return false;
    if (q.onControlled && m.territory.get(`${u.c},${u.r}`) !== f) return false;
    if (q.objectNear && m.objectsNear(u.c, u.r, q.objectNear.radius, q.objectNear.kind).length < (q.objectNear.min ?? 1)) return false;
    if (a.mark) {
      const targets = foes().filter((o) => manhattan(o, u) <= a.mark.radius);
      if (!targets.length) return false;
      const t = targets.find((o) => o.id === m.champion(other(f))) || targets.sort((x, y) => x.hp - y.hp)[0];
      act({ type: 'mark', faction: f, unitId: u.id, targetId: t.id });
      return true;
    }
    if (a.spawn) return u.stance === 'hold' && foes().some((o) => manhattan(o, u) <= 7);
    if (a.healAllies) return hurtNear(a.healAllies.radius, Math.min(4, a.healAllies.amount), a.healAllies.self);
    if (a.consume) return !a.consume.heal || hurtNear(a.consume.heal.radius, 3, true);
    if (a.grant) return engaged && (a.grant.self || friends.some((o) => manhattan(o, u) <= a.grant.radius));
    return engaged;
  };
  for (const a of [...kit].sort((x, y) => y.cost - x.cost || String(x.id).localeCompare(String(y.id)))) {
    if ((u.cooldowns?.[a.id] || 0) > 0 || spent + a.cost > (u.energy || 0) || picks.includes(a.id)) continue;
    if (worth(a)) { picks.push(a.id); spent += a.cost; }
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
