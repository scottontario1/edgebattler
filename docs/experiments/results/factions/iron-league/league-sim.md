> Historical output from earlier rules, not current main balance certification. [Retained findings](../../../../EXPERIMENT_SUMMARY.md).

League simulations: 100 seeds per matchup and map, 30-round limit, seeds 1..100, sides swapped when the armies differ. Replayed 3 games per cell from their logs.

"League" = League starting army + League pool + League commander (experiments/factions/iron-league/commander.mjs); "League (shipped AI)" = the same army and pool driven by the shipped heuristic; "baseline" = shipped army, shared pool, shipped heuristic. Win % has a 95% Wilson interval over all games of the cell (both sides).

| map | matchup (first army is the one whose win rate is shown) | games | first wins | second wins | draws | rounds (mean) | rounds, decided games | keep captures | villages captured / game (first / second) | first: recruits lost / kills | replay |
|---|---|---|---|---|---|---|---|---|---|---|---|
| river_ford | League v baseline | 200 | 0.0% (0.0%–1.9%) | 0.0% (0.0%–1.9%) | 100.0% (98.1%–100.0%) | 30.0 | — | 0.0% | 0.05 / 0.43 | 1.6 / 3.3 | ok |
| river_ford | League (shipped AI) v baseline | 200 | 0.0% (0.0%–1.9%) | 0.5% (0.1%–2.8%) | 99.5% (97.2%–99.9%) | 30.0 | 23.0 | 0.5% | 0.55 / 0.57 | 2.4 / 2.6 | ok |
| river_ford | League v League (blue = first) | 100 | 0.0% (0.0%–3.7%) | 0.0% (0.0%–3.7%) | 100.0% (96.3%–100.0%) | 30.0 | — | 0.0% | 0.10 / 0.00 | 6.1 / 5.3 | ok |
| river_ford | baseline v baseline (blue = first) | 100 | 1.0% (0.2%–5.4%) | 2.0% (0.6%–7.0%) | 97.0% (91.5%–99.0%) | 29.5 | 12.0 | 3.0% | 1.12 / 0.10 | 4.5 / 4.2 | ok |
| choke_gap1 | League v baseline | 200 | 0.0% (0.0%–1.9%) | 0.0% (0.0%–1.9%) | 100.0% (98.1%–100.0%) | 30.0 | — | 0.0% | 0.05 / 0.55 | 1.7 / 6.9 | ok |
| choke_gap1 | League (shipped AI) v baseline | 200 | 0.0% (0.0%–1.9%) | 0.0% (0.0%–1.9%) | 100.0% (98.1%–100.0%) | 30.0 | — | 0.0% | 0.53 / 0.60 | 1.9 / 2.3 | ok |
| choke_gap1 | League v League (blue = first) | 100 | 0.0% (0.0%–3.7%) | 0.0% (0.0%–3.7%) | 100.0% (96.3%–100.0%) | 30.0 | — | 0.0% | 0.00 / 0.00 | 0.0 / 0.0 | ok |
| choke_gap1 | baseline v baseline (blue = first) | 100 | 0.0% (0.0%–3.7%) | 0.0% (0.0%–3.7%) | 100.0% (96.3%–100.0%) | 30.0 | — | 0.0% | 1.30 / 0.18 | 2.9 / 3.6 | ok |

League ability activations per League game (all sides that field the League):

| cell | rally | setPosition | preparedPosition | arcBurst | brace | focusedShot |
|---|---|---|---|---|---|---|
| river_ford league v baseline | 76.0 | 71.8 | 23.6 | 0.1 | 0.0 | 0.0 |
| river_ford league-heuristic v baseline | 37.8 | 0.0 | 0.0 | 0.0 | 18.0 | 4.0 |
| river_ford league v league | 92.2 | 88.1 | 10.5 | 0.5 | 0.0 | 0.0 |
| choke_gap1 league v baseline | 87.0 | 85.6 | 35.4 | 0.2 | 0.0 | 0.0 |
| choke_gap1 league-heuristic v baseline | 32.0 | 0.0 | 0.0 | 0.0 | 13.7 | 2.7 |
| choke_gap1 league v league | 93.2 | 92.9 | 0.0 | 0.0 | 0.0 | 0.0 |

1200 games in 129s on 3 workers; replay checks 24/24 ok.
