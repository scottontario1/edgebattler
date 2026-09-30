import './levelpanel.css';
import { FACTION_BY_ID } from '../setup.js';
import { esc } from './util.js';

/**
 * Objective panel additions (no new markup in index.html): a Menu link on every game, the faction names for a skirmish, and for a
 * level its title, question and the suggested plan (the skilled variant's Blue steps) as a collapsible hint.
 */
export function mountLevelPanel({ level = null, you = 'classic', foe = 'classic', campaignLevel = null, match = null } = {}) {
  const panel = document.querySelector('.objective');
  if (!panel) return;
  const eyebrow = panel.querySelector('.eyebrow'), goal = panel.querySelector('.goal'), sub = panel.querySelector('.sub');
  if (campaignLevel) {
    eyebrow.textContent = `${FACTION_BY_ID[you].name} · Mission ${campaignLevel.number}`;
    goal.lastChild.textContent = campaignLevel.title;
    sub.textContent = '↑ North · clear encounters, rally at villages, reach the north exit';
    panel.insertAdjacentHTML('beforeend', `<details class="lv-plan"><summary>Mission briefing</summary><p>${esc(campaignLevel.teaches)}</p><p>March sets your whole army to Advance toward the current checkpoint. Change individual stances to keep a screen or hold your archers. Rally restores up to 4 HP once per cleared village to survivors within 2 tiles. Enemy waves are fixed. After regrouping, Continue north opens the next encounter.</p></details>`);
  } else if (level) {
    eyebrow.textContent = `${level.groupName} · Level ${level.number}`;
    goal.lastChild.textContent = level.title.replace(/^(Level \d+|[A-E]\.|Scenario \d+):\s*/, '');
    sub.textContent = `Win by holding the enemy keep or destroying their army in ${level.maxRounds} rounds`;
    const hints = level.hints.length ? `<ol>${level.hints.map((h) => `<li>${esc(h)}</li>`).join('')}</ol>` : '<p class="lv-none">No scripted plan: read the setup and improvise.</p>';
    panel.classList.add('has-level');
    panel.insertAdjacentHTML('beforeend', `<details class="lv-plan"><summary>About this level</summary>
      <p class="lv-q">${esc(level.question)}</p>${level.setup ? `<p class="lv-setup">${esc(level.setup)}</p>` : ''}
      <h4>Suggested plan</h4>${hints}</details>`);
  } else if (you !== 'classic' || foe !== 'classic') {
    eyebrow.textContent = 'Skirmish';
    goal.lastChild.textContent = `${FACTION_BY_ID[you].name.replace('The ', '')} v ${FACTION_BY_ID[foe === you ? 'classic' : foe].name.replace('The ', '')}`;
  }
  panel.insertAdjacentHTML('beforeend', '<a class="menu-link" href="?menu=1" title="Back to the menu">☰ Menu</a>');
}
