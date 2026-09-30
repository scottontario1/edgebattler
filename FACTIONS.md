# Factions

Status: **design proposal, not implemented.** Nothing here is a confirmed rule (see `docs/DEVELOPMENT.md`): the numbers are starting points for experiments, new classes and abilities are outside the current roadmap until Scott approves them, and rarity is proposed because every card in the game is currently common. Lore names other than Ashvale and Brenna are invented for this draft and are easy to change.

Each faction entry has the same sections: **Lore** (2–3 paragraphs), **Personality and key traits**, **Unique units**, **Unique skills**, and **Design notes**. Units and skills are suggested as one common, one uncommon and one rare each.

---

## 1. The Argent Crown

*Blue and silver. The baseline Ashvale kingdom; Brenna's faction.*

### Lore

The Argent Crown is the kingdom of Ashvale as its people tell it: a realm of river villages, stone keeps and long roads, held together not by one great army but by a habit of standing next to each other. Its founders were a scatter of valley lords who could not agree on anything except that lone heroes died young. They pooled their levies under a single silver circlet, the Argent Crown, and swore the first Articles of the Line: no one holds a field alone, and no one leaves a neighbour's flank open. Every blue-and-silver banner still carries that oath in its heraldry, a row of interlocked shields beneath the crown.

That history shapes how Ashvale fights. Its levied archers are farmers who learned the bow at village butts. Its pikemen are drilled until they stop being individuals. Its mounted nobility, the Cavaliers, are trained to wait: a charge is spent once, so it is spent behind a wall and released when the enemy has committed. The Crown's finest are the Paladins, knights who take the Articles as a personal vow to stand where the line is thinnest and answer for the people behind them. Brenna is the living form of that idea, a Paladin who anchors a bridge because someone must.

The Crown is old, prosperous and proud, and its weakness is the same as its strength. Its armies are patient and hard to break, but a scattered Crown army is only an ordinary army, and its enemies know it. Barbarian warbands like Dreg's strike at the seams between banners, the gaps where the Articles have not yet been kept.

### Personality and key traits

**Disciplined, dutiful, defensive, proud.** Argent Crown armies are at their best when they hold ground together and finish enemies who commit into it. They are the faction most interested in a coherent battle line.

- **Formation over raw stats.** Their units are ordinary alone and strong when roles overlap properly: a Pikeman protecting an Archer, a Paladin anchoring a bridge, a Cavalier waiting behind the line. Drawing another frontline unit is a decision about completing a formation, not about the biggest number on the card.
- **Automation-friendly.** Every bonus is triggered by stance, adjacency, facing or distance, so the player plans a shape once and the automatic battle keeps it. No unit needs per-round micromanagement.
- **Line Doctrine (faction trait, proposed).** A friendly unit gains one **Formation** point for each role that overlaps it: a Pikeman-class unit adjacent (a screen), an Archer within two tiles behind it (support), a Cavalier within four tiles and not in contact (reserve). Each point gives +1 Defense and +1 damage dealt, up to +3. The idea is that a complete formation is worth roughly one extra unit; tune by experiment.
- **Weak scattered.** Units with no Formation points are slightly worse than the baseline recruit (proposed: −1 Defense), so the Crown is punished for skirmishing and pushed toward keeping its shape.
- **Champion:** Brenna, Paladin (existing). Her natural kit is a defensive anchor and support for the whole line.
- **Play pattern:** hold or Protect stances early, add Archers and Banners behind the front, keep Cavaliers in reserve until the enemy commits, then finish. Weak to being outflanked, fast forces that ignore the front, and spells that hit packed formations (Fireburst punishes packing).

### Unique units

| Rarity | Unit | Class (proposed) | Role |
|---|---|---|---|
| Common | **Crown Guard** | Pikeman variant (infantry) | The wall. Pike and heater shield, drilled to close ranks. |
| Uncommon | **Bannerman** | New support infantry | Carries the standard; makes the units around it hold. |
| Rare | **Oathsworn** | Paladin-class recruit (not a champion) | A knight who stands in for a protected ally. |

**Crown Guard (common).** Heavier and slower than the standard Pikeman, with a shield built for a shield-to-shield line. Suggested stats: HP 26, Str 7, Skl 5, Spd 3, Def 10, Mov 3, range 1 (roughly a Pikeman trading damage for durability). Passive **Shieldwall**: while adjacent to a friendly infantry unit, take 2 less damage from each strike. Two Crown Guards side by side are noticeably harder to kill than any two loose Pikemen, which is the entire point. Kit: Rally, Brace (as Pikeman) and the faction's Shieldwall skill below.

**Bannerman (uncommon).** An unarmoured officer with a sword and the regiment's standard. He is not a fighter; he is a force multiplier. Suggested stats: HP 20, Str 5, Skl 5, Spd 5, Def 6, Mov 4, range 1. Passive **Banner**: friendly units within two tiles that are on Hold or Protect gain +2 Defense and regain 1 extra energy at refresh. The banner is dropped if the Bannerman dies, so protecting him is part of the formation. Recruiting him rewards a slow, defended line and gives the player a reason to keep infantry planted.

**Oathsworn (rare).** A knight who has sworn to one of the Crown's people and takes the blow meant for them. Suggested stats: HP 28, Str 8, Skl 5, Spd 3, Def 12, Mov 4, range 1 (Brenna's frame without the champion rules; it can be combined by the normal three-copy rule). Passive **Sworn Guard**: choose a Protect subject; when that ally would be struck, this unit takes half the damage (rounded down) after the ally's own Defense applies. Rare because it makes a fragile Archer or Bannerman nearly untouchable, and it only works if the Oathsworn is kept in position beside them.

### Unique skills

Skills are planning-selected abilities that use the existing energy/cooldown system, so they run in the same fixed phases as Rally or Brace.

| Rarity | Skill | Classes | Cost / cooldown (proposed) | Phase | Effect |
|---|---|---|---|---|---|
| Common | **Shieldwall** | Crown Guard, Pikeman | 1 / 2 | defense | This battle, adjacent friendly infantry take 2 less damage from each strike, and this unit is treated as Hold. Stacks with Brace. |
| Uncommon | **Raise the Standard** | Bannerman | 2 / 3 | enhancement | Banner range grows from 2 to 3 for this battle, and every unit in range gains Rally's heal (10 HP) at recovery. Requires Hold. |
| Rare | **Sworn Guard** | Oathsworn | 2 / 2 | defense | Choose a Protect subject before battle. Half of all damage that unit takes this battle is taken by the Oathsworn instead (shared, not additional). If the subject is out of range the ability is wasted and the reason is reported. |

The common skill is the workhorse, the uncommon skill is the reason to protect the Bannerman, and the rare skill is the payoff for a fully assembled formation.

### Design notes

- **Strategy question:** whether "formation points" (Line Doctrine) should be a passive on every Crown unit or only a bonus on specific cards. The first is stronger and simpler to explain; the second is easier to balance. Scott to choose.
- **Adjacency and facing** already exist (`flankSide`, cardinal facing), so Shieldwall and Sworn Guard can be built on the same data. Banner needs a distance check over friendly stance.
- **Recruitment decision:** Formation points make a fourth Pikeman matter only if the first three are already screening something, which is the intended "complete the formation" choice. Test with paired-seed simulations before adopting any number.
- **AI:** the heuristic commander would need to place units to earn Formation points; without that, the Crown will not exploit its own mechanics and simulations will understate it.
- **Balance status:** nothing here is tuned. Any adoption requires Scott's selection of defaults and, per the roadmap, new classes wait until the three recruit classes support a complete match.

---

## 2. The White Fang Clans

*Iron, fur and bone. The northern clans; Dreg's faction.*

### Lore

The White Fang Clans hold the high country north of Ashvale, where winter lasts most of the year and the mountains are older than any crown. They are not a nation but a dozen clans that share one rule: a clan that stops moving starves. Their villages are hard-walled longhouses beside iron seams and their smiths are the best in the north, so a White Fang warrior goes to war in riveted plate, ring mail and layered fur, with carved shoulder guards and helms shaped like the beasts the clan has killed. The name comes from the great white wolves of the passes. A warrior earns a fang for each monster he brings down, and wears it on his armour where everyone can count it.

Their wars are short, brutal and rarely defensive. The clans learned long ago that a warband that halts to receive a charge is dead, and one that keeps its momentum breaks whatever it hits. Their trophies are more than vanity: each carved plate and strung tooth is a promise to an ancestor, and a clan that has lost its trophies to an enemy will chase that enemy across a continent to take them back. The chiefs are chosen by a Blood Challenge, an open oath to kill a named rival, and those who survive lead from the front.

Dreg is the most feared of them, a chieftain whose raids on the Ashvale borders have made the Argent Crown nervous for a decade. To the Crown he is a warlord, and to his clans he is proof that the north is not asleep. He wants the Crown's keeps, its iron roads and its river towns, and he expects to take them the way his people always have: by never giving the defenders time to breathe.

### Personality and key traits

**Aggressive, proud, relentless, impatient.** White Fang armies want to be in contact, advancing, and winning the exchange. They are comparatively mediocre at sitting on an objective and waiting.

- **Momentum.** Bonuses trigger on movement and contact, not on standing still. A unit that Advances into an enemy in the same round is at its best. Holding a line with them wastes half their kit.
- **Stance identity.** Advance is the faction's natural stance. Their Hold and Protect options are weaker than the Crown's (proposed: no Brace-style absorb on White Fang infantry, and no damage bonus while holding).
- **Trade blood for tempo.** Many abilities are paid for in health or unlock when hurt. They win by making the enemy's first exchange worse than their own, not by preserving units.
- **Intent modifiers.** The faction's signature is changing what an automated unit *wants* to do (whom it hunts, whether it retreats) instead of asking the player to issue attacks. A single planning choice changes how the unit behaves for the whole battle.
- **Play pattern:** deploy forward, keep everything on Advance, choose one enemy to break, commit spells early for tempo. Strong against slow or scattered opponents and against anyone who cannot punish a charge. Weak against a braced, well-formed line (Shieldwall and Brace), ranged attrition while advancing, and any objective that requires patience. Their mirror against the Argent Crown is the game's core tension: the Crown wins if the charge stalls, the Clans win if it doesn't.
- **Champion:** Dreg, Barbarian (existing). Champions currently have no active kit; his kit below is a proposal.

### Unique units

| Rarity | Unit | Class (proposed) | Role |
|---|---|---|---|
| Common | **White Fang Reaver** | Axe infantry | The charging line. |
| Uncommon | **Axeguard** | Heavy infantry | The anvil that gets angrier when hit. |
| Rare | **Berserker** | Elite melee | A fighter that becomes lethal when near death. |

**White Fang Reaver (common).** A wolf-pelted axeman in half-plate, the clans' standard soldier. Suggested stats: HP 24, Str 9, Skl 5, Spd 5, Def 7, Mov 5, range 1 (compare Pikeman HP 24, Str 8, Def 9, Mov 4: more offence and reach, less armour). Passive **Momentum**: +2 damage on a strike if the Reaver moved this battle before attacking (an Advance that ends in contact). No Hold bonus and no Brace. In the open it hits harder than a Pikeman; standing still it is only a worse Pikeman.

**Axeguard (uncommon).** A heavily armoured shieldbreaker with a bearded axe and a carved wooden buckler, who guards the flanks of the advance. Suggested stats: HP 28, Str 8, Skl 4, Spd 3, Def 10, Mov 4, range 1. Passive **Bloodied Grit**: gains 1 energy each time it takes damage (at most once per round, capped by the energy maximum). It is the faction's energy engine: the harder it is hit in the front line, the sooner its paid abilities fire, which suits a plan that trades early.

**Berserker (rare).** A scarred veteran in half-armour, hung with monster teeth. Suggested stats: HP 26, Str 10, Skl 4, Spd 6, Def 5, Mov 5, range 1 (very high damage, thin defence). Passive **Last Fang**: below 50% HP the Berserker's **Frenzy** ability becomes available and it gains +2 Str; above 50% Frenzy is unavailable. Rare because it rewards being wounded and punishes a Crown player who avoids it with ranged attrition.

### Unique skills

Abilities use the existing energy and cooldown system and fixed phases.

| Rarity | Skill | Classes | Cost / cooldown (proposed) | Phase | Effect |
|---|---|---|---|---|---|
| Common | **Reaving Rush** | Reaver | 1 / 2 | enhancement | Requires Advance, movement and a melee target. The strike gains +2 damage on top of Momentum, and the Reaver ignores the first 2 Defense of the target. |
| Uncommon | **Iron Skin** | Axeguard | 1 / 2 | defense | Take 3 less damage this battle and gain 1 energy if the Axeguard was struck. Does not force Hold (unlike Brace), so it can advance. |
| Rare | **Frenzy** | Berserker | 2 / 3 | enhancement | Only usable below 50% HP. All strikes this battle gain +4 damage and the Berserker moves at full Advance, but it takes +2 damage from each strike. |

### Dreg's signature: Blood Challenge

**Blood Challenge** (Dreg's active ability; proposed cost 2, cooldown 3, enhancement phase). Mark one enemy within a wide radius (proposed 6 tiles, line of sight not required). For the whole battle:

- Dreg Advances toward the marked enemy by the shortest legal path and gains +4 damage and +20 hit against it.
- Dreg is **less willing to attack other targets**: strikes against anything else take a −4 damage penalty and he will not choose an adjacent unmarked target unless the marked one is unreachable.
- The mark ends when the target dies or at the end of the round.

The point is that the planner modifies the *intent* of an automated unit instead of pressing Attack: a marked Archer or Bannerman is in real danger, and the Crown player must decide whether to screen it. The cost is that Dreg ignores the rest of the battle and can be drawn into a trap. Implementation note: this needs the automatic target-selection step in `src/battle.js` to support a preferred target and a penalty on others, a new status, and an AI rule for whom to mark.

### Spells

Their spells reward commitment rather than traditional wizardry. Names are from the brief; numbers are proposals, for one-shot spell cards that resolve at battle start like Fireburst, Ward and Mend.

| Rarity | Spell | Effect |
|---|---|---|
| Common | **War Cry** | Chosen units on Advance gain +1 movement and 1 energy this battle; units on Hold gain nothing. |
| Common | **Blood Oath** | A chosen unit takes 4 damage now (cannot kill) and gains +3 damage for the battle. |
| Uncommon | **Hunt** | Mark one enemy; friendly Advance units within 4 tiles path toward it and gain +2 hit against it. A team-wide, weaker version of Blood Challenge. |
| Rare | **Ancestors' Fury** | For one battle, friendly units below 50% HP gain +3 Str and take 2 less damage, and a unit that dies this battle passes 2 energy to its nearest ally. |

### Design notes

- **Counterplay is deliberate.** Momentum needs movement, so a Crown player can blunt it with Brace and Shieldwall (which force Hold-like solid lines) or by keeping ranged units behind the front. That is the intended mirror, not a bug.
- **Nothing forces the enemy to stand still.** Spells and abilities that ignore Defense (Fireburst) remain the Crown's best counter to a packed advance, as in the existing level results.
- **Strategy questions for Scott:** whether "less willing to attack others" should be a hard target lock (strong, simple) or only a damage penalty (softer); whether Berserker Frenzy should be an ability or a passive; how much healing the White Fang should have (proposed: little).
- **Interaction with pacing:** this faction is the natural counter to the stalemate problem in CORE-02 (it wants contact), but it must be tested in mirror and against the Crown with paired seeds before anyone treats it as a fix.
- **Balance status:** nothing tuned. New classes wait until the roadmap allows them; units here could be trialled first as stat variants of the existing Pikeman and Cavalier classes.
