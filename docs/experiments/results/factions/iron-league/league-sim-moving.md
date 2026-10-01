> Historical output from earlier rules, not current main balance certification. [Retained findings](../../../../EXPERIMENT_SUMMARY.md).

League simulations: 100 seeds per matchup and map, 30-round limit, seeds 1..100, sides swapped when the armies differ. Replayed 1 games per cell from their logs.

"League" = League starting army + League pool + League commander (experiments/factions/iron-league/commander.mjs); "League (shipped AI)" = the same army and pool driven by the shipped heuristic; "baseline" = shipped army, shared pool, shipped heuristic. Win % has a 95% Wilson interval over all games of the cell (both sides).

| map | matchup (first army is the one whose win rate is shown) | games | first wins | second wins | draws | rounds (mean) | rounds, decided games | keep captures | villages captured / game (first / second) | first: recruits lost / kills | replay |
|---|---|---|---|---|---|---|---|---|---|---|---|
| river_ford | League v baseline | 200 | 0.0% (0.0%–1.9%) | 0.0% (0.0%–1.9%) | 100.0% (98.1%–100.0%) | 30.0 | — | 0.0% | 0.46 / 0.60 | 3.4 / 1.6 | ok |
| choke_gap1 | League v baseline | 200 | 0.0% (0.0%–1.9%) | 0.5% (0.1%–2.8%) | 99.5% (97.2%–99.9%) | 30.0 | 27.0 | 0.5% | 0.29 / 0.65 | 3.4 / 1.6 | ok |

League ability activations per League game (all sides that field the League):

| cell | rally |
|---|---|
| river_ford league v baseline | 27.4 |
| choke_gap1 league v baseline | 27.7 |

400 games in 34s on 3 workers; replay checks 2/2 ok.
