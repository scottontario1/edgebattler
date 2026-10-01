// Battle statistics (a sheet opened from the army panel) and the end-of-match screen that embeds it.
// The side tabs (Your army / Enemies) are local presentation state: `data-local-set="side=red"`.
import { esc, intentAttrs } from './util.js';
import { glyph } from './icons.js';

const leader = (l) => `<div class="rp-leader"><small>${esc(l.label)}</small><b>${l.value > 0 ? `${esc(l.name)} <em>${l.value}</em>` : 'No activity yet'}</b></div>`;

function sidePanel(side, data) {
  const rows = data.rows.map((r) => `<tr><td>${esc(r.name)}<small>${esc(r.status)}</small></td><td>${r.dealt}</td><td>${r.taken}</td></tr>`).join('')
    || '<tr><td colspan="3" class="rp-none">No units recorded</td></tr>';
  return `<div class="rp-side" data-side-panel="${side}">
      <div class="rp-leaders">${data.leaders.map(leader).join('')}</div>
      <div class="rp-scroll"><table><thead><tr><th>Character</th><th>Dealt</th><th>Taken</th></tr></thead><tbody>${rows}</tbody></table></div>
    </div>`;
}

/** The statistics body shared by the sheet and the end screen. */
export function reportBody(report) {
  return `<div class="rp-tabs" role="group" aria-label="Army">
      <button type="button" data-local-set="side=blue" aria-pressed="true">Your army</button>
      <button type="button" data-local-set="side=red" aria-pressed="false">Enemies</button>
    </div>
    ${sidePanel('blue', report.sides.blue)}${sidePanel('red', report.sides.red)}
    ${report.footnote ? `<p class="rp-note">${esc(report.footnote)}</p>` : ''}`;
}

/** @param {import('./types.js').ReportVM | null} report */
export function renderReport(report) {
  if (!report) return '';
  return `<div class="hud-backdrop"${intentAttrs('closeStats')}></div>
    <div class="hud-panel ornate hud-modal rp-sheet" role="dialog" aria-label="${esc(report.title)}" data-local-scope data-side="blue">
      <button type="button" class="hud-btn small icon ghost hud-close"${intentAttrs('closeStats')} aria-label="Close statistics">${glyph('close', 12)}</button>
      <h2>${esc(report.title)}</h2>${reportBody(report)}
    </div>`;
}

const OUTCOME_ICON = { victory: 'crown', defeat: 'skull', draw: 'flag' };

/** @param {import('./types.js').EndVM | null} end */
export function renderEnd(end) {
  if (!end) return '';
  const summary = end.summary.map((s) => `<div><small>${esc(s.label)}</small><b>${esc(s.value)}</b></div>`).join('');
  const actions = end.actions.map((a) => `<button type="button" class="hud-btn${a.primary ? ' primary' : ''}"${intentAttrs(a.intent, { mission: a.mission })}>${esc(a.label)}</button>`).join('');
  return `<div class="hud-backdrop"></div>
    <div class="hud-panel ornate hud-modal en-sheet ${esc(end.outcome)}" role="dialog" aria-label="${esc(end.title)}" data-local-scope data-side="blue">
      <header class="en-head">${glyph(OUTCOME_ICON[end.outcome] ?? 'flag', 34, 'en-ico')}
        <div><h2>${esc(end.title)}</h2><p>${esc(end.reason)}</p></div></header>
      <div class="en-summary"><div><small>Rounds</small><b>${end.round}</b></div>${summary}</div>
      ${reportBody(end.report)}
      <div class="en-actions">${actions}</div>
    </div>`;
}
