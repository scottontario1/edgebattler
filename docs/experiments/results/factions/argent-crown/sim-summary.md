| cell | games | A win | B win | draw | mean rounds | keep captured | army destroyed | round limit | village captures / game |
|---|---|---|---|---|---|---|---|---|---|
| Crown (crown AI) v baseline (heuristic) | 400 | 0.0% (0.0%-1.0%) | 0.5% (0.1%-1.8%) | 99.5% (98.2%-99.9%) | 29.9 | 0.5% (0.1%-1.8%) | 0.0% (0.0%-1.0%) | 99.5% (98.2%-99.9%) | 1.22 |
| Crown (plain heuristic) v baseline (heuristic) | 400 | 0.5% (0.1%-1.8%) | 0.3% (0.0%-1.4%) | 99.3% (97.8%-99.7%) | 30.0 | 0.8% (0.3%-2.2%) | 0.0% (0.0%-1.0%) | 99.3% (97.8%-99.7%) | 1.21 |
| Crown (crown AI) v Crown (plain heuristic): what the culture-aware AI adds | 400 | 0.0% (0.0%-1.0%) | 0.5% (0.1%-1.8%) | 99.5% (98.2%-99.9%) | 29.9 | 0.5% (0.1%-1.8%) | 0.0% (0.0%-1.0%) | 99.5% (98.2%-99.9%) | 1.13 |
| Crown v the same Crown army with Line Doctrine stripped from every unit (isolates the doctrine in a whole game; both use the crown AI) | 400 | 0.5% (0.1%-1.8%) | 0.0% (0.0%-1.0%) | 99.5% (98.2%-99.9%) | 30.0 | 0.5% (0.1%-1.8%) | 0.0% (0.0%-1.0%) | 99.5% (98.2%-99.9%) | 1.17 |
| Mirror: Crown (crown AI) v Crown (crown AI); "A" is Blue, so this is the side / map bias | 200 | 1.0% (0.3%-3.6%) | 0.0% (0.0%-1.9%) | 99.0% (96.4%-99.7%) | 29.9 | 1.0% (0.3%-3.6%) | 0.0% (0.0%-1.9%) | 99.0% (96.4%-99.7%) | 1.11 |
| Control: baseline v baseline (heuristic); "A" is Blue | 200 | 0.0% (0.0%-1.9%) | 0.0% (0.0%-1.9%) | 100.0% (98.1%-100.0%) | 30.0 | 0.0% (0.0%-1.9%) | 0.0% (0.0%-1.9%) | 100.0% (98.1%-100.0%) | 1.03 |

End state (averages over all games; HP = living field units at the end):

| cell | units lost A / B | field HP A / B | draws with A ahead on HP | draws with B ahead on HP | formation index A / B (0-2) | field units per round A / B | B units lost - A units lost (95%) | A field HP - B field HP (95%) |
|---|---|---|---|---|---|---|---|---|
| crown-vs-base | 3.7 / 3.8 | 175 / 169 | 230 of 398 | 161 of 398 | 1.40 / 0.87 | 7.3 / 7.3 | 0.14 +/- 0.21 | 6.2 +/- 2.7 |
| crownplain-vs-base | 3.8 / 3.4 | 175 / 169 | 221 of 397 | 169 of 397 | 0.90 / 0.91 | 7.7 / 7.3 | -0.39 +/- 0.22 | 5.6 +/- 2.8 |
| crown-vs-crownplain | 3.1 / 4.2 | 175 / 174 | 199 of 398 | 191 of 398 | 1.41 / 0.91 | 7.3 / 7.7 | 1.06 +/- 0.25 | 0.6 +/- 2.9 |
| line-vs-noline | 3.9 / 4.5 | 173 / 172 | 188 of 398 | 206 of 398 | 1.35 / 1.36 | 7.2 / 7.1 | 0.61 +/- 0.26 | 0.7 +/- 2.7 |
| mirror | 3.3 / 4.5 | 174 / 175 | 97 of 198 | 100 of 198 | 1.43 / 1.26 | 7.2 / 7.2 | 1.15 +/- 0.31 | -0.8 +/- 3.9 |
| base-mirror | 2.8 / 3.0 | 170 / 171 | 94 of 200 | 103 of 200 | 0.87 / 0.90 | 7.4 / 7.3 | 0.21 +/- 0.27 | -1.2 +/- 4.1 |

By side of A (A = the first-named army; in mirror cells A is always Blue):

| cell | A on | games | A win | B win | draw |
|---|---|---|---|---|---|
| crown-vs-base | blue | 200 | 0.0% (0.0%-1.9%) | 1.0% (0.3%-3.6%) | 99.0% (96.4%-99.7%) |
| crown-vs-base | red | 200 | 0.0% (0.0%-1.9%) | 0.0% (0.0%-1.9%) | 100.0% (98.1%-100.0%) |
| crownplain-vs-base | blue | 200 | 0.5% (0.1%-2.8%) | 0.5% (0.1%-2.8%) | 99.0% (96.4%-99.7%) |
| crownplain-vs-base | red | 200 | 0.5% (0.1%-2.8%) | 0.0% (0.0%-1.9%) | 99.5% (97.2%-99.9%) |
| crown-vs-crownplain | blue | 200 | 0.0% (0.0%-1.9%) | 1.0% (0.3%-3.6%) | 99.0% (96.4%-99.7%) |
| crown-vs-crownplain | red | 200 | 0.0% (0.0%-1.9%) | 0.0% (0.0%-1.9%) | 100.0% (98.1%-100.0%) |
| line-vs-noline | blue | 200 | 0.5% (0.1%-2.8%) | 0.0% (0.0%-1.9%) | 99.5% (97.2%-99.9%) |
| line-vs-noline | red | 200 | 0.5% (0.1%-2.8%) | 0.0% (0.0%-1.9%) | 99.5% (97.2%-99.9%) |
| mirror | blue | 200 | 1.0% (0.3%-3.6%) | 0.0% (0.0%-1.9%) | 99.0% (96.4%-99.7%) |
| base-mirror | blue | 200 | 0.0% (0.0%-1.9%) | 0.0% (0.0%-1.9%) | 100.0% (98.1%-100.0%) |

Map river_ford. Seeds per side assignment: 200; max rounds 30; rarity gate {"uncommon":3,"rare":6}; replay checks 10/10 ok.
