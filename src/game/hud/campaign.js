// Campaign progress and checkpoint orders: three stages, waves, march/rally/continue.
import { esc, intentAttrs, stateAttrs } from './util.js';
import { glyph } from './icons.js';

function stagePips(stages) {
  return stages.map((s, i) => `<li class="cp-stage ${esc(s.state)}"${s.state === 'current' ? ' aria-current="step"' : ''} title="${esc(s.name)}: ${s.waves} wave${s.waves === 1 ? '' : 's'}">
      <i aria-hidden="true">${s.state === 'done' ? glyph('flag', 11) : i + 1}</i><span>${esc(s.name)}</span></li>`).join('');
}

/** @param {import('./types.js').CampaignOrderVM} order */
function orderButton(order) {
  const payload = order.intent === 'nextMission' ? { mission: order.mission } : {};
  return `<button type="button" class="hud-btn small${order.primary ? ' primary' : ''}"${intentAttrs(order.intent, payload)}${stateAttrs(order)}>${order.icon ? glyph(order.icon, 13) : ''}${esc(order.label)}</button>`;
}

/** @param {import('./types.js').CampaignVM | null} c */
export function renderCampaign(c) {
  if (!c) return '';
  const checkpoint = c.checkpoint ? `<small>Checkpoint ${c.checkpoint.c}, ${c.checkpoint.r}</small>` : '';
  return `<div class="hud-panel cp-panel" aria-label="Campaign progress">
      <div class="cp-info"><span class="hud-eyebrow">${esc(c.mission)}</span>
        <ol class="cp-stages">${stagePips(c.stages)}</ol></div>
      <div class="cp-status"><b>${esc(c.phaseLabel)}</b>${checkpoint}</div>
      <div class="cp-orders">${c.orders.map(orderButton).join('')}</div>
    </div>`;
}
