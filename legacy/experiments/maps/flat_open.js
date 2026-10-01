// Experiment map: river_ford with all terrain removed. Same 16 x 12 grid, same keeps (C 2,10 and K 12,1)
// and the same three village plots, so rosters, deployment areas and distances are unchanged; every other
// tile is plains. Isolates combat from river, forest, mountain and road effects. Not in the shipped game.
const row = (r) => Array.from({ length: 16 }, () => 'G');
const layout = Array.from({ length: 12 }, (_, r) => row(r));
const put = (c, r, ch) => { layout[r][c] = ch; };
put(2, 10, 'C'); put(12, 1, 'K'); put(5, 2, 'V'); put(13, 4, 'V'); put(4, 8, 'V');
export default { id: 'flat_open', name: 'Flat open field', layout: layout.map((r) => r.join('')), hills: [] };
