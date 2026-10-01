// Shared pieces of the Iron League experiments: the culture (optionally with features removed for ablations), the maps,
// the starting rosters and the win-rate statistics. Nothing here is loaded by the game.
import { pathToFileURL, fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';
import ironLeague from '../../../src/factions/iron-league.js';
import { DEFAULT_MAP } from '../../../src/board.js';

export const HERE = dirname(fileURLToPath(import.meta.url));
export const REPO = resolve(HERE, '../../..');

/**
 * The League definition, minus the named features (passive ids, ability ids or spell keys: ablations) and with optional sensitivity overrides
 * (`barricadeHp`: HP of the Dig In / Field Works barricade). Data-only, so it can sit in a log header.
 */
export function leagueDef({ without = [], barricadeHp, aliasChampion = false } = {}) {
  const def = structuredClone(ironLeague);
  // Mirror matches need two champions with the same stats and kit; ids are unique, so the second side gets an alias of the default champion.
  if (aliasChampion) {
    def.champions.ilseVossRed = { ...def.champions.ilseVoss, name: 'Captain Ilse Voss (red twin)' };
    for (const a of def.abilities) if (a.units?.includes('ilseVoss')) a.units = [...a.units, 'ilseVossRed'];
  }
  if (barricadeHp !== undefined) for (const a of def.abilities) if (a.spawn) a.spawn.hp = barricadeHp;
  const off = new Set(without);
  for (const group of [def.classes, def.variants]) for (const c of Object.values(group)) if (c.passives) c.passives = c.passives.filter((p) => !off.has(p.id));
  def.abilities = def.abilities.filter((a) => !off.has(a.id));
  for (const key of Object.keys(def.spells)) if (off.has(key)) delete def.spells[key];
  def.pool = def.pool.filter((k) => !off.has(k));
  return def;
}

const mapCache = new Map([['river_ford', DEFAULT_MAP]]);
/** Load experiment maps by name once, up front (buildMatch must stay synchronous for replay). */
export async function loadMaps(names) {
  for (const name of names) {
    if (!name || mapCache.has(name)) continue;
    mapCache.set(name, (await import(pathToFileURL(resolve(REPO, 'experiments/maps', `${name}.js`)).href)).default);
  }
}
export const mapByName = (name) => {
  const m = mapCache.get(name || 'river_ford');
  if (!m) throw new Error(`map ${name} not loaded; await loadMaps([...]) first`);
  return m;
};

// ---------- statistics ----------
export const wilson = (k, n) => { if (!n) return [0, 0]; const z = 1.96, p = k / n, d = 1 + z * z / n, c = (p + z * z / (2 * n)) / d, h = z * Math.sqrt(p * (1 - p) / n + z * z / (4 * n * n)) / d; return [Math.max(0, c - h), Math.min(1, c + h)]; };
export const mean = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
export const pct = (x) => `${Math.round(100 * x)}%`;
export const pct1 = (x) => `${(100 * x).toFixed(1)}%`;
export const f1 = (x) => x.toFixed(1);
