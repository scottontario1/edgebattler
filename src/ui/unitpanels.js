// Unit card, combat forecast, inspect sheet, terrain chip and roster portraits.
// Pure template functions; ui.js supplies plain data. Wired by ui.js through
// [data-act="close"] on the sheet and `.mini[data-id]` roster buttons.
import { esc, uniqueIds } from './util.js';

/** u: unit record. m: { portrait: svg string } */
export function unitCardHTML(u, m) {
  const side = u.faction === 'blue' ? 'Ally' : 'Enemy';
  return `
      <div class="face">${uniqueIds(m.portrait)}</div>
      <div class="info">
        <div class="name-row"><span class="name">${esc(u.name)}</span>${u.stars ? `<span class="tag stars">${u.stars}★</span>` : ''}${u.boss ? '<span class="tag boss">BOSS</span>' : ''}<span class="tag side">${side}</span></div>
        <div class="cls">${esc(u.title)} · Lv ${u.lv}</div>
        <div class="hp"><span>HP</span><div class="bar"><i style="width:${(u.hp / u.maxHp) * 100}%"></i></div><b>${u.hp}/${u.maxHp}</b></div>
        <div class="facts"><span>MOV <b>${u.mov}</b></span><span>⚔ <b>${esc(u.weapon)}</b></span>${u.maxEnergy ? `<span>EN <b>${u.energy}/${u.maxEnergy}</b></span>` : ''}<span>STANCE <b>${esc(u.stance || 'advance')}</b></span></div>
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
  return `
      <button class="btn close" data-act="close" aria-label="Close">×</button>
      <div class="top">
        <div class="face">${uniqueIds(m.portrait)}</div>
        <div class="info">
          <div class="eyebrow">${u.faction === 'blue' ? 'Ally' : 'Enemy'}${u.boss ? ' · Boss' : ''}</div>
          <div class="name">${esc(u.name)}</div>
          <div class="cls">${esc(u.title)} · Lv ${u.lv} · ${m.moveType}</div>
          <div class="hp"><span>HP</span><div class="bar"><i style="width:${(u.hp / u.maxHp) * 100}%"></i></div><b>${u.hp}/${u.maxHp}</b></div>
          <div class="facts"><span>MOV <b>${u.mov}</b></span><span>On <b>${t.name}</b></span></div>
        </div>
      </div>
      <div class="stats">
        ${stat('Str', u.str)}${stat('Mag', u.mag)}${stat('Skl', u.skl)}${stat('Spd', u.spd)}
        ${stat('Def', u.def)}${stat('Res', u.res)}${stat('Ter Def', `+${t.def}`)}${stat('Ter Avo', `+${t.avo}`)}
      </div>
      <div class="weapon-row"><span>⚔ <b>${esc(w.name || u.weapon)}</b></span><span>Mt <b>${w.mt}</b> · Hit <b>${w.hit}</b> · Crt <b>${w.crit}</b> · Rng <b>${w.rng[0] === w.rng[1] ? w.rng[0] : w.rng.join('–')}</b></span></div>`;
}

/** Terrain chip under the cursor. m: { terrain: TERRAIN entry, cost: foot move cost | undefined } */
export function terrainChipHTML({ terrain: t, cost }) {
  return `<span class="tname">${t.name}</span>`
    + (cost === undefined ? '<span class="blocked">Impassable</span>'
      : `<span>DEF <b>+${t.def}</b></span><span>AVO <b>+${t.avo}</b></span>${cost > 1 ? `<span>Move <b>×${cost}</b></span>` : ''}`);
}

/** Roster button contents and state classes. */
export function rosterMiniHTML(unit, portrait) {
  return uniqueIds(portrait);
}

/** Refresh a roster button's state classes from the unit record. */
export function decorateRoster(el, unit, { active }) {
  el.classList.toggle('active', !!active);
  el.classList.toggle('done', !!unit.done);
  el.classList.toggle('dead', unit.hp <= 0);
}
