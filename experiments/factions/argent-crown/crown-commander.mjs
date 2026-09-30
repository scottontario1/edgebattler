// A thin Argent Crown commander. The shipped heuristic (src/ai/commander.js) knows only the three base classes: it never plays Rally Banner,
// never picks Close Ranks / Hold the Standard / Interpose / Brenna's kit, never sets Protect for an Oathsworn and never tries to stand
// units next to each other, so it plays the Crown as three plain classes. This wrapper adds the Crown's own play and delegates
// everything else (recruiting, deploying, combining, Mend / Ward / Fireburst, withdrawing, base-class picks) to the heuristic.
//
// What it adds (every knob is a named parameter in CROWN_PARAMS; prototype defaults for the experiment, not balance decisions):
//   1. Rally Banner   cast before the heuristic spends the Supply, on the friendly unit the most enemies can reach.
//   2. Close up       each foot unit uses its one planning move to stand next to friendly infantry (the Line Doctrine), ahead of nothing.
//   3. Hold early     infantry Hold (they do not walk out of the formation) until an enemy is within `holdTrigger` tiles or round `holdRounds` ends.
//   4. Reserve        Crown Knights Hold until an enemy is within `commitDistance` of any friendly infantry, then the heuristic's Advance stands.
//   5. Oath           each Oathsworn Protects Brenna (or the nearest Bannerman if she is down).
//   6. Kit picks      Close Ranks / Hold the Standard / Interpose / Bulwark of the Realm / Oathkeeper's Strike when an enemy is near and the energy is there.
// It never touches match state directly: every change is a logged m.apply action, so games replay.
import { COMMANDERS } from '../../../src/ai/commander.js';
import { computeRange } from '../../../src/rules.js';
import { INFANTRY } from '../../../src/factions/argent-crown.js';

export const CROWN_PARAMS = Object.freeze({
  closeUp: true,          // use the planning move to stand beside friendly infantry
  holdEarly: true,        // infantry Hold until the enemy is near
  holdTrigger: 7,         // tiles: an enemy this close to the unit ends the early hold
  holdRounds: 5,          // hold at most this many rounds (a mirror would otherwise wait forever)
  reserveCavalry: true,   // Knights wait behind the line until the enemy commits
  commitDistance: 6,      // tiles from any friendly infantry unit that counts as "committed"
  kitPicks: true,         // choose Crown skills
  rallyBanner: true,      // cast Rally Banner
  bannerMinThreats: 2,    // enemies that can reach a unit before Rally Banner is worth casting on it
  nearMargin: 2,          // an enemy within mov + this counts as near for kit picks
  formationScoreMin: 1,   // a planning move must improve the formation score by at least this
  // heuristic recruiting weights for the Crown cards (same idea as DEFAULT_PARAMS.mix; keyed by card key)
  mix: { crownPike: 0.3, crownGuard: 0.2, crownArcher: 0.2, crownCavalier: 0.15, bannerman: 0.08, oathsworn: 0.07 },
});

const manhattan = (a, b) => Math.abs(a.c - b.c) + Math.abs(a.r - b.r);
const other = (f) => (f === 'blue' ? 'red' : 'blue');
const isInfantry = (u) => INFANTRY.includes(u.cls);

export function crownCommander(m, f, { act, params = {} }) {
  const P = { ...CROWN_PARAMS, ...params, mix: { ...CROWN_PARAMS.mix, ...(params.mix || {}) } };
  const mine = () => m.alive(f);
  const foes = () => m.alive(other(f));
  const hand = () => m.sides[f].cards.hand;
  const supply = () => m.sides[f].cards.supply;
  const nearest = (u) => foes().reduce((b, o) => Math.min(b, manhattan(o, u)), 99);

  // 1. Rally Banner before the heuristic spends the Supply.
  if (P.rallyBanner) {
    const card = hand().find((c) => c.id === 'spell-rallyBanner' && c.cost <= supply());
    if (card) {
      const threat = new Map();
      for (const o of foes()) {
        const rr = computeRange(o, m.board(), o.mov);
        const reach = new Set([...rr.move, ...rr.attack].map(([c, r]) => `${c},${r}`));
        for (const u of mine()) if (reach.has(`${u.c},${u.r}`)) threat.set(u.id, (threat.get(u.id) || 0) + 1);
      }
      const target = mine().filter((u) => (threat.get(u.id) || 0) >= P.bannerMinThreats).sort((a, b) => (threat.get(b.id) || 0) - (threat.get(a.id) || 0) || a.hp - b.hp)[0];
      if (target) act({ type: 'spell', faction: f, cardId: card.instanceId, unitId: target.id });
    }
  }

  // Recruiting, deploying, combining, shipped spells and base-class picks: the heuristic, with the Crown's card weights.
  COMMANDERS.heuristic(m, f, { act, params: { mix: P.mix } });

  // 2. Close up: the one planning move goes to the reachable tile that maximises friendly-infantry neighbours (at most 2 count), then closeness to the foe.
  if (P.closeUp) {
    const adjacent = (tile, self) => mine().filter((o) => o.id !== self.id && isInfantry(o) && manhattan(o, tile) === 1).length;
    const score = (tile, u) => 10 * Math.min(2, adjacent(tile, u)) - 0.5 * Math.min(...foes().map((o) => manhattan(o, tile)), 20);
    const order = [...mine()].filter((u) => isInfantry(u) || u.cls === 'cavalier').sort((a, b) => nearest(a) - nearest(b) || String(a.id).localeCompare(String(b.id)));
    for (const u of order) {
      if (u.planningMoved) continue;
      const here = score(u, u);
      const tiles = computeRange(u, m.board(), u.mov).move.filter(([c, r]) => !m.unitAt(c, r) && !(c === u.c && r === u.r));
      let best = null;
      for (const [c, r] of tiles) {
        const s = score({ c, r }, u);
        if (!best || s > best.s || (s === best.s && (r < best.r || (r === best.r && c < best.c)))) best = { c, r, s };
      }
      if (best && best.s >= here + P.formationScoreMin) act({ type: 'move', faction: f, unitId: u.id, c: best.c, r: best.r });
    }
  }

  // 3-5. Stances: hold early, keep the Knights in reserve, Oathsworn protect Brenna.
  const brenna = mine().find((u) => u.champion && u.cls === 'paladin');
  const engaged = mine().some((u) => isInfantry(u) && nearest(u) <= P.commitDistance);
  for (const u of mine()) {
    if (u.cls === 'oathsworn') {
      const subject = brenna || mine().filter((o) => o.cls === 'bannerman')[0];
      if (subject && subject.id !== u.id && !(u.stance === 'protect' && u.objective?.targetId === subject.id)) act({ type: 'stance', faction: f, unitId: u.id, stance: 'protect', targetId: subject.id });
      continue;
    }
    if (u.stance === 'protect') continue; // the heuristic's champion guards
    if (P.holdEarly && isInfantry(u) && u.cls !== 'archer' && u.id !== brenna?.id && m.round <= P.holdRounds && nearest(u) > P.holdTrigger && u.stance !== 'hold') act({ type: 'stance', faction: f, unitId: u.id, stance: 'hold' });
    if (P.reserveCavalry && u.cls === 'cavalier' && !engaged && m.round <= P.holdRounds + 3 && u.stance !== 'hold') act({ type: 'stance', faction: f, unitId: u.id, stance: 'hold' });
  }

  // 6. Kit picks for the Crown's own classes (base-class picks were made by the heuristic).
  if (P.kitPicks) {
    for (const u of mine()) {
      const near = foes().some((o) => manhattan(o, u) <= u.mov + P.nearMargin);
      const want = [];
      const afford = (id, list = want) => list.reduce((n, x) => n + ({ closeRanks: 1, holdTheStandard: 2, interpose: 2, bulwarkOfTheRealm: 2, oathkeepersStrike: 1 }[x] || 0), 0) + ({ closeRanks: 1, holdTheStandard: 2, interpose: 2, bulwarkOfTheRealm: 2, oathkeepersStrike: 1 }[id] || 0) <= u.energy;
      if (u.cls === 'crownGuard' && near && afford('closeRanks')) want.push('closeRanks');
      if (u.cls === 'bannerman' && near && u.stance === 'hold' && afford('holdTheStandard')) want.push('holdTheStandard');
      if (u.cls === 'oathsworn' && near && u.stance === 'protect' && afford('interpose')) want.push('interpose');
      if (u.champion && u.cls === 'paladin') {
        if (near && u.stance === 'hold' && afford('bulwarkOfTheRealm')) want.push('bulwarkOfTheRealm');
        if (near && afford('oathkeepersStrike')) want.push('oathkeepersStrike');
      }
      if (!['crownGuard', 'bannerman', 'oathsworn', 'paladin'].includes(u.cls)) continue;
      if (JSON.stringify(want) !== JSON.stringify(u.selectedAbilities || [])) act({ type: 'abilities', faction: f, unitId: u.id, abilityIds: want });
    }
  }
}
