import RIVER_FORD from './river-ford.js';
import { CAMPAIGN_MAPS } from './campaign.js';

export { RIVER_FORD, CAMPAIGN_MAPS };
export const MAPS = Object.freeze(Object.fromEntries([RIVER_FORD, ...CAMPAIGN_MAPS].map((m) => [m.id, m])));
