// Unit action menu, anchored above a selected friendly unit: stance, withdraw, inspect.
// The Hud positions the slot at `anchor` and clamps it into the viewport after rendering.
import { esc, intentAttrs, stateAttrs } from './util.js';
import { stanceIcon, glyph } from './icons.js';

/** @param {import('./types.js').UnitMenuVM | null} menu */
export function renderUnitMenu(menu) {
  if (!menu) return '';
  const stances = menu.stances.map((s) => {
    const protect = s.id === 'protect';
    const needsTarget = protect && (menu.protectTargets?.length ?? 0) > 0;
    // Protect with a choice of allies opens the target list instead of acting straight away.
    const attrs = needsTarget
      ? ` data-local-toggle="um-targets" aria-expanded="${s.active}"`
      : intentAttrs('stance', { unitId: menu.unitId, stance: s.id });
    return `<button type="button" class="um-btn stance-${esc(s.id)}${s.active ? ' active' : ''}"${attrs}${stateAttrs({ enabled: s.enabled, reason: s.reason || s.hint })} aria-pressed="${s.active}">
        ${stanceIcon(s.id, 16)}<span class="um-text"><b>${esc(s.label)}</b><small>${esc(s.hint)}</small></span></button>`;
  }).join('');
  const targets = menu.protectTargets?.length
    ? `<div class="um-targets" role="group" aria-label="Protect which ally">${menu.protectTargets.map((t) => `<button type="button" class="hud-btn small${t.id === menu.protectTarget ? ' primary' : ''}"${intentAttrs('stance', { unitId: menu.unitId, stance: 'protect', target: t.id })}>${esc(t.name)}</button>`).join('')}</div>` : '';
  return `<div class="hud-panel um-panel" role="group" aria-label="${esc(menu.name)} actions">
      <div class="um-head"><div><b>${esc(menu.name)}</b><small>${esc(menu.subtitle)}</small></div>
        <button type="button" class="hud-btn small icon ghost"${intentAttrs('closeMenu')} aria-label="Close menu">${glyph('close', 12)}</button></div>
      <div class="um-stances">${stances}</div>${targets}
      <div class="um-foot">
        <button type="button" class="hud-btn small"${intentAttrs('withdraw', { unitId: menu.unitId })}${stateAttrs(menu.withdraw)}>${glyph('withdraw', 12)}Withdraw</button>
        <button type="button" class="hud-btn small"${intentAttrs('inspect', { unitId: menu.unitId })}${menu.canInspect ? '' : ' disabled'}>${glyph('eye', 12)}Inspect</button>
      </div>
      <i class="um-arrow" aria-hidden="true"></i>
    </div>`;
}
