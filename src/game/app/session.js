import { createSkirmish, createCampaign } from '../../core/setup/match.js';
import { planCommander } from '../../core/ai/commanders.js';
import { buildGameViewModel, createMenuViewModel } from './view-model.js';

export class GameApp {
  constructor({ hud, game, launch = {} }) {
    this.hud = hud;
    this.game = game;
    this.launch = launch;
    this.match = null;
    this.scene = null;
    this.ai = 'heuristic';
    this.ui = { selectedType: null, selectedCard: null, selectedReserve: null, showStats: false };
    this.unsubscribe = hud.onIntent((intent) => this.handle(intent));
    game.events.once('ready', () => this.#onReady());
    if (game.isBooted) this.#onReady();
  }

  #onReady() {
    this.scene = this.game.scene.getScene('Battle');
    this.#bindWorld();
    if (this.launch.demo !== 'world') this.showMenu();
  }

  showMenu(error = '') {
    this.match = null;
    this.hud.update(createMenuViewModel(error));
  }

  start({ mode = 'campaign', mission = 'road', you = 'crown', foe = 'fang', ai = 'heuristic', seed = null } = {}) {
    try {
      const options = { seed: seed ?? 0x415348, combat: { duration: 18 } };
      this.ai = ai;
      this.match = mode === 'skirmish'
        ? createSkirmish({ ...options, blue: you, red: foe })
        : createCampaign({ ...options, level: mission, faction: you });
      this.ui = { selectedType: null, selectedCard: null, selectedReserve: null, showStats: false };
      this.boardId = null;
      this.#syncWorld();
      this.#render();
    } catch (error) {
      console.error('[app] match setup failed', error);
      this.showMenu(error.message);
    }
  }

  async handle(intent) {
    if (!intent) return;
    if (intent.type === 'startGame') return this.start(intent);
    if (intent.type === 'openMenu') return this.showMenu();
    if (intent.type === 'restart') {
      const state = this.match?.getState();
      return state?.campaign
        ? this.start({ mode: 'campaign', mission: state.campaign.id, you: state.campaign.faction })
        : this.start({ mode: 'skirmish' });
    }
    if (intent.type === 'nextMission') {
      const state = this.match?.getState();
      return this.start({ mode: 'campaign', mission: intent.mission, you: state?.campaign?.faction });
    }
    if (!this.match) return;

    switch (intent.type) {
      case 'selectCard':
        this.ui.selectedCard = intent.cardId;
        this.ui.selectedReserve = null;
        this.#render();
        return;
      case 'selectReserve':
        this.ui.selectedReserve = intent.unitId;
        this.ui.selectedCard = null;
        this.#render();
        return;
      case 'selectUnitType':
        this.ui.selectedType = intent.unitType;
        this.#render();
        return;
      case 'openStats':
        this.ui.showStats = true;
        this.#render();
        return;
      case 'closeStats':
        this.ui.showStats = false;
        this.#render();
        return;
      case 'closeInspect':
      case 'closePanel':
        this.ui.selection = null;
        this.scene?.select(null);
        this.#render();
        return;
      case 'inspect':
        this.ui.selection = { unitId: intent.unitId };
        this.#render();
        return;
      case 'resolve':
        await this.resolveRound();
        return;
      case 'campaignOrder':
      case 'campaignRally':
      case 'campaignContinue':
        this.#apply({ type: intent.type, faction: 'blue' });
        return;
      default:
        break;
    }

    if (intent.type === 'deploy' && !Number.isFinite(intent.c)) {
      this.ui.selectedReserve = intent.unitId;
      this.#render();
      return;
    }
    const action = { ...intent, faction: 'blue' };
    if (action.type === 'cycle') {
      action.id = action.cardId ?? action.unitId;
      delete action.cardId;
      delete action.unitId;
    }
    if (action.target && !action.targetId) action.targetId = action.target;
    const result = this.#apply(action);
    if (!result?.ok) console.info('[app] action rejected:', result?.reason);
  }

  async resolveRound() {
    const state = this.match?.getState();
    if (!state || state.over || state.phase !== 'planning') return;
    if (!state.campaign) this.#runAiPlanning();
    this.#render();

    const result = this.match.resolveRound();
    const batches = Array.isArray(result) ? result : result?.batches ?? [];
    await this.#playBatches(batches);
    this.#syncWorld();
    this.#render();
  }

  #runAiPlanning() {
    for (let attempt = 0; attempt < 24; attempt += 1) {
      const context = {
        content: this.match.context.content,
        board: this.match.context.board,
        deploymentTiles: (faction) => this.match.deploymentTiles(faction),
        canDeploy: (faction, id, c, r) => this.match.canDeploy(faction, id, c, r),
      };
      const action = planCommander(this.ai, this.match.getState(), 'red', { context })[0];
      if (!action) break;
      const result = this.match.apply({ ...action, faction: 'red' }, 'ai:' + this.ai);
      if (!result.ok) break;
    }
  }

  async #playBatches(batches) {
    for (const batch of batches) {
      for (const event of batch.events ?? []) {
        const scene = this.scene;
        if (!scene) continue;
        if (event.type === 'move') {
          const view = scene.unitView(event.unitId);
          if (view) await view.moveAlong(event.path ?? [event.from, event.to].filter(Boolean));
        } else if (event.type === 'strike') {
          const attacker = scene.unitView(event.attackerId);
          const target = scene.unitView(event.targetId);
          if (attacker && target) {
            await attacker.lunge(target, () => target.setHp(Math.max(0, target.hp - (event.damage ?? 0)), target.maxHp));
            if (event.damage > 0) await target.hitFlash();
          }
        } else if (event.type === 'death') {
          const view = scene.unitView(event.unitId);
          if (view) await view.die();
        }
      }
    }
  }

  #apply(action) {
    const result = this.match.apply(action, 'human');
    if (result.ok) {
      if (action.type === 'deploy' && this.ui.selectedReserve === action.reserveId) this.ui.selectedReserve = null;
      this.#syncWorld();
      this.#render();
    }
    return result;
  }

  #syncWorld() {
    if (!this.match || !this.scene) return;
    const state = this.match.getState();
    if (this.boardId !== this.match.context.board.id) {
      this.scene.setBoard(this.match.context.board, { seed: state.seed });
      this.boardId = this.match.context.board.id;
      for (const [key, faction] of Object.entries(state.territory ?? {})) {
        const [c, r] = key.split(',').map(Number);
        this.scene.terrain.setOwner(c, r, faction);
      }
    }
    this.scene.syncUnits(state.units.filter((unit) => unit.hp > 0 && unit.state !== 'reserve').concat(state.objects ?? []));
  }

  #render() {
    if (!this.match) return;
    this.ui.manifests = this.game.registry.get('art');
    this.hud.update(buildGameViewModel(this.match, this.ui));
  }

  #bindWorld() {
    const events = this.scene?.worldEvents;
    if (!events || this.bound) return;
    this.bound = true;
    events.on('unit:click', ({ id }) => {
      if (!this.match) return;
      this.ui.selection = { unitId: id };
      this.scene.select(id);
      this.#render();
    });
    events.on('tile:click', ({ c, r }) => {
      if (!this.match) return;
      if (this.ui.selectedReserve) {
        const result = this.#apply({ type: 'deploy', faction: 'blue', reserveId: this.ui.selectedReserve, c, r });
        if (result.ok) this.ui.selectedReserve = null;
        return;
      }
      const unitId = this.ui.selection?.unitId;
      const unit = this.match.getState().units.find((candidate) => candidate.id === unitId);
      if (unit?.faction === 'blue') this.#apply({ type: 'move', faction: 'blue', unitId, c, r });
    });
  }

  destroy() {
    this.unsubscribe?.();
  }
}
