> Historical output from earlier rules, not current main balance certification. [Retained findings](../../../../EXPERIMENT_SUMMARY.md).

League simulations: 100 seeds per matchup and map, 30-round limit, seeds 1..100, sides swapped when the armies differ. Replayed 1 games per cell from their logs.

"League" = League starting army + League pool + League commander (experiments/factions/iron-league/commander.mjs); "League (shipped AI)" = the same army and pool driven by the shipped heuristic; "baseline" = shipped army, shared pool, shipped heuristic. Win % has a 95% Wilson interval over all games of the cell (both sides).

| map | matchup (first army is the one whose win rate is shown) | games | first wins | second wins | draws | rounds (mean) | rounds, decided games | keep captures | villages captured / game (first / second) | first: recruits lost / kills | replay |
|---|---|---|---|---|---|---|---|---|---|---|---|
| river_ford | League v baseline | 200 | 0.0% (0.0%–1.9%) | 4.5% (2.4%–8.3%) | 95.5% (91.7%–97.6%) | 29.8 | 25.4 | 4.5% | 0.01 / 0.47 | 8.9 / 2.6 | ok |
| choke_gap1 | League v baseline | 200 | 0.0% (0.0%–1.9%) | 8.0% (5.0%–12.6%) | 92.0% (87.4%–95.0%) | 29.7 | 25.8 | 8.0% | 0.03 / 0.82 | 10.3 / 3.6 | ok |

League ability activations per League game (all sides that field the League):

| cell |  |
|---||

400 games in 34s on 3 workers; replay checks 2/2 ok.
