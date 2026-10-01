// A tiny typed event emitter for the view's outgoing events. The scene owns one; HUD and session code
// subscribe. Kept separate from Phaser's emitter so event names and payloads are documented in one place.

/**
 * @typedef {object} WorldEvents
 * @property {{ c: number, r: number } | null} 'tile:hover' tile under the pointer (null when off the board)
 * @property {{ c: number, r: number, pointer: { x: number, y: number } }} 'tile:click'
 * @property {{ id: string, c: number, r: number, pointer: { x: number, y: number } }} 'unit:click'
 * @property {{ id: string } | null} 'unit:hover' unit under the pointer (null when none)
 */

export const WORLD_EVENTS = Object.freeze(['tile:hover', 'tile:click', 'unit:click', 'unit:hover']);

export function createEmitter(allowed = WORLD_EVENTS) {
  const listeners = new Map(allowed.map((name) => [name, new Set()]));
  const known = (name) => {
    const set = listeners.get(name);
    if (!set) throw new Error(`unknown world event '${name}'`);
    return set;
  };
  return {
    /** Subscribe; returns an unsubscribe function. */
    on(name, handler) {
      known(name).add(handler);
      return () => known(name).delete(handler);
    },
    off(name, handler) {
      known(name).delete(handler);
    },
    emit(name, payload) {
      for (const handler of known(name)) handler(payload);
    },
    clear() {
      for (const set of listeners.values()) set.clear();
    },
  };
}
