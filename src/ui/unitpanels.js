// Unit card, combat forecast, inspect sheet, terrain chip and roster portraits.
// Pure template functions; ui.js supplies plain data. Wired by ui.js through
// [data-act="close"] on the sheet and `.mini[data-id]` roster buttons.
// Optional unit fields (stars, population, stance, energy/maxEnergy, selectedAbilities, cooldowns,
// statuses) are treated as absent when missing: the matching chip or row is simply omitted.
import { esc, uniqueIds } from './util.js';
import { ABILITIES, selectedCost } from '../abilities.js';
import { stanceIcon, starPips, energyPips, statusIcon, STANCE_LABEL, STANCE_HINT } from './icons.js';

const titleCase = (s) => String(s).replace(/[_-]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
const stanceKey = (u) => (STANCE_LABEL[u.stance] ? u.stance : null);
const pctOf = (hp, max) => Math.max(0, Math.min(100, (hp / max) * 100));

/** Label, short detail and full tooltip for a status entry (`value` may be a number, string or {amount, duration}). */
function statusMeta(name, value) {
  const obj = value && typeof value === 'object' ? value : null;
  const bareBarrier = name === 'barrier' && typeof value === 'number';
  const amount = obj ? obj.amount : (bareBarrier ? value : undefined);
  const dur = obj ? obj.duration : (bareBarrier ? 'upcoming-battle' : value);
  const when = dur === 'upcoming-battle' ? 'until the next battle resolves'
    : Number.isFinite(dur) ? `for ${dur} more round${dur === 1 ? '' : 's'}` : '';
  const effects = {
    barrier: `Reduces damage taken by ${Number.isFinite(amount) ? amount : 'a fixed amount'} in one battle`,
    ward: 'Halves damage taken in the next battle',
  };
  const label = titleCase(name);
  return {
    label,
    detail: name === 'barrier' && Number.isFinite(amount) ? `-${amount} dmg` : name === 'ward' ? 'half dmg' : '',
    title: `${label}: ${effects[name] || label}${when ? `, ${when}` : ''}`,
  };
}

/** Active statuses as [name, value] pairs. */
function activeStatuses(u) {
  return u.statuses && typeof u.statuses === 'object'
    ? Object.entries(u.statuses).filter(([, v]) => v !== undefined && v !== null && v !== false && v !== 0) : [];
}

const stanceChip = (u, size = 12) => {
  const k = stanceKey(u);
  return k ? `<span class="schip stance ${k}" title="${STANCE_LABEL[k]}: ${STANCE_HINT[k]}">${stanceIcon(k, size)}<b>${STANCE_LABEL[k]}</b></span>` : '';
};
const energyChip = (u) => (u.maxEnergy > 0
  ? `<span class="schip energy" title="Energy ${u.energy || 0} of ${u.maxEnergy}">${energyPips(u.energy || 0, u.maxEnergy, 12)}</span>` : '');
const statusChips = (u, { detail = false, iconOnly = false } = {}) => activeStatuses(u).map(([name, v]) => {
  const m = statusMeta(name, v);
  return `<span class="schip status ${esc(name)}" title="${esc(m.title)}">${statusIcon(name, 12)}${iconOnly ? '' : `<b>${esc(m.label)}</b>`}${detail && m.detail ? `<small>${m.detail}</small>` : ''}</span>`;
}).join('');

/** u: unit record. m: { portrait: svg string } */
export function unitCardHTML(u, m) {
  const side = u.faction === 'blue' ? 'Ally' : 'Enemy';
  const many = activeStatuses(u).length > 1;
  return `
      <div class="face">${uniqueIds(m.portrait)}</div>
      <div class="info">
        <div class="name-row"><span class="name" title="${esc(u.name)}">${esc(u.name)}</span>${u.stars ? `<span class="rank" title="${u.stars}-star tier">${starPips(u.stars, u.stars, 12)}</span>` : ''}${u.boss ? '<span class="tag boss">BOSS</span>' : ''}<span class="tag side">${side}</span></div>
        <div class="cls" title="${esc(u.title)} · ${esc(u.weapon)}">${esc(u.title)} · Lv ${u.lv} · MOV ${u.mov}</div>
        <div class="hp"><span>HP</span><div class="bar"><i style="width:${pctOf(u.hp, u.maxHp)}%"></i></div><b>${u.hp}/${u.maxHp}</b></div>
        <div class="sts">${stanceChip(u)}${energyChip(u)}<span class="schip" title="Authoritative facing">${esc(u.facing||'north')}</span>${statusChips(u, { iconOnly: many })}</div>
        <div class="cls">${(u.selectedAbilities||[]).map(id=>ABILITIES[id]?.name||id).join(' · ')||'Basic actions'}${selectedCost(u)>u.energy?' · Paid picks suspended':''}</div>
      </div>`;
}

/**
 * Combat forecast (used by the manual-strike targeting mode).
 * m: { a, d, f: forecast(a, d, from), terrain: TERRAIN entry under the defender }
 */
export function forecastHTML({ a, d, f, terrain }) {
  const val = (s, cls = '') => (s.can
    ? `<div class="v ${cls}">${s.dmg}${s.double ? '<small>×2</small>' : ''}</div>`
    : `<div class="v none ${cls}">–</div>`);
  const pct = (s, k, cls = '') => `<div class="v ${cls}${s.can ? '' : ' none'}">${s.can ? s[k] : '–'}</div>`;
  const after = (hp, s) => Math.max(0, hp - (s.can ? s.dmg * (s.double ? 2 : 1) : 0));
  const hpBar = (u, s, cls) => {
    const left = after(u.hp, s);
    const n = left === u.hp ? `${u.hp}` : `${u.hp}<span>→</span>${left}`;
    return `<div class="fc-hp ${cls}"><div class="bar"><em style="width:${(u.hp / u.maxHp) * 100}%"></em><i style="width:${(left / u.maxHp) * 100}%"></i></div><b>${n}</b></div>`;
  };
  const tri = f.atk.tri > 0 ? 'Weapon advantage' : f.atk.tri < 0 ? 'Weapon disadvantage' : '';
  const counter = f.def.can ? '' : `${esc(d.name)} can't counter at range ${f.dist}`;
  return `
      <div class="eyebrow">Combat forecast</div>
      <div class="fc-grid">
        <div class="fc-name blue">${esc(a.name)}</div><div></div><div class="fc-name red">${esc(d.name)}</div>
        ${hpBar(a, f.def, 'b')}<div class="l">HP</div>${hpBar(d, f.atk, 'r')}
        ${val(f.atk)}<div class="l">DMG</div>${val(f.def, 'r')}
        ${pct(f.atk, 'hit')}<div class="l">HIT</div>${pct(f.def, 'hit', 'r')}
        ${pct(f.atk, 'crit')}<div class="l">CRIT</div>${pct(f.def, 'crit', 'r')}
      </div>
      <div class="fc-note">${[tri, counter, terrain.def || terrain.avo ? `${terrain.name}: <b>+${terrain.def} DEF +${terrain.avo} AVO</b>` : ''].filter(Boolean).join(' · ') || `${esc(a.weapon)} vs ${esc(d.weapon)}`}</div>`;
}

/** Shown in the forecast slot before an enemy is picked. */
export function targetPromptHTML(count) {
  return `<div class="eyebrow">Choose a target</div><div class="fc-note">${count} ${count === 1 ? 'enemy' : 'enemies'} in reach · hover or tap a marked enemy</div>`;
}

/**
 * Inspect sheet body (the close button and top block included).
 * m: { portrait, weapon: weaponOf(u), terrain: TERRAIN entry under the unit, moveType: 'Armored' | 'Mounted' | 'Foot' }
 */
export function sheetHTML(u, m) {
  const { weapon: w, terrain: t } = m;
  const stat = (label, v) => `<div class="stat"><span>${label}</span><b>${v}</b></div>`;
  const row = (label, body, cls = '') => `<div class="srow ${cls}"><span class="lab">${label}</span><div class="val">${body}</div></div>`;
  const k = stanceKey(u);
  const abilities = Array.isArray(u.selectedAbilities)
    ? (u.selectedAbilities.length
      ? u.selectedAbilities.map((id) => {
        const cd = u.cooldowns?.[id] || 0;
        const name = ABILITIES[id]?.name || titleCase(id);
        return `<span class="ability${cd > 0 ? ' cooling' : ''}" title="${esc(name)}${cd > 0 ? `: ready in ${cd} round${cd === 1 ? '' : 's'}` : ''}">${esc(name)}${cd > 0 ? `<small>cd ${cd}</small>` : ''}</span>`;
      }).join('')
      : '<span class="none">None</span>')
    : '';
  const sts = u.statuses && typeof u.statuses === 'object' ? (statusChips(u, { detail: true }) || '<span class="none">None</span>') : '';
  const tier = u.stars || u.population ? `<span class="gold">${u.stars || 1}★</span> · Pop ${u.population ?? 1}` : '';
  const rows = [
    k ? row('Stance', stanceChip(u, 14)) : '',
    u.maxEnergy > 0 ? row('Energy', `${energyPips(u.energy || 0, u.maxEnergy, 14)}<b class="en-n">${u.energy || 0}/${u.maxEnergy}</b>`) : '',
    tier ? row('Stars', tier) : '',
    abilities ? row('Abilities', abilities) : '',
    sts ? row('Statuses', sts, 'wide') : '',
  ].join('');
  return `
      <button class="btn close" data-act="close" aria-label="Close">×</button>
      <div class="top">
        <div class="face">${uniqueIds(m.portrait)}</div>
        <div class="info">
          <div class="eyebrow">${u.faction === 'blue' ? 'Ally' : 'Enemy'}${u.boss ? ' · Boss' : ''}</div>
          <div class="name">${esc(u.name)}</div>
          <div class="cls">${esc(u.title)} · Lv ${u.lv} · ${m.moveType}</div>
          <div class="hp"><span>HP</span><div class="bar"><i style="width:${pctOf(u.hp, u.maxHp)}%"></i></div><b>${u.hp}/${u.maxHp}</b></div>
          <div class="facts"><span>MOV <b>${u.mov}</b></span><span>On <b>${t.name}</b></span></div>
        </div>
      </div>
      <div class="stats">
        ${stat('Str', u.str)}${stat('Mag', u.mag)}${stat('Skl', u.skl)}${stat('Spd', u.spd)}
        ${stat('Def', u.def)}${stat('Res', u.res)}${stat('Ter Def', `+${t.def}`)}${stat('Ter Avo', `+${t.avo}`)}
      </div>
      <div class="weapon-row"><span>⚔ <b>${esc(w.name || u.weapon)}</b></span><span>Mt <b>${w.mt}</b> · Hit <b>${w.hit}</b> · Crt <b>${w.crit}</b> · Rng <b>${w.rng[0] === w.rng[1] ? w.rng[0] : w.rng.join('–')}</b></span></div>
      ${rows ? `<div class="srows">${rows}</div>` : ''}`;
}

/** Terrain chip under the cursor. m: { terrain: TERRAIN entry, cost: foot move cost | undefined } */
export function terrainChipHTML({ terrain: t, cost }) {
  return `<span class="tname">${t.name}</span>`
    + (cost === undefined ? '<span class="blocked">Impassable</span>'
      : `<span>DEF <b>+${t.def}</b></span><span>AVO <b>+${t.avo}</b></span>${cost > 1 ? `<span>Move <b>×${cost}</b></span>` : ''}`);
}

/** Roster button contents: portrait plus overlay slots that `decorateRoster` fills. */
export function rosterMiniHTML(unit, portrait) {
  return `${uniqueIds(portrait)}<span class="rs-stars" aria-hidden="true"></span><i class="rs-stance" aria-hidden="true"></i>`;
}

/** Refresh a roster button's state classes and overlays from the unit record. */
export function decorateRoster(el, unit, { active }) {
  const dead = unit.hp <= 0;
  el.classList.toggle('active', !!active);
  el.classList.toggle('done', !!unit.done);
  el.classList.toggle('dead', dead);
  el.classList.toggle('low', !dead && unit.maxHp > 0 && unit.hp / unit.maxHp < 0.35);
  const stars = Number(unit.stars) >= 2 ? Math.floor(unit.stars) : 0;
  const k = unit.faction === 'blue' ? stanceKey(unit) : null;
  const key = `${stars}|${k}`;
  if (el.dataset.rs !== key) {
    el.dataset.rs = key;
    const starEl = el.querySelector('.rs-stars');
    if (starEl) starEl.innerHTML = stars ? starPips(stars, stars, 10) : '';
    const dot = el.querySelector('.rs-stance');
    if (dot) { dot.className = `rs-stance${k ? ` ${k}` : ''}`; dot.title = k ? `Stance: ${STANCE_LABEL[k]}` : ''; }
  }
  el.classList.toggle('has-stars', stars > 0);
}
