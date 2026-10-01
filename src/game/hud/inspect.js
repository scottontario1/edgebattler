// Inspect sheet: full unit record (portrait, hp, stats, weapon, terrain, stance, shards, statuses).
import { esc, intentAttrs, pct } from './util.js';
import { portraitHTML } from './portraits.js';
import { starPips, glyph } from './icons.js';

const row = (r) => `<div class="in-row"><span class="in-lab">${esc(r.label)}</span><div class="in-val">${r.chips.map((c) => `<span class="hud-chip ${esc(c.tone ?? '')}"${c.title ? ` title="${esc(c.title)}"` : ''}>${esc(c.text)}</span>`).join('') || '<span class="hud-muted">None</span>'}</div></div>`;

/** @param {import('./types.js').InspectVM | null} unit */
export function renderInspect(unit) {
  if (!unit) return '';
  const hpPct = pct(unit.hp, unit.maxHp);
  const stats = unit.stats.map((s) => `<div class="in-stat"><span>${esc(s.label)}</span><b>${esc(s.value)}</b></div>`).join('');
  const terrain = unit.terrain ? `<span>On <b>${esc(unit.terrain.name)}</b> &middot; DEF +${unit.terrain.def} &middot; AVO +${unit.terrain.avo}</span>` : '';
  return `<div class="hud-backdrop"${intentAttrs('closeInspect')}></div>
    <div class="hud-panel ornate hud-modal in-sheet" role="dialog" aria-label="${esc(unit.name)} details">
      <button type="button" class="hud-btn small icon ghost hud-close"${intentAttrs('closeInspect')} aria-label="Close">${glyph('close', 12)}</button>
      <div class="in-top">
        <span class="hud-face ${esc(unit.side)}">${portraitHTML(unit.portrait, { alt: unit.name })}</span>
        <div class="in-info">
          <div class="hud-eyebrow">${unit.side === 'blue' ? 'Ally' : 'Enemy'}</div>
          <div class="in-name">${esc(unit.name)}${unit.stars > 0 ? starPips(unit.stars, 3, 12) : ''}</div>
          <div class="in-class">${esc(unit.title)}</div>
          <div class="in-hp"><span>HP</span><span class="hud-bar${hpPct < 35 ? ' low' : ''}"><i style="width:${hpPct}%"></i></span><b>${unit.hp}/${unit.maxHp}</b></div>
        </div>
      </div>
      <div class="in-stats">${stats}</div>
      <div class="in-weapon">${glyph('swords', 14)}<b>${esc(unit.weapon.name)}</b><span>${esc(unit.weapon.detail)}</span>${terrain}</div>
      <div class="in-rows">${unit.rows.map(row).join('')}</div>
    </div>`;
}
