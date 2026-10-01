// The contract between the HUD and the app layer. Nothing here runs: it is JSDoc only.
//
//   app (session + view-model builders)  --HudViewModel-->  Hud.update(vm)
//   app (input -> match.apply)           <--HudIntent----   Hud.onIntent(handler)
//
// The HUD holds no game rules. Every "can I?" answer (affordable, deployable, combinable, enabled
// buttons and the reason a button is disabled) arrives precomputed in the view model. Slices that did
// not change (deep equality) are not re-rendered, so build the view model freely on every state change.
// Every field marked optional may be absent; the matching element is simply omitted.

/**
 * How a unit or card face is drawn.
 *  - image: a pre-cropped portrait PNG (the faction manifest's `portrait` file, served from /sprites/...).
 *  - svg:   an inline SVG string (the procedural bust from portrait-svg.js `portraitSVG(unit)`). The HUD
 *           rewrites its ids so the same bust can appear several times.
 *  - glyph: a class silhouette for units that have no art yet (`unitId`: pikeman | archer | cavalier).
 * @typedef {{ kind: 'image', src: string } | { kind: 'svg', svg: string } | { kind: 'glyph', unitId: string }} Portrait
 */

/**
 * Top-level view model. `screen` picks between the start menu and the in-game HUD; every other slice is
 * null/absent when it does not apply.
 * @typedef {object} HudViewModel
 * @property {'menu' | 'game'} screen
 * @property {MenuVM | null} [menu]
 * @property {TopBarVM | null} [top]
 * @property {CampaignVM | null} [campaign]
 * @property {ArmyVM | null} [army]
 * @property {TrayVM | null} [tray]
 * @property {ResolveVM | null} [resolve]
 * @property {FeedVM | null} [feed]
 * @property {BannerVM | null} [banner]
 * @property {UnitMenuVM | null} [unitMenu]
 * @property {InspectVM | null} [inspect]
 * @property {CombineVM | null} [combine]
 * @property {ReportVM | null} [report]       battle statistics sheet (opened from the army panel)
 * @property {EndVM | null} [end]             end-of-match screen
 */

// ---------------------------------------------------------------------------------------------- menu

/**
 * @typedef {object} FactionVM
 * @property {string} id            classic | crown | fang | league | court
 * @property {string} name
 * @property {string} tagline
 * @property {string[]} traits
 * @property {string} color         faction primary (hex)
 * @property {string} accent        faction accent (hex)
 */

/**
 * @typedef {object} MenuVM
 * @property {string} title
 * @property {string} subtitle
 * @property {FactionVM[]} factions
 * @property {{ id: string, number: number, title: string, teaches: string }[]} missions
 * @property {{ id: string, label: string }[]} ais            opponent AI choices for skirmish
 * @property {string[]} mirrorAllowed                         faction ids that may face themselves (classic)
 * @property {{ mode: 'campaign' | 'skirmish', you: string, foe: string, ai: string, seed?: number }} defaults
 * @property {string} [error]                                 e.g. a failed launch
 */

// ---------------------------------------------------------------------------------------------- top bar

/**
 * @typedef {object} TopBarVM
 * @property {string} title               mission or "Skirmish: River Ford"
 * @property {string} objective           one line goal
 * @property {number} round
 * @property {number} [maxRound]
 * @property {{ id: 'planning' | 'battle' | 'victory' | 'defeat' | 'draw', label: string }} phase
 * @property {{ current: number, bank: number, income?: number }} supply
 * @property {{ current: number, cap: number }} population      field + bench
 * @property {{ current: number, cap: number }} bench
 * @property {{ remaining: number, max: number }} cycle         shared cycle allowance this round
 * @property {boolean} [canOpenMenu]                            show the "Menu" link
 */

// ---------------------------------------------------------------------------------------------- campaign

/**
 * @typedef {object} CampaignOrderVM
 * @property {'campaignOrder' | 'campaignRally' | 'campaignContinue' | 'nextMission' | 'openMenu'} intent
 * @property {string} label
 * @property {string} [icon]               march | rally | continue | next
 * @property {boolean} enabled
 * @property {string} [reason]             tooltip, shown when disabled
 * @property {boolean} [primary]
 * @property {string} [mission]            nextMission only: the mission id
 */

/**
 * @typedef {object} CampaignVM
 * @property {string} mission              mission title
 * @property {{ name: string, state: 'done' | 'current' | 'pending', waves: number }[]} stages
 * @property {'engage' | 'regroup' | 'exit' | 'complete'} phase
 * @property {string} phaseLabel           "Wave 2/3 - 3 enemies", "Regroup at the village", ...
 * @property {{ c: number, r: number }} [checkpoint]
 * @property {number} [wave]               1-based
 * @property {number} [waves]
 * @property {number} [enemies]
 * @property {CampaignOrderVM[]} orders
 */

// ---------------------------------------------------------------------------------------------- army

/**
 * One row per unit type (variant or class), field and bench together.
 * @typedef {object} ArmyGroupVM
 * @property {string} type                 stable key, e.g. "crownPike"
 * @property {string} name
 * @property {Portrait} portrait
 * @property {number} field                units on the map
 * @property {number} bench                paid reserves
 * @property {number} stars                highest star tier in the group
 * @property {number} hp                   summed current hp of living field units
 * @property {number} maxHp
 * @property {boolean} selected
 * @property {{ shardId: string, name: string, tier: number, tierLabel: string, color: string, effect: string }[]} shards  attached, in slot order
 * @property {number} shardSlots           max attached (3)
 * @property {{ unitIds: string[], label: string, toStars: number } | null} combine  three-of-a-kind available
 * @property {{ label: string, value: string }[]} [stats]    selected group only: MOV, STR, DEF, ...
 * @property {{ name: string, detail: string }} [weapon]     selected group only
 * @property {SkillTimelineVM} [skillTimeline]                selected group only; slots stay display-only while skills are archived
 */

/**
 * A type-wide timeline supplied by the app. The HUD displays exactly three timing slots and never
 * decides whether an ability is legal, affordable, ready, or usable. `enabled` controls the visual
 * state only; a future skill editor can add explicit intents without changing the match boundary.
 * @typedef {object} SkillTimelineVM
 * @property {boolean} enabled
 * @property {string} [status]                                e.g. "Skills are archived"
 * @property {[SkillSlotVM, SkillSlotVM, SkillSlotVM]} slots
 */

/** @typedef {{ time: number, name?: string, detail?: string, icon?: Portrait }} SkillSlotVM */

/**
 * @typedef {object} ArmyVM
 * @property {ArmyGroupVM[]} groups
 * @property {boolean} locked              true while a round plays back (rows are read-only)
 * @property {boolean} [canShowStats]
 */

// ---------------------------------------------------------------------------------------------- tray

/**
 * A card in the hand: a recruit offer or a shard offer.
 * @typedef {object} HandCardVM
 * @property {string} id                   instanceId
 * @property {'unit' | 'shard'} kind
 * @property {string} name
 * @property {number} cost                 Supply
 * @property {'common' | 'uncommon' | 'rare'} rarity
 * @property {boolean} affordable
 * @property {boolean} selected
 * @property {Portrait} [portrait]         unit cards
 * @property {number} [stars]
 * @property {string} [classLabel]         Foot | Mounted | ...
 * @property {number} [range]
 * @property {string} [effect]             one-line description (shard effect text)
 * @property {string} [shardId]            shard cards
 * @property {number} [tier]
 * @property {string} [color]              shard gem colour
 */

/**
 * A paid reserve on the bench.
 * @typedef {object} BenchUnitVM
 * @property {string} id
 * @property {string} name
 * @property {Portrait} portrait
 * @property {number} stars
 * @property {number} hp
 * @property {number} maxHp
 * @property {boolean} selected
 */

/**
 * The detail bar for the selected hand card or bench unit. Actions are precomputed buttons.
 * @typedef {object} DetailVM
 * @property {'unit' | 'shard' | 'reserve'} kind
 * @property {string} title
 * @property {string} text                 effect / description
 * @property {string} [hint]               secondary line (rarity, why a button is off)
 * @property {string} [color]              shard gem colour
 * @property {DetailActionVM[]} actions
 */

/**
 * @typedef {object} DetailActionVM
 * @property {'recruit' | 'buyShard' | 'deploy' | 'cycle'} intent
 * @property {string} label                "Recruit - 2 S"
 * @property {boolean} enabled
 * @property {string} [reason]
 * @property {boolean} [primary]
 * @property {string} [cardId]             recruit / buyShard / cycle (source hand)
 * @property {string} [unitId]             deploy / cycle (source bench)
 * @property {'hand' | 'bench'} [source]   cycle only
 */

/**
 * @typedef {object} ShardItemVM
 * @property {string} id                   shard instance id
 * @property {string} shardId
 * @property {string} name                 "Ruby I"
 * @property {number} tier
 * @property {string} tierLabel            I | II | III
 * @property {string} color
 * @property {string} effect               "+1 Strength"
 * @property {boolean} selected
 */

/**
 * @typedef {object} ShardDockVM
 * @property {number} slots                12
 * @property {ShardItemVM[]} items
 * @property {{ shardId: string, tier: number, label: string, count: number, color: string }[]} combos  three-of-a-kind available
 * @property {{ item: ShardItemVM, classes: { type: string, label: string, count: number, max: number, canApply: boolean }[] } | null} apply
 *           shown when a dock shard is selected: where it can go
 */

/**
 * @typedef {object} TrayVM
 * @property {string} prompt                          one-line planning prompt ("Recruit, deploy, set stances...")
 * @property {boolean} locked                         true during battle (everything read-only)
 * @property {HandCardVM[]} hand
 * @property {number} handLimit                       ordinary hand cap (shard offers sit outside it)
 * @property {{ remaining: number, max: number }} cycle
 * @property {BenchUnitVM[]} bench
 * @property {number} benchCap
 * @property {DetailVM | null} detail
 * @property {ShardDockVM} shards
 */

// ---------------------------------------------------------------------------------------------- resolve / feed

/**
 * @typedef {object} ResolveVM
 * @property {'planning' | 'playback' | 'over'} state
 * @property {string} label                "Start 18s combat"
 * @property {boolean} enabled
 * @property {string} [reason]
 * @property {{ elapsed: number, duration: number }} [clock]   playback only, seconds
 */

/**
 * @typedef {object} FeedEntryVM
 * @property {string} id
 * @property {string} text
 * @property {'good' | 'bad' | 'info' | 'gold' | 'heal'} tone
 * @property {'flag' | 'skull' | 'crown' | 'card' | 'plus' | 'info'} [icon]
 */

/** @typedef {{ title: string, entries: FeedEntryVM[] }} FeedVM  newest first; the app expires entries */

/**
 * Big centred message. The app removes it after a moment (or never, for end banners).
 * @typedef {{ id: string, kind: 'planning' | 'battle' | 'victory' | 'defeat' | 'draw' | 'capture' | 'death', title: string, sub?: string }} BannerVM
 */

// ---------------------------------------------------------------------------------------------- unit menu / inspect

/**
 * Action menu for a selected friendly unit, anchored at a screen point (CSS pixels, viewport space).
 * @typedef {object} UnitMenuVM
 * @property {string} unitId
 * @property {string} name
 * @property {string} subtitle              "Pikeman - 2 stars - HP 24/28"
 * @property {{ x: number, y: number }} anchor   point the menu points at (above the unit)
 * @property {{ id: 'advance' | 'hold' | 'protect', label: string, hint: string, active: boolean, enabled: boolean, reason?: string }[]} stances
 * @property {{ id: string, name: string }[]} [protectTargets]   allies the unit can guard (needed for protect)
 * @property {string} [protectTarget]       current target id
 * @property {{ enabled: boolean, reason?: string }} withdraw
 * @property {boolean} canInspect
 */

/**
 * @typedef {object} InspectVM
 * @property {string} unitId
 * @property {Portrait} portrait
 * @property {string} name
 * @property {'blue' | 'red'} side
 * @property {string} title                 "Pikeman - Foot - Lv 1"
 * @property {number} hp
 * @property {number} maxHp
 * @property {number} stars
 * @property {{ label: string, value: string | number }[]} stats        Str, Mag, Skl, Spd, Def, Res, Mov
 * @property {{ name: string, detail: string }} weapon
 * @property {{ name: string, def: number, avo: number }} [terrain]
 * @property {{ label: string, chips: { text: string, tone?: 'good' | 'bad' | 'info' | 'gold', title?: string }[] }[]} rows
 *           stance, shards, statuses, passives, battle stats ...
 */

// ---------------------------------------------------------------------------------------------- combine / report / end

/**
 * Three-unit upgrade dialog. The app recomputes `preview` when it receives `combinePreview`.
 * @typedef {object} CombineVM
 * @property {string} name
 * @property {string[]} unitIds
 * @property {number} fromStars
 * @property {number} toStars
 * @property {{ id: string, name: string, hp: number, maxHp: number, where: string }[]} options    who survives
 * @property {string} survivorId
 * @property {{ id: 'reserve' | 'field', label: string, hint: string, enabled: boolean }[]} destinations
 * @property {'reserve' | 'field'} destination
 * @property {{ label: string, from: string, to: string, change: 'up' | 'down' | 'same' }[]} [preview]
 * @property {{ before: number, after: number, supplyCost: number }} [population]
 * @property {boolean} ok
 * @property {string} [warning]
 */

/**
 * @typedef {object} ReportRowVM
 * @property {string} name
 * @property {string} status               "Tile 5, 11" | "On bench" | "Fallen"
 * @property {number} dealt
 * @property {number} taken
 */

/**
 * @typedef {object} ReportSideVM
 * @property {{ label: string, name: string, value: number }[]} leaders      most damage dealt / taken
 * @property {ReportRowVM[]} rows
 */

/**
 * @typedef {object} ReportVM
 * @property {string} title
 * @property {{ blue: ReportSideVM, red: ReportSideVM }} sides
 * @property {string} [footnote]
 */

/**
 * @typedef {object} EndVM
 * @property {'victory' | 'defeat' | 'draw'} outcome
 * @property {string} title                "Victory"
 * @property {string} reason               "The enemy keep has fallen"
 * @property {number} round
 * @property {{ label: string, value: string | number }[]} summary     rounds, recruited, lost, captures ...
 * @property {ReportVM} report
 * @property {{ intent: 'restart' | 'nextMission' | 'openMenu', label: string, primary?: boolean, mission?: string }[]} actions
 */

// ---------------------------------------------------------------------------------------------- intents

/**
 * What the HUD asks the app to do. Planning intents mirror `match.apply` action types (the app adds
 * `faction: 'blue'`); the rest are UI-only. Ids are strings, tier/index/c/r are numbers.
 *
 * Planning (engine actions):
 *   { type: 'recruit', cardId }                       buy a unit card onto the bench
 *   { type: 'deploy', unitId, c?, r? }                with c/r: place; without: "enter deploy mode" for that reserve
 *   { type: 'withdraw', unitId }
 *   { type: 'stance', unitId, stance: 'advance'|'hold'|'protect', target? }
 *   { type: 'buyShard', cardId }
 *   { type: 'applyShard', shardId (instance), unitType }
 *   { type: 'removeShard', unitType, index }
 *   { type: 'combineShards', shardId, tier }
 *   { type: 'cycle', source: 'hand'|'bench', cardId? | unitId? }
 *   { type: 'combine', unitIds, survivorId, destination: 'reserve'|'field' }
 *   { type: 'campaignOrder' } { type: 'campaignRally' } { type: 'campaignContinue' }
 *   { type: 'resolve' }
 *
 * UI only:
 *   { type: 'selectCard', cardId }  { type: 'selectReserve', unitId }  { type: 'selectShard', shardId }
 *   { type: 'selectUnitType', unitType }  { type: 'inspect', unitId }  { type: 'closeInspect' }
 *   { type: 'openCombine', unitIds }  { type: 'combinePreview', survivorId, destination }  { type: 'closeCombine' }
 *   { type: 'openStats' }  { type: 'closeStats' }  { type: 'closeMenu' } (unit menu)  { type: 'closePanel' } (Escape)
 *   { type: 'nextMission', mission }  { type: 'restart' }  { type: 'openMenu' }
 *   { type: 'startGame', mode: 'campaign'|'skirmish', mission?, you, foe?, ai?, seed: number | null }
 *
 * Panel collapse (tray, army, feed "more") is presentation state kept inside the Hud; the app never sees it.
 * @typedef {{ type: string, [key: string]: any }} HudIntent
 */

export {};
