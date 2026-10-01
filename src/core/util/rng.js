// Deterministic random streams. The golden logs depend on these sequences bit for bit, so the
// arithmetic here must never change. Every stream is an explicit object owned by its caller.

const DEFAULT_SEED_STATE = 0x6d2b79f5;

/**
 * Small xorshift32 generator used for card draws and shard offers. Same seed, same stream.
 * Returns a function producing floats in [0, 1).
 * @param {number} [seed]
 * @returns {() => number}
 */
export function seededRandom(seed = 1) {
  let state = Number(seed) >>> 0;
  if (!state) state = DEFAULT_SEED_STATE;
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return (state >>> 0) / 0x100000000;
  };
}

/**
 * Battle generator (mulberry32 variant) used for contested moves and strike dice.
 * Returns a function producing floats in [0, 1).
 * @param {number} seed
 * @returns {() => number}
 */
export function makeRng(seed) {
  let state = (Number(seed) >>> 0) || DEFAULT_SEED_STATE;
  return () => {
    state += 0x6d2b79f5;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
