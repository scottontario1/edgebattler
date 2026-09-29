// Hand cards, paid reserves, the selected-card detail bar and the type-wide skill loadouts.
// Pure template functions: ui.js passes plain data in and puts the returned HTML into the
// planning tray. Behaviour is wired by ui.js through data attributes, which must be kept:
//   [data-card-id] [data-reserve-id] [data-act="equipSkill"] [data-skill-unit-type]
//   [data-transfer-skill][data-from-type] [data-skill-transfer-target]
import { esc, uniqueIds } from './util.js';
import { skillsForUnitType } from '../abilities.js';

export const SKILL_TYPES = [['pikeman', 'Pikeman'], ['archer', 'Archer'], ['cavalier', 'Cavalier']];

/**
 * m: { hand: card[], selectedCardId, canAfford(cost) -> bool, portraitFor(card) -> svg string (unit cards) }
 */
export function handHTML(m) {
  return m.hand.map((item) => {
    const unit = item.type === 'unit';
    const skill = item.type === 'skill';
    const portrait = unit
      ? m.portraitFor(item)
      : `<svg viewBox="0 0 64 72" aria-hidden="true"><path d="M32 6 56 36 32 66 8 36Z" fill="${skill ? '#7a6338' : item.id === 'spell-fireburst' ? '#c44c2e' : '#4779bb'}" stroke="#e8c66b" stroke-width="2"/><text x="32" y="43" text-anchor="middle" font-size="24" fill="#fff">${skill ? '⬟' : item.id === 'spell-mend' ? '✚' : item.id === 'spell-ward' ? '◇' : '✹'}</text></svg>`;
    const selected = item.instanceId === m.selectedCardId;
    return `<button class="plan-card ${esc(item.type)}-card${selected ? ' selected' : ''}" data-card-id="${esc(item.instanceId)}" aria-pressed="${selected}">
        <span class="plan-face">${uniqueIds(portrait)}</span><span class="plan-card-copy"><b>${esc(item.name)}</b><small>${unit ? `${esc(item.class)} · ${item.stars}★ · Range ${item.range}` : esc(item.effect)}</small></span>
        <span class="plan-cost">${item.cost} Supply</span>${!m.canAfford(item.cost) ? '<span class="unaffordable">Short</span>' : ''}
      </button>`;
  }).join('');
}

/**
 * m: { reserves: reserve[], selectedReserveId, definitions: UNIT_CARDS }
 */
export function reservesHTML(m) {
  return m.reserves.map((reserve) => {
    const definition = m.definitions[reserve.unitId];
    const selected = m.selectedReserveId === reserve.id;
    return `<button class="reserve-card${selected ? ' selected' : ''}" data-reserve-id="${esc(reserve.id)}" aria-pressed="${selected}"><b>${esc(definition?.name || reserve.unitId)}</b><small>${reserve.stars}★ · ${reserve.hp ?? 'ready'} HP · ${reserve.energy ?? 0} energy</small></button>`;
  }).join('') || '<span class="empty-reserve">No paid reserves</span>';
}

/**
 * The selected-card bar. m: { selectedCard | undefined, selectedSkillType, skillLoadouts, canAfford(cost) }
 */
export function detailHTML(m) {
  const c = m.selectedCard;
  if (!c) return '';
  const skillSelect = SKILL_TYPES.map(([id, label]) => `<option value="${id}"${id === m.selectedSkillType ? ' selected' : ''}>${label}</option>`).join('');
  const alreadyEquipped = (m.skillLoadouts[m.selectedSkillType] || []).some((skill) => skill.id === c.skillId);
  return `<div class="plan-detail"><b>${esc(c.name)}</b><span>${c.type === 'unit' ? `${esc(c.class)} · ${c.stars} star · ${c.range} range · default ${esc(c.defaultStance)}` : esc(c.effect)}</span>${c.type === 'unit' ? '<small>Recruit to the reserve bench; deploy from a controlled keep or village.</small>' : c.type === 'skill' ? `<label class="skill-equip-label">Equip for <select data-skill-unit-type>${skillSelect}</select></label><button class="skill-equip" data-act="equipSkill"${!m.canAfford(c.cost) || alreadyEquipped ? ' disabled' : ''}>Equip · ${c.cost} Supply</button>` : `<small>Target: ${esc(c.target)} · ${esc(c.duration)}</small>`}</div>`;
}

/**
 * Equipped type-wide skills with their transfer controls. m: { skillLoadouts, skillTransferTargets }
 */
export function loadoutsHTML(m) {
  const entries = SKILL_TYPES.flatMap(([typeId, label]) => skillsForUnitType(m.skillLoadouts, typeId).map((skill) => {
    const transferKey = `${typeId}:${skill.id}`;
    const targets = SKILL_TYPES.filter(([id]) => id !== typeId).map(([id, name]) => `<option value="${id}"${id === m.skillTransferTargets[transferKey] ? ' selected' : ''}>${name}</option>`).join('');
    return `<div class="skill-entry"><b>${label}</b><span>${esc(skill.name)} · ${esc(skill.effect)}</span><select data-skill-transfer-target="${esc(transferKey)}" aria-label="Transfer ${esc(skill.name)} from ${label} to">${targets}</select><button data-transfer-skill="${esc(skill.id)}" data-from-type="${typeId}">Move</button></div>`;
  }));
  return `<div class="skill-loadouts" aria-label="Type-wide skill equipment">${entries.join('') || '<span class="no-skills">No type-wide skills equipped</span>'}</div>`;
}
