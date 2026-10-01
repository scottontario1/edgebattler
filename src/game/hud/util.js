// Shared string helpers for the HUD templates. Everything here is pure.

const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

/** Escape text for use in HTML content or a double-quoted attribute. */
export function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, (ch) => ESCAPES[ch]);
}

let svgSequence = 0;

/**
 * Give an inline SVG its own ids. Duplicate gradient/clip ids resolve to the first copy in the
 * document, which breaks when that copy is hidden (display:none) or re-rendered.
 */
export function uniqueIds(svg) {
  svgSequence += 1;
  const suffix = `_h${svgSequence}`;
  return String(svg)
    .replace(/\bid="([^"]+)"/g, `id="$1${suffix}"`)
    .replace(/url\(#([^)]+)\)/g, `url(#$1${suffix})`)
    .replace(/href="#([^"]+)"/g, `href="#$1${suffix}"`);
}

/** Join class names, skipping falsy entries. */
export function cx(...names) {
  return names.filter(Boolean).join(' ');
}

const kebab = (key) => key.replace(/[A-Z]/g, (ch) => `-${ch.toLowerCase()}`);

/**
 * Attributes that make an element emit an intent when clicked:
 * `intentAttrs('recruit', { cardId: 'c1' })` -> ` data-intent="recruit" data-card-id="c1"`.
 * The Hud turns these attributes back into `{ type: 'recruit', cardId: 'c1' }`.
 */
export function intentAttrs(type, payload = {}) {
  let out = ` data-intent="${esc(type)}"`;
  for (const [key, value] of Object.entries(payload)) {
    if (value === undefined || value === null) continue;
    out += ` data-${kebab(key)}="${esc(value)}"`;
  }
  return out;
}

/** A disabled control carries `disabled` plus the reason as its tooltip. */
export function stateAttrs({ enabled = true, reason = '' } = {}) {
  const title = reason ? ` title="${esc(reason)}"` : '';
  return enabled ? title : ` disabled aria-disabled="true"${title}`;
}

/** `n` + singular/plural noun. */
export function plural(n, noun, many = `${noun}s`) {
  return `${n} ${n === 1 ? noun : many}`;
}

/** Clamp a ratio to 0..100 for use as a CSS percentage. */
export function pct(value, max) {
  if (!max || max <= 0) return 0;
  return Math.max(0, Math.min(100, (value / max) * 100));
}
