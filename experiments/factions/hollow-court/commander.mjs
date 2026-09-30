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
  healWorth: 6,                // eat a Corpse only if the heal would restore at least this much HP in total...
  expiringWorth: 3,            // ...or at least this much when the Corpse rots after this battle
});

const COURT_SKILLS = new Set(['unquietStep', 'withering', 'chancelleryAudit', 'sovereignStand', 'holdBeyondDeath']);
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

  // 4. skill selections (state-aware: see courtSkillPicks)
  for (const { unitId, abilityIds } of courtSkillPicks(m, f, { ban: P.ban })) act({ type: 'abilities', faction: f, unitId, abilityIds });

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

/**
 * State-aware skill selection for the Court, shared by the commander and the scenarios' "skilled" plans. Returns the selections that
 * differ from what a unit already has. The point of the rules is not to waste the dead: a Corpse is eaten only when somebody near
 * is hurt enough to use the heal (or the Corpse is about to rot), so it can keep feeding the passives that read it (Duty Beyond
 * Death, Feeds on the Fallen) until then. `ban` removes skills by id (ablations).
 */
export function courtSkillPicks(m, f, { ban = [], healWorth = COURT_AI.healWorth, expiringWorth = COURT_AI.expiringWorth } = {}) {
  const foes = m.alive(other(f));
  const out = [];
  for (const u of m.alive(f)) {
    const near = foes.some((o) => manhattan(o, u) <= u.mov + 2);
    const corpses = (r) => m.objectsNear(u.c, u.r, r, 'corpse');
    // HP the heal of an eating skill would restore to friends within `radius` of the eater, capped by the amount per unit
    const useful = (radius, amount) => m.alive(f).filter((o) => manhattan(o, u) <= radius).reduce((sum, o) => sum + Math.min(amount, o.maxHp - o.hp), 0);
    const worthEating = (a) => {
      const c = a.consume;
      const here = corpses(c.radius);
      if (!here.length) return false;
      const value = useful(c.heal.radius, c.heal.amount);
      const expiring = here.some((o) => (o.decay ?? 9) <= 1);
      return value >= healWorth || (expiring && value >= expiringWorth);
    };
    const wish = [];
    const mine = Object.values(ABILITY_CATALOG).filter((a) => (a.classes?.includes(u.cls) || a.units?.includes(u.id)) && (a.consume || COURT_SKILLS.has(a.id)));
    if (!mine.length) continue; // not a Court unit: leave its selections (shipped kits) to whoever set them
    for (const a of mine) {
      if (ban.includes(a.id)) continue;
      if (a.consume) { if (worthEating(a)) wish.push(a.id); continue; }
      if (a.id === 'unquietStep') { if (near && u.stance === 'advance') wish.push(a.id); continue; }
      if (a.id === 'withering' || a.id === 'chancelleryAudit') { if (near) wish.push(a.id); continue; }
      if (a.id === 'sovereignStand' || a.id === 'holdBeyondDeath') { if (u.stance === 'hold') wish.push(a.id); continue; }
    }
    // most valuable first: eating skills, then the rest, never more than the unit's energy
    wish.sort((x, y) => (ABILITY_CATALOG[y].consume ? 1 : 0) - (ABILITY_CATALOG[x].consume ? 1 : 0));
    const picks = [];
    let spent = 0;
    for (const id of wish) { const cost = ABILITY_CATALOG[id].cost; if (spent + cost <= u.energy) { picks.push(id); spent += cost; } }
    if (JSON.stringify(picks) !== JSON.stringify(u.selectedAbilities || [])) out.push({ unitId: u.id, abilityIds: picks });
  }
  return out;
}
