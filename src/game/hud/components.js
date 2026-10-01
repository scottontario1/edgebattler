// The component registry: which view-model slice feeds which renderer, and which slot it fills.
// Adding a HUD component is one entry here plus its module and stylesheet.
import { renderMenu } from './menu.js';
import { renderTopBar } from './topbar.js';
import { renderCampaign } from './campaign.js';
import { renderArmy } from './army.js';
import { renderTray } from './tray.js';
import { renderResolve } from './resolve.js';
import { renderFeed, renderBanner } from './feed.js';
import { renderUnitMenu } from './unitmenu.js';
import { renderInspect } from './inspect.js';
import { renderCombine } from './upgrade.js';
import { renderReport, renderEnd } from './report.js';

/**
 * @typedef {object} HudComponent
 * @property {string} id
 * @property {(vm: import('./types.js').HudViewModel) => any} select  the slice this component renders
 * @property {(slice: any) => string} render
 * @property {boolean} [gameOnly]     hidden while the start menu is up
 */

/** @type {HudComponent[]} */
export const COMPONENTS = [
  { id: 'menu', select: (vm) => (vm.screen === 'menu' ? vm.menu : null), render: renderMenu },
  { id: 'top', select: (vm) => vm.top, render: renderTopBar, gameOnly: true },
  { id: 'campaign', select: (vm) => vm.campaign, render: renderCampaign, gameOnly: true },
  { id: 'army', select: (vm) => vm.army, render: renderArmy, gameOnly: true },
  { id: 'feed', select: (vm) => vm.feed, render: renderFeed, gameOnly: true },
  { id: 'tray', select: (vm) => vm.tray, render: renderTray, gameOnly: true },
  { id: 'resolve', select: (vm) => vm.resolve, render: renderResolve, gameOnly: true },
  { id: 'unitmenu', select: (vm) => vm.unitMenu, render: renderUnitMenu, gameOnly: true },
  { id: 'banner', select: (vm) => vm.banner, render: renderBanner, gameOnly: true },
  { id: 'inspect', select: (vm) => vm.inspect, render: renderInspect, gameOnly: true },
  { id: 'combine', select: (vm) => vm.combine, render: renderCombine, gameOnly: true },
  { id: 'report', select: (vm) => vm.report, render: renderReport, gameOnly: true },
  { id: 'end', select: (vm) => vm.end, render: renderEnd, gameOnly: true },
];
