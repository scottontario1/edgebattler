// Schema-4 replay adapter for the portable match controller. This is the only logging module that
// knows how a saved header maps to campaign/skirmish factories; the generic log driver stays pure.
import { createCampaign, createSkirmish } from '../setup/match.js';
import { RIVER_FORD } from '../content/maps/index.js';
import { DEFAULT_CARD_LIMITS } from '../content/cards.js';
import { SHARD_IDS } from '../content/shards.js';
import { replayLog } from './index.js';

const HEADER_FIELDS = new Set([
  't', 'schema', 'seed', 'maxRounds', 'map', 'rules', 'combat', 'abilityRules', 'abilities',
  'abilitiesEnabled', 'spellsEnabled', 'shardSubset', 'shardRules', 'cardLimits', 'cultures',
  'rarityGate', 'champions', 'pools', 'campaign', 'blue', 'red', 'blueFaction', 'redFaction',
  'playerFaction', 'campaignLevel',
]);

function metaFromHeader(header) {
  const meta = { ...(header.meta || {}) };
  for (const [key, value] of Object.entries(header)) {
    if (!HEADER_FIELDS.has(key)) meta[key] = value;
  }
  return meta;
}

function sameArray(a, b) {
  return Array.isArray(a) && a.length === b.length && a.every((value, index) => value === b[index]);
}

function configDiffers(recorded, defaults) {
  if (!recorded || typeof recorded !== 'object') return false;
  return Object.keys({ ...defaults, ...recorded }).some((key) => recorded[key] !== defaults[key]);
}

/**
 * Explain known cases where the current factories cannot rebuild every legacy header feature.
 * These are advisory: replay still runs, allowing a useful first-difference report where possible.
 */
export function getReplayParityGaps(header) {
  const gaps = [];
  if (header?.shardSubset && !sameArray(header.shardSubset, SHARD_IDS)) {
    gaps.push({ code: 'shard-subset', message: 'The current match factories use the full shard catalogue; the recorded match used a seed-selected shard subset.' });
  }
  if (configDiffers(header?.cardLimits, DEFAULT_CARD_LIMITS)) {
    gaps.push({ code: 'card-limits', message: 'The recorded economy limits differ from the content defaults, and the standard setup factories do not accept card-limit overrides.' });
  }
  if (header?.maxRounds != null && header.maxRounds !== 90 && header.campaign) {
    gaps.push({ code: 'campaign-round-limit', message: 'Campaign setup uses its fixed 90-round limit; the recorded campaign uses a different limit.' });
  }
  if (header?.abilitiesEnabled || header?.spellsEnabled) {
    gaps.push({ code: 'legacy-skills-spells', message: 'The match port retains ability/spell data but does not implement their legacy activation rules.' });
  }
  if (header?.campaign && !Array.isArray(header.campaign.stages)) {
    gaps.push({ code: 'campaign-stages', message: 'The header does not contain the authored encounter stages needed to reconstruct this campaign.' });
  }
  return gaps;
}

/**
 * Build a match from a schema-4 header using the current canonical factories.
 * Supports standard River Ford skirmishes and the three authored campaign missions. Custom maps,
 * rosters and arbitrary match-construction experiments need their own createFromHeader callback.
 */
export function createFromSchema4Header(header, emit = null) {
  if (!header || typeof header !== 'object' || header.schema !== 4) {
    throw new TypeError('Expected a schema-4 match header');
  }
  const log = typeof emit === 'function' ? emit : null;
  const seed = header.seed;
  const combat = Object.hasOwn(header, 'combat') ? header.combat : null;
  const meta = metaFromHeader(header);

  if (header.campaign || header.source === 'campaign') {
    const campaign = header.campaign;
    if (!campaign || typeof campaign !== 'object') {
      throw new TypeError('Campaign replay requires campaign metadata in the header');
    }
    const level = campaign.id || header.campaignLevel;
    if (!level) throw new TypeError('Campaign replay requires campaign.id or campaignLevel');
    const match = createCampaign({
      level,
      faction: campaign.faction || header.playerFaction || 'classic',
      seed,
      combat,
      meta,
      log,
      enemyFactions: campaign.enemyFactions,
      encounters: campaign.stages,
    });
    if (header.map && match.context.board.id !== header.map) {
      throw new Error(`Campaign map mismatch: header has ${header.map}, factory created ${match.context.board.id}`);
    }
    return match;
  }

  if (header.map && header.map !== RIVER_FORD.id) {
    throw new Error(`Unsupported skirmish map: ${header.map}; the standard factory uses ${RIVER_FORD.id}`);
  }
  const blue = header.blueFaction || header.blue || 'classic';
  const red = header.redFaction || header.red || 'classic';
  return createSkirmish({
    blue,
    red,
    seed,
    maxRounds: header.maxRounds ?? null,
    combat,
    meta,
    log,
  });
}

/** Default callbacks to pass to the generic deterministic replay driver. */
export function createMatchReplayAdapter() {
  return Object.freeze({
    createFromHeader: createFromSchema4Header,
    apply: (session, action, actor) => session.apply(action, actor),
    resolve: (session) => session.resolveRound(),
  });
}

/** Replay with the standard factories and include known header-level parity limitations. */
export function replayMatchLog(entries, options = {}) {
  const header = Array.isArray(entries) ? entries.find((entry) => entry?.t === 'header') : null;
  const adapter = { ...createMatchReplayAdapter(), ...options };
  const result = replayLog(entries, adapter);
  return { ...result, parityGaps: header ? getReplayParityGaps(header) : [] };
}
