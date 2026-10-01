// HUD gallery: every component and state from fixtures on a dark placeholder background.
//   /gallery.html?view=planning            the composed HUD (see VIEW_MODELS for names)
//   /gallery.html?view=components          every component rendered flat, for review
//   &army=1 &tray=open|closed              force the collapsible panels
//   &log=1                                 show intents emitted by clicks
import { Hud } from './Hud.js';
import './styles.js';
import { VIEW_MODELS } from './fixtures.js';
import * as fx from './fixtures.js';
import { renderTopBar } from './topbar.js';
import { renderCampaign } from './campaign.js';
import { renderArmy } from './army.js';
import { renderTray } from './tray.js';
import { renderHandCard, renderBenchUnit, renderDetail } from './hand.js';
import { renderShardDock } from './shards.js';
import { renderResolve } from './resolve.js';
import { renderFeed, renderBanner } from './feed.js';
import { renderUnitMenu } from './unitmenu.js';
import { renderInspect } from './inspect.js';
import { renderCombine } from './upgrade.js';
import { renderReport, renderEnd } from './report.js';
import { renderMenu } from './menu.js';
import './gallery.css';

const params = new URLSearchParams(location.search);
const view = params.get('view') ?? 'planning';
const stage = document.getElementById('stage');
const hudRoot = document.getElementById('hud');
window.__intents = [];

function mountView(name) {
  stage.className = 'gallery-battlefield';
  const hud = new Hud(hudRoot);
  hud.onIntent((intent) => {
    window.__intents.push(intent);
    if (params.get('log')) logIntent(intent);
  });
  if (params.has('army')) hud.setPanel('army', params.get('army') === '1');
  if (params.has('tray')) hud.setPanel('tray', params.get('tray') === 'open');
  hud.update(VIEW_MODELS[name] ?? VIEW_MODELS.planning);
  window.__hud = hud;
}

function logIntent(intent) {
  let log = document.getElementById('intent-log');
  if (!log) { log = document.createElement('pre'); log.id = 'intent-log'; document.body.appendChild(log); }
  log.textContent = `${JSON.stringify(intent)}\n${log.textContent}`.split('\n').slice(0, 6).join('\n');
}

const cell = (title, html, cls = '') => `<section class="gallery-cell ${cls}"><h3>${title}</h3><div class="gallery-body">${html}</div></section>`;

function mountComponents() {
  hudRoot.remove();
  document.body.classList.add('hud-gallery');
  const dock = fx.shardDock;
  const full = { ...dock, items: Array.from({ length: 12 }, (_, i) => ({ ...dock.items[i % dock.items.length], id: `f${i}` })), combos: [] };
  const cards = fx.tray.hand.map(renderHandCard).join('');
  const sections = [
    ['Top bar', renderTopBar(fx.top), 'wide'],
    ['Top bar: population full, cycle spent', renderTopBar({ ...fx.top, population: { current: 10, cap: 10 }, bench: { current: 8, cap: 8 }, cycle: { remaining: 0, max: 1 }, phase: { id: 'battle', label: 'Battle' } }), 'wide'],
    ['Campaign: engage', renderCampaign(fx.campaign), 'wide'],
    ['Campaign: regroup (orders disabled)', renderCampaign(fx.campaignRegroup), 'wide'],
    ['Campaign: complete', renderCampaign(fx.campaignComplete), 'wide'],
    ['Army sidebar', renderArmy(fx.army), 'col'],
    ['Army: locked', renderArmy({ ...fx.army, locked: true }), 'col'],
    ['Army: empty', renderArmy({ groups: [], locked: false }), 'col'],
    ['Hand cards (common, uncommon, rare, short, shard)', `<div class="strip">${cards}</div>`, 'wide'],
    ['Bench', `<div class="strip">${fx.tray.bench.map(renderBenchUnit).join('')}</div>`],
    ['Detail: recruit', renderDetail(fx.tray.detail), 'wide'],
    ['Detail: shard offer', renderDetail(fx.planningShardOffer.tray.detail), 'wide'],
    ['Detail: bench unit (cycle disabled)', renderDetail(fx.planningBenchSelected.tray.detail), 'wide'],
    ['Detail: nothing selected', renderDetail(null), 'wide'],
    ['Shard dock: combine available', renderShardDock(fx.shardDock), 'wide'],
    ['Shard dock: applying Ruby II', renderShardDock(fx.shardDockApplying), 'wide'],
    ['Shard dock: full (12)', renderShardDock(full), 'wide'],
    ['Shard dock: empty', renderShardDock({ slots: 12, items: [], combos: [], apply: null }), 'wide'],
    ['Tray (locked during battle)', renderTray({ ...fx.tray, locked: true }), 'wide'],
    ['Resolve: ready', renderResolve(fx.resolve)],
    ['Resolve: disabled', renderResolve({ ...fx.resolve, enabled: false, reason: 'No units on the field' })],
    ['Resolve: playback', renderResolve(fx.battle.resolve)],
    ['Feed', renderFeed(fx.feed)],
    ['Banner: battle', renderBanner({ id: 'b', kind: 'battle', title: 'Battle', sub: 'Round 3' }), 'wide'],
    ['Banner: capture', renderBanner({ id: 'b', kind: 'capture', title: 'Village captured', sub: 'The Argent Crown hold (5, 11)' }), 'wide'],
    ['Banner: planning', renderBanner({ id: 'b', kind: 'planning', title: 'Round 4', sub: 'Plan your moves' }), 'wide'],
    ['Unit menu', renderUnitMenu(fx.unitMenu), 'col'],
    ['Unit menu: withdraw unavailable', renderUnitMenu({ ...fx.unitMenu, protectTargets: undefined, stances: fx.unitMenu.stances.map((s) => (s.id === 'protect' ? { ...s, enabled: false, reason: 'No ally to protect' } : s)), withdraw: { enabled: false, reason: 'Not in a controlled deployment area' } }), 'col'],
    ['Inspect sheet', renderInspect(fx.inspect), 'modal'],
    ['Combine dialog', renderCombine(fx.combine), 'modal'],
    ['Combine dialog: blocked', renderCombine(fx.combineBlocked), 'modal'],
    ['Battle statistics', renderReport(fx.report), 'modal'],
    ['End: victory', renderEnd(fx.endVictory), 'modal'],
    ['End: defeat', renderEnd(fx.endDefeat), 'modal'],
    ['Start menu (campaign)', renderMenu(fx.menu), 'menu'],
    ['Start menu (skirmish, error)', renderMenu(fx.menuError.menu), 'menu'],
  ];
  stage.className = 'gallery-sheet';
  stage.innerHTML = `<h1>HUD components</h1><div class="gallery-grid">${sections.map(([t, h, c]) => cell(t, h, c)).join('')}</div>`;
}

if (view === 'components') mountComponents();
else mountView(view);
