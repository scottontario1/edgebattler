## river_ford: 100 seeds x 2 sides per cell, max 30 rounds, rarity gate uncommon 3 / rare 6

Subject win, loss and draw rates are over all 2N games (subject on Blue and on Red); the interval is a 95% Wilson interval. A draw is the round limit.

| cell | games | subject win | 95% | opponent win | draw | 95% draw | rounds (all / decided) | subject keep wins | villages captured s / o | anyone captured a village | subject / opp units lost |
|---|---|---|---|---|---|---|---|---|---|---|---|
| fang-cmd | 200 | 0.0% | 0.0%-1.9% | 0.5% | 99.5% | 97.2%-99.9% | 30.0 / 27.0 | 0 | 0.79 / 0.69 | 99.0% | 7.9 / 5.7 |
| fang-heur | 200 | 0.5% | 0.1%-2.8% | 4.5% | 95.0% | 91.0%-97.3% | 29.6 / 22.5 | 1 | 0.65 / 0.59 | 96.5% | 7.4 / 3.5 |
| mirror | 200 | 0.0% | 0.0%-1.9% | 0.0% | 100.0% | 98.1%-100.0% | 30.0 / 0.0 | 0 | 0.81 / 0.81 | 100.0% | 11.3 / 11.3 |
| control | 200 | 1.0% | 0.3%-3.6% | 1.0% | 98.0% | 95.0%-99.2% | 29.7 / 14.3 | 2 | 0.58 / 0.57 | 96.5% | 3.8 / 4.0 |
| fang-axe | 200 | 0.0% | 0.0%-1.9% | 0.5% | 99.5% | 97.2%-99.9% | 30.0 / 27.0 | 0 | 0.73 / 0.62 | 98.0% | 7.3 / 5.8 |
| fang-mov2 | 200 | 0.5% | 0.1%-2.8% | 1.0% | 98.5% | 95.7%-99.5% | 29.9 / 26.0 | 1 | 0.60 / 0.66 | 94.5% | 8.1 / 6.0 |
| fang-nopool | 200 | 1.0% | 0.3%-3.6% | 1.0% | 98.0% | 95.0%-99.2% | 29.8 / 20.0 | 2 | 0.72 / 0.63 | 96.5% | 8.8 / 5.8 |

### By orientation (subject on Blue / on Red)

| cell | subject win as Blue | as Red | draw as Blue | as Red |
|---|---|---|---|---|
| fang-cmd | 0.0% (0.0%-3.7%) | 0.0% (0.0%-3.7%) | 99.0% | 100.0% |
| fang-heur | 0.0% (0.0%-3.7%) | 1.0% (0.2%-5.4%) | 93.0% | 97.0% |
| mirror | 0.0% (0.0%-3.7%) | 0.0% (0.0%-3.7%) | 100.0% | 100.0% |
| control | 0.0% (0.0%-3.7%) | 2.0% (0.6%-7.0%) | 99.0% | 97.0% |
| fang-axe | 0.0% (0.0%-3.7%) | 0.0% (0.0%-3.7%) | 99.0% | 100.0% |
| fang-mov2 | 0.0% (0.0%-3.7%) | 1.0% (0.2%-5.4%) | 98.0% | 99.0% |
| fang-nopool | 1.0% (0.2%-5.4%) | 1.0% (0.2%-5.4%) | 97.0% | 99.0% |

### What the subject played (mean per game)

| cell | recruited | ability uses | spells cast | energy spent |
|---|---|---|---|---|
| fang-cmd | fangReaver 8.66, fangAxeguard 4.72, fangHunter 4.70, fangBerserker 0.79, cavalier 0.06 | bloodChallenge 9.22, focusedShot 11.82, reavingRush 4.36, warlordsRush 2.30, ironSkin 18.86, frenzy 0.20, charge 0.60 | warCry 3.20, bloodOath 2.53, hunt 2.80, fireburst 2.78, ward 2.77, mend 2.64 | 69.19 |
| fang-heur | fangBerserker 1.70, fangReaver 4.55, fangAxeguard 3.35, fangHunter 3.58, cavalier 1.31 | secondWind 2.69, charge 1.74, focusedShot 5.16 | mend 1.43, ward 1.83, fireburst 1.70 | 16.50 |
| mirror | fangReaver 9.97, fangAxeguard 5.86, fangHunter 5.96, fangBerserker 1.21, cavalier 0.04 | bloodChallenge 9.03, focusedShot 12.22, reavingRush 5.21, warlordsRush 1.90, ironSkin 19.83, frenzy 0.41, charge 0.49 | warCry 3.60, bloodOath 3.02, hunt 3.30, fireburst 3.21, ward 3.24, mend 3.15 | 71.25 |
| control | pikeman 7.99, archer 3.04, cavalier 1.14 | rally 25.82, brace 8.82, secondWind 2.36, charge 1.64, focusedShot 4.17 | mend 2.76, ward 3.25, fireburst 3.17 | 31.64 |
| fang-axe | fangReaver 8.29, fangAxeguard 4.48, fangHunter 4.55, fangBerserker 0.59, cavalier 0.06 | bloodChallenge 9.26, focusedShot 11.72, reavingRush 4.25, warlordsRush 2.24, ironSkin 19.41, charge 0.68, frenzy 0.22 | warCry 3.09, bloodOath 2.50, hunt 2.79, fireburst 2.71, ward 2.78, mend 2.61 | 69.68 |
| fang-mov2 | fangReaver 8.88, fangAxeguard 4.94, fangHunter 4.82, fangBerserker 0.80, cavalier 0.07 | bloodChallenge 9.34, reavingRush 4.98, charge 0.65, warlordsRush 2.12, focusedShot 12.74, ironSkin 20.01, frenzy 0.28 | warCry 3.21, bloodOath 2.64, hunt 2.91, fireburst 2.78, ward 2.91, mend 2.81 | 73.14 |
| fang-nopool | pikeman 8.30, cavalier 3.43, archer 5.35 | bloodChallenge 9.18, reavingRush 1.88, focusedShot 16.04, warlordsRush 2.29, charge 1.80 | mend 3.92, ward 3.70, fireburst 3.66 | 58.22 |

Replay checks: 70/70 games rebuilt from their logs (header + actions) with no mismatch. Commit 54552d0.
