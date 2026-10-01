// Portrait rendering for unit and card faces. Three sources, picked by `portrait.kind` (see types.js):
//   image  a pre-cropped PNG (faction manifest `portrait` files), drawn as <img>
//   svg    procedural bust from portrait-svg.js, ids rewritten so copies never clash
//   glyph  class silhouette fallback
import { esc, uniqueIds } from './util.js';

const GLYPHS = {
  pikeman: '<path d="M12 1.5l3.2 5.5h-2.2V22h-2V7H8.8z" fill="#e9eef8" stroke="#7b8799" stroke-width="1" stroke-linejoin="round"/><path d="M6 15h12" stroke="#c9a24a" stroke-width="2"/>',
  archer: '<path d="M6 2.5c9 3 9 16 0 19" fill="none" stroke="#e9eef8" stroke-width="2" stroke-linecap="round"/><path d="M6 2.5v19M6 12h15M17.5 8.5L21 12l-3.5 3.5" fill="none" stroke="#c9a24a" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>',
  cavalier: '<path d="M6 22V13l4.5-9.5 3.2 2.3 4.8 1.4v3.4l-3.4 2 2.4 5.4V22z" fill="#e9eef8" stroke="#7b8799" stroke-width="1" stroke-linejoin="round"/><circle cx="13.2" cy="8" r="1" fill="#16223d"/>',
  unknown: '<circle cx="12" cy="8" r="4" fill="#e9eef8"/><path d="M4 22c0-5 3.5-8 8-8s8 3 8 8z" fill="#e9eef8"/>',
};

/**
 * @param {import('./types.js').Portrait | null | undefined} portrait
 * @param {{ alt?: string }} [options]
 * @returns {string} markup for the inside of a face frame (the frame is styled by the caller)
 */
export function portraitHTML(portrait, { alt = '' } = {}) {
  if (!portrait) return `<svg class="hud-portrait-glyph" viewBox="0 0 24 24" aria-hidden="true">${GLYPHS.unknown}</svg>`;
  if (portrait.kind === 'image') {
    return `<img class="hud-portrait-img" src="${esc(portrait.src)}" alt="${esc(alt)}" draggable="false">`;
  }
  if (portrait.kind === 'svg') return `<span class="hud-portrait-svg">${uniqueIds(portrait.svg)}</span>`;
  const body = GLYPHS[portrait.unitId] ?? GLYPHS.unknown;
  return `<svg class="hud-portrait-glyph" viewBox="0 0 24 24" aria-hidden="true">${body}</svg>`;
}

/**
 * Build an image portrait from the sprite manifests, for the app layer.
 * `factionsManifest` is public/sprites/factions-manifest.json; the shipped core units have no
 * pre-cropped portrait, so callers fall back to portraitSVG() for them.
 * @param {string} key spriteKey / variantId / unit id
 * @param {{ units: Record<string, { portrait?: string }> }} factionsManifest
 * @param {string} [base] asset base URL, default '/'
 * @returns {import('./types.js').Portrait | null}
 */
export function portraitFromManifest(key, factionsManifest, base = '/') {
  const entry = factionsManifest?.units?.[key];
  return entry?.portrait ? { kind: 'image', src: `${base}${entry.portrait}` } : null;
}
