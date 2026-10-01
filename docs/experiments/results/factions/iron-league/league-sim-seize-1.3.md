> Historical output from earlier rules, not current main balance certification. [Retained findings](../../../../EXPERIMENT_SUMMARY.md).

League simulations: 100 seeds per matchup and map, 30-round limit, seeds 1..100, sides swapped when the armies differ. Replayed 1 games per cell from their logs.

"League" = League starting army + League pool + League commander (experiments/factions/iron-league/commander.mjs); "League (shipped AI)" = the same army and pool driven by the shipped heuristic; "baseline" = shipped army, shared pool, shipped heuristic. Win % has a 95% Wilson interval over all games of the cell (both sides).

| map | matchup (first army is the one whose win rate is shown) | games | first wins | second wins | draws | rounds (mean) | rounds, decided games | keep captures | villages captured / game (first / second) | first: recruits lost / kills | replay |
|---|---|---|---|---|---|---|---|---|---|---|---|
| river_ford | League v baseline | 200 | 2.0% (0.8%–5.0%) | 0.0% (0.0%–1.9%) | 98.0% (95.0%–99.2%) | 29.9 | 23.3 | 2.0% | 0.33 / 0.43 | 2.1 / 3.0 | ok |
| choke_gap1 | League v baseline | 200 | 0.0% (0.0%–1.9%) | 1.0% (0.3%–3.6%) | 99.0% (96.4%–99.7%) | 29.8 | 8.5 | 1.0% | 0.43 / 0.55 | 2.7 / 4.2 | ok |

League ability activations per League game (all sides that field the League):

| cell | rally | setPosition | preparedPosition | arcBurst |
|---|---|---|---|---|
| river_ford league v baseline | 64.4 | 54.6 | 19.9 | 0.0 |
| choke_gap1 league v baseline | 62.4 | 52.0 | 20.1 | 0.1 |

400 games in 42s on 3 workers; replay checks 2/2 ok.
