// Candidate cards and abilities for the combat experiments. NOT part of the default card pool or kits:
// nothing here is active unless enableCandidates() is called, and disableCandidates() removes it again.
// Scott chooses what (if anything) enters the game; docs/experiments/CANDIDATES.md lists the provisional numbers.
//
// The engine hooks are data-driven and inert without these registrations:
//   abilities  src/abilities.js registerAbilities()  (requires / effect fields, see activatePhase)
//   cards      src/cards.js registerCandidateCards() + setRecruitmentPool()
//   combat     src/battle.js (setSpears status), src/match.js withEquip() (equipStr / equipDef statuses)
import { registerAbilities, resetAbilities } from '../../src/abilities.js';
import { EXPERIMENT_RULES } from '../../src/match.js';
import { registerCandidateCards, resetCandidateCards, setRecruitmentPool, RECRUITMENT_POOL } from '../../src/cards.js';

export const CANDIDATE_ABILITIES = {
  // Pikeman: a defensive stance against horse. Cheaper than Brace (2) but only good against cavalry.
  setSpears: {
    id: 'setSpears', name: 'Set Spears', classes: ['pikeman'], cost: 1, cooldown: 2, phase: 'defense',
    description: 'Hold this battle. Cavalier Charge, Momentum and flank bonuses against this unit are ignored, and its strike against a Cavalier gains +4 damage.',
    effect: { setSpears: 4 },
  },
  // Cavalier: rewards a run-up. Cheaper than Charge (2) but needs open ground: +1 damage per tile moved, max +5, at least 2 tiles.
  momentum: {
    id: 'momentum', name: 'Momentum', classes: ['cavalier'], cost: 1, cooldown: 1, phase: 'enhancement',
    description: 'Requires Advance and at least 2 tiles of automatic movement. Strike gains +1 damage per tile moved (max +5). Stacks with Charge.',
    requires: { stance: 'advance', moved: 2, target: true },
    effect: { attackBonus: ({ movedTiles }) => Math.min(5, movedTiles) },
  },
};

// Type-wide passive equipment, same shape and slots as Barrier (2 slots per unit type, 2 Supply).
export const CANDIDATE_CARDS = {
  whetstone: { id: 'skill-whetstone', type: 'skill', rarity: 'common', skillId: 'whetstone', name: 'Whetstone', cost: 2, target: 'unit-type', duration: 'persistent',
    statMods: { str: 2 }, effect: 'All friendly units of this type deal +2 damage on every hit.' },
  bulwark: { id: 'skill-bulwark', type: 'skill', rarity: 'common', skillId: 'bulwark', name: 'Bulwark', cost: 2, target: 'unit-type', duration: 'persistent',
    statMods: { def: 2 }, effect: 'All friendly units of this type take 2 less damage from every strike.' },
};

// Planning actions rather than combat picks: switched on through EXPERIMENT_RULES.muster (src/match.js handler).
export const CANDIDATE_ACTIONS = {
  // Muster: a field recruit spends 2 energy (cooldown 2) to put one bench unit on an empty tile next to it.
  muster: { cost: 2, cooldown: 2, classes: ['pikeman', 'archer', 'cavalier'] },
};

export const ALL_CANDIDATES = [...Object.keys(CANDIDATE_ABILITIES), ...Object.keys(CANDIDATE_CARDS), ...Object.keys(CANDIDATE_ACTIONS)];

/** Register the named candidates (default: all). Cards join the draw pool with weight 1 each when `pool` is true. */
export function enableCandidates(ids = ALL_CANDIDATES, { pool = false } = {}) {
  disableCandidates();
  const abilities = ids.filter((id) => CANDIDATE_ABILITIES[id]).map((id) => CANDIDATE_ABILITIES[id]);
  const cards = ids.filter((id) => CANDIDATE_CARDS[id]);
  EXPERIMENT_RULES.muster = ids.includes('muster') ? { ...CANDIDATE_ACTIONS.muster } : null;
  registerAbilities(abilities);
  registerCandidateCards(Object.fromEntries(cards.map((id) => [id, CANDIDATE_CARDS[id]])));
  if (pool && cards.length) setRecruitmentPool([...RECRUITMENT_POOL, ...cards]);
  return { abilities: abilities.map((a) => a.id), cards };
}

export function disableCandidates() {
  EXPERIMENT_RULES.muster = null;
  resetAbilities();
  resetCandidateCards();
}
