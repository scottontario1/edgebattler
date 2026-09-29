// Shared string helpers for the HUD template modules in src/ui/.
export const esc = (s) => String(s).replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));

// Each inserted copy of a portrait SVG needs its own ids: duplicate gradient/clip ids resolve
// to the first copy in the document, which breaks when that copy is hidden (display:none).
let svgSeq = 0;
export function uniqueIds(svg) {
  const n = ++svgSeq;
  return svg.replace(/id="([^"]+)"/g, `id="$1_${n}"`)
    .replace(/url\(#([^)]+)\)/g, `url(#$1_${n})`)
    .replace(/href="#([^"]+)"/g, `href="#$1_${n}"`);
}
