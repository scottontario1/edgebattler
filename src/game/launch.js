// Launch options from the URL. Pure so it can be tested without a browser. The integration pass
// adds real game launches (skirmish, campaign) here; for now only the world demo exists.

export const DEMO_MAP_IDS = Object.freeze(['river_ford', 'campaign-road', 'campaign-woodland', 'campaign-crossing']);
export const DEFAULT_MAP_ID = 'river_ford';

/**
 * @param {string} search the query string, with or without the leading '?'
 * @returns {{ demo: 'world'|null, mapId: string, warnings: string[] }}
 */
export function parseLaunch(search = '') {
  const params = new URLSearchParams(search);
  const warnings = [];

  const requested = params.get('map');
  let mapId = DEFAULT_MAP_ID;
  if (requested) {
    // Accept the file-style spelling too (river-ford, campaign_road).
    const normalized = requested === 'river-ford' ? 'river_ford' : requested.replace(/_/g, '-');
    const match = DEMO_MAP_IDS.find((id) => id === requested || id === normalized);
    if (match) mapId = match;
    else warnings.push(`unknown map '${requested}', using ${DEFAULT_MAP_ID}`);
  }

  const demoParam = params.get('demo');
  if (demoParam && demoParam !== 'world') warnings.push(`unknown demo '${demoParam}', using world`);
  // Until real launches exist the world demo is also the default screen.
  return { demo: 'world', mapId, warnings };
}
