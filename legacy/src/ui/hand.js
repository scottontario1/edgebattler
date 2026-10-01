// Hand cards, paid reserves, the selected-card detail bar and the type-wide skill loadouts.
// Pure template functions: ui.js passes plain data in and puts the returned HTML into the
// planning tray. Behaviour is wired by ui.js through data attributes, which must be kept:
//   [data-card-id] [data-reserve-id] [data-act="equipSkill"] [data-skill-unit-type]
//   [data-transfer-skill][data-from-type] [data-skill-transfer-target]
// Card family: a 3px top edge in the card-type colour (unit blue, spell violet, skill gold),
// a portrait/glyph block on the left, a cost gem top-right, the name and a two-line effect.
import { esc, uniqueIds } from './util.js';
import { UNIT_CARDS } from '../cards.js';
import { skillsForUnitType } from '../abilities.js';
import { gemSVG } from './shards.js';
import { SHARDS, shardEffectText } from '../shards.js';

export const SKILL_TYPES = [['pikeman', 'Pikeman'], ['archer', 'Archer'], ['cavalier', 'Cavalier']];

const KIND_LABEL = { unit: 'Unit', spell: 'Spell', skill: 'Skill', shard: 'Shard' };

// 24x24 icons drawn to read at 24-28px. Each one sits on the coloured glyph block of its card.
const ICONS = {
  'spell-mend': '<path d="M9 3h6v6h6v6h-6v6H9v-6H3V9h6z" fill="#eafff2" stroke="#7fe0a4" stroke-width="1.4" stroke-linejoin="round"/><circle cx="18.5" cy="5" r="1.6" fill="#eafff2"/>',
  'spell-ward': '<circle cx="12" cy="12" r="9" fill="none" stroke="#d5e6ff" stroke-width="1.6"/><path d="M12 4.5l2.2 5.3 5.3 2.2-5.3 2.2L12 19.5l-2.2-5.3L4.5 12l5.3-2.2z" fill="#eaf3ff" stroke="#8fc0ff" stroke-width="1.2" stroke-linejoin="round"/>',
  'spell-fireburst': '<path d="M12.5 2c.6 4.2 6.5 6.4 6.5 12.2A7 7 0 0 1 5 14.2c0-3.2 1.8-4.8 3.2-7.2.9 1.1 1.5 2.3 1.9 3.8 1.5-2.2 2.7-5.5 2.4-8.8z" fill="#ffb347" stroke="#ff5a2e" stroke-width="1.4" stroke-linejoin="round"/><path d="M12 22a3.6 3.6 0 0 1-3.6-3.6c0-2 1.6-2.9 2.3-4.6 1.4 1 4.9 2.4 4.9 5.2A3.6 3.6 0 0 1 12 22z" fill="#fff0b0"/>',
  'skill-barrier': '<path d="M12 2l8 3v6.2c0 5-3.4 8.6-8 10.8-4.6-2.2-8-5.8-8-10.8V5z" fill="#f6d77a" stroke="#8a5f12" stroke-width="1.4" stroke-linejoin="round"/><path d="M12 5.5v14M7 10h10" stroke="#8a5f12" stroke-width="1.6" fill="none"/>',
  skill: '<path d="M12 2l8 3v6.2c0 5-3.4 8.6-8 10.8-4.6-2.2-8-5.8-8-10.8V5z" fill="#f6d77a" stroke="#8a5f12" stroke-width="1.4" stroke-linejoin="round"/>',
  spell: '<path d="M12 2l2.6 6.4L21 9.2l-4.8 4.4 1.4 6.4L12 16.8 6.4 20l1.4-6.4L3 9.2l6.4-.8z" fill="#eaf3ff" stroke="#8fc0ff" stroke-width="1.4" stroke-linejoin="round"/>',
};

// Reserve glyphs: a simple silhouette per recruit class.
const UNIT_GLYPHS = {
  pikeman: '<path d="M12 1.5l3.2 5.5h-2.2V22h-2V7H8.8z" fill="#e9eef8" stroke="#7b8799" stroke-width="1" stroke-linejoin="round"/><path d="M6 15h12" stroke="#c9a24a" stroke-width="2"/>',
  archer: '<path d="M6 2.5c9 3 9 16 0 19" fill="none" stroke="#e9eef8" stroke-width="2" stroke-linecap="round"/><path d="M6 2.5v19M6 12h15M17.5 8.5L21 12l-3.5 3.5" fill="none" stroke="#c9a24a" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>',
  cavalier: '<path d="M6 22V13l4.5-9.5 3.2 2.3 4.8 1.4v3.4l-3.4 2 2.4 5.4V22z" fill="#e9eef8" stroke="#7b8799" stroke-width="1" stroke-linejoin="round"/><circle cx="13.2" cy="8" r="1" fill="#16223d"/>',
};

const glyphSVG = (paths) => `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">${paths}</svg>`;

function glyphFor(item) {
  if (item.type === 'shard') return gemSVG(SHARDS[item.shardId]?.color ?? '#2fc4b0', 30);
  return glyphSVG(ICONS[item.id] || (item.type === 'skill' ? ICONS.skill : ICONS.spell));
}

const costBadge = (cost, affordable) =>
  `<span class="plan-cost${affordable ? '' : ' short'}" aria-label="Cost ${cost} Supply"><span class="cost-num">${cost}</span><i aria-hidden="true">S</i></span>`;

/**
 * m: { hand: card[], selectedCardId, canAfford(cost) -> bool, portraitFor(card) -> svg string (unit cards) }
 */
export function handHTML(m) {
  return m.hand.map((item) => {
    const unit = item.type === 'unit';
    const kind = ['unit', 'spell', 'skill', 'shard'].includes(item.type) ? item.type : 'spell';
    const affordable = !!m.canAfford(item.cost);
    const selected = item.instanceId === m.selectedCardId;
    const face = unit ? uniqueIds(m.portraitFor(item)) : uniqueIds(glyphFor(item));
    const detail = unit
      ? `${esc(item.class)} · ${item.stars}★<span class="rng">Range ${item.range}</span>`
      : esc(item.effect);
    const full = unit ? `${item.class} · ${item.stars} star · Range ${item.range}` : item.effect;
    return `<button class="plan-card ${esc(item.type)}-card${selected ? ' selected' : ''}${affordable ? '' : ' unaffordable-card'}" data-card-id="${esc(item.instanceId)}" aria-pressed="${selected}">
        <span class="plan-face ${unit ? 'portrait' : 'glyph'}">${face}${affordable ? '' : '<span class="unaffordable">Short</span>'}</span>
        <span class="plan-card-copy"><span class="plan-kind" title="${esc(item.rarity||'common')} rarity">${KIND_LABEL[kind]}</span><b title="${esc(item.name)}">${esc(item.name)}</b><small title="${esc(full)}">${detail}</small></span>
        ${costBadge(item.cost, affordable)}
      </button>`;
  }).join('');
}

/**
 * m: { reserves: reserve[], selectedReserveId, definitions: UNIT_CARDS, portraitFor?(reserve) -> svg (optional) }
 */
export function reservesHTML(m) {
  return m.reserves.map((reserve) => {
    const definition = m.definitionFor?.(reserve.unitId) ?? m.definitions[reserve.unitId];
    const name = definition?.name || reserve.unitId;
    const selected = m.selectedReserveId === reserve.id;
    const stars = Math.max(1, Number(reserve.stars) || 1);
    const pips = `<span class="pips" role="img" aria-label="${stars} star${stars === 1 ? '' : 's'}">${'★'.repeat(stars)}</span>`;
    const hp = reserve.hp ?? 'Full';
    const face = m.portraitFor ? uniqueIds(m.portraitFor(reserve)) : glyphSVG(UNIT_GLYPHS[reserve.unitId] || UNIT_GLYPHS.pikeman);
    return `<button class="reserve-card${selected ? ' selected' : ''}" data-reserve-id="${esc(reserve.id)}" aria-pressed="${selected}" title="${esc(name)} · ${stars} star · ${esc(hp)} HP · ${reserve.energy ?? 0} energy">
        <span class="plan-face ${m.portraitFor ? 'portrait' : 'glyph'}">${face}</span>
        <span class="plan-card-copy"><span class="plan-kind">Reserve${pips}</span><b title="${esc(name)}">${esc(name)}</b>
          <span class="reserve-stats"><span class="stat"><em>HP</em> ${esc(hp)}</span><span class="stat"><em>EN</em> ${reserve.energy ?? 0}</span></span></span>
      </button>`;
  }).join('') || '<span class="empty-reserve">No paid reserves</span>';
}

/**
 * The selected-card bar. m: { selectedCard | undefined, selectedSkillType, skillLoadouts, canAfford(cost) }
 */
export function detailHTML(m) {
  const c = m.selectedCard;
  const p=m.cyclePreview;
  const reason={'cycle-used':'Cycle used this turn','hand-full':'Free a hand slot to cycle a bench unit','no-matching-pool':'No matching rarity/type in the pool'}[p?.reason]||p?.reason?.replaceAll('-',' ');
  const cycleControl=p?`<button class="cycle-control" data-act="cycle" ${p.ok?'':'disabled'} title="${esc(reason||'One random replacement; the same identity may return')}">↻ Cycle${m.selectedReserve?' · +'+(p.refund||0)+' Supply':''}</button>`:'';
  if(m.selectedReserve) {
    const u=m.selectedReserve,name=UNIT_CARDS[u.unitId]?.name||u.unitId;
    return `<div class="plan-detail unit-detail"><div class="plan-detail-text"><b>${esc(name)} · ${u.stars||1}★ · ${esc(u.rarity||'common')}</b><span class="effect"> Paid bench unit. Deploy without paying again, or cycle for full refund. Replacement is unpaid and starts fresh.</span><small class="hint">${p?.ok?'Refund '+p.refund+' Supply; free '+p.populationFreed+' population. Same rarity and stars.':esc(reason||'')}</small></div>${cycleControl}</div>`;
  }
  if(!c) return '';
  const unit = c.type === 'unit';
  const skill = c.type === 'skill';
  if (c.type === 'shard') {
    const short = !m.canAfford(c.cost), full = m.dockFree <= 0;
    const why = full ? 'Shard dock is full: apply, remove or combine a shard first' : short ? `Not enough Supply: ${c.name} costs ${c.cost}` : `Buy ${c.name} into the shard dock (${c.cost} Supply)`;
    return `<div class="plan-detail shard-detail"><div class="plan-detail-text" title="${esc(`${c.name}: ${shardEffectText(c.shardId, c.tier)}`)}">${gemSVG(SHARDS[c.shardId]?.color ?? '#2fc4b0', 16)}<b>${esc(c.name)}</b> <span class="effect">${esc(shardEffectText(c.shardId, c.tier))} for every unit of a class</span><small class="hint">${esc(why)}</small></div><button type="button" class="shard-buy" data-act="buyShard" title="${esc(why)}"${short || full ? ' disabled' : ''}>Buy · ${c.cost}S</button>${cycleControl}</div>`;
  }
  const effect = unit ? `${c.class} · ${c.stars} star · ${c.range} range · default ${c.defaultStance}` : c.effect;
  const typeLabel = (id) => SKILL_TYPES.find(([t]) => t === id)?.[1] || id;
  let controls = '';
  if (skill) {
    const skillSelect = SKILL_TYPES.map(([id, label]) => `<option value="${id}"${id === m.selectedSkillType ? ' selected' : ''}>${label}</option>`).join('');
    const alreadyEquipped = (m.skillLoadouts[m.selectedSkillType] || []).some((entry) => entry.id === c.skillId);
    const short = !m.canAfford(c.cost);
    const why = short ? `Not enough Supply: ${c.name} costs ${c.cost}` : alreadyEquipped ? `${c.name} is already equipped for ${typeLabel(m.selectedSkillType)}` : `Equip ${c.name} for every ${typeLabel(m.selectedSkillType)} (${c.cost} Supply)`;
    controls = `<label class="skill-equip-label"><span>Equip for</span><select data-skill-unit-type aria-label="Unit type to equip ${esc(c.name)} for">${skillSelect}</select></label><button class="skill-equip" data-act="equipSkill" title="${esc(why)}"${short || alreadyEquipped ? ' disabled' : ''}>Equip <span class="equip-cost">· ${c.cost}<span class="wide"> Supply</span></span></button>`;
  }
  const hint = unit ? '<small class="hint">Recruit to the paid bench; deploy near controlled locations. Cycling keeps rarity and stars.</small>'
    : skill ? '' : `<small class="hint">Target: ${esc(c.target)} · ${esc(c.duration)}</small>`;
  return `<div class="plan-detail ${esc(c.type)}-detail"><div class="plan-detail-text" title="${esc(`${c.name}: ${effect}`)}"><b>${esc(c.name)}</b> <span class="effect">${esc(effect)}</span>${hint}<small class="hint">${esc(c.rarity||'common')} rarity${reason?' · '+esc(reason):' · Random replacement of the same type'}</small></div>${controls}${cycleControl}</div>`;
}

/**
 * Equipped type-wide skills with their transfer controls. m: { skillLoadouts, skillTransferTargets }
 */
export function loadoutsHTML(m) {
  const entries = SKILL_TYPES.flatMap(([typeId, label]) => skillsForUnitType(m.skillLoadouts, typeId).map((skill) => {
    const transferKey = `${typeId}:${skill.id}`;
    const targets = SKILL_TYPES.filter(([id]) => id !== typeId).map(([id, name]) => `<option value="${id}"${id === m.skillTransferTargets[transferKey] ? ' selected' : ''}>${name}</option>`).join('');
    return `<div class="skill-entry" title="${esc(`${label}: ${skill.name}. ${skill.effect}`)}"><span class="skill-id"><b>${label}</b><span>${esc(skill.name)}</span></span><label class="skill-move"><span>Move to</span><select data-skill-transfer-target="${esc(transferKey)}" aria-label="Transfer ${esc(skill.name)} from ${label} to">${targets}</select></label><button data-transfer-skill="${esc(skill.id)}" data-from-type="${typeId}" aria-label="Move ${esc(skill.name)} from ${label}">Move</button></div>`;
  }));
  return `<div class="skill-loadouts" aria-label="Type-wide skill equipment">${entries.join('') || '<span class="no-skills">No type-wide skills equipped</span>'}</div>`;
}
