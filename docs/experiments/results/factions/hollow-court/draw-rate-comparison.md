# Do the death mechanics change the draw rate?

| regime | driver / matchup | draws WITH death mechanics | draws WITHOUT | difference (95%) | keep-captured with / without | mean rounds with / without | baseline mirror draws |
|---|---|---|---|---|---|---|---|
| River Ford, shipped rules | Court commander v baseline | 98.0% (392/400) | 98.0% (392/400) | +0.0 pp +-1.9 | 2.0% / 2.0% | 29.8 / 29.9 | 97.5% |
| River Ford, shipped rules | Court commander mirror | 98.0% (392/400) | 97.5% (390/400) | +0.5 pp +-2.1 | 2.0% / 2.5% | 29.8 / 29.8 | 97.5% |
| River Ford, shipped rules | shipped heuristic v baseline | 94.5% (378/400) | 94.8% (379/400) | -0.3 pp +-3.1 | 5.5% / 5.3% | 29.5 / 29.6 | 97.5% |
| River Ford, shipped rules | shipped heuristic mirror | 82.8% (331/400) | 84.8% (339/400) | -2.0 pp +-5.1 | 16.3% / 13.0% | 28.4 / 28.5 | 97.5% |
| village_chain, village deployment radius 5 | Court commander v baseline | 85.5% (342/400) | 86.5% (346/400) | -1.0 pp +-4.8 | 14.5% / 13.5% | 27.5 / 27.9 | 67.5% |
| village_chain, village deployment radius 5 | Court commander mirror | 94.3% (377/400) | 93.3% (373/400) | +1.0 pp +-3.4 | 5.8% / 6.8% | 29.4 / 29.4 | 67.5% |
| village_chain, village deployment radius 5 | shipped heuristic v baseline | 56.8% (227/400) | 51.2% (205/400) | +5.5 pp +-6.9 | 43.3% / 48.8% | 24.4 / 24.2 | 67.5% |
| village_chain, village deployment radius 5 | shipped heuristic mirror | 45.3% (181/400) | 35.3% (141/400) | +10.0 pp +-6.8 | 42.3% / 41.5% | 25.4 / 24.4 | 67.5% |

## Which mechanic?

| Court build (shipped heuristic, village_chain radius 5, mirror, 1000 games each) | draws | difference from "no death mechanics" (95%) | keep-captured | army-destroyed | mean rounds |
|---|---|---|---|---|---|
| no death mechanics (control) | 35.4% (354/1000) | +0.0 pp +-4.2 | 464 | 182 | 24.6 |
| all death mechanics | 44.5% (445/1000) | +9.1 pp +-4.3 | 435 | 120 | 25.2 |
| without Revenant (corpses and passives on) | 37.2% (372/1000) | +1.8 pp +-4.2 | 482 | 146 | 24.6 |
| without corpse-reading passives (Revenant and corpses on) | 41.8% (418/1000) | +6.4 pp +-4.3 | 450 | 132 | 25.3 |
| without corpses (Revenant on; passives inert) | 41.1% (411/1000) | +5.7 pp +-4.3 | 449 | 140 | 25.1 |
