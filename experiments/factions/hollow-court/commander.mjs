// A thin Hollow Court commander. The shipped heuristic (src/ai/commander.js) knows only Pikemen, Archers and Cavaliers: it
// recruits by a mix table keyed on those three, never selects Court skills, never casts Mend Bone or Grave Chill and sends
// every unit forward, so a Court army played by it wastes its corpse economy. This commander therefore
//   1. runs the shipped heuristic on a view of the match whose hand has no unit cards (spells, withdraw, combine, Cavalier picks and
//      stances for units already on the field all still come from the shipped code),
//   2. recruits and deploys Court units toward a target mix,
//   3. sets Court stances (Necromancers shadow a friend, Graveguards hold when the enemy is close),
//   4. selects Court skills (all through match.apply, so everything is logged and replays), and
//   5. casts Mend Bone and Grave Chill.
// It is deliberately simple: an honest "competent but unimaginative" player, not an optimiser. Every knob is in COURT_AI.
import { heuristic, DEFAULT_PARAMS } from '../../../src/ai/commander.js';
import { CARD_LIMITS } from '../../../src/cards.js';
import { ABILITY_CATALOG } from '../../../src/abilities.js';

export const COURT_AI = Object.freeze({
  mix: { feralGhoul: 0.35, graveguard: 0.30, wight: 0.15, necromancer: 0.10, mourningKnight: 0.10 }, // target share of the field army
  minFrontBeforeNecro: 2,      // do not recruit a Necromancer before this many non-Necromancer units exist
  guardHoldRange: 3,           // a Graveguard holds while a foe is within this many tiles, otherwise it advances
  chillFinishHp: 3,            // Grave Chill an enemy at or below this HP (it would kill)
  chillBankAt: 5,              // ...or any wounded enemy when Supply is at least this (bank nearly full)
  mendBoneMissing: 5,          // Mend Bone a unit missing at least this much HP (the spell is free)
});

const manhattan = (a, b) => Math.abs(a.c - b.c) + Math.abs(a.r - b.r);
const other = (f) => (f === 'blue' ? 'red' : 'blue');

/** Court commander. plan(match, faction, { act, params }); `act` is match.apply with the actor label filled in. */
export function courtCommander(m, f, { act, params = {} }) {
  const P = { ...COURT_AI, ...params, mix: { ...COURT_AI.mix, ...(params.mix || {}) } };
  const mine = () => m.alive(f);
  const foes = () => m.alive(other(f));
  const cards = () => m.sides[f].cards;

  // 1. shipped heuristic, unit cards hidden. Cycling off: its bench-cycle refunds hurt units, which is wrong for Court play.
  const view = Object.create(m, {
    sides: { get() { const s = m.sides[f]; return { ...m.sides, [f]: { ...s, cards: { ...s.cards, hand: s.cards.hand.filter((c) => c.type !== 'unit') } } }; } },
  });
  heuristic(view, f, { act, params: { ...DEFAULT_PARAMS, cycling: false, ...(params.heuristic || {}) } });

  // 2. recruit toward the target mix; deploy on the legal tile nearest the enemy.
  const nearestFoe = (c, r) => foes().reduce((best, o) => Math.min(best, Math.abs(o.c - c) + Math.abs(o.r - r)), 99);
  for (let guard = 0; guard < 20; guard += 1) {
    const counts = {};
    let total = 0;
    for (const u of m.armyRecords(f)) if (u.id !== m.champion(f)) { const k = u.variantId || u.cls; counts[k] = (counts[k] || 0) + 1; total += 1; }
    const room = CARD_LIMITS.populationCap - m.population(f);
    const front = total - (counts.necromancer || 0);
    const buyable = cards().hand.filter((c) => c.type === 'unit' && c.cost <= cards().supply && (c.population || 1) <= room
      && !(c.unitId === 'necromancer' && front < P.minFrontBeforeNecro));
    if (!buyable.length || !m.deploymentTiles(f).some(([c, r]) => !m.unitAt(c, r))) break;
    const score = (c) => (P.mix[c.unitId] ?? 0.05) - (counts[c.unitId] || 0) / Math.max(1, total + 1);
    buyable.sort((a, b) => score(b) - score(a) || b.cost - a.cost);
    const res = act({ type: 'recruit', faction: f, cardId: buyable[0].instanceId });
    if (!res.ok) break;
    deploy(res.reserveId);
  }
  // rested reserves also come back (the heuristic redeploys reserves that are in its `mix`; Court reserves are handled here)
  for (const reserve of [...cards().reserves]) if (reserve.hp == null || reserve.hp / reserve.maxHp >= 0.7) deploy(reserve.id);
  function deploy(reserveId) {
    const tiles = m.deploymentTiles(f).filter(([c, r]) => m.canDeployAt(f, reserveId, c, r).ok)
      .sort((a, b) => nearestFoe(...a) - nearestFoe(...b) || a[1] - b[1] || a[0] - b[0]);
    if (tiles.length) act({ type: 'deploy', faction: f, reserveId, c: tiles[0][0], r: tiles[0][1] });
  }

  // 3. stances for Court classes (the Mourning Knight is a cavalier variant: the shipped code already handled it).
  const champ = m.byId(m.champion(f));
  for (const u of mine()) {
    if (u.id === m.champion(f)) continue;
    let want = null;
    const nearest = nearestFoe(u.c, u.r);
    if (u.cls === 'necromancer') {
      const friend = mine().filter((o) => o.id !== u.id && o.cls !== 'necromancer' && o.id !== m.champion(f))
        .sort((a, b) => manhattan(a, u) - manhattan(b, u) || a.id.localeCompare(b.id))[0] || (champ && champ.hp > 0 ? champ : null);
      want = friend ? { stance: 'protect', targetId: friend.id } : { stance: 'hold' };
    } else if (u.cls === 'graveguard') want = nearest <= P.guardHoldRange ? { stance: 'hold' } : { stance: 'advance' };
    else if (u.cls === 'feralGhoul' || u.cls === 'wight') want = { stance: 'advance' };
    if (!want) continue;
    const same = u.stance === want.stance && (want.targetId ? u.objective?.targetId === want.targetId : true);
    if (!same) act({ type: 'stance', faction: f, unitId: u.id, ...want });
  }

  // 4. skill selections, cheapest useful first, never more than the unit's energy.
  for (const u of mine()) {
    const near = foes().some((o) => manhattan(o, u) <= u.mov + 2);
    const wish = [];
    const corpseNear = (r) => m.objectsNear(u.c, u.r, r, 'corpse').length > 0;
    if (u.cls === 'feralGhoul' && near && u.stance === 'advance') wish.push('unquietStep');
    if (u.cls === 'graveguard') wish.push('graveRally');
    if (u.cls === 'wight' && near) wish.push('withering');
    if (u.cls === 'necromancer') wish.push('consumeRemains');
    if (u.id === 'hollowRegent') { if (corpseNear(4)) wish.push('decreeOfAttendance'); if (u.stance === 'hold') wish.push('sovereignStand'); }
    if (u.id === 'chancellor') { if (corpseNear(5)) wish.push('ledgerOfTheDead'); if (near) wish.push('chancelleryAudit'); }
    if (u.id === 'marshal' && u.stance === 'hold') wish.push('holdBeyondDeath');
    if (!wish.length) continue;
    const picks = [];
    let spent = 0;
    for (const id of wish) {
      const a = ABILITY_CATALOG[id];
      if (a && spent + a.cost <= u.energy) { picks.push(id); spent += a.cost; }
    }
    if (JSON.stringify(picks) !== JSON.stringify(u.selectedAbilities || [])) act({ type: 'abilities', faction: f, unitId: u.id, abilityIds: picks });
  }

  // 5. Court spells.
  const inHand = (id) => cards().hand.find((c) => c.id === `spell-${id}` && c.cost <= cards().supply);
  const bone = inHand('mendBone');
  if (bone) {
    const hurt = mine().filter((u) => u.maxHp - u.hp >= P.mendBoneMissing).sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)[0];
    if (hurt) act({ type: 'spell', faction: f, cardId: bone.instanceId, unitId: hurt.id });
  }
  const chill = inHand('graveChill');
  if (chill) {
    const reach = (o) => mine().some((u) => manhattan(o, u) <= u.mov + 3);
    const target = foes().filter((o) => reach(o) && (o.hp <= P.chillFinishHp || (cards().supply >= P.chillBankAt && o.hp < o.maxHp)))
      .sort((a, b) => a.hp - b.hp)[0];
    if (target) act({ type: 'spell', faction: f, cardId: chill.instanceId, c: target.c, r: target.r });
  }
}
