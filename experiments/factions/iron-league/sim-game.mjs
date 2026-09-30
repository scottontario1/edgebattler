// One League simulation game: builds the match for a spec, plays it with the chosen commanders and returns a summary row.
//
// spec = { seed, map, blue, red, maxRounds, params? } (params: League commander overrides, see DEFAULT_LEAGUE_PARAMS), where blue / red is one of
//   'baseline'         the shipped starting army, the shared card pool, the shipped heuristic commander
//   'league'           the League starting army (its champion, League Pikemen, a Crossbowman, a Pavise Guard), the League pool, the League commander
//   'league-heuristic' the same League army and pool, driven by the SHIPPED heuristic (shows what the shipped AI does with League cards)
// Everything is built from the spec, so a log header (meta.spec) is enough to replay a game (replayGame).
import { createMatch, setExperimentRules } from '../../../src/match.js';
import { setMap } from '../../../src/board.js';
import { UNITS, createRecruitUnit, createChampionUnit } from '../../../src/roster.js';
import { culturePool, registerCulture, resetCultures } from '../../../src/cultures.js';
import { setRarityGate } from '../../../src/cards.js';
import { runCommander } from '../../../src/ai/commander.js';
import { memoryLog, replay } from '../../../src/log.js';
import { disableCandidates } from '../../candidates/index.mjs';
import { leagueDef, mapByName } from './common.mjs';
import { leagueCommander } from './commander.mjs';

export const RARITY_GATE = { uncommon: 3, rare: 6 }; // Scott's confirmed time gate (FACTIONS.md 1b)
const CHAMPION = { blue: 'ilseVoss', red: 'ilseVossRed' }; // the default champion; red gets an identical twin so a mirror is possible
const isLeague = (kind) => kind === 'league' || kind === 'league-heuristic';

/** The starting army of one side: the shipped roster, or the League's in the same places (Captain for the champion, Pavise Guard for the Cavalier). */
function leagueArmy(faction) {
  const rec = (key, id, c, r) => createRecruitUnit(key, id, faction, c, r);
  return faction === 'blue'
    ? [createChampionUnit(CHAMPION.blue, 'blue', 5, 9), rec('leaguePike', 'pike_b1', 3, 9), rec('leaguePike', 'pike_b2', 4, 10), rec('coil', 'archer_b1', 1, 9), rec('pavise', 'cav_b1', 3, 7)]
    : [createChampionUnit(CHAMPION.red, 'red', 10, 3), rec('leaguePike', 'pike_r1', 9, 6), rec('coil', 'archer_r1', 12, 4), rec('coil', 'archer_r2', 11, 1), rec('pavise', 'cav_r1', 12, 2)];
}

export function buildGame(spec, log = null) {
  setMap(mapByName(spec.map));
  disableCandidates();
  setExperimentRules({});
  resetCultures();
  registerCulture(leagueDef({ aliasChampion: true }));
  setRarityGate(RARITY_GATE);
  const sides = { blue: spec.blue, red: spec.red };
  const roster = [];
  for (const f of ['blue', 'red']) {
    if (isLeague(sides[f])) roster.push(...leagueArmy(f));
    else roster.push(...structuredClone(UNITS.filter((u) => u.faction === f)));
  }
  const pools = {};
  const champions = {};
  for (const f of ['blue', 'red']) if (isLeague(sides[f])) { pools[f] = culturePool('league'); champions[f] = CHAMPION[f]; }
  return createMatch({ seed: spec.seed, maxRounds: spec.maxRounds ?? 30, log, roster, pools: Object.keys(pools).length ? pools : null,
    champions: Object.keys(champions).length ? champions : null, meta: { source: 'league-sim', spec } });
}

export function planSide(m, f, kind, params = {}) {
  if (kind === 'league') return leagueCommander(m, f, { act: (a) => m.apply(a, 'ai:league'), params });
  return runCommander(m, f, 'heuristic');
}

export function playGame(spec, { keepLog = false } = {}) {
  const log = memoryLog();
  const m = buildGame(spec, log.push);
  while (!m.over) {
    planSide(m, 'blue', spec.blue, spec.params);
    planSide(m, 'red', spec.red, spec.params);
    m.resolveRound();
  }
  const s = m.stats();
  const sum = (o) => Object.values(o).reduce((a, b) => a + b, 0);
  const rounds = log.entries.filter((e) => e.t === 'round').length;
  const row = {
    seed: spec.seed, map: spec.map, blue: spec.blue, red: spec.red, winner: m.winner || 'draw', reason: m.reason, rounds,
    ...Object.fromEntries(['blue', 'red'].flatMap((f) => [
      [`${f}_captures`, s[f].captures], [`${f}_lost`, sum(s[f].lost)], [`${f}_killed`, sum(s[f].killed)], [`${f}_recruited`, sum(s[f].recruited)],
      [`${f}_ability_uses`, sum(s[f].abilities)], [`${f}_abilities`, JSON.stringify(s[f].abilities)], [`${f}_spells`, JSON.stringify(s[f].spells)],
      [`${f}_recruits`, JSON.stringify(s[f].recruited)], [`${f}_final_units`, m.summary(f).units], [`${f}_final_hp`, m.summary(f).hp],
    ])),
  };
  return keepLog ? { row, log } : { row };
}

/** Rebuild a game from its log header and check every logged action and summary. */
export function replayGame(entries) {
  return replay(entries, { create: (header, push) => buildGame(header.spec, push) });
}
