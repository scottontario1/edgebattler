> Historical output from earlier rules, not current main balance certification. [Retained findings](../../../../EXPERIMENT_SUMMARY.md).

League simulations: 100 seeds per matchup and map, 30-round limit, seeds 1..100, sides swapped when the armies differ. Replayed 1 games per cell from their logs.

"League" = League starting army + League pool + League commander (experiments/factions/iron-league/commander.mjs); "League (shipped AI)" = the same army and pool driven by the shipped heuristic; "baseline" = shipped army, shared pool, shipped heuristic. Win % has a 95% Wilson interval over all games of the cell (both sides).

| map | matchup (first army is the one whose win rate is shown) | games | first wins | second wins | draws | rounds (mean) | rounds, decided games | keep captures | villages captured / game (first / second) | first: recruits lost / kills | replay |
|---|---|---|---|---|---|---|---|---|---|---|---|
| river_ford | League v baseline | 200 | 0.0% (0.0%–1.9%) | 0.0% (0.0%–1.9%) | 100.0% (98.1%–100.0%) | 30.0 | — | 0.0% | 0.16 / 0.43 | 1.7 / 3.3 | ok |
| choke_gap1 | League v baseline | 200 | 0.0% (0.0%–1.9%) | 0.5% (0.1%–2.8%) | 99.5% (97.2%–99.9%) | 29.9 | 9.0 | 0.5% | 0.24 / 0.55 | 2.1 / 6.1 | ok |

League ability activations per League game (all sides that field the League):

| cell | rally | setPosition | preparedPosition | arcBurst |
|---|---|---|---|---|
| river_ford league v baseline | 71.9 | 65.6 | 22.2 | 0.1 |
| choke_gap1 league v baseline | 79.1 | 74.9 | 30.7 | 0.2 |

400 games in 40s on 3 workers; replay checks 2/2 ok.
