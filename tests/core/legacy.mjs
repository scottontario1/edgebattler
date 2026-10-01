// Helpers for differential tests: the frozen legacy engine keeps its registrations in module
// globals, so each scenario sets them up and tears them down through these functions.
import { prepareFactions } from '../../legacy/src/setup.js';
import { resetCultures } from '../../legacy/src/cultures.js';
import { setRarityGate } from '../../legacy/src/cards.js';
import { setMap, DEFAULT_MAP } from '../../legacy/src/board.js';
import { createContentForFactions } from '../../src/core/setup/content.js';

export const FACTION_SETS = [
  [],
  ['crown'],
  ['fang'],
  ['league'],
  ['court'],
  ['crown', 'fang'],
  ['league', 'court'],
  ['crown', 'fang', 'league', 'court'],
];

/** Register the factions in legacy, run `fn(newContext)`, and always restore the legacy globals. */
export function withFactions(ids, fn) {
  prepareFactions(ids);
  try {
    return fn(createContentForFactions(ids));
  } finally {
    resetCultures();
    setRarityGate({});
    setMap(DEFAULT_MAP);
  }
}

/** Run `fn` for every faction set. */
export function forEachFactionSet(fn) {
  for (const ids of FACTION_SETS) withFactions(ids, (content) => fn(ids, content));
}

/** Small deterministic generator for scenario building (not the engine's streams). */
export function scenarioRandom(seed) {
  let state = seed >>> 0 || 1;
  const next = () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 0x100000000;
  };
  return {
    next,
    int: (n) => Math.floor(next() * n),
    pick: (list) => list[Math.floor(next() * list.length)],
  };
}
