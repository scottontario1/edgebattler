// Hand (unit and shard offers), bench (paid reserves) and the detail bar for the selected card.
import { esc, intentAttrs, stateAttrs, pct } from './util.js';
import { portraitHTML } from './portraits.js';
import { starPips, gemIcon, glyph } from './icons.js';

const RARITY_LABEL = { common: 'Common', uncommon: 'Uncommon', rare: 'Rare' };
const costBadge = (cost, affordable) =>
  `<span class="hd-cost${affordable ? '' : ' short'}" aria-label="Cost ${cost} Supply">${cost}<i aria-hidden="true">S</i></span>`;

/** @param {import('./types.js').HandCardVM} card */
export function renderHandCard(card) {
  const unit = card.kind === 'unit';
  const face = unit
    ? `<span class="hud-face">${portraitHTML(card.portrait, { alt: card.name })}</span>`
    : `<span class="hud-face hd-gem" style="--gem:${esc(card.color ?? '#2fc4b0')}">${gemIcon(card.color ?? '#2fc4b0', 30)}</span>`;
  const meta = unit
    ? `${esc(card.classLabel ?? '')}${card.range ? ` &middot; Rng ${card.range}` : ''}`
    : esc(card.effect ?? '');
  const title = unit ? `${card.name}: ${card.classLabel ?? ''}, ${card.stars ?? 1} star, range ${card.range ?? 1}` : `${card.name}: ${card.effect ?? ''}`;
  return `<button type="button" class="hd-card ${unit ? 'unit' : 'shard'} ${esc(card.rarity)}${card.selected ? ' selected' : ''}${card.affordable ? '' : ' unaffordable'}"
      ${intentAttrs('selectCard', { cardId: card.id })} aria-pressed="${card.selected}" title="${esc(title)}">
      ${face}
      <span class="hd-copy"><span class="hd-kind">${unit ? 'Unit' : 'Shard'}${unit && card.stars > 1 ? starPips(card.stars, card.stars, 10) : ''}${costBadge(card.cost, card.affordable)}</span>
        <b>${esc(card.name)}</b><small>${meta}</small></span>
    </button>`;
}

/** @param {import('./types.js').BenchUnitVM} unit */
export function renderBenchUnit(unit) {
  const hpPct = pct(unit.hp, unit.maxHp);
  return `<button type="button" class="hd-bench${unit.selected ? ' selected' : ''}"${intentAttrs('selectReserve', { unitId: unit.id })} aria-pressed="${unit.selected}"
      title="${esc(`${unit.name}: ${unit.stars} star, ${unit.hp}/${unit.maxHp} HP. Paid reserve.`)}">
      <span class="hud-face">${portraitHTML(unit.portrait, { alt: unit.name })}</span>
      <span class="hd-copy"><b>${esc(unit.name)}</b>
        <span class="hud-bar${hpPct < 35 ? ' low' : ''}"><i style="width:${hpPct}%"></i></span>
        <small>${unit.stars > 1 ? starPips(unit.stars, unit.stars, 10) : 'Reserve'}</small></span>
    </button>`;
}

function actionButton(action) {
  const payload = { cardId: action.cardId, unitId: action.unitId, source: action.source };
  const icon = action.intent === 'cycle' ? glyph('cycle', 13) : '';
  return `<button type="button" class="hud-btn small${action.primary ? ' primary' : ''}"${intentAttrs(action.intent, payload)}${stateAttrs(action)}>${icon}${esc(action.label)}</button>`;
}

/** @param {import('./types.js').DetailVM | null} detail */
export function renderDetail(detail) {
  if (!detail) {
    return '<div class="hd-detail empty"><span>Select a card or a bench unit to see its details and options.</span></div>';
  }
  const lead = detail.kind === 'shard' ? gemIcon(detail.color ?? '#2fc4b0', 18) : '';
  return `<div class="hd-detail ${esc(detail.kind)}">
      <div class="hd-detail-text">${lead}<b>${esc(detail.title)}</b><span>${esc(detail.text)}</span>
        ${detail.hint ? `<small>${esc(detail.hint)}</small>` : ''}</div>
      <div class="hd-detail-actions">${detail.actions.map(actionButton).join('')}</div>
    </div>`;
}

/** @param {import('./types.js').TrayVM} tray */
export function renderHandSection(tray) {
  const cards = tray.hand.map(renderHandCard).join('') || '<span class="hd-none">Hand is empty. New offers arrive next round.</span>';
  const cycleSpent = tray.cycle.remaining <= 0;
  return `<section class="hd-hand" aria-label="Hand">
      <header><span class="hud-eyebrow">Hand</span>
        <span class="hd-meta">${tray.hand.filter((c) => c.kind === 'unit').length}/${tray.handLimit} units</span>
        <span class="hd-cycle${cycleSpent ? ' spent' : ''}" title="One shared cycle per round, for a hand card or a bench unit">${glyph('cycle', 12)}Cycle ${tray.cycle.remaining}/${tray.cycle.max}</span></header>
      <div class="hd-strip">${cards}</div>
    </section>`;
}

/** @param {import('./types.js').TrayVM} tray */
export function renderBenchSection(tray) {
  const bench = tray.bench.map(renderBenchUnit).join('') || '<span class="hd-none">No paid reserves</span>';
  return `<section class="hd-benchbox" aria-label="Bench">
      <header><span class="hud-eyebrow">Bench</span><span class="hd-meta">${tray.bench.length}/${tray.benchCap}</span></header>
      <div class="hd-strip">${bench}</div>
    </section>`;
}
