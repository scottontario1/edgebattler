// A thin White Fang commander that wraps the shipped heuristic (src/ai/commander.js). The heuristic does not know the clan cards, the
// clan kits or the mark action, and it is Advance/Hold-agnostic; left alone it (a) counts only the three shipped classes toward its
// recruit mix, (b) cycles clan cards away as "unwanted" and (c) puts Archers on Hold and hurt units on Protect. This wrapper:
//   1. casts at most one clan spell (Blood Oath, Hunt, War Cry) on a unit that will make contact this battle,
//   2. runs the heuristic for recruiting, deployment, the shared spells (Mend, Ward, Fireburst), withdrawing and stances, with cycling
//      off and a recruit mix that names the clan classes,
//   3. puts every unit back on Advance (the clans never Hold or Protect),
//   4. picks each unit's kit: Reaving Rush, Iron Skin, Frenzy, and for the champion Blood Challenge (with a `mark` on the enemy that
//      is cheapest to finish) or Warlord's Rush.
// It plans through `act` (= match.apply), so its moves are logged and replayed like any other. Nothing here changes the engine.
import { heuristic } from '../../../src/ai/commander.js';
import { computeRange } from '../../../src/rules.js';
import { forecast } from '../../../src/combat.js';
import { battleMovement, kitFor, ABILITY_CATALOG, selectedCost } from '../../../src/abilities.js';

/** Recruit mix handed to the heuristic (share of the army it aims for; prototype default, not tuned). */
export const FANG_MIX = Object.freeze({ fangReaver: 0.35, fangAxeguard: 0.2, fangBerserker: 0.15, fangHunter: 0.2, cavalier: 0.1, pikeman: 0, archer: 0 });
/** How far past its movement a unit may be from a foe and still be picked for a kit ability (tiles). */
export const KIT_SLACK = 2;
/** Mark scoring: lower is better; hp plus this many points per tile of distance. */
export const MARK_DISTANCE_WEIGHT = 2;

const manhattan = (a, b) => Math.abs(a.c - b.c) + Math.abs(a.r - b.r);
const other = (f) => (f === 'blue' ? 'red' : 'blue');

export function fangCommander(m, f, { act, params = {} }) {
  const foes = () => m.alive(other(f));
  const mine = () => m.alive(f);
  const side = () => m.sides[f];
  const nearestFoe = (u) => foes().reduce((best, o) => Math.min(best, manhattan(o, u)), 99);
  // Units that could strike an enemy this battle (from their Advance movement), with the enemy they would hit.
  const engaged = () => {
    const out = [];
    for (const u of mine()) {
      const rr = computeRange(u, m.board(), battleMovement({ ...u, stance: 'advance' }));
      const reach = [...rr.targets.keys()].map((id) => m.byId(id)).filter(Boolean);
      if (reach.length) out.push({ u, reach });
    }
    return out;
  };

  // 1. One clan spell on a unit that will make contact.
  const castable = (id) => side().cards.hand.find((c) => c.id === `spell-${id}` && c.cost <= side().cards.supply);
  const contact = engaged();
  const cast = (id, pick) => { const card = castable(id); const t = card && pick(); if (t) act({ type: 'spell', faction: f, cardId: card.instanceId, unitId: t.id }); return Boolean(card && t); };
  const strongest = (list) => [...list].sort((a, b) => b.u.str - a.u.str || String(a.u.id).localeCompare(String(b.u.id)))[0]?.u;
  const armoured = (list) => [...list].sort((a, b) => Math.max(...b.reach.map((o) => o.def)) - Math.max(...a.reach.map((o) => o.def)) || String(a.u.id).localeCompare(String(b.u.id)))[0]?.u;
  if (contact.length && !cast('bloodOath', () => strongest(contact)) && !cast('hunt', () => armoured(contact))) cast('warCry', () => strongest(contact));

  // 2. Recruiting, shared spells, withdrawing and stances by the shipped heuristic.
  heuristic(m, f, { act, params: { ...params, cycling: false, mix: { ...FANG_MIX, ...(params.mix || {}) } } });

  // 3. The clans never Hold or Protect.
  for (const u of mine()) if (u.stance !== 'advance') act({ type: 'stance', faction: f, unitId: u.id, stance: 'advance' });

  // 4. Kit picks and the mark.
  for (const u of mine()) {
    const near = nearestFoe(u) <= battleMovement({ ...u, stance: 'advance' }) + KIT_SLACK;
    const kit = kitFor(u).map((a) => a.id);
    const picks = [];
    const want = (id) => { if (kit.includes(id) && selectedCost({ selectedAbilities: [...picks, id] }) <= u.energy && !(u.cooldowns?.[id] > 0)) picks.push(id); };
    if (u.cls === 'fangReaver' && near) want('reavingRush');
    else if (u.cls === 'fangAxeguard' && near) want('ironSkin');
    else if (u.cls === 'fangBerserker' && near && u.hp < u.maxHp * 0.5) want('frenzy');
    else if (u.cls === 'archer' && near && u.energy >= 2) want('focusedShot');
    else if (u.id === m.champion(f) && near) {
      for (const id of kit.filter((k) => ABILITY_CATALOG[k].mark)) want(id);
      for (const id of kit.filter((k) => ABILITY_CATALOG[k].requires?.moved)) want(id);
    }
    else if (u.cls === 'cavalier' && near && u.energy >= 2) want('charge');
    if (JSON.stringify(picks) !== JSON.stringify(u.selectedAbilities || [])) act({ type: 'abilities', faction: f, unitId: u.id, abilityIds: picks });
    // Blood Challenge: mark the enemy in radius that is cheapest to finish (hp plus distance).
    const markAbility = kit.map((k) => ABILITY_CATALOG[k]).find((a) => a.mark && picks.includes(a.id));
    if (markAbility) {
      const inRadius = foes().filter((o) => manhattan(o, u) <= markAbility.mark.radius);
      const best = inRadius.sort((a, b) => a.hp + MARK_DISTANCE_WEIGHT * manhattan(a, u) - (b.hp + MARK_DISTANCE_WEIGHT * manhattan(b, u)) || String(a.id).localeCompare(String(b.id)))[0];
      if (best) act({ type: 'mark', faction: f, unitId: u.id, targetId: best.id });
    }
  }
}

/** Run the clan commander for one side (same shape as runCommander in src/ai/commander.js). Returns the accepted action count. */
export function runFang(m, faction, params = {}) {
  let accepted = 0;
  const act = (action) => { const res = m.apply(action, 'ai:fang'); if (res.ok) accepted += 1; return res; };
  fangCommander(m, faction, { act, params });
  return accepted;
}
export { forecast };
