// Queued spells and the three-of-a-kind combine flow (prompts + the survivor/destination dialog).
// Wired by ui.js through: [data-cancel-spell] [data-upgrade-group] [data-upgrade-survivor]
// [data-upgrade-destination] [data-act="confirmUpgrade"] [data-act="cancelUpgrade"].
// The dialog's Keep / Place controls are radio groups; ui.js listens for their `change` events and
// reads `.value`, exactly as it did for the old selects.
import { esc } from './util.js';

const SPELL_GLYPH = '<svg class="qs-glyph" viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" focusable="false"><path d="M8 1.2 9.6 6.4 14.8 8 9.6 9.6 8 14.8 6.4 9.6 1.2 8 6.4 6.4Z" fill="currentColor"/><path d="M12.6 1.6l.6 1.6 1.6.6-1.6.6-.6 1.6-.6-1.6-1.6-.6 1.6-.6Z" fill="currentColor" opacity=".7"/></svg>';
const STAR_PATH = 'M8 1.2l2 4.3 4.7.6-3.4 3.2.9 4.7L8 11.6 3.8 14l.9-4.7L1.3 6.1 6 5.5z';
const stars3 = (cls, filled = 3) => `<svg class="${cls}" viewBox="0 0 48 16" width="36" height="12" aria-hidden="true" focusable="false">${[0, 1, 2].map((i) => `<path transform="translate(${i * 16} 0)" d="${STAR_PATH}" fill="currentColor"${i < filled ? '' : ' opacity=".25"'}/>`).join('')}</svg>`;
const CROSS = '<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true" focusable="false"><path d="m4 4 8 8m0-8-8 8" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';

/** m: { queued: [{ queueId, spellName, targetText }] } */
export function queuedHTML(m) {
  const queued = (m && m.queued) || [];
  return queued.map((q) => `<span class="queued-spell" title="${esc(q.spellName)} → ${esc(q.targetText)}">${SPELL_GLYPH}<span class="qs-text"><span class="qs-name">${esc(q.spellName)}</span><span class="qs-target">${esc(q.targetText)}</span></span><button type="button" class="queue-cancel" data-cancel-spell="${esc(q.queueId)}" aria-label="Cancel ${esc(q.spellName)}" title="Cancel ${esc(q.spellName)}">${CROSS}</button></span>`).join('');
}

/** m: { groups: [{ ids: string[], label }] } — one prompt per available three-of-a-kind. */
export function upgradePromptsHTML(m) {
  const groups = (m && m.groups) || [];
  return groups.map((g) => `<button type="button" class="upgrade-prompt" data-upgrade-group="${g.ids.join(',')}">${stars3('up-stars')}<span class="up-label">Combine ${esc(g.label)} ×3</span></button>`).join('');
}

const STAT_ROWS = [['hp', 'HP'], ['str', 'STR'], ['def', 'DEF'], ['mag', 'MAG'], ['skl', 'SKL'], ['spd', 'SPD'], ['res', 'RES']];
const ALWAYS = new Set(['hp', 'str', 'def']);
const num = (v) => (Number.isFinite(v) ? v : null);

function statCell(key, label, before, after) {
  const b = num(before?.[key]);
  const a = num(after?.[key]);
  if (b === null && a === null) return '';
  const isHp = key === 'hp';
  if (!ALWAYS.has(key) && (b === null || a === null || a === b)) return '';
  const fmt = (rec, v) => (isHp && num(rec?.maxHp) !== null && v !== null ? `${v}/${rec.maxHp}` : (v === null ? '–' : String(v)));
  const delta = a !== null && b !== null ? a - b : 0;
  const cls = delta > 0 ? ' up' : delta < 0 ? ' down' : '';
  return `<div class="ud-stat${cls}${ALWAYS.has(key) ? '' : ' extra'}"><span class="ud-stat-label">${label}</span><span class="ud-stat-vals"><span class="ud-from">${fmt(before, b)}</span><span class="ud-arrow" aria-hidden="true">→</span><b class="ud-to">${fmt(after, a)}</b><span class="visually-hidden"> ${delta > 0 ? `up ${delta}` : delta < 0 ? `down ${-delta}` : 'unchanged'}</span></span></div>`;
}

let wasOpen = false;
let pendingFocus = null;

/**
 * The open combine choice, or '' when none.
 * m: { choice: null | { survivorId, destination, options: [{ id, name }], canReserve, canField, summary,
 *      ok?, records?, preview? } }
 * `records` (the three chosen unit records) and `preview` (previewUpgrade()'s result) are optional.
 */
export function upgradeChoiceHTML(m) {
  const c = m && m.choice;
  if (!c) { wasOpen = false; pendingFocus = false; return ''; }
  const enter = !wasOpen;
  wasOpen = true;
  if (enter) pendingFocus = true;

  const records = Array.isArray(c.records) ? c.records : [];
  const options = Array.isArray(c.options) ? c.options : [];
  const byId = new Map(records.map((r) => [r.id, r]));
  const preview = c.preview && c.preview.ok ? c.preview : null;
  const survivor = byId.get(c.survivorId) || records[0] || null;
  const name = (survivor && survivor.name) || (options[0] && options[0].name) || 'units';
  const fromStars = preview ? preview.stars.from : (Number(survivor?.stars) || 1);
  const toStars = preview ? preview.stars.to : fromStars + 1;
  const ok = c.ok !== false;

  const whereOf = (r) => (r ? (r.state === 'reserve' ? 'Reserve' : (r.c !== undefined ? `Tile ${r.c},${r.r}` : 'Field')) : '');
  const mixed = new Set(records.map(whereOf)).size > 1;
  const keep = options.map((o) => {
    const r = byId.get(o.id);
    const hp = r && num(r.hp) !== null ? `HP ${r.hp}${num(r.maxHp) !== null ? `/${r.maxHp}` : ''}` : '';
    const meta = [hp, mixed ? whereOf(r) : ''].filter(Boolean).join(' · ');
    return `<label class="ud-opt" title="${esc(o.name)} ${esc(o.id)}"><input type="radio" name="upgrade-survivor" data-upgrade-survivor value="${esc(o.id)}"${o.id === c.survivorId ? ' checked' : ''}><span class="ud-opt-body"><span class="ud-opt-name">${esc(o.name)}</span><span class="ud-opt-id">${esc(o.id)}</span><span class="ud-opt-meta">${esc(meta)}</span></span></label>`;
  }).join('');

  const places = [];
  if (c.canReserve) places.push(['reserve', 'Reserve bench', 'Result waits off the map']);
  if (c.canField) places.push(['field', 'Keep field tile', 'Result stays on its tile']);
  const place = places.map(([value, label, hint]) => `<label class="ud-opt"><input type="radio" name="upgrade-destination" data-upgrade-destination value="${value}"${c.destination === value ? ' checked' : ''}><span class="ud-opt-body"><span class="ud-opt-name">${label}</span><span class="ud-opt-meta">${hint}</span></span></label>`).join('');

  const after = preview ? preview.unit : null;
  const stats = after ? STAT_ROWS.map(([k, label]) => statCell(k, label, survivor, after)).join('') : '';
  const pop = preview && preview.population
    ? `<p class="ud-pop"><span class="ud-pop-label">Population</span><b>${preview.population.before}</b><span aria-hidden="true">→</span><b class="ud-to">${preview.population.after}</b><span class="ud-pop-note">${preview.supplyCost ? `${preview.supplyCost} Supply` : 'No Supply cost'}</span></p>`
    : '';
  const fieldBlocked = ok && preview && c.destination === 'field' && preview.unit && preview.unit.c === undefined;
  const warn = !ok
    ? `<p class="ud-warn" role="alert">${esc(c.summary || 'These units cannot be combined.')}</p>`
    : fieldBlocked ? '<p class="ud-warn" role="alert">The chosen copy is on the reserve bench, so it has no field tile. Choose the reserve bench or a fielded copy.</p>' : '';
  const fallback = !preview && ok && c.summary ? `<p class="ud-summary">${esc(c.summary)}</p>` : '';

  return `<div class="upgrade-dialog${enter ? ' enter' : ''}" role="dialog" aria-label="Combine units" aria-labelledby="ud-title">
      <div class="ud-head"><h3 id="ud-title" class="ud-title">Combine ${esc(name)} ×3 <span class="ud-title-arrow" aria-hidden="true">→</span> ${toStars}★</h3><span class="ud-stars" role="img" aria-label="${fromStars} star to ${toStars} star">${stars3('ud-stars-ico', toStars)}</span></div>
      <div class="ud-body">
        <fieldset class="ud-group"><legend>Keep</legend><div class="ud-seg ud-keep">${keep}</div></fieldset>
        ${place ? `<fieldset class="ud-group ud-place"><legend>Place</legend><div class="ud-seg">${place}</div></fieldset>` : ''}
        ${warn}${fallback}
        ${stats ? `<div class="ud-preview" aria-label="Before and after"><div class="ud-preview-head"><span>${fromStars}★ ${esc(name)}</span><span aria-hidden="true">→</span><span>${toStars}★</span></div><div class="ud-stats">${stats}</div></div>` : ''}
        ${pop}
      </div>
      <div class="ud-actions"><button type="button" class="ud-btn ud-primary upgrade-confirm" data-act="confirmUpgrade"${ok ? '' : ' disabled'}>Combine now</button><button type="button" class="ud-btn upgrade-cancel" data-act="cancelUpgrade">Cancel</button></div>
    </div>`;
}

// The tray re-renders its markup on every refresh, which drops keyboard focus. Put focus on the
// dialog when it opens, and give it back to the same radio after a Keep / Place change. Enter and
// Space on a dialog control stay local so ui.js's window-level Enter shortcut (resolve battle)
// does not also fire.
if (typeof document !== 'undefined') {
  document.addEventListener('change', (e) => {
    const t = e.target;
    if (!t || !t.matches || !t.matches('[data-upgrade-survivor], [data-upgrade-destination]')) return;
    const attr = t.matches('[data-upgrade-survivor]') ? 'data-upgrade-survivor' : 'data-upgrade-destination';
    const value = t.value;
    // ui.js has already re-rendered synchronously by the time this bubbles to the document.
    const next = [...document.querySelectorAll(`.upgrade-dialog [${attr}]`)].find((el) => el.value === value);
    if (next && next !== t) next.focus({ preventScroll: true });
  });
  document.addEventListener('keydown', (e) => {
    if ((e.key === 'Enter' || e.key === ' ') && e.target.closest && e.target.closest('.upgrade-dialog')) e.stopPropagation();
  });
  const focusOpenDialog = () => {
    if (!pendingFocus) return;
    const el = document.querySelector('.upgrade-dialog [data-upgrade-survivor]:checked');
    if (el) { pendingFocus = false; el.focus({ preventScroll: true }); }
  };
  new MutationObserver(focusOpenDialog).observe(document.documentElement, { childList: true, subtree: true });
}
