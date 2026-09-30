// A thin League commander for the simulations. The shipped heuristic (src/ai/commander.js) does not know the League: it buys
// by the shipped class mix, sets every unit to Advance (archers to Hold near a foe), and overwrites skill picks with the shipped
// kit, so it never holds a killing ground, never picks Set Position / Prepared Position / Arc Burst / Dig In and never plays
// Field Repair or Flare. This commander plans one side through match.apply (logged and replayable like any other AI):
//
//   1. Buy the unit that fills the next empty slot of the map's killing ground (FORMATIONS), deploy it nearest that slot.
//   2. Walk every unit to its slot (planning move now, Advance with a tile objective for the rest of the way), then Hold and face the enemy.
//   3. Pick the League skills that fit (Set Position / Prepared Position / Arc Burst / Dig In / the champion's kit).
//   4. Cast Field Repair or Mend on a hurt unit, Flare on a Crossbowman with a target, Ward on a threatened plug, Fireburst on a clump.
//   5. Release the line and march on the enemy keep once the League holds a clear HP lead (seizeRatio) and keep marching while it stays ahead.
//
// It is a prototype policy, not a strong player: formations are hand-drawn per map (river_ford, choke_gap1), the release rule is a
// single HP ratio, and it ignores flanks. Report win rates with that in mind (docs/factions/IRON_LEAGUE.md).
import { computeRange, MOVE_COST, MOVE_TYPE } from '../../../src/rules.js';
import { findTile, inBounds, terrainAt, MAP } from '../../../src/board.js';
import { unitCardFor, CARD_LIMITS } from '../../../src/cards.js';
import { ABILITY_CATALOG, selectedCost } from '../../../src/abilities.js';

export const DEFAULT_LEAGUE_PARAMS = Object.freeze({
  seizeRatio: 2.0,     // release the line and march on the enemy keep when own field HP >= enemy field HP x this (a sweep in the results shows marching earlier loses more than it wins)
  keepMarching: 1.0,   // ... and keep marching until own HP falls below enemy HP x this
  repairBelow: 0.7,    // Field Repair / Mend a unit under this HP fraction (and missing at least the spell's heal, up to 4 / 8)
  wardMinThreats: 2,   // Ward a unit that at least this many foes can reach
  fireburstMin: 10,    // Fireburst only when it would deal at least this much damage in total
  useSkills: true,     // set false to play the same formation without League skill picks (ablation)
  useSpells: true,
  hold: true,          // set false to leave every unit on Advance (the moving control)
});

// Killing grounds, drawn for the blue (west) side; red mirrors columns with `mirror`. Slots are in filling order; `roles` are the unit
// roles that may stand there, best first. Roles: pavise, pike (League Pikeman, plain Pikemen, the Captain), coil (Crossbowmen, Archers,
// the Engineer), walker (Relic Walker), sapper.
//   river_ford: the bridge is 8,5 and its west exit 7,5. The plug stands ON the exit; three Crossbowmen at range 2 of the bridge tile
//               (7,4, 7,6 and 6,5) shoot whatever stands on it while the plug takes its blows; the rest wait behind.
//   choke_gap1: a two-tile lane (7,5, 8,5). The plug stands at its west mouth 6,5; three Crossbowmen at 5,5 / 6,4 / 6,6 (range 2 of 7,5).
export const FORMATIONS = {
  river_ford: {
    mirror: (c) => 16 - c,
    slots: [
      { c: 7, r: 5, roles: ['pavise', 'pike'] },
      { c: 7, r: 4, roles: ['coil', 'walker'] }, { c: 7, r: 6, roles: ['coil', 'walker'] }, { c: 6, r: 5, roles: ['coil', 'walker', 'pike'] },
      { c: 6, r: 4, roles: ['pavise', 'pike', 'walker', 'sapper'] }, { c: 6, r: 6, roles: ['pavise', 'pike', 'walker', 'sapper'] },
      { c: 5, r: 5, roles: ['pike', 'pavise', 'sapper', 'walker'], extra: true }, { c: 5, r: 3, roles: ['pike', 'pavise', 'sapper', 'walker'], extra: true }, { c: 5, r: 6, roles: ['pike', 'pavise', 'sapper', 'walker'], extra: true },
    ],
  },
  choke_gap1: {
    mirror: (c) => 15 - c,
    slots: [
      { c: 6, r: 5, roles: ['pavise', 'pike'] },
      { c: 5, r: 5, roles: ['coil', 'walker'] }, { c: 6, r: 4, roles: ['coil', 'walker'] }, { c: 6, r: 6, roles: ['coil', 'walker'] },
      { c: 5, r: 4, roles: ['pavise', 'pike', 'walker', 'sapper'] }, { c: 5, r: 6, roles: ['pavise', 'pike', 'walker', 'sapper'] },
      { c: 4, r: 5, roles: ['pike', 'pavise', 'sapper', 'walker'], extra: true }, { c: 4, r: 4, roles: ['pike', 'pavise', 'sapper', 'walker'], extra: true }, { c: 4, r: 6, roles: ['pike', 'pavise', 'sapper', 'walker'], extra: true },
    ],
  },
};

const manhattan = (a, b) => Math.abs(a.c - b.c) + Math.abs(a.r - b.r);
const other = (f) => (f === 'blue' ? 'red' : 'blue');
const ROLE_OF_CARD = { leaguePike: 'pike', pavise: 'pavise', coil: 'coil', sapper: 'sapper', relicWalker: 'walker', pikeman: 'pike', archer: 'coil' };
export const roleOf = (u) => {
  if (u.variantId && ROLE_OF_CARD[u.variantId]) return ROLE_OF_CARD[u.variantId];
  if (ROLE_OF_CARD[u.cls]) return ROLE_OF_CARD[u.cls];
  return u.cls === 'cavalier' ? 'cav' : 'pike';
};
const state = new WeakMap(); // match -> { seizing: { blue, red } }

/** Cheapest movement cost from every tile to `goal` for this movement type, ignoring units (so a unit can plan a route around the river). */
function costMap(goal, moveType) {
  const costs = MOVE_COST[moveType];
  const dist = new Map([[`${goal.c},${goal.r}`, 0]]);
  const queue = [[goal.c, goal.r, 0]];
  while (queue.length) {
    queue.sort((a, b) => a[2] - b[2]);
    const [c, r, d] = queue.shift();
    for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nc = c + dc, nr = r + dr;
      if (!inBounds(nc, nr)) continue;
      const cost = costs[terrainAt(nc, nr)];
      if (cost === undefined) continue;
      const nd = d + cost, key = `${nc},${nr}`;
      if (dist.has(key) && dist.get(key) <= nd) continue;
      dist.set(key, nd);
      queue.push([nc, nr, nd]);
    }
  }
  return dist;
}

export function leagueCommander(m, f, { act, params = {} }) {
  const P = { ...DEFAULT_LEAGUE_PARAMS, ...params };
  const st = state.get(m) || state.set(m, { seizing: { blue: false, red: false } }).get(m);
  const formation = FORMATIONS[MAP.id];
  const mine = () => m.alive(f);
  const foes = () => m.alive(other(f));
  const side = () => m.sides[f];
  const facing = f === 'blue' ? 'east' : 'west';
  const slots = (formation?.slots || []).map((s) => ({ ...s, c: f === 'blue' ? s.c : formation.mirror(s.c) }));
  const enemyKeep = findTile(f === 'blue' ? 'K' : 'C');

  // ---- assignment of units to slots ----
  const assign = () => {
    const units = mine().filter((u) => roleOf(u) !== 'cav');
    const free = new Set(units.map((u) => u.id));
    const out = new Map();
    for (const s of slots) {
      let best = null;
      for (const u of units) {
        if (!free.has(u.id)) continue;
        const rank = s.roles.indexOf(roleOf(u));
        if (rank < 0) continue;
        const key = [rank, manhattan(u, s)];
        if (!best || key[0] < best.key[0] || (key[0] === best.key[0] && key[1] < best.key[1])) best = { u, key };
      }
      if (best) { out.set(best.u.id, s); free.delete(best.u.id); }
    }
    return { out, spare: units.filter((u) => free.has(u.id)) };
  };

  // ---- 0. seize / release ----
  const hp = (list) => list.reduce((s, u) => s + u.hp, 0);
  const ratio = hp(mine()) / Math.max(1, hp(foes()));
  if (!st.seizing[f] && ratio >= P.seizeRatio && m.round > 2) st.seizing[f] = true;
  if (st.seizing[f] && ratio < P.keepMarching) st.seizing[f] = false;
  const seizing = st.seizing[f] && enemyKeep;

  // ---- 1. spells (before recruiting so Supply is spent where it pays) ----
  const hand = () => side().cards.hand;
  const cardOf = (id) => hand().find((c) => c.id === `spell-${id}` && c.cost <= side().cards.supply);
  if (P.useSpells) {
    const threat = new Map();
    for (const o of foes()) {
      const rr = computeRange(o, m.board(), o.mov);
      const reach = new Set([...rr.move, ...rr.attack].map(([c, r]) => `${c},${r}`));
      for (const u of mine()) if (reach.has(`${u.c},${u.r}`)) threat.set(u.id, (threat.get(u.id) || 0) + 1);
    }
    let card = cardOf('fireburst');
    if (card) {
      let best = null;
      for (const center of foes()) for (const [dc, dr] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const at = { c: center.c + dc, r: center.r + dr };
        const score = foes().filter((o) => manhattan(o, at) <= 1).reduce((s, o) => s + Math.min(o.hp, 6), 0);
        if (!best || score > best.score) best = { ...at, score };
      }
      if (best && best.score >= P.fireburstMin) act({ type: 'spell', faction: f, cardId: card.instanceId, c: best.c, r: best.r });
    }
    const hurt = (min) => mine().filter((u) => u.maxHp - u.hp >= min && u.hp / u.maxHp < P.repairBelow).sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)[0];
    for (const [id, min] of [['mend', 8], ['fieldRepair', 4]]) {
      card = cardOf(id);
      const t = card && hurt(min);
      if (t) act({ type: 'spell', faction: f, cardId: card.instanceId, unitId: t.id });
    }
    card = cardOf('ward');
    const wt = card && mine().filter((u) => (threat.get(u.id) || 0) >= P.wardMinThreats).sort((a, b) => (threat.get(b.id) || 0) - (threat.get(a.id) || 0) || a.hp - b.hp)[0];
    if (wt) act({ type: 'spell', faction: f, cardId: card.instanceId, unitId: wt.id });
    card = cardOf('flare');
    const ft = card && mine().find((u) => roleOf(u) === 'coil' && foes().some((o) => manhattan(o, u) === 2));
    if (ft) act({ type: 'spell', faction: f, cardId: card.instanceId, unitId: ft.id });
  }

  // ---- 1b. the shared one-per-round cycle: keep the hand from clogging (a full hand blocks draws, and a Crossbowman may be the card that never arrives) ----
  // Unwanted cards go first: Sappers (no wall on these maps; an uncommon unit cycles into a Crossbowman half the time), then duplicates.
  if (formation && side().cards.cyclesRemaining > 0 && hand().length >= 5) {
    const count = (id) => hand().filter((c) => c.unitId === id).length;
    const unwanted = hand().find((c) => c.type === 'unit' && c.unitId === 'sapper')
      || hand().find((c) => c.type === 'unit' && c.unitId === 'leaguePike' && count('leaguePike') >= 2)
      || hand().find((c) => c.type === 'unit' && c.unitId === 'pavise' && count('pavise') >= 2)
      || hand().find((c) => c.id === 'spell-flare' && !mine().some((u) => roleOf(u) === 'coil'));
    if (unwanted) act({ type: 'cycle', faction: f, source: 'hand', id: unwanted.instanceId });
  }

  // ---- 2. recruit toward the empty slots, deploy next to them ----
  if (formation && !seizing) {
    for (let guard = 0; guard < 12; guard += 1) {
      const { out } = assign();
      const filled = new Set([...out.values()].map((s) => `${s.c},${s.r}`));
      // Extra slots hold surplus units (the starting army) but are never bought for: the population cap belongs to the killing ground.
      const empty = slots.filter((s) => !filled.has(`${s.c},${s.r}`) && !s.extra);
      const affordable = hand().filter((c) => c.type === 'unit' && c.cost <= side().cards.supply && (unitCardFor(c.unitId)?.population || 1) + m.population(f) <= CARD_LIMITS.populationCap);
      if (!affordable.length || !empty.length || !m.deploymentTiles(f).some(([c, r]) => !m.unitAt(c, r))) break;
      // The first empty slot decides the role; take the best-ranked affordable card for it, else any role that some empty slot accepts.
      let pick = null;
      // Best role rank first across all empty slots, so a Crossbowman card beats a third-choice Pikeman for the same slot.
      for (let rank = 0; rank < 3 && !pick; rank += 1) {
        for (const s of empty) {
          const role = s.roles[rank];
          const c = role && affordable.find((x) => ROLE_OF_CARD[x.unitId] === role && !(role === 'sapper' && !wantsSapper()));
          if (c && rank <= (role === 'pike' ? 1 : 2)) { pick = { card: c, slot: s }; break; }
        }
      }
      // No card for the killing ground: spend leftover Supply on filler Pikemen / Pavise Guards (they wait at the extra slots) while two
      // population slots stay free for a Crossbowman or Relic Walker that may still arrive.
      if (!pick && m.population(f) < CARD_LIMITS.populationCap - 2) {
        const c = affordable.find((x) => ['pavise', 'pike'].includes(ROLE_OF_CARD[x.unitId]));
        if (c) pick = { card: c, slot: slots.find((s) => s.extra) || slots.at(-1) };
      }
      if (!pick) break;
      const res = act({ type: 'recruit', faction: f, cardId: pick.card.instanceId });
      if (!res.ok) break;
      const reserve = side().cards.reserves.find((r) => r.id === res.reserveId);
      const tiles = m.deploymentTiles(f).filter(([c, r]) => m.canDeployAt(f, reserve.id, c, r).ok)
        .sort((a, b) => manhattan({ c: a[0], r: a[1] }, pick.slot) - manhattan({ c: b[0], r: b[1] }, pick.slot) || a[1] - b[1] || a[0] - b[0]);
      if (tiles.length) act({ type: 'deploy', faction: f, reserveId: reserve.id, c: tiles[0][0], r: tiles[0][1] });
    }
    // rested reserves come back out
    for (const reserve of [...side().cards.reserves]) {
      if (reserve.hp != null && reserve.hp / reserve.maxHp < 0.7) continue;
      const tiles = m.deploymentTiles(f).filter(([c, r]) => m.canDeployAt(f, reserve.id, c, r).ok);
      if (tiles.length) act({ type: 'deploy', faction: f, reserveId: reserve.id, c: tiles[0][0], r: tiles[0][1] });
    }
  }
  function wantsSapper() { return false; } // no wall on these two maps (see the Level D finding: the plug already does the job)

  // ---- 3. orders ----
  if (!P.hold) {
    for (const u of mine()) if (u.stance !== 'advance') act({ type: 'stance', faction: f, unitId: u.id, stance: 'advance' });
  } else if (seizing) {
    for (const u of mine()) {
      const same = u.stance === 'advance' && u.objective?.type === 'tile' && u.objective.c === enemyKeep[0] && u.objective.r === enemyKeep[1];
      if (!same) act({ type: 'stance', faction: f, unitId: u.id, stance: 'advance', tile: enemyKeep });
    }
  } else if (formation) {
    const { out, spare } = assign();
    const moveType = (u) => MOVE_TYPE[u.cls] || 'foot';
    const maps = new Map();
    const distTo = (u, s) => { const k = `${moveType(u)}:${s.c},${s.r}`; if (!maps.has(k)) maps.set(k, costMap(s, moveType(u))); return maps.get(k); };
    // Move units whose slot is free first; repeat so that swaps resolve.
    const pending = [...out.entries()].map(([id, s]) => ({ u: m.byId(id), s }));
    const settled = new Set();
    for (let pass = 0; pass < 3; pass += 1) {
      for (const { u, s } of pending) {
        if (settled.has(u.id)) continue;
        if (u.c === s.c && u.r === s.r) { settled.add(u.id); continue; }
        if (u.planningMoved) continue;
        const rr = computeRange(u, m.board(), u.mov);
        const d = distTo(u, s);
        const cand = rr.move.filter(([c, r]) => !m.unitAt(c, r) && d.has(`${c},${r}`)).sort((a, b) => d.get(`${a[0]},${a[1]}`) - d.get(`${b[0]},${b[1]}`) || a[1] - b[1] || a[0] - b[0])[0];
        const here = d.get(`${u.c},${u.r}`) ?? 99;
        if (cand && d.get(`${cand[0]},${cand[1]}`) < here) {
          const res = act({ type: 'move', faction: f, unitId: u.id, c: cand[0], r: cand[1] });
          if (res.ok && cand[0] === s.c && cand[1] === s.r) settled.add(u.id);
        }
      }
    }
    for (const { u, s } of pending) {
      const there = u.c === s.c && u.r === s.r;
      const want = there ? { stance: 'hold' } : { stance: 'advance', tile: [s.c, s.r] };
      const same = u.stance === want.stance && (want.tile ? u.objective?.type === 'tile' && u.objective.c === want.tile[0] && u.objective.r === want.tile[1] : true);
      if (!same) act({ type: 'stance', faction: f, unitId: u.id, ...want });
      if (there && u.facing !== facing) act({ type: 'facing', faction: f, unitId: u.id, facing });
    }
    // Units with no slot wait where they are, holding.
    for (const u of spare) if (u.stance !== 'hold') act({ type: 'stance', faction: f, unitId: u.id, stance: 'hold' });
  }

  // ---- 4. skill picks ----
  if (P.useSkills) {
    for (const u of mine()) {
      const role = roleOf(u);
      const holding = P.hold && !seizing && u.stance === 'hold';
      const wish = [];
      if (u.cls === 'pikeman' || u.id === m.champion(f)) {
        wish.push('rally');
        if (holding) wish.push('setPosition');
        // Field Works is not picked: the champion stands on the plug facing the bridge, so it would wall up the bridge tile the Crossbowmen shoot at.
      }
      if (role === 'coil' && holding) wish.push('preparedPosition');
      if (role === 'coil' && holding && ABILITY_CATALOG.overcharge && u.id === 'tobiahKettle') wish.push('overcharge');
      if (role === 'walker' && holding && foes().some((o) => manhattan(o, u) <= 3)) wish.push('arcBurst');
      if (role === 'walker' && holding && ABILITY_CATALOG.ironbound && u.id === 'oldSixty') wish.push('ironbound');
      if (role === 'sapper' && holding) wish.push('digIn');
      const picks = [];
      for (const id of wish) {
        if (!ABILITY_CATALOG[id]) continue;
        if (selectedCost({ selectedAbilities: [...picks, id] }) <= (u.energy || 0)) picks.push(id);
      }
      if (JSON.stringify(picks) !== JSON.stringify(u.selectedAbilities || [])) act({ type: 'abilities', faction: f, unitId: u.id, abilityIds: picks });
    }
  }
}
