// View-model fixtures for the gallery and the tests. Card and shard shapes come from real match summaries
// (tests/fixtures/golden/*.jsonl.gz, `summary` entries); the numbers are those of a Crown campaign, round 3.
import { portraitSVG } from './portrait-svg.js';

const sprite = (key) => ({ kind: 'image', src: `/sprites/factions/${key}-portrait.png` });
const svgFace = (unit) => ({ kind: 'svg', svg: portraitSVG(unit, { variant: 'full' }) });

const BRENNA = { id: 'brenna', name: 'Brenna', cls: 'paladin', faction: 'blue', look: { skin: '#f0cdb4', hair: '#c9b6e6', eyes: '#5a64c8', style: 'long' } };
const CLASSIC_PIKE = { id: 'pike_b1', name: 'Pikeman', cls: 'pikeman', faction: 'blue', look: { skin: '#e8b995', hair: '#6b4226', eyes: '#4a6a9a', style: 'short' } };
const CLASSIC_ARCHER = { id: 'archer_b1', name: 'Archer', cls: 'archer', faction: 'blue', look: { skin: '#f0cdb4', hair: '#b5462b', eyes: '#3f7a4a', style: 'short' } };
const DREG = { id: 'dreg', name: 'Dreg', cls: 'barbarian', faction: 'red', look: { skin: '#d8a98a', hair: '#9c4722', eyes: '#5b7088', style: 'long', beard: true } };

export const FACTIONS = [
  { id: 'classic', name: 'Ashvale (classic)', tagline: "Brenna's kingdom against Dreg's raiders: plain Pikemen, Archers and Cavaliers.", traits: ['Baseline rules', 'Brenna (Paladin) or Dreg (Barbarian)'], color: '#3d5a80', accent: '#c9d6ea' },
  { id: 'crown', name: 'The Argent Crown', tagline: 'Blue and silver. A coherent line beats a strong unit: stand together and the wall holds.', traits: ['Line Doctrine: +1 Defense per adjacent infantry (max +2)', 'Bannerman auras, Oathsworn, Crown Guard'], color: '#1A4FA0', accent: '#B8C4D6' },
  { id: 'fang', name: 'The White Fang Clans', tagline: 'Iron, fur and fangs. Keep the momentum: Advance, make contact, never sit still.', traits: ['Momentum: +2 damage after moving', 'Blood Challenge (Dreg): hunt one enemy'], color: '#6B7280', accent: '#A8231C' },
  { id: 'league', name: 'The Iron League', tagline: 'Brass, bronze and rust. Mercenaries with salvaged ancient machines: prepare a killing ground.', traits: ['Prepared Shot: hold still to hit harder', 'Barricades, Pavise shields, Relic Walkers'], color: '#B5843A', accent: '#4E7C6A' },
  { id: 'court', name: 'The Hollow Court', tagline: 'Bone, velvet and candlelight. A dead aristocracy: defeat their units and you still may not be rid of them.', traits: ['Corpses fuel healing', 'Revenant Vow: return once with 1 HP'], color: '#5B7A7A', accent: '#D9C27A' },
];

export const MISSIONS = [
  { id: 'road', number: 1, title: 'The North Road', teaches: 'Screen your ranged units, clear a patrol, and rally before advancing.' },
  { id: 'woods', number: 2, title: 'The Wooded Approach', teaches: 'Use cover and protect your flanks. A second wave follows the first at each position.' },
  { id: 'pass', number: 3, title: 'The Northern Pass', teaches: 'Choose a route through the pass and preserve your formation through mixed waves.' },
];

/** @type {import('./types.js').MenuVM} */
export const menu = {
  title: 'Chronicle of Ashvale',
  subtitle: 'Recruit a battle line, plan the round, then watch it resolve.',
  factions: FACTIONS,
  missions: MISSIONS,
  ais: [
    { id: 'greedy', label: 'Greedy: recruits and deploys' },
    { id: 'heuristic', label: 'Heuristic: stances, keep marches' },
    { id: 'passive', label: 'Passive: does not play cards' },
  ],
  mirrorAllowed: ['classic'],
  defaults: { mode: 'campaign', you: 'crown', foe: 'classic', ai: 'greedy' },
};

// ------------------------------------------------------------------------------------------------ shards

const SHARD = {
  ruby: { name: 'Ruby', color: '#d6334a', effect: '+1 Strength' },
  sapphire: { name: 'Sapphire', color: '#2f6fe0', effect: '+1 Defence' },
  emerald: { name: 'Emerald', color: '#2fae5c', effect: '+3 Max HP' },
  pearl: { name: 'Pearl', color: '#e8e2d4', effect: 'Heals at the start of each round: 2' },
};
const TIERS = ['I', 'II', 'III'];
const shardItem = (id, shardId, tier = 1, selected = false) => ({
  id, shardId, name: `${SHARD[shardId].name} ${TIERS[tier - 1]}`, tier, tierLabel: TIERS[tier - 1], color: SHARD[shardId].color,
  effect: SHARD[shardId].effect, selected,
});

/** @type {import('./types.js').ShardDockVM} */
export const shardDock = {
  slots: 12,
  items: [shardItem('sh-1', 'emerald'), shardItem('sh-2', 'emerald'), shardItem('sh-3', 'emerald'), shardItem('sh-4', 'ruby', 2), shardItem('sh-5', 'sapphire'), shardItem('sh-6', 'pearl')],
  combos: [{ shardId: 'emerald', tier: 1, label: 'Emerald I', count: 3, color: '#2fae5c' }],
  apply: null,
};
export const shardDockApplying = {
  ...shardDock,
  items: shardDock.items.map((s) => ({ ...s, selected: s.id === 'sh-4' })),
  apply: {
    item: { ...shardDock.items[3], selected: true },
    classes: [
      { type: 'crownPike', label: 'Crown Pikeman', count: 1, max: 3, canApply: true },
      { type: 'crownArcher', label: 'Levy Archer', count: 0, max: 3, canApply: true },
      { type: 'crownCavalier', label: 'Crown Knight', count: 3, max: 3, canApply: false },
    ],
  },
};
const emptyDock = { slots: 12, items: [], combos: [], apply: null };

// ------------------------------------------------------------------------------------------------ hand

const unitCard = (id, key, name, cost, classLabel, range, extra = {}) => ({
  id, kind: 'unit', name, cost, rarity: 'common', affordable: true, selected: false, portrait: sprite(key), stars: 1, classLabel, range, ...extra,
});
const shardCard = (id, shardId, selected = false, affordable = true) => ({
  id, kind: 'shard', name: `${SHARD[shardId].name} Shard`, cost: 1, rarity: 'common', affordable, selected, shardId, tier: 1,
  color: SHARD[shardId].color, effect: SHARD[shardId].effect,
});

const hand = [
  shardCard('card-23-shard', 'emerald'),
  shardCard('card-24-shard', 'ruby'),
  unitCard('card-8-11', 'crownCavalier', 'Crown Knight', 3, 'Mounted', 1),
  unitCard('card-10-9', 'crownArcher', 'Levy Archer', 2, 'Foot', 2, { selected: true }),
  unitCard('card-16-1', 'crownPike', 'Crown Pikeman', 1, 'Foot', 1),
  unitCard('card-21-4', 'crownGuard', 'Crown Guard', 2, 'Foot', 1, { rarity: 'uncommon' }),
  unitCard('card-22-7', 'oathsworn', 'Oathsworn', 3, 'Foot', 1, { rarity: 'rare', affordable: false }),
  shardCard('card-25-shard', 'sapphire', false, true),
];
const bench = [
  { id: 'u-bench-1', name: 'Crown Pikeman', portrait: sprite('crownPike'), stars: 1, hp: 24, maxHp: 24, selected: false },
  { id: 'u-bench-2', name: 'Levy Archer', portrait: sprite('crownArcher'), stars: 2, hp: 11, maxHp: 26, selected: false },
];

const recruitDetail = {
  kind: 'unit', title: 'Levy Archer', text: 'Foot - 1 star - range 2 - default hold', hint: 'Common. Recruit to the paid bench; deploy near controlled locations.',
  actions: [
    { intent: 'recruit', label: 'Recruit - 2 S', enabled: true, primary: true, cardId: 'card-10-9' },
    { intent: 'cycle', label: 'Cycle', enabled: true, source: 'hand', cardId: 'card-10-9' },
  ],
};

/** @type {import('./types.js').TrayVM} */
export const tray = {
  prompt: 'Recruit units, deploy reserves, set stances, then start combat.',
  locked: false, hand, handLimit: 8, cycle: { remaining: 1, max: 1 }, bench, benchCap: 8, detail: recruitDetail, shards: shardDock,
};

// ------------------------------------------------------------------------------------------------ top / army / campaign

/** @type {import('./types.js').TopBarVM} */
export const top = {
  title: 'Mission 1 - The North Road',
  objective: 'Clear the patrol, rally, march north',
  round: 3,
  phase: { id: 'planning', label: 'Planning' },
  supply: { current: 5, bank: 30, income: 3 },
  population: { current: 7, cap: 10 },
  bench: { current: 2, cap: 8 },
  cycle: { remaining: 1, max: 1 },
  canOpenMenu: true,
};

const group = (type, key, name, field, benchCount, hp, maxHp, extra = {}) => ({
  type, name, portrait: sprite(key), field, bench: benchCount, stars: 1, hp, maxHp, selected: false, shards: [], shardSlots: 3, combine: null, ...extra,
});

/** @type {import('./types.js').ArmyVM} */
export const army = {
  locked: false,
  canShowStats: true,
  groups: [
    group('brenna', 'brenna', 'Brenna', 1, 0, 28, 28, { portrait: svgFace(BRENNA), stars: 0 }),
    group('crownPike', 'crownPike', 'Crown Pikeman', 3, 1, 61, 72, {
      selected: true, stars: 2,
      shards: [{ shardId: 'emerald', name: 'Emerald I', tier: 1, tierLabel: 'I', color: '#2fae5c', effect: '+3 Max HP' }, { shardId: 'ruby', name: 'Ruby II', tier: 2, tierLabel: 'II', color: '#d6334a', effect: '+2 Strength' }],
      combine: { unitIds: ['u1', 'u2', 'u3'], label: 'Combine x3', toStars: 3 },
      stats: [{ label: 'MOV', value: 4 }, { label: 'STR', value: 10 }, { label: 'DEF', value: 11 }, { label: 'SPD', value: 4 }, { label: 'SKL', value: 5 }, { label: 'RES', value: 1 }, { label: 'RNG', value: 1 }, { label: 'LV', value: 2 }],
      weapon: { name: 'Iron Pike', detail: 'Mt 6 - Hit 85 - Crt 0' },
    }),
    group('crownArcher', 'crownArcher', 'Levy Archer', 2, 1, 30, 44, { stars: 1 }),
    group('crownCavalier', 'crownCavalier', 'Crown Knight', 1, 0, 24, 24),
  ],
};

/** @type {import('./types.js').CampaignVM} */
export const campaign = {
  mission: 'The North Road',
  stages: [{ name: 'South patrol', state: 'current', waves: 1 }, { name: 'Middle line', state: 'pending', waves: 1 }, { name: 'North guard', state: 'pending', waves: 1 }],
  phase: 'engage', phaseLabel: 'Wave 1/1 - 3 enemies', checkpoint: { c: 5, r: 11 }, wave: 1, waves: 1, enemies: 3,
  orders: [{ intent: 'campaignOrder', label: 'March north', icon: 'march', enabled: true }],
};
export const campaignRegroup = {
  ...campaign,
  stages: [{ name: 'South patrol', state: 'current', waves: 1 }, { name: 'Middle line', state: 'pending', waves: 1 }, { name: 'North guard', state: 'pending', waves: 1 }],
  phase: 'regroup', phaseLabel: 'Regroup at the village', enemies: 0,
  orders: [
    { intent: 'campaignOrder', label: 'Regroup', icon: 'march', enabled: true },
    { intent: 'campaignRally', label: 'Rally +4 HP', icon: 'rally', enabled: false, reason: 'Move an ally within 2 tiles of the checkpoint first' },
    { intent: 'campaignContinue', label: 'Continue north', icon: 'continue', enabled: false, primary: true, reason: 'Move an ally within 2 tiles of the checkpoint first' },
  ],
};
export const campaignComplete = {
  ...campaign,
  stages: campaign.stages.map((s) => ({ ...s, state: 'done' })),
  phase: 'complete', phaseLabel: 'The north road is secured', checkpoint: undefined,
  orders: [{ intent: 'nextMission', label: 'Next mission', icon: 'next', enabled: true, primary: true, mission: 'woods' }],
};

/** @type {import('./types.js').ResolveVM} */
export const resolve = { state: 'planning', label: 'Start 18s combat', enabled: true };

/** @type {import('./types.js').FeedVM} */
export const feed = {
  title: 'Round results',
  entries: [
    { id: 'f3', text: 'Captured village (5, 11)', tone: 'good', icon: 'flag' },
    { id: 'f2', text: 'Levy Archer fallen', tone: 'bad', icon: 'skull' },
    { id: 'f1', text: 'Hand full: 2 cards not drawn', tone: 'info', icon: 'card' },
  ],
};

// ------------------------------------------------------------------------------------------------ dialogs

/** @type {import('./types.js').UnitMenuVM} */
export const unitMenu = {
  unitId: 'u1', name: 'Crown Pikeman', subtitle: 'Foot - 2 stars - HP 24/28', anchor: { x: 520, y: 360 },
  stances: [
    { id: 'advance', label: 'Advance', hint: 'Moves toward the nearest foe and attacks', active: true, enabled: true },
    { id: 'hold', label: 'Hold', hint: 'Stays put and attacks what comes into reach', active: false, enabled: true },
    { id: 'protect', label: 'Protect', hint: 'Guards nearby allies and intercepts foes', active: false, enabled: true },
  ],
  protectTargets: [{ id: 'brenna', name: 'Brenna' }, { id: 'u4', name: 'Levy Archer' }],
  withdraw: { enabled: true }, canInspect: true,
};

/** @type {import('./types.js').InspectVM} */
export const inspect = {
  unitId: 'u1', portrait: sprite('crownPike'), name: 'Crown Pikeman', side: 'blue', title: 'Levy - Foot - Lv 2', hp: 24, maxHp: 28, stars: 2,
  stats: [{ label: 'Str', value: 10 }, { label: 'Mag', value: 0 }, { label: 'Skl', value: 5 }, { label: 'Spd', value: 4 },
    { label: 'Def', value: 11 }, { label: 'Res', value: 1 }, { label: 'Mov', value: 4 }, { label: 'Pop', value: 2 }],
  weapon: { name: 'Iron Pike', detail: 'Mt 6 - Hit 85 - Crt 0 - Rng 1' },
  terrain: { name: 'Forest', def: 1, avo: 20 },
  rows: [
    { label: 'Stance', chips: [{ text: 'Advance', tone: 'info' }] },
    { label: 'Shards', chips: [{ text: 'Emerald I +3 HP', tone: 'good' }, { text: 'Ruby II +2 STR', tone: 'bad' }] },
    { label: 'Passives', chips: [{ text: 'Line Doctrine', tone: 'gold', title: '+1 Defense per adjacent friendly infantry (max +2)' }] },
    { label: 'Statuses', chips: [] },
  ],
};

/** @type {import('./types.js').CombineVM} */
export const combine = {
  name: 'Crown Pikeman', unitIds: ['u1', 'u2', 'u3'], fromStars: 1, toStars: 2,
  options: [
    { id: 'u1', name: 'Crown Pikeman', hp: 24, maxHp: 24, where: 'Tile 5, 11' },
    { id: 'u2', name: 'Crown Pikeman', hp: 17, maxHp: 24, where: 'Tile 4, 12' },
    { id: 'u3', name: 'Crown Pikeman', hp: 24, maxHp: 24, where: 'Reserve' },
  ],
  survivorId: 'u1',
  destinations: [
    { id: 'reserve', label: 'Reserve bench', hint: 'Result waits off the map', enabled: true },
    { id: 'field', label: 'Keep field tile', hint: 'Result stays on its tile', enabled: true },
  ],
  destination: 'field',
  preview: [
    { label: 'HP', from: '24/24', to: '38/38', change: 'up' }, { label: 'STR', from: '8', to: '10', change: 'up' }, { label: 'DEF', from: '9', to: '11', change: 'up' },
    { label: 'SKL', from: '5', to: '6', change: 'up' }, { label: 'SPD', from: '4', to: '5', change: 'up' }, { label: 'MOV', from: '4', to: '4', change: 'same' },
  ],
  population: { before: 7, after: 8, supplyCost: 0 }, ok: true,
};
export const combineBlocked = {
  ...combine, ok: false, warning: 'The chosen copy is on the reserve bench, so it has no field tile. Choose the reserve bench or a fielded copy.',
  survivorId: 'u3', destination: 'field', preview: [],
  destinations: [{ id: 'reserve', label: 'Reserve bench', hint: 'Result waits off the map', enabled: true }, { id: 'field', label: 'Keep field tile', hint: 'Needs a fielded survivor', enabled: false }],
};

const reportSide = (rows, leaders) => ({ rows, leaders });
/** @type {import('./types.js').ReportVM} */
export const report = {
  title: 'Battle statistics',
  sides: {
    blue: reportSide([
      { name: 'Brenna', status: 'Tile 5, 9', dealt: 41, taken: 12 },
      { name: 'Crown Pikeman', status: 'Tile 4, 10', dealt: 28, taken: 19 },
      { name: 'Levy Archer', status: 'Fallen', dealt: 22, taken: 18 },
      { name: 'Crown Knight', status: 'On bench', dealt: 0, taken: 0 },
    ], [{ label: 'Most damage dealt', name: 'Brenna', value: 41 }, { label: 'Most damage taken', name: 'Crown Pikeman', value: 19 }]),
    red: reportSide([
      { name: 'Dreg', status: 'Tile 10, 3', dealt: 30, taken: 25 },
      { name: 'Raider Pikeman', status: 'Fallen', dealt: 12, taken: 24 },
    ], [{ label: 'Most damage dealt', name: 'Dreg', value: 30 }, { label: 'Most damage taken', name: 'Raider Pikeman', value: 24 }]),
  },
  footnote: 'Strike damage after mitigation, including overkill.',
};

const summary = [{ label: 'Recruited', value: 21 }, { label: 'Lost', value: 15 }, { label: 'Kills', value: 16 }, { label: 'Captures', value: 1 }, { label: 'Supply spent', value: 35 }];
/** @type {import('./types.js').EndVM} */
export const endVictory = {
  outcome: 'victory', title: 'Victory', reason: 'The north road is secured', round: 12, summary, report,
  actions: [{ intent: 'nextMission', label: 'Next mission', primary: true, mission: 'woods' }, { intent: 'restart', label: 'Replay' }, { intent: 'openMenu', label: 'Menu' }],
};
export const endDefeat = {
  outcome: 'defeat', title: 'Defeat', reason: 'Your army has fallen', round: 7, summary: summary.slice(0, 4), report,
  actions: [{ intent: 'restart', label: 'Try again', primary: true }, { intent: 'openMenu', label: 'Menu' }],
};
export const endDraw = {
  outcome: 'draw', title: 'Draw', reason: 'The round limit was reached', round: 30, summary: summary.slice(0, 3), report,
  actions: [{ intent: 'restart', label: 'Play again', primary: true }, { intent: 'openMenu', label: 'Menu' }],
};

// ------------------------------------------------------------------------------------------------ composed screens

/** @type {import('./types.js').HudViewModel} */
export const planning = { screen: 'game', top, campaign, army, tray, resolve, feed: null };

export const planningShardApply = { ...planning, tray: { ...tray, shards: shardDockApplying, detail: null } };

export const planningShardOffer = { ...planning, tray: { ...tray, hand: hand.map((c) => ({ ...c, selected: c.id === 'card-24-shard' })), detail: {
  kind: 'shard', title: 'Ruby Shard', text: '+1 Strength for every unit of a class', color: '#d6334a', hint: 'Persistent. Costs 1 Supply.',
  actions: [{ intent: 'buyShard', label: 'Buy - 1 S', enabled: true, primary: true, cardId: 'card-24-shard' }, { intent: 'cycle', label: 'Cycle', enabled: true, source: 'hand', cardId: 'card-24-shard' }] } } };

export const planningBenchSelected = { ...planning, tray: { ...tray, hand: hand.map((c) => ({ ...c, selected: false })), bench: bench.map((b) => ({ ...b, selected: b.id === 'u-bench-2' })), detail: {
  kind: 'reserve', title: 'Levy Archer - 2 stars', text: 'Paid bench unit. Deploy without paying again, or cycle for a full refund.', hint: 'Refund 6 Supply, free 2 population.',
  actions: [{ intent: 'deploy', label: 'Deploy', enabled: true, primary: true, unitId: 'u-bench-2' }, { intent: 'cycle', label: 'Cycle +6 S', enabled: false, reason: 'Cycle already used this round', source: 'bench', unitId: 'u-bench-2' }] } } };

export const planningUnitMenu = { ...planning, unitMenu };

export const battle = {
  ...planning,
  top: { ...top, phase: { id: 'battle', label: 'Battle' } },
  tray: { ...tray, locked: true },
  army: { ...army, locked: true },
  resolve: { state: 'playback', label: 'Battle', enabled: false, clock: { elapsed: 7.4, duration: 18 } },
  feed,
  banner: { id: 'b1', kind: 'battle', title: 'Battle', sub: 'Round 3' },
};

export const campaignRegroupScreen = { ...planning, campaign: campaignRegroup, feed: { title: 'Round results', entries: [{ id: 'r1', text: 'South patrol cleared', tone: 'good', icon: 'flag' }] } };

/** A fresh classic skirmish: SVG busts instead of image portraits, no campaign panel. */
export const skirmish = {
  screen: 'game',
  top: { ...top, title: 'Skirmish - River Ford', objective: 'Hold the enemy keep or destroy the army', round: 1, maxRound: 30, supply: { current: 3, bank: 30 }, population: { current: 5, cap: 10 }, bench: { current: 0, cap: 8 } },
  campaign: null,
  army: {
    locked: false, canShowStats: true,
    groups: [
      group('brenna', 'brenna', 'Brenna', 1, 0, 28, 28, { portrait: svgFace(BRENNA), stars: 0 }),
      group('pikeman', 'pikeman', 'Pikeman', 2, 0, 48, 48, { portrait: svgFace(CLASSIC_PIKE) }),
      group('archer', 'archer', 'Archer', 1, 0, 18, 18, { portrait: svgFace(CLASSIC_ARCHER) }),
    ],
  },
  tray: {
    ...tray, shards: { ...emptyDock, items: [] }, bench: [],
    hand: [
      { id: 'c1', kind: 'unit', name: 'Pikeman', cost: 1, rarity: 'common', affordable: true, selected: false, portrait: { kind: 'glyph', unitId: 'pikeman' }, stars: 1, classLabel: 'Foot', range: 1 },
      { id: 'c2', kind: 'unit', name: 'Archer', cost: 2, rarity: 'common', affordable: true, selected: false, portrait: svgFace(CLASSIC_ARCHER), stars: 1, classLabel: 'Foot', range: 2 },
      { id: 'c3', kind: 'unit', name: 'Cavalier', cost: 3, rarity: 'common', affordable: true, selected: false, portrait: { kind: 'glyph', unitId: 'cavalier' }, stars: 1, classLabel: 'Mounted', range: 1 },
      { id: 'c4', kind: 'unit', name: 'Cavalier', cost: 3, rarity: 'common', affordable: false, selected: false, portrait: { kind: 'glyph', unitId: 'cavalier' }, stars: 1, classLabel: 'Mounted', range: 1 },
      { id: 'c5', kind: 'unit', name: 'Archer', cost: 2, rarity: 'common', affordable: true, selected: false, portrait: svgFace(CLASSIC_ARCHER), stars: 1, classLabel: 'Foot', range: 2 },
    ],
    detail: null,
  },
  resolve: { state: 'planning', label: 'Start 18s combat', enabled: true },
};

/** Nothing recruited, nothing in hand: the empty states of every panel. */
export const empty = {
  screen: 'game',
  top: { ...top, title: 'Skirmish - River Ford', objective: 'Hold the enemy keep', round: 1, supply: { current: 0, bank: 30 }, population: { current: 0, cap: 10 }, bench: { current: 0, cap: 8 }, cycle: { remaining: 0, max: 1 } },
  army: { groups: [], locked: false, canShowStats: false },
  tray: { prompt: 'Nothing to play this round.', locked: false, hand: [], handLimit: 8, cycle: { remaining: 0, max: 1 }, bench: [], benchCap: 8, detail: null, shards: emptyDock },
  resolve: { state: 'planning', label: 'Start 18s combat', enabled: false, reason: 'Nothing to resolve: no units on the field' },
};

export const menuError = { screen: 'menu', menu: { ...menu, error: 'Could not start the match: the opponent faction failed to load. Pick another and try again.', defaults: { ...menu.defaults, mode: 'skirmish', foe: 'fang' } } };
export const menuView = { screen: 'menu', menu };

export const VIEW_MODELS = {
  menu: menuView,
  'menu-skirmish': menuError,
  planning,
  'planning-shard': planningShardApply,
  'planning-shard-offer': planningShardOffer,
  'planning-bench': planningBenchSelected,
  'unit-menu': planningUnitMenu,
  battle,
  regroup: campaignRegroupScreen,
  skirmish,
  empty,
  inspect: { ...planning, inspect },
  combine: { ...planning, combine },
  'combine-blocked': { ...planning, combine: combineBlocked },
  report: { ...planning, report },
  'end-victory': { ...planning, campaign: campaignComplete, resolve: { ...resolve, state: 'over' }, end: endVictory },
  'end-defeat': { ...planning, resolve: { ...resolve, state: 'over' }, end: endDefeat },
  'end-draw': { ...skirmish, resolve: { ...resolve, state: 'over' }, end: endDraw },
};
