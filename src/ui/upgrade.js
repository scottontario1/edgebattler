// Queued spells and the three-of-a-kind combine flow (prompts + the survivor/destination dialog).
// Wired by ui.js through: [data-cancel-spell] [data-upgrade-group] [data-upgrade-survivor]
// [data-upgrade-destination] [data-act="confirmUpgrade"] [data-act="cancelUpgrade"].
import { esc } from './util.js';

/** m: { queued: [{ queueId, spellName, targetText }] } */
export function queuedHTML(m) {
  return m.queued.map((q) => `<span class="queued-spell">${esc(q.spellName)} → ${esc(q.targetText)} <button class="queue-cancel" data-cancel-spell="${esc(q.queueId)}" aria-label="Cancel ${esc(q.spellName)}">×</button></span>`).join('');
}

/** m: { groups: [{ ids: string[], label }] } — one prompt per available three-of-a-kind. */
export function upgradePromptsHTML(m) {
  return m.groups.map((g) => `<button class="upgrade-prompt" data-upgrade-group="${g.ids.join(',')}">Combine ${esc(g.label)} · 3 copies</button>`).join('');
}

/**
 * The open combine choice, or '' when none.
 * m: { choice: null | { survivorId, destination, options: [{ id, name }], canReserve, canField, summary } }
 */
export function upgradeChoiceHTML(m) {
  const c = m.choice;
  if (!c) return '';
  return `<div class="upgrade-choice"><label>Keep <select data-upgrade-survivor>${c.options.map((o) => `<option value="${esc(o.id)}"${o.id === c.survivorId ? ' selected' : ''}>${esc(o.name)} · ${esc(o.id)}</option>`).join('')}</select></label><label>Place <select data-upgrade-destination>${c.canReserve ? `<option value="reserve"${c.destination === 'reserve' ? ' selected' : ''}>Reserve bench</option>` : ''}${c.canField ? `<option value="field"${c.destination === 'field' ? ' selected' : ''}>Keep field tile</option>` : ''}</select></label><span class="upgrade-preview">${esc(c.summary)} · no Supply</span><button class="upgrade-confirm" data-act="confirmUpgrade">Combine now</button><button class="upgrade-cancel" data-act="cancelUpgrade">Cancel</button></div>`;
}
