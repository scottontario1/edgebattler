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
export const ARMIES = {
  base: { label: 'Baseline (shipped classes)', culture: null, policy: 'heuristic' },
  court: { label: 'Court', culture: () => buildHollowCourt(), policy: 'court' },
  courtOff: { label: 'Court without death mechanics', culture: () => buildHollowCourt(DEATH_OFF), policy: 'court' },
  courtPlain: { label: 'Court under the shipped heuristic', culture: () => buildHollowCourt(), policy: 'heuristic' },
};

/** Register the (single) culture the two armies need; throws if they need two different Court builds. */
export function setupCulture(armyKeys) {
  resetCultures();
  const wanted = [...new Set(armyKeys.map((k) => ARMIES[k].culture && k === 'courtOff' ? 'off' : ARMIES[k].culture ? 'full' : null).filter(Boolean))];
  if (wanted.length > 1) throw new Error('one Court build per process');
  if (wanted.length) registerCulture(wanted[0] === 'off' ? buildHollowCourt(DEATH_OFF) : buildHollowCourt());
}

/** createMatch options for one game: sides = { blue: armyKey, red: armyKey }. Culture must already be registered. */
export function matchOptions(sides, champion = DEFAULT_CHAMPION) {
  let roster = UNITS;
  const champions = {}, pools = {};
  for (const f of ['blue', 'red']) {
    if (!ARMIES[sides[f]].culture) continue;
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
