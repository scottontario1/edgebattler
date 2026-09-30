League simulations: 100 seeds per matchup and map, 30-round limit, seeds 1..100, sides swapped when the armies differ. Replayed 1 games per cell from their logs.

"League" = League starting army + League pool + League commander (experiments/factions/iron-league/commander.mjs); "League (shipped AI)" = the same army and pool driven by the shipped heuristic; "baseline" = shipped army, shared pool, shipped heuristic. Win % has a 95% Wilson interval over all games of the cell (both sides).

| map | matchup (first army is the one whose win rate is shown) | games | first wins | second wins | draws | rounds (mean) | rounds, decided games | keep captures | villages captured / game (first / second) | first: recruits lost / kills | replay |
|---|---|---|---|---|---|---|---|---|---|---|---|
| river_ford | League v baseline | 200 | 1.5% (0.5%–4.3%) | 0.0% (0.0%–1.9%) | 98.5% (95.7%–99.5%) | 29.9 | 24.7 | 1.5% | 0.40 / 0.45 | 2.6 / 3.1 | ok |
| choke_gap1 | League v baseline | 200 | 0.0% (0.0%–1.9%) | 1.0% (0.3%–3.6%) | 99.0% (96.4%–99.7%) | 29.8 | 10.5 | 1.0% | 0.53 / 0.63 | 3.1 / 3.0 | ok |

League ability activations per League game (all sides that field the League):

| cell | rally | setPosition | preparedPosition | arcBurst |
|---|---|---|---|---|
| river_ford league v baseline | 58.6 | 44.8 | 17.5 | 0.1 |
| choke_gap1 league v baseline | 44.6 | 27.5 | 11.6 | 0.1 |

400 games in 29s on 3 workers; replay checks 2/2 ok.
