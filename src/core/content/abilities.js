// Ability and spell catalogue: inert records only. Skill kits and spells are archived in this pass
// (off in normal play), so nothing here has an effect function. The records keep id, name, cost,
// cooldown, phase and description, plus the plain-data `requires` / `effect` blocks the legacy
// definitions carried, so a later pass can plug an effect interpreter in at the match controller
// without re-authoring the factions.

/** The five shipped class skills. */
export const SHIPPED_ABILITIES = Object.freeze({
  rally: { id: 'rally', name: 'Rally', classes: ['pikeman'], cost: 0, cooldown: 2, phase: 'recovery', description: 'Heal 10 HP; gain 1 energy now and next round, when useful.' },
  brace: { id: 'brace', name: 'Brace', classes: ['pikeman'], cost: 2, cooldown: 2, phase: 'defense', description: 'Hold this battle. Absorb 4 total damage; paid even without incoming attacks.' },
  focusedShot: { id: 'focusedShot', name: 'Focused Shot', classes: ['archer'], cost: 2, cooldown: 2, phase: 'enhancement', description: 'A legal ranged strike gains +4 damage and +20 hit.' },
  charge: { id: 'charge', name: 'Charge', classes: ['cavalier'], cost: 2, cooldown: 2, phase: 'enhancement', description: 'Requires Advance, automatic movement and a melee target. Strike gains +4 damage.' },
  secondWind: { id: 'secondWind', name: 'Second Wind', classes: ['cavalier'], cost: 1, cooldown: 3, phase: 'recovery', description: 'Heal 6 HP when at or below half HP, including outside combat.' },
});

/** The three shipped spells (the spell cards in cards.js reference them by name). */
export const SHIPPED_SPELLS = Object.freeze({
  mend: { id: 'mend', name: 'Mend', type: 'spell', cost: 1, target: 'friendly-unit', duration: 'instant', effect: { type: 'heal', amount: 8 } },
  ward: { id: 'ward', name: 'Ward', type: 'spell', cost: 1, target: 'friendly-unit', duration: 'upcoming-battle', effect: { type: 'status', status: 'ward', duration: 'upcoming-battle' } },
  fireburst: { id: 'fireburst', name: 'Fireburst', type: 'spell', cost: 2, target: 'enemy-area', duration: 'instant', radius: 1, effect: { type: 'damage', amount: 6 } },
});
