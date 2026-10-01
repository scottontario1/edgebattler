> Historical output from earlier rules, not current main balance certification. [Retained findings](../../../../EXPERIMENT_SUMMARY.md).

## village_chain with experiment rules dvil-5: 100 seeds x 2 sides per cell, max 30 rounds, rarity gate uncommon 3 / rare 6

Subject win, loss and draw rates are over all 2N games (subject on Blue and on Red); the interval is a 95% Wilson interval. A draw is the round limit.

| cell | games | subject win | 95% | opponent win | draw | 95% draw | rounds (all / decided) | subject keep wins | villages captured s / o | anyone captured a village | subject / opp units lost |
|---|---|---|---|---|---|---|---|---|---|---|---|
| fang-cmd | 200 | 9.5% | 6.2%-14.4% | 14.0% | 76.5% | 70.2%-81.8% | 25.9 / 12.7 | 19 | 2.11 / 1.74 | 100.0% | 13.1 / 12.3 |
| fang-heur | 200 | 11.0% | 7.4%-16.1% | 34.0% | 55.0% | 48.1%-61.7% | 25.0 / 19.0 | 22 | 1.92 / 1.69 | 100.0% | 13.2 / 7.8 |
| mirror | 200 | 17.5% | 12.9%-23.4% | 17.5% | 65.0% | 58.2%-71.3% | 23.6 / 11.8 | 35 | 2.04 / 2.04 | 100.0% | 16.1 / 16.1 |
| control | 200 | 15.0% | 10.7%-20.6% | 17.5% | 67.5% | 60.7%-73.6% | 23.1 / 8.8 | 30 | 1.50 / 1.63 | 100.0% | 6.4 / 7.6 |
| fang-axe | 200 | 11.5% | 7.8%-16.7% | 12.0% | 76.5% | 70.2%-81.8% | 25.8 / 12.1 | 23 | 2.13 / 1.80 | 100.0% | 11.2 / 13.8 |
| fang-mov2 | 200 | 6.5% | 3.8%-10.8% | 9.5% | 84.0% | 78.3%-88.4% | 27.9 / 16.7 | 13 | 1.61 / 1.75 | 100.0% | 14.5 / 13.0 |
| fang-nopool | 200 | 17.0% | 12.4%-22.8% | 19.5% | 63.5% | 56.6%-69.9% | 22.9 / 10.6 | 34 | 1.76 / 1.75 | 100.0% | 11.5 / 11.3 |

### By orientation (subject on Blue / on Red)

| cell | subject win as Blue | as Red | draw as Blue | as Red |
|---|---|---|---|---|
| fang-cmd | 7.0% (3.4%-13.7%) | 12.0% (7.0%-19.8%) | 72.0% | 81.0% |
| fang-heur | 1.0% (0.2%-5.4%) | 21.0% (14.2%-30.0%) | 57.0% | 53.0% |
| mirror | 13.0% (7.8%-21.0%) | 22.0% (15.0%-31.1%) | 65.0% | 65.0% |
| control | 1.0% (0.2%-5.4%) | 29.0% (21.0%-38.5%) | 68.0% | 67.0% |
| fang-axe | 7.0% (3.4%-13.7%) | 16.0% (10.1%-24.4%) | 75.0% | 78.0% |
| fang-mov2 | 5.0% (2.2%-11.2%) | 8.0% (4.1%-15.0%) | 87.0% | 81.0% |
| fang-nopool | 7.0% (3.4%-13.7%) | 27.0% (19.3%-36.4%) | 62.0% | 65.0% |

### What the subject played (mean per game)

| cell | recruited | ability uses | spells cast | energy spent |
|---|---|---|---|---|
| fang-cmd | fangReaver 9.77, fangHunter 5.52, fangAxeguard 5.53, fangBerserker 1.30, cavalier 0.07 | bloodChallenge 7.84, focusedShot 12.60, reavingRush 5.83, charge 1.06, warlordsRush 2.93, ironSkin 14.94, frenzy 0.45 | warCry 3.52, bloodOath 2.84, ward 3.15, hunt 3.19, fireburst 3.09, mend 3.01 | 67.61 |
| fang-heur | fangBerserker 2.23, fangReaver 6.41, fangAxeguard 4.43, fangHunter 4.87, cavalier 1.72 | charge 1.94, secondWind 2.03, focusedShot 5.33 | fireburst 2.03, ward 2.09, mend 1.76 | 16.59 |
| mirror | fangReaver 9.97, fangAxeguard 5.45, fangHunter 5.74, fangBerserker 1.71, cavalier 0.12 | bloodChallenge 6.88, focusedShot 10.13, charge 0.98, reavingRush 6.40, warlordsRush 3.04, ironSkin 12.84, frenzy 0.39 | warCry 3.47, bloodOath 2.83, hunt 3.20, fireburst 3.05, ward 3.19, mend 3.04 | 59.03 |
| control | pikeman 9.02, archer 4.78, cavalier 1.52 | rally 30.73, charge 2.03, brace 12.93, secondWind 1.88, focusedShot 6.26 | fireburst 3.26, ward 3.53, mend 3.15 | 44.33 |
| fang-axe | fangReaver 9.02, fangHunter 5.19, fangAxeguard 5.12, fangBerserker 1.11, cavalier 0.04 | bloodChallenge 7.83, focusedShot 12.37, reavingRush 6.02, charge 1.11, warlordsRush 3.04, ironSkin 15.58, frenzy 0.36 | warCry 3.39, bloodOath 2.67, ward 2.97, hunt 3.03, fireburst 2.90, mend 2.74 | 68.00 |
| fang-mov2 | fangReaver 10.55, fangAxeguard 6.18, fangHunter 6.27, fangBerserker 1.59, cavalier 0.07 | bloodChallenge 8.43, focusedShot 14.39, reavingRush 6.81, charge 1.03, warlordsRush 3.72, ironSkin 16.93, frenzy 0.48 | warCry 3.76, bloodOath 3.07, hunt 3.42, fireburst 3.39, ward 3.38, mend 3.23 | 76.13 |
| fang-nopool | pikeman 9.25, cavalier 3.36, archer 6.40 | bloodChallenge 6.99, focusedShot 15.28, reavingRush 1.95, charge 2.34, warlordsRush 2.93 | mend 4.26, ward 3.67, fireburst 3.73 | 54.12 |

Replay checks: 70/70 games rebuilt from their logs (header + actions) with no mismatch. Commit 54552d0.
