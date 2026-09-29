// In-world markers for the persistent-state mechanics (stance, energy, stars, statuses,
// village ownership). Owned by TASK-006; this stub is wired by ui.js and does nothing yet.

/** deps: { camera, scene, units, territory: Map('c,r' -> 'blue' | 'red' | null), container: HTMLElement } */
export function createPlates(_deps) {
  return {
    /** Called every frame from ui.update(t). */
    update(_t) {},
    /** Called after ui refresh() whenever unit or territory state may have changed. */
    sync(_state) {},
  };
}
