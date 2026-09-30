| cell | games | A win | B win | draw | mean rounds | keep captured | army destroyed | round limit | village captures / game |
|---|---|---|---|---|---|---|---|---|---|
| Crown (crown AI) v baseline (heuristic) | 400 | 0.0% (0.0%-1.0%) | 1.5% (0.7%-3.2%) | 98.5% (96.8%-99.3%) | 29.7 | 1.5% (0.7%-3.2%) | 0.0% (0.0%-1.0%) | 98.5% (96.8%-99.3%) | 2.15 |
| Crown (plain heuristic) v baseline (heuristic) | 400 | 2.0% (1.0%-3.9%) | 1.0% (0.4%-2.5%) | 97.0% (94.8%-98.3%) | 29.3 | 3.0% (1.7%-5.2%) | 0.0% (0.0%-1.0%) | 97.0% (94.8%-98.3%) | 2.09 |
| Crown (crown AI) v Crown (plain heuristic): what the culture-aware AI adds | 400 | 0.0% (0.0%-1.0%) | 3.5% (2.1%-5.8%) | 96.5% (94.2%-97.9%) | 29.5 | 3.5% (2.1%-5.8%) | 0.0% (0.0%-1.0%) | 96.5% (94.2%-97.9%) | 1.99 |
| Crown v the same Crown army with Line Doctrine stripped from every unit (isolates the doctrine in a whole game; both use the crown AI) | 400 | 0.0% (0.0%-1.0%) | 0.3% (0.0%-1.4%) | 99.8% (98.6%-100.0%) | 30.0 | 0.3% (0.0%-1.4%) | 0.0% (0.0%-1.0%) | 99.8% (98.6%-100.0%) | 1.85 |
| Mirror: Crown (crown AI) v Crown (crown AI); "A" is Blue, so this is the side / map bias | 200 | 0.0% (0.0%-1.9%) | 0.0% (0.0%-1.9%) | 100.0% (98.1%-100.0%) | 30.0 | 0.0% (0.0%-1.9%) | 0.0% (0.0%-1.9%) | 100.0% (98.1%-100.0%) | 1.74 |
| Control: baseline v baseline (heuristic); "A" is Blue | 200 | 0.5% (0.1%-2.8%) | 2.0% (0.8%-5.0%) | 97.5% (94.3%-98.9%) | 29.5 | 2.5% (1.1%-5.7%) | 0.0% (0.0%-1.9%) | 97.5% (94.3%-98.9%) | 2.31 |

End state (averages over all games; HP = living field units at the end):

| cell | units lost A / B | field HP A / B | draws with A ahead on HP | draws with B ahead on HP | formation index A / B (0-2) | field units per round A / B | B units lost - A units lost (95%) | A field HP - B field HP (95%) |
|---|---|---|---|---|---|---|---|---|
| crown-vs-base | 5.7 / 7.5 | 168 / 149 | 291 of 394 | 98 of 394 | 1.32 / 0.77 | 7.1 / 6.9 | 1.75 +/- 0.28 | 19.5 +/- 3.3 |
| crownplain-vs-base | 7.6 / 7.5 | 156 / 149 | 212 of 388 | 172 of 388 | 0.79 / 0.70 | 7.4 / 6.9 | -0.08 +/- 0.35 | 6.7 +/- 3.6 |
| crown-vs-crownplain | 5.1 / 7.0 | 168 / 162 | 225 of 386 | 155 of 386 | 1.36 / 0.91 | 7.1 / 7.5 | 1.87 +/- 0.31 | 6.2 +/- 3.0 |
| line-vs-noline | 5.4 / 6.5 | 170 / 167 | 216 of 399 | 176 of 399 | 1.42 / 1.41 | 7.1 / 7.0 | 1.05 +/- 0.28 | 2.7 +/- 3.2 |
| mirror | 5.1 / 5.7 | 171 / 169 | 106 of 200 | 90 of 200 | 1.44 / 1.41 | 7.1 / 7.1 | 0.64 +/- 0.35 | 1.3 +/- 3.9 |
| base-mirror | 7.6 / 8.2 | 143 / 149 | 77 of 195 | 118 of 195 | 0.65 / 0.69 | 6.9 / 6.9 | 0.62 +/- 0.42 | -6.3 +/- 5.1 |

By side of A (A = the first-named army; in mirror cells A is always Blue):

| cell | A on | games | A win | B win | draw |
|---|---|---|---|---|---|
| crown-vs-base | blue | 200 | 0.0% (0.0%-1.9%) | 3.0% (1.4%-6.4%) | 97.0% (93.6%-98.6%) |
| crown-vs-base | red | 200 | 0.0% (0.0%-1.9%) | 0.0% (0.0%-1.9%) | 100.0% (98.1%-100.0%) |
| crownplain-vs-base | blue | 200 | 0.0% (0.0%-1.9%) | 2.0% (0.8%-5.0%) | 98.0% (95.0%-99.2%) |
| crownplain-vs-base | red | 200 | 4.0% (2.0%-7.7%) | 0.0% (0.0%-1.9%) | 96.0% (92.3%-98.0%) |
| crown-vs-crownplain | blue | 200 | 0.0% (0.0%-1.9%) | 6.5% (3.8%-10.8%) | 93.5% (89.2%-96.2%) |
| crown-vs-crownplain | red | 200 | 0.0% (0.0%-1.9%) | 0.5% (0.1%-2.8%) | 99.5% (97.2%-99.9%) |
| line-vs-noline | blue | 200 | 0.0% (0.0%-1.9%) | 0.5% (0.1%-2.8%) | 99.5% (97.2%-99.9%) |
| line-vs-noline | red | 200 | 0.0% (0.0%-1.9%) | 0.0% (0.0%-1.9%) | 100.0% (98.1%-100.0%) |
| mirror | blue | 200 | 0.0% (0.0%-1.9%) | 0.0% (0.0%-1.9%) | 100.0% (98.1%-100.0%) |
| base-mirror | blue | 200 | 0.5% (0.1%-2.8%) | 2.0% (0.8%-5.0%) | 97.5% (94.3%-98.9%) |

Map flat_open. Seeds per side assignment: 200; max rounds 30; rarity gate {"uncommon":3,"rare":6}; replay checks 10/10 ok.
