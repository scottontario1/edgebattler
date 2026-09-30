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

---

## 3. The Iron League

*Brass, bronze and rust. Free cities, merchant princes and mercenary companies who field salvaged ancient machines. The non-magical counterweight.*

Revised from the original brief: the League keeps its payrolls, professional soldiers and preparation-based play, but its edge now comes from **artifacts**: the working remnants of an older, fallen technological age, in decrepit, patched-together, half-understood condition. The look is closer to a salvage yard than a sci-fi army: corroded plating riveted over pike-and-crossbow kit, coil guns with rope-wrapped grips, lanterns that hum, gears that stick. They are non-magical by their own insistence: their engineers say the old machines are craft, not sorcery.

### Lore

Beneath the League's free cities lie the ruins of the Foundry Age, a civilization that built engines, wires and automatic workshops before it vanished for reasons no one agrees on. The old works are everywhere: sealed vaults under river ports, tomb-like factories in the hills, half-buried walkers rusting beside trade roads. Most of it is dead. Some of it still moves. The merchant princes of the League discovered that a soldier who can be taught to operate one of these relics is worth ten who cannot, and that a company which can repair three of them is worth a small kingdom. They founded guilds to dig, catalogue and mend the salvage, and companies to carry it into battle.

The League itself is a loose compact of free cities and hired companies, bound by contracts, not blood. Their soldiers do not care whether someone possesses royal blood or speaks to forest spirits; they care whether the payroll clears and whether their weapon fires. What they field is professional but improvised: pikes and crossbows are still the backbone, but they are backed by reloading rigs, deployable pavises made from plate that no smith alive can forge, surveying instruments turned into sights and sappers' tools that were once part of automatic builders. Nothing is new. Everything is repaired, rebuilt or borrowed from a dead machine, and every soldier knows that any piece might fail at the wrong time.

Politically the League is a rebuke to the old order. It shows that disciplined common soldiers with increasingly effective weapons can defeat hereditary knights, and the Argent Crown's nobility has noticed. Some nobles want to buy the League, some to ban it, and some to steal its salvage. The League's answer is a contract: pay, and it will make your enemy's problem harder.

### Personality and key traits

**Pragmatic, methodical, mercantile, brittle.** The League is about creating a battlefield problem and forcing the opponent to solve it. Where the Argent Crown relies on complementary medieval arms, the League builds a killing ground and waits for the enemy to enter it.

- **Preparation during planning.** Their central mechanic is investing in a position before the battle. A unit that holds still for a round converts its standing into something: a barricade, a Prepared Shot, an automatic Brace. Their bonuses need time and a chosen tile, so a League army that is rushed gets very little of them.
- **A road or bridge is their home.** A typical formation is Pikemen in front, Pavise Guards behind them and Crossbowmen at the rear, on a road, bridge or ford, so the enemy has to come through the problem.
- **Fantastic skills, mediocre spells.** Most of their power is in unit abilities (engines, rigs and tools). Their spell cards are weak and few: they are salvage tricks, not sorcery, and are expected to fail sometimes. The League beats casters by out-preparing them and loses to enemies who make it move.
- **Decrepit tech.** Artifacts are powerful but unreliable. Proposed model: each artifact ability has a **Malfunction** chance, or needs a **Repair** turn after a heavy use (cooldown-based), never a random coin flip on the first use. Weak points are legible and can be exploited by the opponent.
- **Champion:** none decided (see questions). A mercenary captain or a guild engineer are both natural choices.
- **Play pattern:** hold a chokepoint or controlled location, prepare a killing ground, then let the enemy come. Strong on bridges, fords and fixed objectives. Weak against fast, flanking or magical opponents (Fireburst on a packed position, cavalry going round the ends) and against anything that forces them to move before they are prepared. The White Fang mirror is the archetype: momentum against preparation.

### Unique units

| Rarity | Unit | Class (proposed) | Role |
|---|---|---|---|
| Common | **Pavise Guard** | Shield infantry | Carries a deployable relic-plate shield wall. |
| Uncommon | **Coil Crossbowman** | Ranged infantry | An archer with a salvaged spring-loaded crossbow that needs setup. |
| Rare | **Relic Walker** | Artifact pilot / heavy | A pilot inside a patched-together ancient frame. |

**Pavise Guard (common).** An infantryman behind a tall pavise shield made from salvaged alloy plate, with a short pike. He fills the middle of the League line. Suggested stats: HP 25, Str 6, Skl 5, Spd 3, Def 11, Mov 3, range 1. Passive **Set Shield**: if it did not move this round, adjacent ranged friends behind it take 3 less damage from ranged attacks. Pikemen still lead the line; the Pavise Guard is what makes their shooters survive.

**Coil Crossbowman (uncommon).** A crossbowman with an ancient coil-driven bow that is powerful but slow to prepare. Suggested stats: HP 18, Str 6, Skl 8, Spd 5, Def 3, Mov 4, range 2. Passive **Prepared Shot**: if it is on Hold and did not move last round, its next ranged strike gains +4 damage and +20 hit. Hold and stillness are rewarded; a crossbowman that keeps moving is only a weaker Archer.

**Relic Walker (rare).** A pilot in a dented, creaking ancient frame, half armour and half machine, with a repaired arm cannon and a rack of tools. Suggested stats: HP 30, Str 9, Skl 4, Spd 2, Def 13, Mov 2, range 2 (very slow and durable, with a short-range beam). Passive **Failing Systems**: the first time it drops below 50% HP it loses 1 Mov and its cannon gains a Malfunction chance (proposed: an attack has a 25% chance to fizzle). Rare because it is a strong anchor that ages during a fight and rewards the opponent for pressuring it early.

### Unique skills

Abilities use the existing energy and cooldown system and fixed phases. The **Sapper** is a support role that can appear on any League unit card (proposed to be a skill, not a class).

| Rarity | Skill | Classes | Cost / cooldown (proposed) | Phase | Effect |
|---|---|---|---|---|---|
| Common | **Dig In** | Pikeman, Pavise Guard, Sapper | 1 / 2 | defense | Requires Hold and no movement this round. Creates a barricade on the adjacent tile in front (facing): an enemy that ends its move there is blocked and takes a hit from the barricade (3 damage). Lasts until destroyed (proposed 8 HP). |
| Uncommon | **Prepared Position** | Crossbowman, Coil Crossbowman | 1 / 2 | enhancement | Hold only. Gain Prepared Shot immediately and treat the unit as having held for two rounds, so its next shot is +6 damage. Reduced if it moved this round. |
| Rare | **Arc Lance** | Relic Walker | 3 / 3 | enhancement | Fire a piercing beam along the facing line up to range 3, hitting every enemy in line (4 damage each, ignores 2 Defense). 20% Malfunction chance; on Malfunction, take 4 damage and gain no cooldown. |

Also proposed as a faction rule rather than a skill: **Garrison Doctrine.** Pikemen on a controlled location (keep or village) start each battle as though Brace were selected, for free. It gives the League a free defence exactly where it wants to fight, and its strength depends on holding villages.

### Spells

Deliberately mediocre, as in the brief. They are salvaged one-shot tricks:

| Rarity | Spell | Effect |
|---|---|---|
| Common | **Field Repair** | Heal a chosen unit 4 HP and clear a Malfunction. |
| Common | **Flare** | Reveal and mark one enemy: units with Prepared Shot gain +2 hit against it. |
| Uncommon | **Static Discharge** | 3 damage to one enemy, ignoring Defense, with a 25% chance to fail. |

The League has no rare spell (proposal); its rare cards are units and skills.

### Design notes

- **Art direction:** patina, dents, rope and rivets. Artifacts look ancient, unreliable and hand-repaired, not clean. The blue-and-silver Crown and crimson-and-fur Clans read against brass, bronze and oxidized green.
- **Prepared state must be visible.** Holding still is the mechanic, so the UI has to show that a unit is prepared (a marker such as a raised sight or a barricade) or the player will not understand why a crossbowman is strong.
- **AI:** the heuristic commander needs to hold positions and pick chokepoints for the League to exploit its mechanics.
- **Balance status:** nothing tuned. Malfunction is deterministic under the seeded RNG so replays still match.

---

## 4. The Hollow Court

*Bone, black velvet and pale candlelight. A dead civilization that has ruled the same provinces for centuries.*

### Lore

The Hollow Court is not a horde. It is a government, and it has been in session for four hundred years. Its founders were the provincial nobility of a realm older than Ashvale, who discovered that an heir does not have to wait for an inheritance if the incumbent never leaves. The great families ended their own deaths by rite and decree, and the households that served them followed. Their lands were never conquered or abandoned; they simply kept going. The Court still holds assizes, collects rents, seals writs and settles precedence at banquets, and it does all of it with servants who are sometimes alive, sometimes dead, and sometimes both in the same week.

The Court believes, sincerely and without malice, that mortality is a barbaric condition that a civilized society should eventually eliminate, like plague or debt slavery. The living are not treated as enemies but as citizens who have not yet been invited into the franchise. A Court army therefore is not an invasion but an administrative act: it arrives to regularise a province. It brings Graveguards to hold the roads, Wights to carry writs, Mourning Knights to keep old vows, and Necromancers who are less sorcerers than civil servants of the grave, filing the fallen back into service. At the bottom are the feral ghouls, the Court's failed cases, kept for labour and for the front line, and considered rude company by everyone above them.

Everyone else finds this appalling, which the Court finds provincial. The Argent Crown's knights die and are mourned, and the Court thinks that is the barbaric part. The White Fang wants to give death meaning, and the Court considers that a very old-fashioned superstition. The Iron League treats the dead as salvage, which is a shocking idea to the Court, since it thinks the dead are its constituents. The Court is very patient, and every defeat is only a delay in the schedule.

### Personality and key traits

**Formal, patient, entitled, inevitable.** The Court does not need to win every exchange. It expects to lose some units and lose nothing that matters. Its identity is that **defeating a unit does not necessarily remove its battlefield value.**

- **Death is a resource, not a loss.** Cheap undead leave **Corpse** tokens; Necromancers spend them; the great units come back. The opponent has to ask "did I actually get rid of it?" and can be wrong, which is the counterplay the game needs against "just kill the 2-star".
- **Individually modest.** Units are not overwhelmingly strong. The lever is attrition: an army that keeps returning, keeps healing from its own dead and can be starved of Corpses.
- **Slow and inevitable.** They want long games, low tempo and tokens on the board. Weak against fast finishes (a keep capture before value converts), against Fireburst-style burst on packed clumps (Corpses appear where they die) and against anything that cleans up Corpses.
- **Ties to permanent death.** A dead 2★ is normally a strategic victory in this game (units are permanent, champions respawn). Against the Court that victory needs to be verified: the Court can return a unit once per match or turn a ghoul into a Graveguard. Kills against the Court are worth less on average, but they are not worthless, and the cost is denied elsewhere (see Death as a resource below).
- **Champion:** not decided. Natural candidates: a deathless noble (the Hollow Regent), or a Necromancer-chancellor. Questions below.
- **Play pattern:** cheap ghoul front, Graveguards holding a line, Necromancers behind spending Corpses each round, Revenants and Mourning Knights as the elite that comes back. Trades cheaply, wins slowly, and punishes an opponent who commits everything to the first kill.

### Unique units

| Rarity | Unit | Class (proposed) | Role |
|---|---|---|---|
| Common | **Feral Ghoul** | Fast melee swarm | Cheap disposable front line that leaves a Corpse. |
| Uncommon | **Graveguard** | Armoured infantry | Old household troops; heals from Corpses. |
| Rare | **Mourning Knight** | Mounted or heavy elite | A knight of the Court who returns once per match. |

Further roster (not one of the three, for later): **Wight** (fast courier and duelist), **Necromancer** (the Corpse consumer, below), **Hollow Noble** (champion tier).

**Feral Ghoul (common).** Cheap, quick and hungry, wearing what remains of livery. Suggested stats: HP 14, Str 7, Skl 4, Spd 7, Def 2, Mov 5, range 1, low recruitment cost. Passive **Leave Remains**: when it dies it leaves a Corpse token on its tile. Ghouls are poor fighters that turn kills into a resource for someone else.

**Graveguard (uncommon).** Pale household troops in black-and-silver plate, still marching in step. Suggested stats: HP 26, Str 7, Skl 5, Spd 3, Def 9, Mov 3, range 1. Passive **Duty Beyond Death**: heals 4 HP at refresh if a Corpse is within 2 tiles (consuming the Corpse only if its own Necromancer is not present; see rules). A slow, dependable anchor that needs the field to be full of the recently dead.

**Mourning Knight (rare).** An armoured knight who has kept a vow past death, wearing a mourning veil and a rusted crest. Suggested stats: HP 28, Str 8, Skl 5, Spd 5, Def 10, Mov 6, range 1. Passive **Revenant Vow**: once per match, when it dies it returns at the end of battle with 1 HP on its own tile (or the nearest empty tile). It keeps its stars and equipment. It is rare because the first kill has to be redone.

### Unique skills

| Rarity | Skill | Classes | Cost / cooldown (proposed) | Phase | Effect |
|---|---|---|---|---|---|
| Common | **Consume Remains** | Necromancer (any unit that can reach a Corpse) | 1 / 1 | recovery | Consume one Corpse within 3 tiles: heal a chosen friendly Graveguard 8 HP. |
| Uncommon | **Raise Ghoul** | Necromancer | 2 / 2 | recovery | Consume two Corpses within 3 tiles: place a Feral Ghoul on an empty adjacent tile (population and bench limits still apply). |
| Rare | **Revenant** | Any 2★+ Court unit, Mourning Knight | 0 / once per match | on death | The unit returns at the end of battle with 1 HP, keeping stars and equipment. A second death is permanent. Cannot trigger on the champion. |

### Spells

| Rarity | Spell | Effect |
|---|---|---|
| Common | **Grave Chill** | An enemy in range takes 3 damage and loses 1 energy; if it dies, a Corpse is left. |
| Uncommon | **Writ of Recall** | Return one dead Court unit from this match to the reserve bench at 1 HP (cost: 2 Corpses; the unit is unpaid again). |
| Rare | **Assize of the Dead** | For one battle, every Court unit that dies leaves a Corpse and every Corpse on the field heals the nearest friendly unit 2 HP. |

### Design notes

- **Corpse tokens are an engine change**: a tile object that persists across rounds, blocks or does not block movement (decide), is removed by being consumed, occupied for capture, or decaying (proposed: 3 rounds). They belong in the match state and the replay log, and need an overlay for the player.
- **Revenant and permanent death** interact with the population cap, reserve state and the end check (an army is not destroyed while a Revenant is pending). Match victory by wipe must account for pending returns, the same way champion respawn already does.
- **The balance lever** is the Court's *unit quality*, not its resource loop. Keep individual stats low, and make Corpses scarce, so that starving them is a real strategy.

---

## Death as a resource (cross-faction)

The same idea can be applied to the whole game, not only the Court. Death is already meaningful (permanent for recruits, respawn for champions, population freed on death); these options turn it into something a player can plan around. Each is a menu item, none is adopted.

| Idea | How it works | Best fit |
|---|---|---|
| **Corpse tokens** | Some units leave a token on their tile; effects consume it (heal, summon, capture bonus). Can be denied by standing on it. | Hollow Court |
| **Revenant / return once** | A unit comes back with 1 HP after battle, once per match. | Hollow Court, rare |
| **Death payoffs** | A dying unit passes energy or a status to the nearest ally. | White Fang (Ancestors' Fury already proposes 2 energy) |
| **Bounty on kills** | Killing certain units pays Supply or energy to the killer's side. | Iron League (mercenary bounties), any faction |
| **Fallen banner / memorial** | A dead Bannerman or champion leaves a marker tile that buffs units defending it for a few rounds. | Argent Crown |
| **Sacrifice** | Spend a unit (its population and its investment) for a stronger effect. Blood Oath (White Fang) is a small version. | White Fang, Hollow Court |
| **Graveyard pile** | A per-side count of the dead this match; some cards scale with it (Writ of Recall, Ancestors' Fury). | Hollow Court, White Fang |
| **Salvage** | A dead machine leaves scrap; spend it to repair or field a cheap unit. | Iron League |
| **Capture cost of kills** | Killing a 2★ unit refunds part of its cost to the killer (bounty), so killing expensive units is rewarded. | Any |

Important caution: death-as-a-resource can make the CORE-02 stalemate worse (more replacement, less loss). If the Court is adopted, test it by paired-seed simulation for match length and draw rate before choosing defaults.

---

## Open questions to bring up later

**All factions**
1. Rarity: every card is currently common. Do these proposed rarities become a real system (drop rates, deck limits), or should they be labels for power level only? Rarity rates are not confirmed and were not invented.
2. Are unique factional units new classes (roadmap says new classes wait until the three recruit classes support a complete match), or stat/skill variants of the existing Pikeman, Archer and Cavalier?
3. Does a player pick one faction for the whole match (with faction-only pools), or can decks mix? "Different factions cannot combine" already exists for combination.
4. Do factions have their own champions, and should champions get active kits (Brenna and Dreg currently have none)?
5. How many spells and skills should each faction have, and are the spells all one-shot cards like Fireburst, Ward and Mend?

**Argent Crown**
6. Should Line Doctrine be a passive on every Crown unit, or a bonus on specific cards?
7. Does Sworn Guard share damage (half to the guard) or redirect it (all damage to the guard)?

**White Fang Clans**
8. Should Blood Challenge be a hard target lock or a damage penalty on other targets?
9. Is Berserker Frenzy an ability or a passive, and how much healing should the White Fang have?

**Iron League**
10. Who is the League's champion (mercenary captain, guild engineer, or none)?
11. Malfunction: random chance, a repair cooldown, or both? It must stay legible and deterministic for replay.
12. Is the Sapper a class, or a skill any League unit can carry?
13. Is Garrison Doctrine (free Brace on controlled locations) a faction rule, or is it too strong with the village and deployment-radius experiments?
14. Do the lore claims about the Foundry Age fit the wider setting (Ashvale, the Crown's magic and forest spirits), or should the ancient tech stay unexplained?

**Hollow Court and death as a resource**
15. Are Corpse tokens acceptable as a new persistent tile object, and do they block movement or capture? How long do they last (proposed: 3 rounds)?
16. Does Revenant Vow apply to any 2★+ unit or only to Mourning Knights? Should Revenants count as alive for the army-destroyed end check while pending (as champion respawn does)?
17. Who is the champion (Hollow Regent, Necromancer-chancellor, or another)?
18. Should death-as-a-resource effects (bounty, death payoffs, graveyard pile) be shared across factions or stay faction-specific? Which of the cross-faction menu items do you want to explore?
19. Is the Court's "feral ghouls" tier one class or a rank within the Court (ghoul → graveguard by Corpse spending)?
