// Data-driven unit passives (cultures, src/cultures.js). Pure functions; nothing here runs unless a unit carries `passives`,
// which only registered culture variants do, so the shipped game is unchanged.
//
// A passive is plain data:
//   { id, when?, effect, perAdjacent?, cap?, aura? }
//   when    all listed conditions must hold for the unit that owns the passive (checked after movement, before strikes):
//             moved: true|false          it did / did not move this battle
//             stance: ['hold', ...]      its effective stance
//             hpBelow / hpAbove: 0..1    fraction of max HP (strict)
//             onControlled: true         it stands on an owned keep or village
//             objectNear: { kind, radius, min? }   at least `min` (1) tile objects of that kind (corpse...) within radius
//             adjacentAlly: { classes?: [...], min?: n }   at least n adjacent friendly units (of those classes)
//   effect  numeric statuses added for this battle: damageTaken (less damage per strike), damageDealt (more per strike),
//           hitBonus, ignoreDefense, offTargetPenalty, energyWhenStruck, plus any custom numeric key
//   perAdjacent  multiply the effect by the number of matching adjacent allies, at most `cap`
//   aura    { radius, includeSelf?, stance?: [...], classes?: [...] }: instead of the owner, every living friendly unit within
//           `radius` tiles (Manhattan) that matches the filters gets the effect. `when` still gates the source.
//   effect.revenant is not a status: match.js reads it when the unit dies (once per match).
export const STATUS_EFFECT_KEYS = Object.freeze(['damageTaken', 'damageDealt', 'hitBonus', 'ignoreDefense', 'offTargetPenalty', 'energyWhenStruck']);
const manhattan = (a, b) => Math.abs(a.c - b.c) + Math.abs(a.r - b.r);

function adjacentAllies(unit, units, classes) {
  return units.filter((o) => o.hp > 0 && o.id !== unit.id && o.faction === unit.faction && manhattan(unit, o) === 1
    && (!classes || classes.includes(o.cls)));
}

/** Does the owner satisfy the passive's `when`? Returns the matching-adjacent count (0 if none required) or -1 if unmet. */
export function passiveHolds(unit, passive, ctx) {
  const w = passive.when || {};
  if (w.moved !== undefined && Boolean(ctx.moved?.has(unit.id)) !== w.moved) return -1;
  if (w.stance && !w.stance.includes(ctx.stanceOf ? ctx.stanceOf(unit) : unit.stance)) return -1;
  if (w.hpBelow !== undefined && !(unit.hp < unit.maxHp * w.hpBelow)) return -1;
  if (w.hpAbove !== undefined && !(unit.hp > unit.maxHp * w.hpAbove)) return -1;
  if (w.onControlled && !(ctx.controlled && ctx.controlled(unit))) return -1;
  if (w.objectNear && (ctx.objectCount ? ctx.objectCount(unit, w.objectNear.kind, w.objectNear.radius) : 0) < (w.objectNear.min ?? 1)) return -1;
  let count = 0;
  if (w.adjacentAlly || passive.perAdjacent) {
    count = adjacentAllies(unit, ctx.units, w.adjacentAlly?.classes).length;
    if (count < (w.adjacentAlly?.min ?? 1)) return -1;
  }
  return count;
}

/**
 * Returns Map(unitId -> { statusKey: amount }) for every living unit in `units` (the post-movement snapshot).
 * ctx: { units, moved: Set(ids that moved), stanceOf(unit), controlled(unit) }
 */
export function evaluatePassives(units, ctx) {
  const out = new Map();
  const add = (id, effect, times = 1) => {
    const into = out.get(id) || {};
    for (const [k, v] of Object.entries(effect)) if (k !== 'revenant' && typeof v === 'number') into[k] = (into[k] || 0) + v * times;
    out.set(id, into);
  };
  const full = { ...ctx, units };
  for (const unit of units) {
    if (unit.hp <= 0 || !unit.passives?.length) continue;
    for (const p of unit.passives) {
      const held = passiveHolds(unit, p, full);
      if (held < 0) continue;
      const times = p.perAdjacent ? Math.min(held, p.cap ?? held) : 1;
      if (!p.aura) { add(unit.id, p.effect, times); continue; }
      const a = p.aura;
      for (const other of units) {
        if (other.hp <= 0 || other.faction !== unit.faction) continue;
        if (other.id === unit.id && !a.includeSelf) continue;
        if (manhattan(unit, other) > a.radius) continue;
        if (a.classes && !a.classes.includes(other.cls)) continue;
        if (a.stance && !a.stance.includes(ctx.stanceOf ? ctx.stanceOf(other) : other.stance)) continue;
        add(other.id, p.effect, times);
      }
    }
  }
  return out;
}

/** True when a unit carries an unused revenant passive (once per match). */
export const hasRevenant = (unit) => !unit.revenantUsed && (unit.passives || []).some((p) => p.effect?.revenant);
