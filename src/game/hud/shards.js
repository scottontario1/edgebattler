// Shard dock: 12 slots, apply the selected shard to a unit type, combine three of a kind.
// (Removing an attached shard lives on the army panel; buying one lives in the hand detail bar.)
import { esc, intentAttrs, stateAttrs } from './util.js';
import { gemIcon } from './icons.js';

const itemTitle = (item) => `${item.name} (${item.effect})`;

function slot(item) {
  if (!item) return '<span class="sh-slot empty" aria-label="Empty shard slot"></span>';
  return `<button type="button" class="sh-slot filled${item.selected ? ' selected' : ''}" style="--gem:${esc(item.color)}"${intentAttrs('selectShard', { shardId: item.id })}
      aria-pressed="${item.selected}" title="${esc(itemTitle(item))}" aria-label="${esc(itemTitle(item))}">${gemIcon(item.color, 24)}<i class="sh-tier t${item.tier}">${esc(item.tierLabel)}</i></button>`;
}

function applyBar(apply) {
  const { item, classes } = apply;
  const buttons = classes.map((c) => `<button type="button" class="hud-btn small sh-apply"${intentAttrs('applyShard', { shardId: item.id, unitType: c.type })}${stateAttrs({
    enabled: c.canApply, reason: c.canApply ? `Apply ${item.name} to every ${c.label}` : `${c.label} already holds ${c.max} shards` })}>${esc(c.label)}<span>${c.count}/${c.max}</span></button>`).join('');
  return `<div class="sh-apply-bar">${gemIcon(item.color, 16)}<b>${esc(item.name)}</b><span class="hud-muted">${esc(item.effect)}</span>
      <span class="sh-apply-label">Apply to</span><span class="sh-apply-row">${buttons}</span></div>`;
}

/** @param {import('./types.js').ShardDockVM | null} dock */
export function renderShardDock(dock) {
  if (!dock) return '';
  const slots = [];
  for (let i = 0; i < dock.slots; i += 1) slots.push(slot(dock.items[i]));
  const combos = dock.combos.map((c) => `<button type="button" class="hud-btn small sh-combine"${intentAttrs('combineShards', { shardId: c.shardId, tier: c.tier })}
      title="Merge three ${esc(c.label)} into one of the next tier">${gemIcon(c.color, 14)}Combine ${esc(c.label)} &times;3</button>`).join('');
  return `<div class="sh-dock" aria-label="Shard dock">
      <header><span class="sh-count" title="Shards are stored between rounds. Select one, then apply it to a unit type.">Shards <b>${dock.items.length}/${dock.slots}</b></span>${combos ? `<span class="sh-combos">${combos}</span>` : ''}</header>
      <div class="sh-slots">${slots.join('')}</div>
    </div>${dock.apply ? applyBar(dock.apply) : ''}`;
}
