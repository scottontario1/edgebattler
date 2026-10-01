// Shard dock, apply bar and applied-shard summary (docs/SHARDS.md). Pure template functions:
// ui.js passes plain data in and wires behaviour through these data attributes, which must be kept:
//   [data-shard-id]  a filled dock slot (selects it)        [data-combine-shard="<shardId>:<tier>"]
//   [data-apply-shard-class="<cls>"] apply the selected shard [data-remove-shard="<cls>:<index>"]
import { esc } from './util.js';
import { SHARDS, SHARD_TIER_LABELS, SHARD_RULES, shardLabel, shardEffectText } from '../shards.js';

const tierLabel = (tier) => SHARD_TIER_LABELS[tier - 1] ?? String(tier);

/** Faceted gem glyph tinted by `color`; a light/dark overlay gives the facets. */
export function gemSVG(color, size = 20) {
  return `<svg class="gem" viewBox="0 0 24 24" width="${size}" height="${size}" aria-hidden="true" focusable="false"><path d="M12 2 21 9 12 22 3 9Z" fill="${esc(color)}" stroke="rgba(0,0,0,.55)" stroke-width="1" stroke-linejoin="round"/><path d="M12 2 21 9H3Z" fill="#fff" fill-opacity=".38"/><path d="M12 22 8 9h8Z" fill="#000" fill-opacity=".22"/><path d="M6.5 8.2 9 5.6" stroke="#fff" stroke-opacity=".8" stroke-width="1.3" stroke-linecap="round"/></svg>`;
}

const shardTitle = (s) => `${shardLabel(s.shardId, s.tier)} (${SHARDS[s.shardId]?.title ?? ''}): ${shardEffectText(s.shardId, s.tier)}`;

/**
 * m: { dock: [{id, shardId, tier}], selectedShardId, combos: [{shardId, tier}] }
 */
export function shardDockHTML(m) {
  const slots = [];
  for (let i = 0; i < SHARD_RULES.dockSlots; i++) {
    const s = m.dock[i];
    if (!s) { slots.push('<span class="shard-slot empty" aria-label="Empty shard slot"></span>'); continue; }
    const def = SHARDS[s.shardId];
    const sel = s.id === m.selectedShardId;
    slots.push(`<button type="button" class="shard-slot filled${sel ? ' selected' : ''}" style="--gem:${esc(def?.color ?? '#999')}" data-shard-id="${esc(s.id)}" aria-pressed="${sel}" title="${esc(shardTitle(s))}" aria-label="${esc(shardTitle(s))}">${gemSVG(def?.color ?? '#999')}<i class="tier t${s.tier}">${tierLabel(s.tier)}</i></button>`);
  }
  const combos = (m.combos || []).map((c) => `<button type="button" class="shard-combine" data-combine-shard="${esc(c.shardId)}:${c.tier}" title="Merge three ${esc(shardLabel(c.shardId, c.tier))} into one ${esc(shardLabel(c.shardId, c.tier + 1))}">${gemSVG(SHARDS[c.shardId]?.color, 14)}Combine ${esc(shardLabel(c.shardId, c.tier))} ×3</button>`).join('');
  return `<div class="shard-dock" aria-label="Shard dock"><span class="shard-count" title="Shards stored between rounds. Select one to apply it to a unit class.">Shards <b>${m.dock.length}/${SHARD_RULES.dockSlots}</b></span><div class="shard-slots">${slots.join('')}</div>${combos ? `<div class="shard-combos">${combos}</div>` : ''}</div>`;
}

/**
 * Apply bar for the selected dock shard (shares the tray's detail-bar styling).
 * m: { shard: {id, shardId, tier}, classes: [{id, label, count, max}] }
 */
export function shardApplyHTML(m) {
  const s = m.shard;
  const def = SHARDS[s.shardId];
  const buttons = m.classes.map((c) => {
    const full = c.count >= c.max;
    return `<button type="button" class="shard-apply" data-apply-shard-class="${esc(c.id)}"${full ? ' disabled' : ''} title="${esc(full ? `${c.label} already holds ${c.max} shards` : `Apply ${shardLabel(s.shardId, s.tier)} to every ${c.label}`)}">${esc(c.label)} <span class="n">${c.count}/${c.max}</span></button>`;
  }).join('');
  return `<div class="plan-detail shard-detail"><div class="plan-detail-text" title="${esc(shardTitle(s))}">${gemSVG(def.color, 16)}<b>${esc(shardLabel(s.shardId, s.tier))}</b> <span class="effect">${esc(shardEffectText(s.shardId, s.tier))}</span></div><span class="shard-apply-label">Apply to</span><div class="shard-apply-row">${buttons}</div></div>`;
}

/**
 * Applied shards per class. m: { classes: [{id, label, shards: [{shardId, tier}]}] } (classes with shards only)
 */
export function appliedShardsHTML(m) {
  const entries = m.classes.filter((c) => c.shards.length).map((c) => `<div class="applied-class" aria-label="${esc(c.label)} shards"><b>${esc(c.label)}</b>${c.shards.map((s, i) => `<button type="button" class="applied-chip" style="--gem:${esc(SHARDS[s.shardId]?.color ?? '#999')}" data-remove-shard="${esc(c.id)}:${i}" title="${esc(shardTitle(s))}. Click to return it to the dock.">${gemSVG(SHARDS[s.shardId]?.color, 14)}${esc(shardLabel(s.shardId, s.tier))}<span class="x" aria-hidden="true">×</span></button>`).join('')}</div>`);
  return `<div class="applied-shards" aria-label="Applied shards">${entries.join('') || '<span class="no-shards">No shards applied</span>'}</div>`;
}
