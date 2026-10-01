// Shared cloning and validation helpers for portable economy state.
export const clone = (value) => globalThis.structuredClone
  ? structuredClone(value)
  : JSON.parse(JSON.stringify(value));

export const finite = (value) => Number.isFinite(value);

/** Economy calls are deterministic only when callers provide the match-owned random stream. */
export function randomIndex(rng, length) {
  if (typeof rng !== 'function') throw new TypeError('economy operation requires an explicit rng function');
  if (!Number.isInteger(length) || length <= 0) return -1;
  return Math.min(length - 1, Math.max(0, Math.floor(rng() * length)));
}
