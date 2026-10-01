// Army sidebar: field and bench grouped by unit type; the selected type shows its stats and attached shards.
import { esc, intentAttrs, pct } from './util.js';
import { portraitHTML } from './portraits.js';
import { starPips, gemIcon, glyph } from './icons.js';

function shardChips(group, locked) {
  const chips = group.shards.map((shard, index) => `<button type="button" class="ar-shard" style="--gem:${esc(shard.color)}"${intentAttrs('removeShard', { unitType: group.type, index })}${locked ? ' disabled' : ''}
      title="${esc(`${shard.name}: ${shard.effect}. Click to return it to the dock.`)}">${gemIcon(shard.color, 14)}<span>${esc(shard.name)}</span><i aria-hidden="true">&times;</i></button>`);
  for (let i = group.shards.length; i < group.shardSlots; i += 1) chips.push('<span class="ar-shard empty" title="Open shard slot"></span>');
  return chips.join('');
}

function skillTimeline(timeline) {
  if (!timeline) return '';
  const slots = timeline.slots.map((slot, index) => {
    const face = slot.icon ? portraitHTML(slot.icon, { alt: '' }) : glyph('card', 16);
    const title = slot.name ? `${slot.name}${slot.detail ? `: ${slot.detail}` : ''}` : 'No skill assigned';
    return `<div class="ar-skill-slot${slot.name ? ' filled' : ''}${timeline.enabled ? '' : ' disabled'}" aria-label="Slot ${index + 1}, ${slot.time} seconds: ${esc(title)}">
        <small>Slot ${index + 1} · ${esc(slot.time)}s</small><span class="ar-skill-icon" aria-hidden="true">${face}</span>
        <b>${esc(slot.name ?? 'Empty')}</b>${slot.detail ? `<span class="ar-skill-detail">${esc(slot.detail)}</span>` : ''}
      </div>`;
  }).join('');
  return `<section class="ar-skills" aria-label="Skill timeline"><div class="ar-skills-head"><span class="hud-eyebrow">Skills</span>${timeline.status ? `<small>${esc(timeline.status)}</small>` : ''}</div><div class="ar-skill-slots">${slots}</div></section>`;
}

function details(group, locked) {
  const stats = (group.stats ?? []).map((s) => `<div><span>${esc(s.label)}</span><b>${esc(s.value)}</b></div>`).join('');
  const weapon = group.weapon ? `<div class="ar-weapon">${glyph('swords', 12)}<b>${esc(group.weapon.name)}</b><span>${esc(group.weapon.detail)}</span></div>` : '';
  return `<div class="ar-details">
      ${stats ? `<div class="ar-stats">${stats}</div>` : ''}${weapon}${skillTimeline(group.skillTimeline)}
      <div class="ar-shards" aria-label="Attached shards"><span class="hud-eyebrow">Shards ${group.shards.length}/${group.shardSlots}</span><div class="ar-shard-row">${shardChips(group, locked)}</div></div>
    </div>`;
}

function renderGroup(group, locked) {
  const hpPct = pct(group.hp, group.maxHp);
  const counts = `${group.field} field${group.bench ? ` &middot; ${group.bench} bench` : ''}`;
  const combine = group.combine
    ? `<button type="button" class="hud-btn small ar-combine"${intentAttrs('openCombine', { unitIds: group.combine.unitIds.join(',') })}${locked ? ' disabled' : ''}
        title="Merge three ${esc(group.name)} into one ${group.combine.toStars}-star unit">${starPips(group.combine.toStars, 3, 11)}${esc(group.combine.label)}</button>` : '';
  return `<div class="ar-group${group.selected ? ' selected' : ''}">
      <button type="button" class="ar-select"${intentAttrs('selectUnitType', { unitType: group.type })} aria-pressed="${group.selected}" title="Select ${esc(group.name)}">
        <span class="hud-face">${portraitHTML(group.portrait, { alt: group.name })}</span>
        <span class="ar-label"><b>${esc(group.name)}</b><small>${counts}${group.stars > 1 ? starPips(group.stars, group.stars, 10) : ''}</small>
          <span class="hud-bar${hpPct < 35 ? ' low' : ''}" title="HP ${group.hp}/${group.maxHp}"><i style="width:${hpPct}%"></i></span></span>
      </button>
      ${combine}${group.selected ? details(group, locked) : ''}
    </div>`;
}

/** @param {import('./types.js').ArmyVM | null} army */
export function renderArmy(army) {
  if (!army) return '';
  const rows = army.groups.length
    ? army.groups.map((g) => renderGroup(g, army.locked)).join('')
    : '<p class="ar-empty">No units yet. Recruit from your hand to build an army.</p>';
  const stats = army.canShowStats
    ? `<button type="button" class="hud-btn small ghost"${intentAttrs('openStats')} title="Battle statistics">${glyph('chart', 12)}Stats</button>` : '';
  const total = army.groups.reduce((sum, g) => sum + g.field + g.bench, 0);
  const toggle = `<button type="button" class="hud-btn ar-toggle" data-local-toggle="army" aria-controls="ar-panel" title="Show or hide the army panel">${glyph('people', 14)}<span>Army</span><b>${total}</b></button>`;
  return `${toggle}<div class="hud-panel ornate ar-panel${army.locked ? ' locked' : ''}" id="ar-panel">
      <div class="ar-head"><span class="hud-eyebrow">Your army</span>${stats}</div>
      <div class="ar-list">${rows}</div>
    </div>`;
}

.ar-skills { display: grid; gap: 4px; }
.ar-skills-head { display: flex; align-items: baseline; justify-content: space-between; gap: 4px; }
.ar-skills-head small { color: var(--muted); font-size: 9px; text-align: right; }
.ar-skill-slots { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 3px; }
.ar-skill-slot { display: grid; justify-items: center; gap: 2px; min-width: 0; min-height: 54px; padding: 4px 2px; border: 1px dashed var(--line-soft); border-radius: 3px; background: var(--panel-sunk); text-align: center; }
.ar-skill-slot.filled { border-style: solid; border-color: var(--gold); }
.ar-skill-slot.disabled { opacity: .55; }
.ar-skill-slot > small { color: var(--muted); font: 600 8px/1.15 var(--font-ui); white-space: nowrap; }
.ar-skill-icon { display: grid; place-items: center; width: 18px; height: 18px; color: var(--gold-bright); }
.ar-skill-icon .hud-portrait-img, .ar-skill-icon .hud-portrait-svg, .ar-skill-icon .hud-portrait-glyph { width: 18px; height: 18px; padding: 0; }
.ar-skill-slot > b { max-width: 100%; overflow: hidden; color: var(--ivory); font-size: 9px; line-height: 1.1; text-overflow: ellipsis; white-space: nowrap; }
.ar-skill-detail { display: none; }
