// Enemy commander planning under the same card rules as the player (GAME.md, "Round structure":
// "the enemy recruits and plans under the same core rules"). Pure functions of plain data: the
// caller supplies the board queries, so this module can be exercised without a browser.
import { CARD_LIMITS, UNIT_CARDS, createCardState, drawOpeningHand, refreshRound, recruitUnit, seededRandom } from './cards.js';

// Prototype limits, deliberately simple and listed so they are easy to tune:
// - only unit cards are played; the enemy does not cast spells or equip skills yet, so any other
//   card it draws is dropped from its hand immediately (otherwise it would clog the 8-card cap);
// - it spends greedily, most expensive affordable card first, and deploys the same round.
const PRIORITY = ['cavalier', 'archer', 'pikeman'];

/** Starting inventory for the enemy: opening hand and initial Supply, counting its fielded units. */
export function createEnemyCards({ seed = 0x454e4d59, population = 0 } = {}) {
  const rng = seededRandom(seed);
  const drawn = drawOpeningHand(createCardState({ population }), rng);
  return { cards: keepUnitCards(drawn.state), rng };
}

/** Grant the round's Supply and draw, as the player does. */
export function refreshEnemyCards(enemy, population) {
  const next = refreshRound({ ...enemy.cards, population }, enemy.rng);
  return { cards: keepUnitCards(next.state), rng: enemy.rng };
}

function keepUnitCards(state) {
  return { ...state, hand: state.hand.filter((card) => card.type === 'unit') };
}

/**
 * Recruit and deploy as many affordable unit cards as the rules allow.
 *
 * enemy:   { cards, rng } from createEnemyCards / refreshEnemyCards
 * board:   { tiles: [[c, r]...]   candidate deployment tiles in controlled territory,
 *            canStand(unitId, c, r) -> bool   empty and traversable for that unit type,
 *            threat(c, r) -> number   smaller = closer to the front (distance to the nearest foe) }
 * Returns { enemy, deployments: [{ unitId, name, cost, c, r, stars, population }] }.
 */
export function planEnemyReinforcements(enemy, board) {
  let cards = enemy.cards;
  const deployments = [];
  const taken = new Set();
  for (;;) {
    const pick = PRIORITY
      .map((unitId) => cards.hand.find((card) => card.unitId === unitId && card.cost <= cards.supply))
      .find(Boolean);
    if (!pick) break;
    const tile = [...board.tiles]
      .filter(([c, r]) => !taken.has(`${c},${r}`) && board.canStand(pick.unitId, c, r))
      .sort((a, b) => board.threat(a[0], a[1]) - board.threat(b[0], b[1]) || a[1] - b[1] || a[0] - b[0])[0];
    if (!tile) break;
    const bought = recruitUnit(cards, pick.instanceId);
    if (!bought.ok) break; // population cap or reserve capacity: stop, keep the rest of the hand
    // The reserve bench is skipped: the enemy deploys the unit it just paid for.
    cards = { ...bought.state, reserves: bought.state.reserves.filter((reserve) => reserve.id !== bought.reserve.id) };
    taken.add(`${tile[0]},${tile[1]}`);
    deployments.push({
      unitId: pick.unitId, name: UNIT_CARDS[pick.unitId].name, cost: bought.supplySpent,
      c: tile[0], r: tile[1], stars: bought.reserve.stars, population: bought.reserve.population,
    });
  }
  return { enemy: { ...enemy, cards }, deployments };
}

export { CARD_LIMITS };
