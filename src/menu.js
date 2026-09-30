import './style.css';
import './menu.css';
import { FACTIONS } from './setup.js';
import { CAMPAIGN_LEVELS, campaignURL } from './campaign.js';
import { LEVELS } from './levels.js';
import { esc } from './ui/util.js';

// Start menu: pick factions for a skirmish or a level to play. It starts a game by reloading the page with URL flags that src/game.js reads
// (?you=<faction>&foe=<faction>&red=<ai>&seed=N, or ?level=<id>). Shown when the URL has no flags or ?menu=1; ?nomenu=1 skips it.
const AIS = [['greedy', 'Greedy: recruits and deploys'], ['heuristic', 'Heuristic: spells, stances, keep marches'], ['passive', 'Passive: does not play cards']];
const swatch = (f) => `linear-gradient(135deg, ${f.color} 0 58%, ${f.accent} 58% 100%)`;

function factionCards(name, selected, disabled = null) {
  return FACTIONS.map((f) => `<label class="fcard" style="--fc:${f.color};--fa:${f.accent}">
    <input type="radio" name="${name}" value="${f.id}" ${f.id === selected ? 'checked' : ''} ${f.id === disabled ? 'disabled' : ''}>
    <span class="fbody"><i class="fsw" style="background:${swatch(f)}"></i><b>${esc(f.name)}</b>
    <em>${esc(f.tagline)}</em><small>${f.traits.map(esc).join(' · ')}</small></span></label>`).join('');
}

function levelList() {
  const groups = [...new Set(LEVELS.map((l) => l.group))];
  return groups.map((g) => {
    const ls = LEVELS.filter((l) => l.group === g);
    const f = FACTIONS.find((x) => x.id === g);
    return `<section class="lgroup" style="--fc:${f.color};--fa:${f.accent}"><h3><i class="fsw" style="background:${swatch(f)}"></i>${esc(ls[0].groupName)}</h3>
      ${ls.map((l) => `<div class="lrow"><div><b>${esc(l.title)}</b><p>${esc(l.question)}</p></div>
      <a class="btn play" href="?level=${encodeURIComponent(l.id)}" data-level="${esc(l.id)}">Play</a></div>`).join('')}</section>`;
  }).join('');
}

export function showMenu(root = document.body) {
  const el = document.createElement('div');
  el.className = 'menu';
  el.innerHTML = `<div class="menu-card" role="dialog" aria-label="Main menu">
    <header><h1>Chronicle of Ashvale</h1><p>Recruit a battle line, plan the round, then watch it resolve.</p></header>
    <nav class="tabs" role="tablist"><button role="tab" data-tab="campaign" aria-selected="true">Campaign</button><button role="tab" data-tab="skirmish" aria-selected="false">Skirmish</button><button role="tab" data-tab="levels" aria-selected="false">Levels</button></nav>
    <section class="tab" data-panel="campaign">
      <h2>Choose your faction</h2><div class="fgrid">${factionCards('campaignFaction', 'crown')}</div>
      <p class="note">March south to north. Monsters and rival faction troops arrive in fixed encounters and waves; they never recruit. Clear a position, regroup at its village, then continue north. Each mission starts a fresh army.</p>
      ${CAMPAIGN_LEVELS.map(l => `<div class="lrow"><div><b>${l.number}. ${esc(l.title)}</b><p>${esc(l.teaches)}</p></div><a class="btn play campaign-play" data-campaign="${l.id}" href="${campaignURL(l.id,'crown',0x415348)}">Play</a></div>`).join('')}
    </section>
    <section class="tab" data-panel="skirmish" hidden>
      <h2>Your faction</h2><div class="fgrid" data-group="you">${factionCards('you', 'classic')}</div>
      <h2>Opponent</h2><div class="fgrid" data-group="foe">${factionCards('foe', 'classic')}</div>
      <div class="opts"><label>Opponent AI <select name="red">${AIS.map(([v, t]) => `<option value="${v}">${esc(t)}</option>`).join('')}</select></label>
      <label>Seed <input name="seed" type="number" min="1" placeholder="random" inputmode="numeric"></label></div>
      <p class="note">Faction cards share a draw pool; uncommon cards appear from round 3 and rare cards from round 6. The same faction cannot be picked twice yet.</p>
      <div class="go"><a class="btn primary start" href="?">Start skirmish</a></div>
    </section>
    <section class="tab" data-panel="levels" hidden><p class="note">Fixed battles with a scripted enemy. You play Blue; the suggested plan is under "About this level" in the game.</p>${levelList()}</section>
  </div>`;
  root.appendChild(el);
  document.body.classList.add('menu-open');

  const val = (name) => el.querySelector(`input[name="${name}"]:checked`)?.value || 'classic';
  const sync = () => {
    const faction = el.querySelector('input[name=campaignFaction]:checked')?.value || 'crown';
    for (const a of el.querySelectorAll('.campaign-play')) a.href = campaignURL(a.dataset.campaign, faction, 0x415348);
    const you = val('you');
    for (const input of el.querySelectorAll('input[name="foe"]')) {
      input.disabled = input.value === you && you !== 'classic';
      if (input.disabled && input.checked) el.querySelector('input[name="foe"][value="classic"]').checked = true;
    }
    const q = new URLSearchParams({ you, foe: val('foe'), red: el.querySelector('select[name="red"]').value });
    const seed = el.querySelector('input[name="seed"]').value;
    if (seed) q.set('seed', seed);
    el.querySelector('.start').setAttribute('href', `?${q}`);
  };
  el.addEventListener('change', sync);
  el.addEventListener('input', sync);
  for (const tab of el.querySelectorAll('[role="tab"]')) {
    tab.addEventListener('click', () => {
      for (const t of el.querySelectorAll('[role="tab"]')) t.setAttribute('aria-selected', String(t === tab));
      for (const p of el.querySelectorAll('.tab')) p.hidden = p.dataset.panel !== tab.dataset.tab;
    });
  }
  sync();
  return el;
}
