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
