> Historical output from earlier rules, not current main balance certification. [Retained findings](../../../../EXPERIMENT_SUMMARY.md).

| cell | games | A win | B win | draw | mean rounds | keep captured | army destroyed | round limit | village captures / game |
|---|---|---|---|---|---|---|---|---|---|
| Crown (crown AI) v baseline (heuristic) | 400 | 0.0% (0.0%-1.0%) | 1.8% (0.9%-3.6%) | 98.3% (96.4%-99.1%) | 29.7 | 1.8% (0.9%-3.6%) | 0.0% (0.0%-1.0%) | 98.3% (96.4%-99.1%) | 2.15 |
| Crown (plain heuristic) v baseline (heuristic) | 400 | 2.0% (1.0%-3.9%) | 1.5% (0.7%-3.2%) | 96.5% (94.2%-97.9%) | 29.3 | 3.5% (2.1%-5.8%) | 0.0% (0.0%-1.0%) | 96.5% (94.2%-97.9%) | 2.09 |
| Crown (crown AI) v Crown (plain heuristic): what the culture-aware AI adds | 400 | 0.0% (0.0%-1.0%) | 3.3% (1.9%-5.5%) | 96.8% (94.5%-98.1%) | 29.5 | 3.3% (1.9%-5.5%) | 0.0% (0.0%-1.0%) | 96.8% (94.5%-98.1%) | 2.02 |
| Crown v the same Crown army with Line Doctrine stripped from every unit (isolates the doctrine in a whole game; both use the crown AI) | 400 | 0.0% (0.0%-1.0%) | 0.3% (0.0%-1.4%) | 99.8% (98.6%-100.0%) | 30.0 | 0.3% (0.0%-1.4%) | 0.0% (0.0%-1.0%) | 99.8% (98.6%-100.0%) | 1.88 |
| Mirror: Crown (crown AI) v Crown (crown AI); "A" is Blue, so this is the side / map bias | 200 | 0.0% (0.0%-1.9%) | 0.0% (0.0%-1.9%) | 100.0% (98.1%-100.0%) | 30.0 | 0.0% (0.0%-1.9%) | 0.0% (0.0%-1.9%) | 100.0% (98.1%-100.0%) | 1.78 |
| Control: baseline v baseline (heuristic); "A" is Blue | 200 | 0.5% (0.1%-2.8%) | 2.0% (0.8%-5.0%) | 97.5% (94.3%-98.9%) | 29.5 | 2.5% (1.1%-5.7%) | 0.0% (0.0%-1.9%) | 97.5% (94.3%-98.9%) | 2.31 |

End state (averages over all games; HP = living field units at the end):

| cell | units lost A / B | field HP A / B | draws with A ahead on HP | draws with B ahead on HP | formation index A / B (0-2) | field units per round A / B | B units lost - A units lost (95%) | A field HP - B field HP (95%) |
|---|---|---|---|---|---|---|---|---|
| crown-vs-base | 5.8 / 7.5 | 167 / 149 | 283 of 393 | 104 of 393 | 1.32 / 0.78 | 7.1 / 6.9 | 1.72 +/- 0.30 | 18.5 +/- 3.2 |
| crownplain-vs-base | 7.5 / 7.5 | 156 / 150 | 214 of 386 | 168 of 386 | 0.79 / 0.71 | 7.4 / 6.9 | -0.05 +/- 0.35 | 6.0 +/- 3.5 |
| crown-vs-crownplain | 5.0 / 7.0 | 169 / 162 | 221 of 387 | 157 of 387 | 1.36 / 0.91 | 7.1 / 7.5 | 1.99 +/- 0.31 | 6.2 +/- 3.2 |
| line-vs-noline | 5.4 / 6.5 | 169 / 166 | 217 of 399 | 178 of 399 | 1.41 / 1.40 | 7.1 / 7.0 | 1.07 +/- 0.26 | 3.8 +/- 3.1 |
| mirror | 5.0 / 5.7 | 169 / 172 | 93 of 200 | 103 of 200 | 1.44 / 1.42 | 7.1 / 7.2 | 0.62 +/- 0.35 | -3.8 +/- 4.0 |
| base-mirror | 7.6 / 8.2 | 143 / 149 | 77 of 195 | 118 of 195 | 0.65 / 0.69 | 6.9 / 6.9 | 0.62 +/- 0.42 | -6.3 +/- 5.1 |

By side of A (A = the first-named army; in mirror cells A is always Blue):

| cell | A on | games | A win | B win | draw |
|---|---|---|---|---|---|
| crown-vs-base | blue | 200 | 0.0% (0.0%-1.9%) | 3.5% (1.7%-7.0%) | 96.5% (93.0%-98.3%) |
| crown-vs-base | red | 200 | 0.0% (0.0%-1.9%) | 0.0% (0.0%-1.9%) | 100.0% (98.1%-100.0%) |
| crownplain-vs-base | blue | 200 | 0.0% (0.0%-1.9%) | 2.5% (1.1%-5.7%) | 97.5% (94.3%-98.9%) |
| crownplain-vs-base | red | 200 | 4.0% (2.0%-7.7%) | 0.5% (0.1%-2.8%) | 95.5% (91.7%-97.6%) |
| crown-vs-crownplain | blue | 200 | 0.0% (0.0%-1.9%) | 6.0% (3.5%-10.2%) | 94.0% (89.8%-96.5%) |
| crown-vs-crownplain | red | 200 | 0.0% (0.0%-1.9%) | 0.5% (0.1%-2.8%) | 99.5% (97.2%-99.9%) |
| line-vs-noline | blue | 200 | 0.0% (0.0%-1.9%) | 0.5% (0.1%-2.8%) | 99.5% (97.2%-99.9%) |
| line-vs-noline | red | 200 | 0.0% (0.0%-1.9%) | 0.0% (0.0%-1.9%) | 100.0% (98.1%-100.0%) |
| mirror | blue | 200 | 0.0% (0.0%-1.9%) | 0.0% (0.0%-1.9%) | 100.0% (98.1%-100.0%) |
| base-mirror | blue | 200 | 0.5% (0.1%-2.8%) | 2.0% (0.8%-5.0%) | 97.5% (94.3%-98.9%) |

Map flat_open. Seeds per side assignment: 200; max rounds 30; rarity gate {"uncommon":3,"rare":6}; replay checks 10/10 ok.
