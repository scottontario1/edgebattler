// Three-unit upgrade dialog: choose the survivor and where the result goes, see the before/after stats.
// Form state lives in the DOM (radio groups); the Hud reads it when "Combine now" is pressed and
// reports each change as a `combinePreview` intent so the app can recompute `preview`.
import { esc, intentAttrs } from './util.js';
import { starPips, glyph } from './icons.js';

/** @param {import('./types.js').CombineVM | null} c */
export function renderCombine(c) {
  if (!c) return '';
  const keep = c.options.map((o) => `<label class="cb-opt"><input type="radio" name="survivorId" value="${esc(o.id)}"${intentAttrs('combinePreview')}${o.id === c.survivorId ? ' checked' : ''}>
      <span class="cb-body"><b>${esc(o.name)}</b><small>HP ${o.hp}/${o.maxHp} &middot; ${esc(o.where)}</small></span></label>`).join('');
  const where = c.destinations.map((d) => `<label class="cb-opt${d.enabled ? '' : ' off'}"><input type="radio" name="destination" value="${esc(d.id)}"${intentAttrs('combinePreview')}${d.id === c.destination ? ' checked' : ''}${d.enabled ? '' : ' disabled'}>
      <span class="cb-body"><b>${esc(d.label)}</b><small>${esc(d.hint)}</small></span></label>`).join('');
  const preview = (c.preview ?? []).map((p) => `<div class="cb-stat ${esc(p.change)}"><span>${esc(p.label)}</span><span class="cb-vals">${esc(p.from)}<i aria-hidden="true">&rarr;</i><b>${esc(p.to)}</b></span></div>`).join('');
  const pop = c.population ? `<p class="cb-pop"><span>Population</span><b>${c.population.before}</b><i aria-hidden="true">&rarr;</i><b class="to">${c.population.after}</b>
      <em>${c.population.supplyCost ? `${c.population.supplyCost} Supply` : 'No Supply cost'}</em></p>` : '';
  const warn = c.warning ? `<p class="cb-warn" role="alert">${esc(c.warning)}</p>` : '';
  return `<div class="hud-backdrop"${intentAttrs('closeCombine')}></div>
    <div class="hud-panel ornate hud-modal cb-dialog" role="dialog" aria-labelledby="cb-title" data-form="combine">
      <button type="button" class="hud-btn small icon ghost hud-close"${intentAttrs('closeCombine')} aria-label="Close">${glyph('close', 12)}</button>
      <h2 id="cb-title">Combine ${esc(c.name)} &times;3 <span aria-hidden="true">&rarr;</span> ${c.toStars}<span class="cb-star">&#9733;</span></h2>
      <div class="cb-stars" role="img" aria-label="${c.fromStars} star to ${c.toStars} star">${starPips(c.fromStars, 3, 14)}<i aria-hidden="true">&rarr;</i>${starPips(c.toStars, 3, 14)}</div>
      <fieldset class="cb-group"><legend>Keep</legend><div class="cb-seg">${keep}</div></fieldset>
      <fieldset class="cb-group"><legend>Place</legend><div class="cb-seg">${where}</div></fieldset>
      ${warn}
      ${preview ? `<div class="cb-preview" aria-label="Before and after"><div class="cb-stats">${preview}</div></div>` : ''}
      ${pop}
      <div class="cb-actions">
        <button type="button" class="hud-btn primary"${intentAttrs('combine', { unitIds: c.unitIds.join(',') })} data-collect="form"${c.ok ? '' : ' disabled aria-disabled="true"'}>Combine now</button>
        <button type="button" class="hud-btn"${intentAttrs('closeCombine')}>Cancel</button>
      </div>
    </div>`;
}
