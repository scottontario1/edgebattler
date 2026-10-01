// Start menu: campaign missions (1-3) and skirmish setup (faction, opponent, AI, seed).
// Form state lives in the DOM; the Hud collects it when a start button is pressed (`data-collect="form"`).
import { esc, intentAttrs } from './util.js';

/** A small heraldic shield in the faction colours. */
export function crestSVG(faction) {
  const color = /^#[0-9a-f]{6}$/i.test(faction.color) ? faction.color : '#3d5a80';
  const accent = /^#[0-9a-f]{6}$/i.test(faction.accent) ? faction.accent : '#c9d6ea';
  return `<svg class="mn-crest" viewBox="0 0 32 38" width="30" height="36" aria-hidden="true" focusable="false">
    <path d="M16 1.5 29.5 5v13c0 8-5.6 14-13.5 18.5C8.1 32 2.5 26 2.5 18V5z" fill="${color}" stroke="${accent}" stroke-width="1.6" stroke-linejoin="round"/>
    <path d="M16 1.5V36.5C8.1 32 2.5 26 2.5 18V5z" fill="#000" opacity=".18"/>
    <path d="M16 9 22 18H10zM16 20l5 6H11z" fill="${accent}" opacity=".9"/></svg>`;
}

function factionCards(name, factions, selected, mirror, you) {
  return factions.map((f) => {
    const blocked = name === 'foe' && f.id === you && !mirror.includes(f.id);
    return `<label class="mn-fcard" style="--fc:${esc(f.color)};--fa:${esc(f.accent)}">
      <input type="radio" name="${name}" value="${esc(f.id)}"${f.id === selected ? ' checked' : ''}${blocked ? ' disabled' : ''}>
      <span class="mn-fbody">${crestSVG(f)}<span class="mn-ftext"><b>${esc(f.name)}</b><em>${esc(f.tagline)}</em><small>${f.traits.map(esc).join(' &middot; ')}</small></span></span></label>`;
  }).join('');
}

/** @param {import('./types.js').MenuVM | null} menu */
export function renderMenu(menu) {
  if (!menu) return '';
  const d = menu.defaults;
  const campaignTab = d.mode !== 'skirmish';
  const missions = menu.missions.map((m) => `<div class="mn-mission"><span class="mn-num">${m.number}</span>
      <div><b>${esc(m.title)}</b><p>${esc(m.teaches)}</p></div>
      <button type="button" class="hud-btn primary"${intentAttrs('startGame', { mode: 'campaign', mission: m.id })} data-collect="form">Play</button></div>`).join('');
  const ais = menu.ais.map((a) => `<option value="${esc(a.id)}"${a.id === d.ai ? ' selected' : ''}>${esc(a.label)}</option>`).join('');
  return `<div class="mn-screen" data-local-scope data-tab="${campaignTab ? 'campaign' : 'skirmish'}">
    <div class="hud-panel mn-card" role="dialog" aria-label="Main menu" data-form="menu" data-mirror="${esc(menu.mirrorAllowed.join(','))}">
      <header><h1>${esc(menu.title)}</h1><p>${esc(menu.subtitle)}</p></header>
      ${menu.error ? `<p class="mn-error" role="alert">${esc(menu.error)}</p>` : ''}
      <h2>Your faction</h2>
      <div class="mn-fgrid">${factionCards('you', menu.factions, d.you, menu.mirrorAllowed, d.you)}</div>
      <nav class="mn-tabs" role="tablist" aria-label="Game mode">
        <button type="button" role="tab" data-local-set="tab=campaign" aria-pressed="${campaignTab}">Campaign</button>
        <button type="button" role="tab" data-local-set="tab=skirmish" aria-pressed="${!campaignTab}">Skirmish</button>
      </nav>
      <section class="mn-pane" data-pane="campaign">
        <p class="mn-note">March south to north. Monsters and rival troops arrive in fixed encounters and waves; they never recruit. Clear a position, regroup at its village, then continue north. Each mission starts a fresh army.</p>
        ${missions}
      </section>
      <section class="mn-pane" data-pane="skirmish">
        <h2>Opponent</h2>
        <div class="mn-fgrid">${factionCards('foe', menu.factions, d.foe, menu.mirrorAllowed, d.you)}</div>
        <div class="mn-opts">
          <label>Opponent AI<select name="ai">${ais}</select></label>
          <label>Seed<input name="seed" type="number" min="1" inputmode="numeric" placeholder="random"${d.seed ? ` value="${d.seed}"` : ''}></label>
        </div>
        <p class="mn-note">Faction cards share a draw pool; uncommon cards appear from round 3 and rare cards from round 6. Win by holding the enemy keep or destroying its army.</p>
        <div class="mn-go"><button type="button" class="hud-btn primary"${intentAttrs('startGame', { mode: 'skirmish' })} data-collect="form">Start skirmish</button></div>
      </section>
    </div></div>`;
}
