// Top bar: mission/objective, round and phase, and the economy ledger (Supply, population, bench, cycle).
import { esc, intentAttrs, pct } from './util.js';
import { glyph } from './icons.js';

const PHASE_CLASS = { planning: 'blue', battle: 'red', victory: 'gold', defeat: 'red', draw: 'muted' };

/** @param {import('./types.js').TopBarVM | null} top */
export function renderTopBar(top) {
  if (!top) return '';
  const { supply, population, bench, cycle } = top;
  const popRatio = pct(population.current, population.cap);
  const popState = population.current >= population.cap ? ' full' : popRatio >= 80 ? ' warn' : '';
  const benchState = bench.current >= bench.cap ? ' warn' : '';
  const round = top.maxRound ? `${top.round}<small>/${top.maxRound}</small>` : String(top.round);
  return `<div class="hud-panel ornate tb-objective">
      <div class="hud-eyebrow">${esc(top.title)}${top.canOpenMenu ? `<button type="button" class="tb-menu"${intentAttrs('openMenu')} aria-label="Main menu" title="Main menu">${glyph('menu', 12)}</button>` : ''}</div>
      <div class="tb-goal"><i class="tb-gem" aria-hidden="true"></i><span>${esc(top.objective)}</span></div>
    </div>
    <div class="hud-panel tb-turn">
      <span class="tb-round" title="Round"><small>Round</small><b>${round}</b></span>
      <span class="tb-phase ${PHASE_CLASS[top.phase.id] ?? 'blue'}">${esc(top.phase.label)}</span>
    </div>
    <div class="hud-panel tb-ledger" role="group" aria-label="Economy">
      <div class="tb-cell tb-supply" title="Supply: spend it on recruits and shards. Income arrives each round; the bank caps what you can hold.">
        <span class="tb-label">Supply</span>
        <span class="tb-value">${glyph('supply', 15)}<b>${supply.current}</b><small>/${supply.bank}</small>${supply.income ? `<em>+${supply.income}</em>` : ''}</span>
      </div>
      <div class="tb-cell tb-pop${popState}" title="Population: field units plus bench reserves, against the cap.">
        <span class="tb-label">Population</span>
        <span class="tb-value">${glyph('population', 15)}<b>${population.current}</b><small>/${population.cap}</small>
          <span class="tb-meter" role="meter" aria-label="Population" aria-valuemin="0" aria-valuemax="${population.cap}" aria-valuenow="${population.current}"><i style="width:${popRatio}%"></i></span></span>
      </div>
      <div class="tb-cell tb-bench${benchState}" title="Bench: paid reserves waiting to deploy.">
        <span class="tb-label">Bench</span>
        <span class="tb-value">${glyph('bench', 15)}<b>${bench.current}</b><small>/${bench.cap}</small></span>
      </div>
      <div class="tb-cell tb-cycle${cycle.remaining > 0 ? '' : ' spent'}" title="Cycle: one shared re-roll per round, for a hand card or a bench unit.">
        <span class="tb-label">Cycle</span>
        <span class="tb-value">${glyph('cycle', 15)}<b>${cycle.remaining}</b><small>/${cycle.max}</small></span>
      </div>
    </div>`;
}
