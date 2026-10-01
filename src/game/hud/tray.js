// Planning tray: a header (prompt + collapse), the shard dock, the hand and bench, and the detail bar.
// Collapse is presentation state owned by the Hud (class `tray-collapsed` on #hud).
import { esc } from './util.js';
import { glyph } from './icons.js';
import { renderHandSection, renderBenchSection, renderDetail } from './hand.js';
import { renderShardDock } from './shards.js';

/** @param {import('./types.js').TrayVM | null} tray */
export function renderTray(tray) {
  if (!tray) return '';
  const prompt = tray.locked ? 'Battle in progress' : tray.prompt;
  return `<div class="hud-panel ornate tr-panel${tray.locked ? ' locked' : ''}">
      <header class="tr-head">
        <span class="hud-eyebrow">Planning</span>
        <span class="tr-prompt${tray.locked ? ' battle' : ''}" title="${esc(prompt)}">${esc(prompt)}</span>
        <button type="button" class="hud-btn small icon tr-toggle" data-local-toggle="tray" aria-controls="tr-body" aria-label="Collapse or expand the planning tray" title="Collapse or expand the planning tray"${tray.locked ? ' disabled' : ''}>${glyph('chevron', 14)}</button>
      </header>
      <div class="tr-body" id="tr-body">
        ${renderHandSection(tray)}
        <div class="tr-lower"><section class="tr-docksec" aria-label="Shards">${renderShardDock(tray.shards)}</section>${renderBenchSection(tray)}</div>
        ${renderDetail(tray.detail)}
      </div>
    </div>`;
}
