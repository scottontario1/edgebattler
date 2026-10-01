export const DEMO_MAP_IDS=Object.freeze(['river_ford','campaign-road','campaign-woodland','campaign-crossing']);
export const DEFAULT_MAP_ID='river_ford';
export function parseLaunch(search=''){
 const params=new URLSearchParams(search),warnings=[],requested=params.get('map');
 let mapId=DEFAULT_MAP_ID;
 if(requested){const normalized=requested==='river-ford'?'river_ford':requested.replace(/_/g,'-');const found=DEMO_MAP_IDS.find(id=>id===requested||id===normalized);if(found)mapId=found;else warnings.push("unknown map '"+requested+"', using "+DEFAULT_MAP_ID);}
 const demoParam=params.get('demo');
 if(demoParam&&demoParam!=='world')warnings.push("unknown demo '"+demoParam+"', using menu");
 return {demo:demoParam==='world'?'world':null,mapId,warnings};
}
