// Tiny shared helpers for grid distance and plain-data copies.

/**
 * Manhattan distance between two records that carry `c` and `r`.
 * @param {{c: number, r: number}} a
 * @param {{c: number, r: number}} b
 */
export function manhattan(a, b) {
  return Math.abs(a.c - b.c) + Math.abs(a.r - b.r);
}

/**
 * Manhattan distance between two [c, r] pairs.
 * @param {number[]} a
 * @param {number[]} b
 */
export function tileDistance(a, b) {
  return Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]);
}

/** Deep copy of plain JSON-compatible data. */
export function clone(value) {
  return structuredClone(value);
}

/** Recursively freeze plain data (objects, arrays) and return it. Functions are left alone. */
export function deepFreeze(value, seen = new WeakSet()) {
  if (value === null || typeof value !== 'object' || seen.has(value)) return value;
  seen.add(value);
  // Frozen containers can still contain mutable descendants. Walk them before returning so callers
  // may safely compose shallow-frozen catalogues into a single immutable content context.
  for (const key of Object.keys(value)) deepFreeze(value[key], seen);
  return Object.isFrozen(value) ? value : Object.freeze(value);
}
