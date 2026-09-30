import { CARD_LIMITS, setCardLimits } from './cards.js';
// Game-data logging. The match controller (src/match.js) emits plain entries; these helpers collect
// them as JSON Lines, ship them to the dev server (browser) and replay a log to check determinism.
//
// Entry kinds (field `t`):
//   header   schema, seed, maxRounds, map, rules, cardLimits, + meta (source, policies, commit, ...)
//   (schema 4: shard actions buyShard/applyShard/removeShard/combineShards/grantShard; header.abilitiesEnabled)
//   action   round, actor ('human' | 'ai:<policy>'), action {type, faction, ...}, ok, reason?, result?
//   round    round, batches [{ type: spells | abilities | movement | combat | results, events }]
//   summary  round, blue {...}, red {...}   state after that round (round 0 = start)
//   result   round, winner ('blue' | 'red' | null), reason, stats
import { createMatch, SCHEMA } from './match.js';
import { CAMPAIGN_BY_ID, createCampaignMatch } from './campaign.js';
import { MAP } from './board.js';

export const toJSONL = (entries) => entries.map((e) => JSON.stringify(e)).join('\n') + '\n';
export const fromJSONL = (text) => text.split('\n').filter((l) => l.trim()).map((l) => JSON.parse(l));

/** In-memory collector: `const log = memoryLog(); createMatch({ log: log.push })`. */
export function memoryLog() {
  const entries = [];
  return { entries, push: (e) => entries.push(e), text: () => toJSONL(entries) };
}

/**
 * Browser logger for real play: buffers entries and POSTs them to the dev server's `/__log`
 * endpoint (vite.config.js) after every round and when the page is hidden. The file name is chosen
 * once per game. Missing endpoint (production build) is ignored silently.
 */
export function playLog({ endpoint = '/__log', name = `${new Date().toISOString().replace(/[:.]/g, '-')}` } = {}) {
  const pending = [];
  const all = [];
  let file = name;
  const flush = (beacon = false) => {
    if (!pending.length) return;
    const body = JSON.stringify({ file, text: toJSONL(pending.splice(0)) });
    try {
      if (beacon && navigator.sendBeacon) navigator.sendBeacon(endpoint, new Blob([body], { type: 'application/json' }));
      else fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body, keepalive: true }).catch(() => {});
    } catch { /* logging must never break the game */ }
  };
  addEventListener('pagehide', () => flush(true));
  return {
    entries: all,
    push(e) {
      if (e.t === 'header') file = `${name}-seed${e.seed}`;
      pending.push(e);
      all.push(e);
      if (e.t === 'summary' || e.t === 'result') flush();
    },
    flush,
    text: () => toJSONL(all),
  };
}

/**
 * Re-run a logged game from its header seed and logged actions. Returns { ok, mismatches } where a
 * mismatch is a summary/result entry that differs from the log (the rules or RNG changed, or a
 * nondeterministic code path crept in).
 */
export function replay(entries, { create } = {}) {
  const header = entries.find((e) => e.t === 'header');
  if (!header) return { ok: false, mismatches: [{ reason: 'no-header' }] };
  if(header.schema!==SCHEMA) return {ok:false,mismatches:[{reason:'unsupported-schema',schema:header.schema,expected:SCHEMA}]};
  if (!create && header.campaign) create = (h,push) => createCampaignMatch(CAMPAIGN_BY_ID[h.campaign.id], { faction: h.campaign.faction, seed: h.seed, log: push, enemyFactions: h.campaign.enemyFactions, encounters: h.campaign.stages, combat:h.combat||null, abilities:h.abilitiesEnabled===true });
  if (!create && header.map && header.map !== MAP.id) return { ok: false, mismatches: [{ reason: 'unsupported-map', map: header.map, active: MAP.id }] };
  const previousLimits={...CARD_LIMITS};
  setCardLimits(header.cardLimits || previousLimits);
  try {
    const out = memoryLog();
    // Custom scenarios (other map, roster, candidate rules) pass create(header, log) to rebuild the same match.
    const m = create ? create(header, out.push) : createMatch({ seed: header.seed, maxRounds: header.maxRounds, log: out.push, pools: header.pools ?? null, abilities: header.abilitiesEnabled === true, combat:header.combat||null });
    for (const e of entries) {
      if (e.t === 'action') m.apply(e.action, e.actor);
      else if (e.t === 'round') m.resolveRound();
    }
    const pick = (list) => list.filter((e) => ['action','round','summary','result'].includes(e.t)).map((e) => JSON.stringify(e));
    const want = pick(entries), got = pick(out.entries);
    const mismatches = [];
    for (let i = 0; i < Math.max(want.length, got.length); i += 1) {
      if (want[i] !== got[i]) mismatches.push({ index: i, want: want[i] && JSON.parse(want[i]), got: got[i] && JSON.parse(got[i]) });
    }
    return { ok: !mismatches.length, mismatches, match: m };
  } finally {setCardLimits(previousLimits);}
}
