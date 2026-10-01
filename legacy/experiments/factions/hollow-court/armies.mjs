// Armies for the Hollow Court experiments: how to register a culture, build a side's roster/champion/pool and pick its commander.
//   base        the shipped army (Brenna / Dreg, Pikemen, Archers, Cavaliers), shared pool, shipped heuristic
//   court       the full Court (module default), Court roster and pool, Court commander (commander.mjs)
//   courtOff    the SAME Court stats with every death mechanic removed (no corpses, no Revenant, no consume abilities, no
//               corpse passives): the control for "do the death mechanics change anything?"
//   courtPlain  the full Court driven by the unmodified shipped heuristic (shows what the AI limitation costs)
import { registerCulture, resetCultures, culturePool } from '../../../src/cultures.js';
import { createRecruitUnit, createChampionUnit, UNITS } from '../../../src/roster.js';
import { runCommander } from '../../../src/ai/commander.js';
import { buildHollowCourt, courtRoster, DEFAULT_CHAMPION } from '../../../src/factions/hollow-court.js';
import { courtCommander } from './commander.mjs';

export const DEATH_OFF = { corpses: false, revenant: false, consume: false, corpsePassives: false };
// Court builds by key (buildHollowCourt options); one build per worker process.
export const BUILDS = { full: {}, off: DEATH_OFF, noRevenant: { revenant: false }, noPassives: { corpsePassives: false }, noConsume: { consume: false }, noCorpses: { corpses: false } };
export const ARMIES = {
  base: { label: 'Baseline (shipped classes)', build: null, policy: 'heuristic' },
  court: { label: 'Court', build: 'full', policy: 'court' },
  courtOff: { label: 'Court without death mechanics', build: 'off', policy: 'court' },
  courtPlain: { label: 'Court under the shipped heuristic', build: 'full', policy: 'heuristic' },
  courtOffPlain: { label: 'Court without death mechanics, shipped heuristic', build: 'off', policy: 'heuristic' },
  // single-mechanic ablations under the shipped heuristic (which never selects Court skills, so consume is inert there)
  courtNoRevPlain: { label: 'Court without Revenant, shipped heuristic', build: 'noRevenant', policy: 'heuristic' },
  courtNoPassPlain: { label: 'Court without corpse-reading passives, shipped heuristic', build: 'noPassives', policy: 'heuristic' },
  courtNoCorpsePlain: { label: 'Court without corpses, shipped heuristic', build: 'noCorpses', policy: 'heuristic' },
};

/** Register the (single) culture the two armies need; throws if they need two different Court builds. */
export function setupCulture(armyKeys) {
  resetCultures();
  const wanted = [...new Set(armyKeys.map((k) => ARMIES[k].build).filter(Boolean))];
  if (wanted.length > 1) throw new Error('one Court build per process');
  if (wanted.length) registerCulture(buildHollowCourt(BUILDS[wanted[0]]));
}

/** createMatch options for one game: sides = { blue: armyKey, red: armyKey }. Culture must already be registered. */
export function matchOptions(sides, champion = DEFAULT_CHAMPION) {
  let roster = UNITS;
  const champions = {}, pools = {};
  for (const f of ['blue', 'red']) {
    if (!ARMIES[sides[f]].build) continue;
    roster = courtRoster(roster, f, createRecruitUnit, createChampionUnit, champion);
    champions[f] = champion;
    pools[f] = culturePool('court');
  }
  return { roster, ...(Object.keys(champions).length ? { champions, pools } : {}) };
}

/** Plan one side's turn with the commander its army uses. */
export function plan(m, f, armyKey) {
  const policy = ARMIES[armyKey].policy;
  if (policy === 'court') {
    const act = (a) => m.apply(a, 'ai:court');
    courtCommander(m, f, { act });
  } else runCommander(m, f, policy);
}
