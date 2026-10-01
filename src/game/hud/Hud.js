// The DOM HUD. Mount it into #hud, feed it view models, listen for intents.
//
//   const hud = new Hud(document.getElementById('hud'));
//   hud.onIntent((intent) => app.handle(intent));
//   hud.update(viewModel);            // cheap: only slices that changed are re-rendered
//
// The Hud owns presentation-only state (panel collapse, menu tab, report side, form fields) and nothing
// else. Game state, legality and selection live in the app and arrive through the view model.
import './styles.js';
import { COMPONENTS } from './components.js';
import { intentFromDataset, applyForm, readForm } from './intents.js';

const NARROW = '(max-width: 560px), (max-aspect-ratio: 1/1) and (max-width: 820px)';
const SHORT = '(max-height: 500px) and (orientation: landscape)';
/** Containers whose scroll offset survives a re-render. */
const SCROLLERS = '.hd-strip, .ar-list, .tr-body, .rp-scroll, .mn-card';
/** `data-local-toggle` targets: where the state class lives and which class it is. */
const LOCAL_TOGGLES = {
  army: { selector: null, className: 'army-open' },
  tray: { selector: null, className: 'tray-collapsed' },
  'um-targets': { selector: '.um-panel', className: 'targets-open' },
  feed: { selector: '.fd-feed', className: 'open' },
};

export class Hud {
  /** @param {HTMLElement} root the #hud element */
  constructor(root) {
    this.root = root;
    this.handlers = new Set();
    this.lastKeys = new Map();
    this.slots = new Map();
    this.unitMenuAnchor = null;
    root.classList.add('hud-root');
    for (const component of COMPONENTS) {
      const slot = document.createElement('div');
      slot.className = `hud-slot slot-${component.id}`;
      slot.dataset.slot = component.id;
      root.appendChild(slot);
      this.slots.set(component.id, slot);
    }
    this.applyResponsiveDefaults();
    this.onClick = (event) => this.handleClick(event);
    this.onChange = (event) => this.handleChange(event);
    this.onKey = (event) => this.handleKey(event);
    this.onResize = () => this.layout();
    root.addEventListener('click', this.onClick);
    root.addEventListener('change', this.onChange);
    window.addEventListener('keydown', this.onKey);
    window.addEventListener('resize', this.onResize);
    if (typeof ResizeObserver !== 'undefined') {
      this.observer = new ResizeObserver(() => this.layout());
      for (const id of ['top', 'campaign', 'tray']) this.observer.observe(this.slots.get(id));
    }
  }

  /** Register the single intent consumer. Returns an unsubscribe function. */
  onIntent(handler) {
    this.handlers.add(handler);
    return () => this.handlers.delete(handler);
  }

  /** Render a view model. Slices that are deeply equal to the last render are skipped. */
  update(viewModel) {
    const inMenu = viewModel.screen === 'menu';
    this.root.dataset.screen = viewModel.screen;
    for (const component of COMPONENTS) {
      const slice = inMenu && component.gameOnly ? null : component.select(viewModel) ?? null;
      const key = JSON.stringify(slice);
      if (this.lastKeys.get(component.id) === key) continue;
      this.lastKeys.set(component.id, key);
      this.renderSlot(component, slice);
    }
    this.layout();
  }

  /** Open or close a collapsible panel ('army' | 'tray') from code, e.g. to start collapsed or for screenshots. */
  setPanel(name, open) {
    if (name === 'army') this.root.classList.toggle('army-open', open);
    if (name === 'tray') this.root.classList.toggle('tray-collapsed', !open);
    this.layout();
  }

  destroy() {
    this.root.removeEventListener('click', this.onClick);
    this.root.removeEventListener('change', this.onChange);
    window.removeEventListener('keydown', this.onKey);
    window.removeEventListener('resize', this.onResize);
    this.observer?.disconnect();
    this.handlers.clear();
    this.root.replaceChildren();
  }

  // ---- rendering -------------------------------------------------------------------------------

  renderSlot(component, slice) {
    const slot = this.slots.get(component.id);
    const html = slice ? component.render(slice) : '';
    const memory = this.remember(slot, component.id);
    slot.innerHTML = html;
    this.restore(slot, memory, component.id);
    if (component.id === 'unitmenu') {
      this.unitMenuAnchor = slice?.anchor ?? null;
      this.placeUnitMenu();
    }
    if (component.id === 'menu') this.syncMenuForm();
  }

  /** What a re-render would otherwise lose: focus, scroll offsets, local tab state and the menu form. */
  remember(slot, id) {
    const active = slot.contains(document.activeElement) ? focusKey(document.activeElement) : null;
    const scroll = [...slot.querySelectorAll(SCROLLERS)].map((el) => [el.scrollLeft, el.scrollTop]);
    const scope = slot.querySelector('[data-local-scope]');
    const local = scope ? { tab: scope.dataset.tab, side: scope.dataset.side } : null;
    const form = id === 'menu' && slot.querySelector('[data-form]') ? readForm(slot) : null;
    const panelClasses = ['.um-panel', '.fd-feed'].map((s) => slot.querySelector(s)?.classList.contains(s === '.um-panel' ? 'targets-open' : 'open') ?? false);
    return { active, scroll, local, form, panelClasses };
  }

  restore(slot, memory, id) {
    [...slot.querySelectorAll(SCROLLERS)].forEach((el, i) => {
      if (memory.scroll[i]) { el.scrollLeft = memory.scroll[i][0]; el.scrollTop = memory.scroll[i][1]; }
    });
    const scope = slot.querySelector('[data-local-scope]');
    if (scope && memory.local) {
      if (memory.local.tab) this.setScopeValue(scope, 'tab', memory.local.tab);
      if (memory.local.side) this.setScopeValue(scope, 'side', memory.local.side);
    }
    if (memory.form) {
      for (const el of slot.querySelectorAll('input[name], select[name]')) {
        if (!(el.name in memory.form)) continue;
        if (el.type === 'radio') el.checked = el.value === memory.form[el.name];
        else el.value = memory.form[el.name];
      }
    }
    if (memory.panelClasses[0]) slot.querySelector('.um-panel')?.classList.add('targets-open');
    if (memory.panelClasses[1]) slot.querySelector('.fd-feed')?.classList.add('open');
    if (memory.active) {
      const match = [...slot.querySelectorAll('button, input, select, a')].find((el) => focusKey(el) === memory.active);
      match?.focus({ preventScroll: true });
    }
  }

  // ---- layout ----------------------------------------------------------------------------------

  applyResponsiveDefaults() {
    const phone = window.matchMedia?.(NARROW).matches || window.matchMedia?.(SHORT).matches;
    this.root.classList.toggle('army-open', !phone);
    this.root.classList.toggle('tray-collapsed', Boolean(phone));
  }

  /** Publish the measured heights other slots stack against, and keep the unit menu on screen. */
  layout() {
    const height = (id) => Math.ceil(this.slots.get(id).getBoundingClientRect().height);
    const style = this.root.style;
    style.setProperty('--hud-top-h', `${height('top')}px`);
    style.setProperty('--hud-camp-h', `${height('campaign')}px`);
    style.setProperty('--hud-tray-h', `${height('tray')}px`);
    this.placeUnitMenu();
  }

  placeUnitMenu() {
    const slot = this.slots.get('unitmenu');
    const panel = slot.firstElementChild;
    if (!panel || !this.unitMenuAnchor) return;
    const { x, y } = this.unitMenuAnchor;
    const edge = 8;
    const { width, height } = panel.getBoundingClientRect();
    const left = Math.min(Math.max(x - width / 2, edge), Math.max(edge, window.innerWidth - width - edge));
    let top = y - height - 14;
    const below = top < edge + this.slots.get('top').getBoundingClientRect().bottom;
    if (below) top = y + 14;
    top = Math.min(Math.max(top, edge), Math.max(edge, window.innerHeight - height - edge));
    slot.style.transform = `translate(${Math.round(left)}px, ${Math.round(top)}px)`;
    panel.classList.toggle('below', below);
    panel.style.setProperty('--arrow-x', `${Math.round(Math.min(Math.max(x - left, 14), width - 14))}px`);
  }

  // ---- events ----------------------------------------------------------------------------------

  handleClick(event) {
    const target = event.target instanceof Element ? event.target : null;
    if (!target) return;
    const toggle = target.closest('[data-local-toggle]');
    if (toggle) { this.localToggle(toggle); return; }
    const set = target.closest('[data-local-set]');
    if (set) { this.localSet(set); return; }
    const control = target.closest('[data-intent]');
    // Form inputs report through `change`, so a click on a radio does not double-fire.
    if (!control || control.matches('input, select') || control.disabled) return;
    this.emit(control);
  }

  handleChange(event) {
    const target = event.target instanceof Element ? event.target : null;
    if (!target) return;
    if (target.matches('input[name="you"]')) this.syncMenuForm();
    if (target.matches('[data-intent]')) this.emit(target, true);
  }

  handleKey(event) {
    if (event.key !== 'Escape') return;
    const open = ['inspect', 'combine', 'report', 'unitmenu'].some((id) => this.slots.get(id).childElementCount > 0);
    if (open) this.dispatch({ type: 'closePanel' });
  }

  /** Build the intent for a control (merging form values when it asks for them) and hand it out. */
  emit(control, fromChange = false) {
    const base = intentFromDataset(control.dataset);
    if (!base) return;
    const formRoot = control.closest('[data-form]');
    const wantsForm = control.dataset.collect === 'form' || (fromChange && formRoot);
    this.dispatch(wantsForm && formRoot ? applyForm(base, readForm(formRoot)) : base);
  }

  dispatch(intent) {
    for (const handler of this.handlers) {
      try { handler(intent); } catch (error) { console.error('HUD intent handler failed', intent, error); }
    }
  }

  // ---- presentation-only state -------------------------------------------------------------------

  localToggle(button) {
    const spec = LOCAL_TOGGLES[button.dataset.localToggle];
    if (!spec) return;
    const host = spec.selector ? button.closest(spec.selector) ?? this.root.querySelector(spec.selector) : this.root;
    const on = host?.classList.toggle(spec.className);
    if (button.hasAttribute('aria-expanded')) button.setAttribute('aria-expanded', String(Boolean(on)));
    this.layout();
  }

  localSet(button) {
    const [name, value] = button.dataset.localSet.split('=');
    const scope = button.closest('[data-local-scope]');
    if (scope) this.setScopeValue(scope, name, value);
  }

  /** Switch a tab-like attribute on a scope and mirror it onto the buttons that set it. */
  setScopeValue(scope, name, value) {
    scope.dataset[name] = value;
    for (const button of scope.querySelectorAll('[data-local-set]')) {
      const [n, v] = button.dataset.localSet.split('=');
      if (n === name) button.setAttribute('aria-pressed', String(v === value));
    }
  }

  /** The opponent cannot mirror the player's faction unless the menu lists it as mirrorable. */
  syncMenuForm() {
    const form = this.slots.get('menu').querySelector('[data-form="menu"]');
    if (!form) return;
    const mirror = (form.dataset.mirror ?? '').split(',').filter(Boolean);
    const you = form.querySelector('input[name="you"]:checked')?.value;
    const foes = [...form.querySelectorAll('input[name="foe"]')];
    for (const input of foes) input.disabled = input.value === you && !mirror.includes(input.value);
    if (foes.find((input) => input.checked)?.disabled) {
      const fallback = foes.find((input) => !input.disabled);
      if (fallback) fallback.checked = true;
    }
  }
}

/** Identity of a control across re-renders: tag, name/value and every data attribute. */
function focusKey(el) {
  return `${el.tagName}|${el.getAttribute('name') ?? ''}|${el.getAttribute('value') ?? ''}|${JSON.stringify({ ...el.dataset })}`;
}
