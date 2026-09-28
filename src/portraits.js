// Procedural SVG bust portraits in a painted anime style.
// viewBox is 100 x 120. The head is turned slightly to the viewer's right
// (face midline x = 52), eyes sit at y = 57.5, shoulders fill y 86-120.
// portraitSVG(unit, { variant }) returns a self-contained SVG string:
//   'full' (default) — framed with a faction-coloured painted backdrop
//   'bust'           — transparent background, for the portrait that breaks
//                      out of the primary unit card.
// Every call gets a fresh id prefix, so the same unit can be on screen twice.

const FACTION = {
  blue: {
    ink: '#0a1224',
    bg1: '#5c8fe0', bg2: '#0a1733', cloth: '#2f62c4', clothDark: '#183a80', trim: '#e0b85a',
    rim: '#a9d0ff', gem: '#49c6ff', steel: ['#fbfdff', '#c8d2e0', '#7b8799', '#e4ebf4'], edge: '#56617a',
  },
  red: {
    ink: '#1e0808',
    bg1: '#c9503c', bg2: '#1c0707', cloth: '#c0392b', clothDark: '#6a1812', trim: '#d0a64e',
    rim: '#ffb592', gem: '#ff5a3c', steel: ['#d6d4d8', '#8e8b93', '#34313a', '#a9a6ae'], edge: '#2b2830',
  },
};

// Per-unit character notes (gender cues, expression, marks). Units not listed
// get a deterministic persona derived from their id.
const PERSONA = {
  aldric: { fem: false, young: true, mood: 'calm', mouth: 'smile' },
  brenna: { fem: true, mood: 'determined', mouth: 'neutral', freckles: true },
  wren: { fem: false, young: true, mood: 'calm', mouth: 'smirk', freckles: true },
  elowen: { fem: true, mood: 'soft', mouth: 'smile', elf: true },
  garrick: { fem: false, mood: 'stern', mouth: 'neutral' },
  morvath: { fem: false, mood: 'angry', mouth: 'snarl', scar: 'eye' },
  dreg: { fem: false, mood: 'angry', mouth: 'frown', stubble: true, scar: 'nose' },
  sable: { fem: true, mood: 'sly', mouth: 'smirk', mole: true },
  vex: { fem: false, gaunt: true, mood: 'sly', mouth: 'grin', paint: true },
  grisk: { fem: false, mood: 'angry', mouth: 'grin', scar: 'cheek', earring: true },
};

const F = (n) => Math.round(n * 100) / 100;

function norm(h) {
  h = h.replace('#', '');
  return h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
}
function rgb(h) {
  const n = parseInt(norm(h), 16);
  return [n >> 16, (n >> 8) & 255, n & 255];
}
function hex(c) {
  const k = (v) => Math.max(0, Math.min(255, Math.round(v)));
  return '#' + ((1 << 24) | (k(c[0]) << 16) | (k(c[1]) << 8) | k(c[2])).toString(16).slice(1);
}
export function mix(a, b, t) {
  const A = rgb(a), B = rgb(b);
  return hex(A.map((v, i) => v + (B[i] - v) * t));
}
export const shade = (h, amt) => (amt >= 0 ? mix(h, '#ffffff', amt) : mix(h, '#000000', -amt));

function rng(str) {
  let h = 1779033703 ^ str.length;
  for (const ch of str) {
    h = Math.imul(h ^ ch.charCodeAt(0), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  };
}

function persona(u) {
  if (PERSONA[u.id]) return PERSONA[u.id];
  const r = rng(u.id || u.name || 'x');
  const fem = !u.look.beard && r() < 0.5;
  return {
    fem,
    mood: u.faction === 'red' ? 'angry' : ['calm', 'determined', 'soft'][Math.floor(r() * 3)],
    mouth: u.faction === 'red' ? 'frown' : 'smile',
  };
}

// Spine of a hair lock: cubic from root to tip, bent sideways by b1 / b2
// (same sign = C curve, opposite = S curve).
function spine(rx, ry, tx, ty, b1, b2) {
  const dx = tx - rx, dy = ty - ry, L = Math.hypot(dx, dy) || 1;
  const nx = -dy / L, ny = dx / L;
  return {
    nx, ny,
    c1: [rx + dx / 3 + nx * b1, ry + dy / 3 + ny * b1],
    c2: [rx + (2 * dx) / 3 + nx * b2, ry + (2 * dy) / 3 + ny * b2],
  };
}
// A tapered, curved hair lock from root (rx, ry) to tip (tx, ty), w wide at the root.
function lock(rx, ry, tx, ty, w, b1, b2 = b1) {
  const { nx, ny, c1, c2 } = spine(rx, ry, tx, ty, b1, b2);
  const h = w / 2;
  return `M${F(rx - nx * h)} ${F(ry - ny * h)} C${F(c1[0] - nx * h * 0.85)} ${F(c1[1] - ny * h * 0.85)} ${F(c2[0] - nx * h * 0.45)} ${F(c2[1] - ny * h * 0.45)} ${F(tx)} ${F(ty)} C${F(c2[0] + nx * h * 0.45)} ${F(c2[1] + ny * h * 0.45)} ${F(c1[0] + nx * h * 0.85)} ${F(c1[1] + ny * h * 0.85)} ${F(rx + nx * h)} ${F(ry + ny * h)} Z`;
}
// Thin strand line along a lock, offset sideways by `off` (for shine / partings).
function strand(rx, ry, tx, ty, b1, b2 = b1, off = 0, a = 0.1, b = 0.75) {
  const { nx, ny, c1, c2 } = spine(rx, ry, tx, ty, b1, b2);
  const P0 = [rx + nx * off, ry + ny * off], P3 = [tx, ty];
  const C1 = [c1[0] + nx * off * 0.8, c1[1] + ny * off * 0.8], C2 = [c2[0] + nx * off * 0.4, c2[1] + ny * off * 0.4];
  const B = (t) => [0, 1].map((k) => (1 - t) ** 3 * P0[k] + 3 * (1 - t) ** 2 * t * C1[k] + 3 * (1 - t) * t * t * C2[k] + t ** 3 * P3[k]);
  const p0 = B(a), p1 = B((a + b) / 2), p2 = B(b);
  const q = [2 * p1[0] - (p0[0] + p2[0]) / 2, 2 * p1[1] - (p0[1] + p2[1]) / 2];
  return `M${F(p0[0])} ${F(p0[1])} Q${F(q[0])} ${F(q[1])} ${F(p2[0])} ${F(p2[1])}`;
}

// What covers the crown of the head; mirrors each class's battlefield model.
const HEADWEAR_COVERS = { knight: 'helm', cavalier: 'helm', warlord: 'helm', brigand: 'band', archer: 'hood', mage: 'hat', lord: 'none' };

function faceD(P) {
  const j = P.fem ? -0.8 : P.gaunt ? 0 : 1.2;
  const cy = P.fem ? 77.5 : P.young ? 78 : 79.2;
  return `M33.5 49 C33.5 37 41 30.5 50.5 30.5 C60 30.5 67 37 67 49 C67 57 ${F(66 + j * 0.4)} 62.5 ${F(62.5 + j)} 68 C${F(59 + j * 0.5)} 73 55 ${cy} 51.5 ${cy} C48 ${cy} ${F(43.5 - j)} ${F(75 - j)} ${F(40 - j)} 70.5 C${F(36.5 - j * 0.6)} 66 33.5 58 33.5 49 Z`;
}

function defs(c) {
  const { id, L, f, skin, skinSh } = c;
  const st = f.steel;
  return `
    <radialGradient id="${id}bg" cx="42%" cy="30%" r="85%">
      <stop offset="0" stop-color="${shade(f.bg1, 0.15)}"/><stop offset="0.45" stop-color="${f.bg1}"/><stop offset="1" stop-color="${f.bg2}"/>
    </radialGradient>
    <radialGradient id="${id}vig" cx="50%" cy="42%" r="75%">
      <stop offset="0.6" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity="0.55"/>
    </radialGradient>
    <linearGradient id="${id}skin" x1="0" y1="0" x2="1" y2="0.25">
      <stop offset="0" stop-color="${shade(skin, 0.14)}"/><stop offset="0.5" stop-color="${skin}"/><stop offset="1" stop-color="${mix(skin, skinSh, 0.55)}"/>
    </linearGradient>
    <linearGradient id="${id}skinB" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${shade(skin, 0.08)}"/><stop offset="1" stop-color="${mix(skin, skinSh, 0.7)}"/>
    </linearGradient>
    <linearGradient id="${id}hair" x1="0.1" y1="0" x2="0.4" y2="1">
      <stop offset="0" stop-color="${shade(L.hair, 0.28)}"/><stop offset="0.45" stop-color="${L.hair}"/><stop offset="1" stop-color="${shade(L.hair, -0.38)}"/>
    </linearGradient>
    <linearGradient id="${id}hairD" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${shade(L.hair, -0.18)}"/><stop offset="1" stop-color="${shade(L.hair, -0.5)}"/>
    </linearGradient>
    <linearGradient id="${id}steel" x1="0" y1="0" x2="0.55" y2="1">
      <stop offset="0" stop-color="${st[0]}"/><stop offset="0.34" stop-color="${st[1]}"/><stop offset="0.5" stop-color="${st[2]}"/>
      <stop offset="0.53" stop-color="${mix(st[2], '#b08a5a', 0.45)}"/><stop offset="0.78" stop-color="${mix(st[1], '#c89a6a', 0.25)}"/><stop offset="1" stop-color="${mix(st[3], f.rim, 0.35)}"/>
    </linearGradient>
    <linearGradient id="${id}steelV" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${st[0]}"/><stop offset="0.4" stop-color="${st[1]}"/><stop offset="0.56" stop-color="${st[2]}"/><stop offset="0.6" stop-color="${mix(st[2], '#b08a5a', 0.4)}"/><stop offset="1" stop-color="${mix(st[1], f.rim, 0.3)}"/>
    </linearGradient>
    <linearGradient id="${id}gold" x1="0" y1="0" x2="0.3" y2="1">
      <stop offset="0" stop-color="#fff2b8"/><stop offset="0.45" stop-color="${f.trim}"/><stop offset="1" stop-color="#7a5418"/>
    </linearGradient>
    <linearGradient id="${id}cloth" x1="0" y1="0" x2="0.8" y2="1">
      <stop offset="0" stop-color="${shade(f.cloth, 0.2)}"/><stop offset="0.5" stop-color="${f.cloth}"/><stop offset="1" stop-color="${shade(f.cloth, -0.35)}"/>
    </linearGradient>
    <linearGradient id="${id}clothD" x1="0" y1="0" x2="0.6" y2="1">
      <stop offset="0" stop-color="${shade(f.clothDark, 0.12)}"/><stop offset="1" stop-color="${shade(f.clothDark, -0.4)}"/>
    </linearGradient>
    <linearGradient id="${id}leather" x1="0" y1="0" x2="0.7" y2="1">
      <stop offset="0" stop-color="#8a6240"/><stop offset="1" stop-color="#3e2716"/>
    </linearGradient>
    <linearGradient id="${id}fur" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#9a8672"/><stop offset="0.5" stop-color="#5e4c3c"/><stop offset="1" stop-color="#2e241c"/>
    </linearGradient>
    <linearGradient id="${id}bear" x1="0.2" y1="0" x2="0.6" y2="1">
      <stop offset="0" stop-color="#9a7a62"/><stop offset="0.45" stop-color="#6a5040"/><stop offset="1" stop-color="#2e2018"/>
    </linearGradient>
    <linearGradient id="${id}bone" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#fff8e6"/><stop offset="0.6" stop-color="#d8c8a2"/><stop offset="1" stop-color="#8a7650"/>
    </linearGradient>
    <linearGradient id="${id}iris" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${shade(L.eyes, -0.55)}"/><stop offset="0.5" stop-color="${L.eyes}"/><stop offset="1" stop-color="${shade(L.eyes, 0.45)}"/>
    </linearGradient>
    <linearGradient id="${id}scl" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#cbbfcc"/><stop offset="0.5" stop-color="#fbf6f4"/><stop offset="1" stop-color="#fffdfb"/>
    </linearGradient>
    <radialGradient id="${id}glow" cx="50%" cy="50%" r="50%">
      <stop offset="0" stop-color="${f.rim}" stop-opacity="0.55"/><stop offset="1" stop-color="${f.rim}" stop-opacity="0"/>
    </radialGradient>
    <filter id="${id}soft" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="0.9"/></filter>
    <filter id="${id}soft2" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="2.2"/></filter>
    <pattern id="${id}mail" width="2.4" height="2" patternUnits="userSpaceOnUse">
      <circle cx="1.2" cy="1" r="0.95" fill="none" stroke="#e8edf4" stroke-opacity="0.55" stroke-width="0.4"/>
      <circle cx="0" cy="0" r="0.95" fill="none" stroke="#39404c" stroke-opacity="0.6" stroke-width="0.4"/>
    </pattern>
    <filter id="${id}ink" x="-10%" y="-10%" width="120%" height="120%" color-interpolation-filters="sRGB">
      <feMorphology in="SourceAlpha" operator="dilate" radius="0.75" result="fat"/>
      <feFlood flood-color="${f.ink}"/><feComposite in2="fat" operator="in" result="line"/>
      <feOffset in="SourceAlpha" dx="-1.1" dy="0.7" result="shift"/>
      <feComposite in="SourceAlpha" in2="shift" operator="out" result="edge"/>
      <feGaussianBlur in="edge" stdDeviation="0.35" result="edgeS"/>
      <feFlood flood-color="${f.rim}" flood-opacity="0.7"/><feComposite in2="edgeS" operator="in" result="rimL"/>
      <feComposite in="rimL" in2="SourceAlpha" operator="in" result="rim"/>
      <feMerge><feMergeNode in="line"/><feMergeNode in="SourceGraphic"/><feMergeNode in="rim"/></feMerge>
    </filter>
    <linearGradient id="${id}key" x1="0.1" y1="0" x2="0.9" y2="1">
      <stop offset="0" stop-color="#ffd9a0" stop-opacity="0.32"/><stop offset="0.45" stop-color="#ffd9a0" stop-opacity="0"/>
      <stop offset="0.7" stop-color="#1a1030" stop-opacity="0"/><stop offset="1" stop-color="#1a1030" stop-opacity="0.35"/>
    </linearGradient>
    <clipPath id="${id}face"><path d="${faceD(c.P)}"/></clipPath>
    <filter id="${id}grain" x="0" y="0" width="100%" height="100%">
      <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" seed="7"/>
      <feColorMatrix values="0 0 0 0 0.5  0 0 0 0 0.47  0 0 0 0 0.4  0 0 0 0.55 0"/>
      <feComposite operator="in" in2="SourceGraphic"/>
    </filter>`;
}

/* ---------------------------------------------------------------- backdrop */

function backdrop(c) {
  const { id, f, r } = c;
  let dots = '';
  for (let i = 0; i < 7; i++) {
    const x = F(r() * 100), y = F(r() * 70), rad = F(2 + r() * 6);
    dots += `<circle cx="${x}" cy="${y}" r="${rad}" fill="${f.rim}" opacity="${F(0.05 + r() * 0.1)}"/>`;
  }
  return `<rect width="100" height="120" fill="url(#${id}bg)"/>
    <path d="M-10 0 L30 0 L70 120 L40 120 Z M40 0 L55 0 L100 100 L100 120 L90 120 Z" fill="#fff" opacity="0.06"/>
    ${dots}
    <ellipse cx="50" cy="56" rx="40" ry="42" fill="url(#${id}glow)"/>`;
}

/* -------------------------------------------------------- behind the body */

function behind(c) {
  const { id, u, f } = c;
  let s = '';
  if (u.cls === 'archer') {
    // arrows over the far shoulder; the longbow is held in front (see front())
    const feather = shade(f.cloth, 0.35);
    for (const [x, y, a] of [[80, 66, 22], [86, 70, 30], [74, 70, 14]]) {
      s += `<g transform="translate(${x} ${y}) rotate(${a})">
        <path d="M0 0 L0 40" stroke="#7a5534" stroke-width="1.1"/>
        <path d="M0 1 L-2.6 -2 L-2.6 9 L0 11 Z M0 1 L2.6 -2 L2.6 9 L0 11 Z" fill="${feather}" stroke="${shade(feather, -0.3)}" stroke-width="0.3"/>
      </g>`;
    }
  }
  // Weapons match the unit's battlefield model: lances for knights and the cavalier, the
  // boss's great axe, the brigand's hand axe, the mage's crystal staff.
  if (u.cls === 'knight' || u.cls === 'cavalier') s += lance(c, 73, 124, 80, 30);
  if (u.cls === 'warlord') s += greatAxe(c);
  if (u.cls === 'brigand') s += handAxe(c);
  if (u.cls === 'mage' && u.faction !== 'red') s += staff(c);
  if (u.cls === 'warlord') {
    // inside of the bear-pelt hood, visible around the bald head
    s += `<path d="M26 96 C20 66 26 26 50.5 22 C75 26 81 66 75 96 Z" fill="#1e140e"/>`;
  }
  if (HEADWEAR_COVERS[u.cls] === 'hood') {
    // hood shell seen from the inside around the head
    s += `<path d="M22 100 C14 62 24 18 50 14 C76 18 86 62 78 100 Z" fill="${c.hoodIn}"/>`;
  }
  if (u.cls === 'cavalier') s += plume(c);
  return s;
}

// Lance from (x0, y0) to the base of its steel point at (x1, y1), faction pennant below the tip.
function lance(c, x0, y0, x1, y1) {
  const { id, f } = c;
  const L = Math.hypot(x1 - x0, y1 - y0);
  const ang = (Math.atan2(y1 - y0, x1 - x0) * 180) / Math.PI;
  const pen = f.cloth;
  return `<g transform="translate(${x0} ${y0}) rotate(${F(ang)})">
      <path d="M0 -1.5 L${F(L)} -1 L${F(L)} 1 L0 1.5 Z" fill="#5e3c22"/>
      <path d="M0 -0.8 L${F(L)} -0.5" stroke="#a87a4e" stroke-width="0.6"/>
      <path d="M${F(L - 12)} 0 L${F(L - 26)} 0 L${F(L - 23)} 12 L${F(L - 18.5)} 7.5 L${F(L - 14)} 12.5 Z" fill="${pen}" stroke="url(#${id}gold)" stroke-width="0.6"/>
      <path d="M${F(L - 14)} 1.5 L${F(L - 24)} 1.5" stroke="#fff" stroke-opacity="0.35" stroke-width="0.8"/>
      <rect x="${F(L - 2.5)}" y="-2" width="3" height="4" fill="url(#${id}gold)"/>
      <path d="M${F(L)} -2.6 L${F(L + 14)} 0 L${F(L)} 2.6 Z" fill="url(#${id}steelV)"/>
      <path d="M${F(L + 1)} -0.8 L${F(L + 12)} -0.1" stroke="#fff" stroke-width="0.6" stroke-opacity="0.9"/>
    </g>`;
}

// Morvath's two-handed axe (KayKit 2H_Axe), haft behind the far shoulder, blades up top.
function greatAxe(c) {
  const { id } = c;
  return `<path d="M66 124 L84 36" stroke="#4a2e1a" stroke-width="3.2" stroke-linecap="round"/>
    <path d="M67 118 L83.5 40" stroke="#8a5a36" stroke-width="0.8"/>
    <path d="M83 40 C74 36 70 28 71 18 C76 24 82 26 86 25 Z" fill="url(#${id}steel)" stroke="#111" stroke-width="0.6"/>
    <path d="M86 40 C96 42 101 50 101 60 C95 54 89 52 85 53 Z" fill="url(#${id}steelV)" stroke="#111" stroke-width="0.6"/>
    <path d="M72 20 C73 28 77 33 83 37" stroke="#fff" stroke-opacity="0.8" stroke-width="0.9" fill="none"/>
    <rect x="81" y="33" width="6" height="8" rx="1" transform="rotate(12 84 37)" fill="url(#${id}gold)"/>`;
}

// Grisk's hand axe (KayKit 1H_Axe) resting on the far shoulder.
function handAxe(c) {
  const { id } = c;
  return `<path d="M70 124 L82 58" stroke="#4a2e1a" stroke-width="2.6" stroke-linecap="round"/>
    <path d="M71 118 L81.5 61" stroke="#8a5a36" stroke-width="0.7"/>
    <path d="M80 60 C84 52 90 48 96 48 C95 56 95 64 97 70 C91 68 85 66 80 67 Z" fill="url(#${id}steel)" stroke="#111" stroke-width="0.6"/>
    <path d="M95 50 C94.5 57 94.5 63 96 68" stroke="#fff" stroke-opacity="0.85" stroke-width="0.8" fill="none"/>`;
}

// Elowen's crystal staff (KayKit 2H_Staff), behind the far shoulder, crystal above the hat brim.
function staff(c) {
  const { id, f } = c;
  const glow = '#7fd6ff';
  return `<path d="M78 124 L85.5 30" stroke="#5a3a1e" stroke-width="2.4" stroke-linecap="round"/>
    <path d="M78.8 120 L85.8 33" stroke="#a87a4e" stroke-width="0.6"/>
    <circle cx="86" cy="22" r="9" fill="${glow}" opacity="0.35" filter="url(#${id}soft2)"/>
    <path d="M82 31 C80 26 82 21 84 19 M90 31 C92 26 90 21 88 19" stroke="url(#${id}gold)" stroke-width="1.3" fill="none"/>
    <path d="M86 12 L90 21 L86 30 L82 21 Z" fill="${glow}" stroke="${shade(f.cloth, -0.3)}" stroke-width="0.5"/>
    <path d="M86 12 L90 21 L86 21 Z" fill="#fff" opacity="0.7"/>`;
}

function plume(c) {
  const { id, f } = c;
  const col = shade(f.cloth, 0.15);
  return `<path d="M60 26 C64 12 78 4 96 8 C90 10 86 13 84 16 C92 15 98 18 102 23 C94 23 88 25 84 28 C90 29 94 33 96 38 C86 34 74 33 64 34 Z" fill="${col}"/>
    <path d="M62 30 C70 16 82 10 96 9 M64 32 C74 22 88 18 100 22 M64 33 C76 30 86 31 95 36" stroke="${shade(col, 0.4)}" stroke-width="0.7" fill="none"/>
    <path d="M62 32 C72 26 82 24 92 26" stroke="${shade(col, -0.4)}" stroke-width="0.9" fill="none"/>`;
}

/* ------------------------------------------------------------- back hair */

function backHair(c) {
  const { id, L, u, r } = c;
  const cover = HEADWEAR_COVERS[u.cls];
  if (L.style === 'none') return '';
  if (L.style === 'long') {
    // long curtain behind the shoulders with a jagged, locky hem
    let hem = '';
    const n = 9;
    for (let i = 0; i <= n; i++) {
      const x = 76 - (52 * i) / n;
      const y = 112 + (i % 2 ? 6 + r() * 3 : r() * 3);
      hem += ` L${F(x)} ${F(y)}`;
    }
    let lines = '';
    for (let i = 0; i < 7; i++) {
      const x = 28 + i * 7.5 + r() * 2;
      lines += `<path d="M${F(x)} 60 Q${F(x + (x < 50 ? -4 : 4))} 88 ${F(x + (x < 50 ? -2 : 2))} 114" stroke="${shade(L.hair, -0.5)}" stroke-opacity="0.5" stroke-width="0.6" fill="none"/>`;
    }
    return `<path d="M29 46 C22 66 20 92 24 112 ${hem} C80 92 78 66 71 46 C69 34 62 26 50 26 C38 26 31 34 29 46 Z" fill="url(#${id}hairD)"/>${lines}`;
  }
  if (cover === 'helm' || cover === 'band') return '';
  // short styles: nape mass behind the neck
  const len = L.style === 'swept' ? 82 : 74;
  return `<path d="M31 50 C28 62 30 ${len - 4} 35 ${len} L42 ${len - 3} L48 ${len + 2} L55 ${len - 2} L62 ${len + 1} L66 ${len - 4} C71 ${len - 10} 72 60 69 50 Z" fill="url(#${id}hairD)"/>`;
}

/* ------------------------------------------------------------------ body */

function body(c) {
  const { id, u, f } = c;
  const steel = `url(#${id}steel)`, steelV = `url(#${id}steelV)`, gold = `url(#${id}gold)`;
  const edge = f.edge;
  const hl = (d, o = 0.7, w = 1.1) => `<path d="${d}" stroke="#fff" stroke-opacity="${o}" stroke-width="${w}" fill="none" stroke-linecap="round"/>`;
  const capeBack = `<path d="M-4 124 L-2 100 C8 91 26 85 44 83 L60 83 C78 85 94 91 102 100 L104 124 Z" fill="url(#${id}clothD)"/>`;

  switch (u.cls) {
    case 'knight':
    case 'cavalier': {
      const emblem = u.faction === 'blue'
        ? `<path d="M52 106 l2.2 4.6 5 .5 -3.8 3.4 1.1 5 -4.5 -2.6 -4.5 2.6 1.1 -5 -3.8 -3.4 5 -.5 Z" fill="${gold}"/>`
        : `<path d="M47 108 L57 108 L52 120 Z" fill="${f.cloth}" stroke="${gold}" stroke-width="0.8"/>`;
      return `${capeBack}
        <path d="M24 124 C24 106 34 96 52 96 C70 96 80 106 80 124 Z" fill="${steel}" stroke="${edge}" stroke-width="0.6"/>
        <path d="M52 97 L52 124" stroke="${edge}" stroke-width="0.8"/>${hl('M50.5 99 L50.5 122', 0.45, 0.8)}
        ${emblem}
        <path d="M40 83 C44 88 60 88 64 83 L67 95 C60 99 44 99 37 95 Z" fill="${steelV}" stroke="${edge}" stroke-width="0.6"/>
        <path d="M38.5 89.5 C46 93.5 58 93.5 65.5 89.5" stroke="${edge}" stroke-width="0.6" fill="none"/>
        <path d="M37 95 C44 99 60 99 67 95" stroke="${gold}" stroke-width="1.3" fill="none"/>
        <path d="M-6 124 C-2 112 8 105 21 105 C30 105 36 109 38 114 C27 111 10 116 -6 128 Z" fill="${steel}" stroke="${edge}" stroke-width="0.6"/>
        <path d="M-6 116 C-2 103 10 96 23 96 C32 96 38 101 40 107 C28 103 10 108 -6 120 Z" fill="${steel}" stroke="${edge}" stroke-width="0.6"/>
        <path d="M-6 108 C-4 94 9 86 24 87 C34 88 40 94 41 101 C30 97 12 101 -6 112 Z" fill="${steel}" stroke="${edge}" stroke-width="0.6"/>
        <path d="M-6 112 C12 101 30 97 41 101" stroke="${gold}" stroke-width="1.5" fill="none"/>
        <path d="M-6 120 C10 108 28 103 40 107" stroke="${gold}" stroke-width="0.9" fill="none"/>
        ${hl('M3 97 C9 91 17 89 26 89.5', 0.85, 1.4)}
        <path d="M106 108 C104 95 93 88 80 89 C71 90 66 95 65 100 C75 97 90 100 106 112 Z" fill="${steel}" stroke="${edge}" stroke-width="0.6"/>
        <path d="M106 115 C104 103 93 96 80 96 C72 96 67 100 66 105 C76 102 90 105 106 119 Z" fill="${steel}" stroke="${edge}" stroke-width="0.6"/>
        <path d="M65 100 C75 97 90 100 106 112" stroke="${gold}" stroke-width="1.3" fill="none"/>
        ${hl('M72 92 C79 90 87 91 94 94', 0.5, 1)}`;
    }
    case 'archer': {
      const hood = `url(#${id}hood)`;
      return `<path d="M4 124 C6 104 22 94 40 89 L64 89 C82 94 96 104 98 124 Z" fill="url(#${id}leather)"/>
        <path d="M44 89 L52 104 L60 89 Z" fill="#d9ccb0"/>
        <path d="M46 89 L52 100 L58 89" stroke="#8a7a5a" stroke-width="0.5" fill="none"/>
        <path d="M10 124 C14 110 24 104 34 102" stroke="#2e1d10" stroke-width="0.6" fill="none"/>
        <path d="M-2 124 C-2 104 14 92 34 86 L43 84 C43 91 47 97 52 99 C57 97 61 91 61 84 L70 86 C88 92 102 104 102 124 L92 124 C90 112 82 104 70 102 L52 114 L34 102 C24 104 14 112 12 124 Z" fill="${hood}"/>
        <path d="M12 124 C14 112 24 104 34 102 L52 114 L70 102 C82 104 90 112 92 124" stroke="${gold}" stroke-width="0.9" fill="none"/>
        <path d="M6 104 C14 96 24 91 34 88" stroke="#fff" stroke-opacity="0.25" stroke-width="1.2" fill="none"/>
        <path d="M60 90 L67 88 L42 124 L34 124 Z" fill="#3a2414"/>
        <path d="M61 90 L66 89 L41 123" stroke="#7a5534" stroke-width="0.5" fill="none"/>
        <rect x="48.5" y="103" width="5.5" height="4.5" rx="0.8" transform="rotate(-55 51 105)" fill="none" stroke="${gold}" stroke-width="1"/>`;
    }
    case 'mage': {
      if (u.faction === 'red') {
        // shaman: dark robe, hood cowl, bone-bead necklace
        let beads = '';
        for (let i = 0; i <= 10; i++) {
          const t = i / 10;
          const x = 38 + t * 28, y = 92 + Math.sin(t * Math.PI) * 12;
          beads += i % 3 === 1
            ? `<path d="M${F(x)} ${F(y - 1)} l1.2 4 -2.4 0 Z" fill="url(#${id}bone)"/>`
            : `<circle cx="${F(x)}" cy="${F(y)}" r="1.25" fill="${i % 2 ? '#7a2a8a' : 'url(#' + id + 'bone)'}"/>`;
        }
        return `<path d="M2 124 C4 104 20 94 40 88 L64 88 C84 94 98 104 100 124 Z" fill="url(#${id}cloth)"/>
          <path d="M-4 112 C2 98 20 90 40 86 L64 86 C84 90 100 98 104 110 C92 115 76 109 66 105 L52 114 L38 105 C28 109 10 115 -4 112 Z" fill="url(#${id}clothD)"/>
          <path d="M-4 112 C10 115 28 109 38 105 L52 114 L66 105 C76 109 92 115 104 110" stroke="${gold}" stroke-width="1.3" fill="none"/>
          ${beads}
          <circle cx="52" cy="106" r="3.2" fill="${gold}"/><circle cx="52" cy="106" r="1.9" fill="#b04aff"/>
          <circle cx="52" cy="106" r="6" fill="#c46aff" opacity="0.25" filter="url(#${id}soft)"/>`;
      }
      return `<path d="M2 124 C4 104 20 94 40 88 L64 88 C84 94 98 104 100 124 Z" fill="url(#${id}cloth)"/>
        <path d="M-4 112 C2 98 20 90 40 86 L64 86 C84 90 100 98 104 110 C92 115 76 109 66 105 L52 114 L38 105 C28 109 10 115 -4 112 Z" fill="url(#${id}clothD)"/>
        <path d="M-4 112 C10 115 28 109 38 105 L52 114 L66 105 C76 109 92 115 104 110" stroke="${gold}" stroke-width="1.3" fill="none"/>
        <path d="M2 108 C14 110 28 105 37 101 M67 101 C76 105 90 110 102 106" stroke="${gold}" stroke-width="0.5" stroke-dasharray="1 1.3" fill="none"/>
        <path d="M40 87 L32 70 L45 79 Z" fill="url(#${id}clothD)" stroke="${gold}" stroke-width="0.8"/>
        <path d="M63 87 L72 70 L59 79 Z" fill="url(#${id}clothD)" stroke="${gold}" stroke-width="0.8"/>
        <path d="M44 88 Q52 100 60 88" stroke="${gold}" stroke-width="0.6" fill="none"/>
        <circle cx="52" cy="98" r="6.5" fill="#ffae4a" opacity="0.3" filter="url(#${id}soft)"/>
        <path d="M52 93.5 L55.5 98 L52 103 L48.5 98 Z" fill="${gold}"/>
        <path d="M52 95.3 L54 98 L52 101 L50 98 Z" fill="#ff8a2a"/>
        <circle cx="51.3" cy="97" r="0.6" fill="#fff"/>`;
    }
    case 'warlord':
      return `<path d="M-10 124 L-8 100 C4 90 22 86 36 86 L66 86 C80 86 98 90 110 100 L112 124 Z" fill="url(#${id}bear)"/>
        <path d="M-6 124 C-6 108 3 99 17 97 C27 96 34 99 38 104 L38 124 Z" fill="url(#${id}skinB)"/>
        <path d="M108 124 C108 108 99 100 86 98 C76 97 70 100 66 105 L66 124 Z" fill="url(#${id}skinB)"/>
        <path d="M6 110 C10 106 16 105 22 106 M82 107 C88 106 94 107 98 111" stroke="${c.skinSh}" stroke-width="1" fill="none" opacity="0.7"/>
        <path d="M22 124 C24 108 32 99 43 95 L61 95 C72 99 80 108 82 124 Z" fill="url(#${id}cloth)"/>
        <path d="M43 95 l3 4 3 -4 3 4 3 -4 3 4 3 -4 M24 116 l4 3 4 -3 4 3 4 -3 4 3 4 -3 4 3 4 -3 4 3 4 -3 4 3 4 -3 4 3" stroke="#f2ead8" stroke-width="1.1" fill="none" stroke-linejoin="round"/>
        <path d="M30 124 L64 96 L72 100 L40 124 Z" fill="url(#${id}leather)"/>
        <g fill="#c9ccd2"><circle cx="62" cy="99.5" r="0.9"/><circle cx="55" cy="105" r="0.9"/><circle cx="48" cy="111" r="0.9"/><circle cx="41" cy="117" r="0.9"/></g>
        <circle cx="52" cy="108" r="4.2" fill="${gold}" stroke="#5a3a10" stroke-width="0.5"/>
        <path d="M50 107 a1 1 0 1 0 0.1 0 M54 107 a1 1 0 1 0 0.1 0" stroke="#3a2008" stroke-width="1.2"/>
        <path d="M-6 108 L-2 97 L3 101 L7 91 L12 97 L17 88 L23 94 L28 86 L33 92 L38 85 L44 90 L52 87 L60 90 L66 85 L71 92 L76 86 L81 94 L87 88 L92 97 L97 91 L101 101 L106 97 L106 110 C90 104 72 101 52 104 C32 101 14 104 -6 110 Z" fill="url(#${id}bear)"/>
        <path d="M6 99 l3 6 M16 92 l2 7 M27 89 l2 6 M40 88 l1 6 M64 88 l-1 6 M76 89 l-2 6 M88 92 l-2 7 M97 99 l-3 6" stroke="#c4a488" stroke-width="0.6" opacity="0.7"/>
        <path d="M2 116 l3 -3 M8 118 l3 -3 M94 117 l3 3 M100 115 l3 3" stroke="#6a2a1a" stroke-width="2.2" stroke-linecap="round"/>`;
    case 'brigand':
      return `<path d="M-6 124 L-6 108 C2 97 20 91 40 87 L64 87 C84 91 102 97 106 108 L106 124 Z" fill="url(#${id}skinB)"/>
        <path d="M76 98 C86 99 96 104 102 112" stroke="${c.skinSh}" stroke-width="1" fill="none" opacity="0.6"/>
        <path d="M82 104 l4 2 -1 4 4 1 M90 106 l3 4" stroke="#3a2a3a" stroke-width="0.9" fill="none" opacity="0.55"/>
        <path d="M16 124 C18 108 28 98 41 91 L52 110 L63 91 C76 98 86 108 88 124 Z" fill="url(#${id}cloth)"/>
        <path d="M41 91 L52 110 L63 91" stroke="#f2ead8" stroke-width="1.3" fill="none"/>
        <path d="M18 118 l4 3 4 -3 4 3 4 -3 4 3 4 -3 4 3 4 -3 4 3 4 -3 4 3 4 -3 4 3 4 -3 4 3" stroke="#f2ead8" stroke-width="1" fill="none"/>
        <path d="M46 102 l1.6 1 M48.5 106 l1.6 1 M58 102 l-1.6 1 M55.5 106 l-1.6 1" stroke="#c9b48a" stroke-width="0.6"/>
        <path d="M-8 114 C-6 99 5 90 19 90 C29 90 35 94 38 98 L34 99.5 L36 103 L30 102 L31 107 L25 104 L23.5 109 L18 105 L14.5 110 L11 105 L6 111 L2.5 106 L-8 118 Z" fill="url(#${id}fur)"/>
        <path d="M4 96 l2 5 M12 93 l1 6 M22 92 l0 5 M30 94 l-1 4" stroke="#c4b098" stroke-width="0.6" opacity="0.7"/>
        <path d="M62 91 L68 89 L44 124 L36 124 Z" fill="#2e1c10"/>
        <g fill="#c9ccd2"><circle cx="61" cy="95" r="0.9"/><circle cx="56" cy="102" r="0.9"/><circle cx="51" cy="109" r="0.9"/><circle cx="46" cy="116" r="0.9"/></g>
        <path d="M84 124 L90 108 L96 110 L92 124 Z" fill="${f.cloth}" opacity="0.9"/>`;
    default: // lord
      return `${capeBack}
        <path d="M8 124 C10 106 24 96 42 92 L62 92 C80 96 92 106 94 124 Z" fill="url(#${id}cloth)"/>
        <path d="M52 101 L52 124" stroke="${gold}" stroke-width="1.2"/>
        <path d="M49 104 L49 124 M55 104 L55 124" stroke="${gold}" stroke-width="0.4" stroke-dasharray="1 1"/>
        <path d="M40 81 C40 88 41 92 44 96 L52 104 L60 96 C63 92 64 88 64 81 C60 88 44 88 40 81 Z" fill="#efe7d6" stroke="${gold}" stroke-width="0.9"/>
        <path d="M44 90 C48 93 56 93 60 90 L52 100 Z" fill="#cfc4ae"/>
        <path d="M62 88 C76 88 92 94 100 104 L104 124 L80 124 C82 110 76 98 62 90 Z" fill="url(#${id}cloth)"/>
        <path d="M62 90 C76 98 82 110 80 124" stroke="${gold}" stroke-width="1.4" fill="none"/>
        <path d="M65 92 C76 99 80 110 79 122" stroke="#fff" stroke-opacity="0.2" stroke-width="1" fill="none"/>
        <path d="M-4 112 C-2 98 11 90 26 90 C35 90 40 96 41 102 C30 99 13 102 -4 116 Z" fill="${steel}" stroke="${gold}" stroke-width="1.3"/>
        <path d="M-2 120 C2 110 12 105 24 105 C31 105 36 107 38 111 C27 109 12 113 -2 124 Z" fill="${steel}" stroke="${gold}" stroke-width="0.9"/>
        <path d="M6 104 C12 98 22 96 31 97" stroke="${gold}" stroke-width="0.6" stroke-dasharray="1.4 1" fill="none"/>
        ${hl('M2 99 C8 93 16 91 25 91.5', 0.85, 1.3)}
        <path d="M46 101 Q56 104 64 96" stroke="${gold}" stroke-width="0.7" fill="none"/>
        <circle cx="44.5" cy="101" r="3.4" fill="${gold}"/><circle cx="44.5" cy="101" r="2" fill="${f.gem}"/>
        <circle cx="43.8" cy="100.3" r="0.6" fill="#fff"/>`;
  }
}

/* ------------------------------------------------------------ head / face */

function neck(c) {
  const { id, P, skinSh } = c;
  const w = P.fem ? 0 : 1;
  return `<path d="M${44 - w} 66 L${43.5 - w} 90 C48 93 57 93 ${60.5 + w} 89 L${60 + w} 64 Z" fill="url(#${id}skin)"/>
    <path d="M${43 - w} 64 L${61 + w} 64 L${61 + w} 78 C56 84 48 81 ${43 - w} 76 Z" fill="${skinSh}" opacity="0.75"/>
    <path d="M56 80 C58 84 59 87 60 89" stroke="${skinSh}" stroke-width="1.6" opacity="0.5" fill="none"/>`;
}

function ears(c, near) {
  const { id, P, skin, skinSh, u } = c;
  if (!near) {
    return `<path d="M65.5 52 C69 50.5 70.2 55 69.6 58.5 C69 62 67.5 63.5 65.5 62.5 Z" fill="${mix(skin, skinSh, 0.4)}"/>`;
  }
  if (P.elf) {
    return `<path d="M35 51 C29 47 22 40 16 34 C18 44 23 55 29 61 C31 63.5 33 64.5 35.5 64 Z" fill="url(#${id}skin)"/>
      <path d="M33 53 C28 49 23 44 19 38 C21 46 25 54 30 59" stroke="${skinSh}" stroke-width="0.9" fill="none"/>
      <path d="M19 36 C22 40 25 44 28 47" stroke="#fff" stroke-opacity="0.5" stroke-width="0.6" fill="none"/>`;
  }
  let s = `<path d="M35 52 C30.5 50 29 55 29.8 59 C30.4 62.4 32.5 65 35.5 64 Z" fill="url(#${id}skin)"/>
    <path d="M33.8 54.5 C31.6 54 31.2 57.5 32 60 C32.5 61.5 33.5 62 34.5 61.8" stroke="${skinSh}" stroke-width="0.8" fill="none"/>`;
  if (P.earring) s += `<circle cx="31.8" cy="66" r="1.7" fill="none" stroke="url(#${id}gold)" stroke-width="0.8"/>`;
  return s;
}

function eye(c, cx, cy, w, h, side, key) {
  const { id, P, L, lash, skinSh } = c;
  const X = (uu) => F(cx + side * uu * w);
  const Y = (v) => F(cy + v * h);
  const top = P.mood === 'angry' ? -0.48 : P.mood === 'sly' ? -0.52 : -0.62;
  const scl = `M${X(-0.5)} ${Y(0.1)} C${X(-0.36)} ${Y(top * 0.85)} ${X(0.16)} ${Y(top)} ${X(0.5)} ${Y(-0.06)} C${X(0.42)} ${Y(0.42)} ${X(-0.12)} ${Y(0.58)} ${X(-0.5)} ${Y(0.1)} Z`;
  const upper = `M${X(-0.54)} ${Y(0.12)} C${X(-0.38)} ${Y(top * 0.85 - 0.05)} ${X(0.16)} ${Y(top - 0.05)} ${X(0.52)} ${Y(-0.08)}`;
  const lower = `M${X(0.5)} ${Y(-0.02)} C${X(0.42)} ${Y(0.44)} ${X(0.05)} ${Y(0.56)} ${X(-0.2)} ${Y(0.46)}`;
  const lw = P.fem ? 1.75 : 1.45; // heavy upper lash line reads at 40 px
  const ix = cx + side * 0.04 * w, iy = cy + 0.14 * h;
  const irx = 0.27 * w, iry = 0.52 * h;
  let s = `<clipPath id="${id}e${key}"><path d="${scl}"/></clipPath>
    <path d="${scl}" fill="url(#${id}scl)"/>
    <g clip-path="url(#${id}e${key})">
      <ellipse cx="${F(ix)}" cy="${F(iy)}" rx="${F(irx)}" ry="${F(iry)}" fill="url(#${id}iris)" stroke="${shade(L.eyes, -0.6)}" stroke-width="0.45"/>
      <ellipse cx="${F(ix)}" cy="${F(iy + 0.05 * h)}" rx="${F(irx * 0.45)}" ry="${F(iry * 0.55)}" fill="${shade(L.eyes, -0.7)}"/>
      <path d="M${F(ix - irx * 0.75)} ${F(iy + iry * 0.45)} Q${F(ix)} ${F(iy + iry * 0.95)} ${F(ix + irx * 0.75)} ${F(iy + iry * 0.45)}" stroke="${shade(L.eyes, 0.6)}" stroke-width="0.7" fill="none" opacity="0.8"/>
      <ellipse cx="${X(0)}" cy="${Y(-0.62)}" rx="${F(0.62 * w)}" ry="${F(0.3 * h)}" fill="#2a1418" opacity="0.35"/>
      <ellipse cx="${F(ix - irx * 0.35)}" cy="${F(iy - iry * 0.38)}" rx="${F(irx * 0.36)}" ry="${F(iry * 0.28)}" fill="#fff"/>
      <circle cx="${F(ix + irx * 0.45)}" cy="${F(iy + iry * 0.35)}" r="${F(irx * 0.16)}" fill="#fff" opacity="0.9"/>
    </g>
    <path d="${upper}" stroke="${lash}" stroke-width="${lw}" fill="none" stroke-linecap="round"/>
    <path d="${lower}" stroke="${lash}" stroke-width="0.5" fill="none" opacity="0.55" stroke-linecap="round"/>
    <path d="M${X(-0.3)} ${Y(top - 0.28)} C${X(0)} ${Y(top - 0.42)} ${X(0.3)} ${Y(top - 0.36)} ${X(0.46)} ${Y(-0.36)}" stroke="${skinSh}" stroke-width="0.5" fill="none" opacity="0.7"/>`;
  if (P.fem) {
    s += `<path d="M${X(0.3)} ${Y(-0.42)} L${X(0.68)} ${Y(-0.34)} L${X(0.5)} ${Y(-0.02)} Z" fill="${lash}"/>
      <path d="M${X(0.52)} ${Y(-0.12)} l${F(side * 1.2)} -1 M${X(0.42)} ${Y(-0.3)} l${F(side * 1.1)} -1.2" stroke="${lash}" stroke-width="0.5"/>`;
  } else {
    s += `<path d="M${X(0.36)} ${Y(-0.36)} L${X(0.6)} ${Y(-0.24)} L${X(0.5)} ${Y(-0.04)} Z" fill="${lash}"/>`;
  }
  return s;
}

function brows(c, eyes) {
  const { P, L, u } = c;
  const col = shade(L.hair === '#dfe3ec' ? '#9aa0b0' : L.hair, -0.25);
  const bw = P.fem ? 1.15 : 1.9;
  const inD = { angry: 2.4, determined: 1.3, stern: 1.5, calm: 0, soft: -0.9, sly: 0.5 }[P.mood] || 0;
  const outD = { angry: -1.4, determined: -0.4, stern: -0.3, calm: 0.3, soft: 0.9, sly: -0.4 }[P.mood] || 0;
  let s = '';
  for (const [cx, w, h, side] of eyes) {
    const by = 57.5 - h * 0.55 - (P.fem ? 3.6 : 2.9);
    const raise = P.mood === 'sly' && side === 1 ? -1.4 : 0;
    const ix = cx - side * 0.46 * w, iy = by + inD + raise * 0.4;
    const ox = cx + side * 0.62 * w, oy = by + 1 + outD + raise;
    const qx = cx + side * 0.08 * w, qy = by - 1.7 + inD * 0.3 + raise;
    s += `<path d="M${F(ix)} ${F(iy)} Q${F(qx)} ${F(qy)} ${F(ox)} ${F(oy)}" stroke="${col}" stroke-width="${bw}" fill="none" stroke-linecap="round"/>`;
    if (!P.fem) s += `<path d="M${F(ix)} ${F(iy + 0.5)} Q${F(qx)} ${F(qy + 0.6)} ${F((ix + ox) / 2)} ${F((iy + oy) / 2 - 0.2)}" stroke="${col}" stroke-width="${bw * 0.8}" fill="none" stroke-linecap="round"/>`;
  }
  return s;
}

function mouth(c) {
  const { P, skin, skinSh } = c;
  const line = mix(skin, '#5a1a22', 0.62);
  const lip = mix(skin, '#c8505a', 0.4);
  const y = P.fem ? 71.2 : 71.8;
  let s;
  switch (P.mouth) {
    case 'smile':
      s = `<path d="M48.8 ${y - 0.4} Q52.6 ${y + 2.2} 56.4 ${y - 0.8}" stroke="${line}" stroke-width="0.9" fill="none" stroke-linecap="round"/>`;
      break;
    case 'smirk':
      s = `<path d="M49.3 ${y + 0.2} Q52.6 ${y + 0.8} 56.5 ${y - 1.4}" stroke="${line}" stroke-width="0.9" fill="none" stroke-linecap="round"/>`;
      break;
    case 'frown':
      s = `<path d="M49.2 ${y + 0.6} Q52.6 ${y - 0.8} 56 ${y + 0.7}" stroke="${line}" stroke-width="1" fill="none" stroke-linecap="round"/>`;
      break;
    case 'grin':
      s = `<path d="M47.8 ${y - 1} Q52.6 ${y - 1.6} 57.4 ${y - 1.6} Q56 ${y + 3.6} 52.4 ${y + 3.6} Q48.6 ${y + 3.2} 47.8 ${y - 1} Z" fill="#3a1216"/>
        <path d="M48.6 ${y - 0.8} Q52.6 ${y - 1.3} 56.8 ${y - 1.3} L56.4 ${y + 0.3} Q52.6 ${y + 0.1} 48.9 ${y + 0.5} Z" fill="#f4eee2"/>
        <path d="M49.2 ${y + 2.4} Q52.6 ${y + 3.8} 55.8 ${y + 2.2}" stroke="#c0505a" stroke-width="0.8" fill="none" opacity="0.8"/>`;
      break;
    case 'snarl':
      s = `<path d="M47.6 ${y - 0.4} Q52.6 ${y - 1.8} 57.6 ${y - 0.6} Q56.2 ${y + 3.2} 52.6 ${y + 3} Q48.8 ${y + 3.2} 47.6 ${y - 0.4} Z" fill="#3a1216"/>
        <path d="M48.4 ${y - 0.3} Q52.6 ${y - 1.4} 56.8 ${y - 0.5} L56.4 ${y + 0.7} Q52.6 ${y} 48.8 ${y + 0.8} Z" fill="#efe6d4"/>
        <path d="M49.6 ${y + 0.6} l0.8 1.8 0.6 -1.9 Z M55 ${y + 0.5} l0.7 1.8 0.6 -1.9 Z" fill="#efe6d4"/>`;
      break;
    default:
      s = `<path d="M49.4 ${y + 0.1} Q52.6 ${y + 0.7} 55.8 ${y}" stroke="${line}" stroke-width="0.9" fill="none" stroke-linecap="round"/>`;
  }
  if (P.mouth !== 'grin' && P.mouth !== 'snarl') {
    s += `<path d="M50.6 ${y + 1.8} Q52.8 ${y + 2.9} 55 ${y + 1.7}" stroke="${P.fem ? lip : skinSh}" stroke-width="${P.fem ? 1.1 : 0.7}" fill="none" stroke-linecap="round" opacity="${P.fem ? 0.75 : 0.5}"/>`;
  }
  return s;
}

function marks(c) {
  const { P, skinSh, id } = c;
  let s = '';
  if (P.freckles) {
    const pts = [[40, 64], [42.5, 63.2], [44.5, 64.5], [58.5, 63.4], [61, 64.2], [60, 62.6], [41.5, 66]];
    s += pts.map(([x, y]) => `<circle cx="${x}" cy="${y}" r="0.42" fill="${skinSh}" opacity="0.8"/>`).join('');
  }
  if (P.mole) s += `<circle cx="57.5" cy="74" r="0.55" fill="#3a2020"/>`;
  if (P.paint) {
    s += `<path d="M39 61 L42 69 L44.5 61 Z M57.5 61 L60 68 L62.5 61 Z" fill="#7a2aa0" opacity="0.85"/>
      <path d="M52 74.5 L52 78.5" stroke="#7a2aa0" stroke-width="1.4" opacity="0.85"/>`;
  }
  if (P.scar === 'eye') s += `<path d="M39 47 L46.5 67" stroke="#b0544a" stroke-width="1.1" opacity="0.9"/><path d="M40 51 l2.6 -1 M41.4 55 l2.6 -1 M43 59.5 l2.6 -1 M44.4 63.5 l2.6 -1" stroke="#b0544a" stroke-width="0.6"/>`;
  if (P.scar === 'cheek') s += `<path d="M58 62 L64.5 69.5" stroke="#b0544a" stroke-width="1" opacity="0.9"/><path d="M59.5 65 l1.8 -1.3 M61.5 67.3 l1.8 -1.3" stroke="#b0544a" stroke-width="0.55"/>`;
  if (P.scar === 'nose') s += `<path d="M47 61.5 L58 58.5" stroke="#b0544a" stroke-width="0.9" opacity="0.85"/>`;
  return s;
}

function beard(c) {
  const { id, P, L, u, r, skin } = c;
  let s = '';
  if (P.stubble) {
    s += `<path d="M35.5 60 C37 72 44 79.5 51.5 80 C59 79.5 64.5 72 66 60 C63 69 58 74 51.5 74.5 C45 74 39 69 35.5 60 Z" fill="${mix(L.hair, skin, 0.45)}" opacity="0.5" clip-path="url(#${id}face)"/>
      <path d="M47 69.8 Q52.6 67.8 58 69.6" stroke="${mix(L.hair, skin, 0.4)}" stroke-width="1.6" opacity="0.5" fill="none"/>`;
  }
  if (!L.beard) return s;
  const hl = shade(L.hair, 0.35), dk = shade(L.hair, -0.4);
  let outer;
  if (u.cls === 'warlord') {
    outer = 'M33.5 55 C33 74 40 94 51.5 104 C63 94 68 74 66.5 55 C65.5 64 61.5 70 57.5 72.5 C55.5 74.5 53.5 75.5 51.5 75.5 C49.5 75.5 47.5 74.5 45.5 72.5 C41 70 35 64 33.5 55 Z';
  } else if (u.cls === 'brigand') {
    let jag = '';
    for (let i = 0; i <= 10; i++) {
      const t = i / 10;
      const x = 35 + t * 32, y = 72 + Math.sin(t * Math.PI) * 14 + (i % 2 ? 3 + r() * 2 : 0);
      jag += ` L${F(x)} ${F(y)}`;
    }
    outer = `M34 57 ${jag.replace(' L', 'L')} L66.5 57 C65 65 61.5 70 57.5 72.5 C55.5 74 53.5 75 51.5 75 C49.5 75 47.5 74 45.5 72.5 C41 70 35.5 65 34 57 Z`;
  } else {
    outer = 'M34 57 C35 72 42 84.5 51.5 86.5 C61 84.5 67 72 66.5 57 C65 65 61.5 70 57.5 72 C55.5 74.2 53.5 75.3 51.5 75.3 C49.5 75.3 47.5 74.2 45.5 72 C41 70 35.5 65 34 57 Z';
  }
  s += `<clipPath id="${id}beard"><path d="${outer}"/></clipPath><path d="${outer}" fill="url(#${id}hair)"/>`;
  let st = '';
  for (let i = 0; i < 9; i++) {
    const x = 38 + i * 3.4 + r();
    const y0 = 70 + Math.abs(i - 4) * -0.8 + 4;
    st += `M${F(x)} ${F(y0)} q${F((x - 51.5) * 0.08)} 5 ${F((x - 51.5) * 0.12)} ${F(8 + r() * 4)} `;
  }
  s += `<path d="${st}" stroke="${hl}" stroke-width="0.5" fill="none" opacity="0.7" clip-path="url(#${id}beard)"/>`;
  s += `<path d="M46.5 69.6 C49 68 51.5 68.8 52.6 69.4 C53.7 68.8 56.2 68 58.8 69.6 C57.4 71.2 55 70.8 52.6 70.6 C50.2 70.8 48 71.2 46.5 69.6 Z" fill="${dk}"/>
    <path d="M47.6 69.4 C49.5 68.6 51 68.9 52.4 69.4" stroke="${hl}" stroke-width="0.4" fill="none"/>`;
  if (u.cls === 'warlord') s += `<rect x="49" y="92" width="5" height="3.2" rx="1" fill="url(#${id}gold)"/><path d="M49 93.2 L54 93.2" stroke="#6a4a10" stroke-width="0.4"/>`;
  return s;
}

function face(c) {
  const { id, P, skin, skinSh, f, u } = c;
  const soft = `filter="url(#${id}soft)"`;
  let s = ears(c, false);
  s += `<path d="${faceD(P)}" fill="url(#${id}skin)"/>
    <g clip-path="url(#${id}face)">
      <path d="M65 40 C61.5 50 62 58 59 65 C56.5 70.5 54 75 51 80 L72 84 L72 38 Z" fill="${skinSh}" opacity="0.72" ${soft}/>
      <path d="M30 44 Q36 51 42 47.5 Q47 52 52 48.5 Q58 52 63 47.5 Q67 50 72 44 L72 26 L30 26 Z" fill="${skinSh}" opacity="0.75" ${soft}/>
      <ellipse cx="41" cy="66" rx="4" ry="1.9" fill="#ff6a70" opacity="${P.fem ? 0.35 : 0.14}" ${soft}/>
      <ellipse cx="60.5" cy="65.5" rx="3" ry="1.6" fill="#ff6a70" opacity="${P.fem ? 0.3 : 0.12}" ${soft}/>
      <ellipse cx="41.5" cy="61" rx="3.5" ry="4.5" fill="#fff" opacity="0.14" ${soft}/>
      <path d="M34.6 44 C34.2 56 36 64 41 71" stroke="${f.rim}" stroke-width="1.4" opacity="0.55" fill="none" ${soft}/>
    </g>`;
  s += marks(c);
  const eh = (P.fem ? 7.4 : P.young ? 6.6 : 5.8) * (P.mood === 'angry' ? 0.85 : 1);
  const ew = P.fem ? 11 : P.young ? 10.6 : 10;
  const eyes = [[43.2, ew, eh, -1], [59.8, ew * 0.86, eh * 0.97, 1]];
  s += eye(c, 43.2, 57.5, ew, eh, -1, 'l') + eye(c, 59.8, 57.5, ew * 0.86, eh * 0.97, 1, 'r');
  s += brows(c, eyes);
  // nose
  const nd = mix(skin, '#6a2a3a', 0.4);
  s += `<path d="M51.6 59 C51.4 61.5 51.8 63.5 52.4 65.2" stroke="${skinSh}" stroke-width="0.9" fill="none" opacity="0.55" ${soft}/>
    <path d="M52.2 66 Q53.8 66.9 55.4 65.7" stroke="${nd}" stroke-width="${P.fem ? 0.6 : 0.8}" fill="none" stroke-linecap="round"/>
    <path d="M55.4 63.5 L56.4 66 L54.6 66.2 Z" fill="${skinSh}" opacity="0.4"/>
    <circle cx="52.7" cy="64.3" r="0.55" fill="#fff" opacity="0.5"/>`;
  s += mouth(c);
  s += beard(c);
  s += ears(c, true);
  return s;
}

/* ------------------------------------------------------------ front hair */

function frontHair(c) {
  const { id, L, u, r, P } = c;
  if (L.style === 'none') return '';
  const cover = HEADWEAR_COVERS[u.cls];
  const fill = `url(#${id}hair)`;
  const hl = shade(L.hair, 0.5), dk = shade(L.hair, -0.45);
  let base = '', under = '', lines = '', parts = '';
  // Locks radiate from a crown whorl, like drawn anime hair.
  const add = (rx, ry, tx, ty, w, b1, b2 = b1, shine = true) => {
    base += `<path d="${lock(rx, ry, tx, ty, w, b1, b2)}"/>`;
    under += `<path d="${lock(rx, ry, tx + (tx < 51 ? -1 : 1), ty + 1.6, w * 1.15, b1, b2)}"/>`;
    if (shine) lines += `<path d="${strand(rx, ry, tx, ty, b1, b2, -w * 0.12, 0.28, 0.55)}" stroke="${hl}" stroke-width="${F(w * 0.16)}" fill="none" stroke-linecap="round" opacity="0.55"/>`;
    parts += `<path d="${strand(rx, ry, tx, ty, b1, b2, w * 0.32, 0.45, 0.92)}" stroke="${dk}" stroke-width="0.45" fill="none" stroke-linecap="round" opacity="0.8"/>`;
  };
  // crown cap, hidden under headwear when present
  const cap = cover === 'none' || cover === 'hat'
    ? `<path d="M31 56 C28 31 39 23.5 50.5 23.5 C62.5 23.5 73 31 70 56 C68 46 66 42 62 39 C56 37 44 37 38 39 C34 42 32.5 47 31 56 Z" fill="${fill}"/>`
    : '';
  const tipY = cover === 'helm' ? 48 : 47.5;
  if (L.style === 'swept') {
    // side part on the near side, fringe swept across to the far side
    const px = 40, py = 25;
    add(px, py, 31, 58, 9, -3, -1);
    add(px + 1, py, 36, 49 + r() * 2, 8, -1.5, 1);
    [44, 50, 56, 62].forEach((x, i) => add(px + 3 + i * 2, py, x + 4, tipY - 1 + r() * 2.5, 10, 2.5, 1.5));
    add(px + 10, py, 70, 52, 10, 3, 1);
    add(px + 12, py + 2, 68.5, 62, 7, 2.5, -0.5, false);
  } else if (L.style === 'long') {
    // centre part, curtains falling to the chest in soft S-curves
    const px = 50.5, py = 25.5;
    [[42, 49], [47, 48], [55, 48.5], [60, 49.5]].forEach(([x, y]) => {
      const dir = x < px ? -1 : 1;
      add(px + dir * 1.5, py, x + dir * (0.5 + r() * 1.5), y + r() * 1.5 - (cover === 'hat' ? 1 : 0), 9, dir * 2.2, dir * 0.5);
    });
    add(px - 3, py + 1, 27.5, 94 + r() * 6, 10, -4, 2.5);
    add(px - 4, py + 4, 33.5, 84 + r() * 5, 6, -3, 1.5, false);
    add(px + 3, py + 1, 74, 92 + r() * 6, 9.5, 4, -2.5);
    add(px + 4, py + 4, 67.5, 82 + r() * 5, 5.5, 3, -1.5, false);
  } else {
    // short: tousled fringe with a slight sweep
    const px = P.fem ? 46 : 52, py = 26;
    const sweep = P.fem ? -1 : 1;
    [36, 42, 48, 54, 60, 65].forEach((x, i) => {
      const edge = i === 0 || i === 5;
      add(px + (x - px) * 0.25, py, x + sweep * (1 + r() * 2), tipY + r() * 3 - (edge ? 2.5 : 0), 9.5, sweep * 1.8 + (x < px ? -1.5 : 1.5), sweep);
    });
    add(px - 6, py + 2, 32.5, 59 + (P.fem ? 4 : 0), 7.5, -3, -0.5);
    add(px + 6, py + 2, 68.5, 57 + (P.fem ? 4 : 0), 7, 3, 0.5);
  }
  // glossy "angel ring" highlight across the crown (only when the crown is visible)
  const ring = cover === 'none'
    ? `<path d="M35.5 34 C40 29 46 27.5 51 27.5 C56 27.5 62 29 66 33 L64.5 35.5 C60 32 56 31 51 31 C46 31 41 32.5 37 36.5 Z" fill="${hl}" opacity="0.45" filter="url(#${id}soft)"/>`
    : '';
  return `${cap}<g fill="${dk}" opacity="0.85">${under}</g><g fill="${fill}">${base}</g>${ring}${lines}${parts}`;
}

/* -------------------------------------------------------------- headwear */

function headwear(c) {
  const { id, u, f } = c;
  const steel = `url(#${id}steel)`, steelV = `url(#${id}steelV)`, gold = `url(#${id}gold)`;
  const edge = f.edge;
  switch (u.cls) {
    case 'lord':
      return `<path d="M32.5 44 Q50 35 68 43 L68 46 Q50 38.5 32.5 47 Z" fill="${gold}" stroke="#7a5418" stroke-width="0.3"/>
        <path d="M44 41 C46 37 49 35.5 50.5 33.5 C52 35.5 55 37 57 41 C54 39.5 47 39.5 44 41 Z" fill="${gold}"/>
        <path d="M50.5 36 L53 39.6 L50.5 43 L48 39.6 Z" fill="${f.gem}" stroke="#7a5418" stroke-width="0.4"/>
        <path d="M49.8 37.8 L50.6 36.8" stroke="#fff" stroke-width="0.6"/>
        <path d="M36 43.5 Q50 37 65 42.5" stroke="#fff5c8" stroke-width="0.4" fill="none" opacity="0.8"/>`;
    case 'knight':
    case 'cavalier': {
      // low crest ridge like the model's helmet; the cavalier's plume is drawn behind the head
      const top = `<path d="M47.5 23 C48 17 49.5 14.5 50.5 14 C51.5 14.5 53 17 53.5 23 Z" fill="${steelV}" stroke="${edge}" stroke-width="0.5"/>`;
      return `${top}
        <path d="M29.5 53 C28 30 39 21 50.5 21 C62 21 73 30 71.5 53 C68 46.5 61 43 50.5 43 C40 43 33 46.5 29.5 53 Z" fill="${steel}" stroke="${edge}" stroke-width="0.7"/>
        <path d="M50.5 21.5 L50.5 43" stroke="${edge}" stroke-width="1"/>
        <path d="M49.3 23 L49.3 42" stroke="#fff" stroke-opacity="0.55" stroke-width="0.7"/>
        <path d="M34 34 C37 27 43 23.5 48 23" stroke="#fff" stroke-opacity="0.8" stroke-width="1.6" fill="none" stroke-linecap="round"/>
        <path d="M29.5 53 C33 46.5 40 43 50.5 43 C61 43 68 46.5 71.5 53" stroke="${gold}" stroke-width="1.6" fill="none"/>
        <path d="M29.8 51 L29.2 70 C30.6 74.5 35 75.5 38.6 72.5 L37.5 57 C36 53 33 51 29.8 51 Z" fill="${steelV}" stroke="${edge}" stroke-width="0.6"/>
        <path d="M71.2 51 L71.5 68.5 C70 72.5 66 74 63 71.5 L64.8 57 C66 53 68.5 51 71.2 51 Z" fill="${steelV}" stroke="${edge}" stroke-width="0.6"/>
        <path d="M29.2 70 C30.6 74.5 35 75.5 38.6 72.5" stroke="${gold}" stroke-width="1" fill="none"/>
        <g fill="${gold}"><circle cx="33" cy="58" r="0.8"/><circle cx="33" cy="66" r="0.8"/><circle cx="68" cy="58" r="0.7"/><circle cx="68" cy="65" r="0.7"/></g>
        <path d="M33 45.5 C38 41 44 39.5 50.5 39.5 C57 39.5 63 41 68.5 45.5 L68 49 C63 46 57 44.5 50.5 44.5 C44 44.5 38 46 33.5 49 Z" fill="${steelV}" stroke="${edge}" stroke-width="0.6"/>
        <path d="M37 45 L42 43.3 M45 42.5 L49 42.2 M52.5 42.2 L56.5 42.5 M59.5 43.3 L64.5 45" stroke="${f.ink}" stroke-width="1.1" stroke-linecap="round"/>
        <path d="M35 44 C41 40.5 47 40.2 52 40.3" stroke="#fff" stroke-opacity="0.7" stroke-width="0.7" fill="none"/>`;
    }
    case 'archer':
    case 'mage': {
      if (u.cls === 'mage') {
        const hat = `url(#${id}hat)`;
        const band = '#c9772e';
        return `<ellipse cx="50" cy="42" rx="36" ry="8.5" fill="${hat}" transform="rotate(-5 50 42)"/>
          <ellipse cx="50" cy="43.5" rx="30" ry="5" fill="#000" opacity="0.25" transform="rotate(-5 50 42)"/>
          <path d="M35 41 C38 30 44 18 52 10 C58 5 66 2 74 4 C68 6 64 10 62 16 C60 24 64 32 66 40 C56 43 44 43 35 41 Z" fill="${hat}"/>
          <path d="M34.8 36 C44 39.5 56 39.5 66 35.5 L66.8 41 C56 44.5 44 44.5 35 41.5 Z" fill="${band}"/>
          <path d="M34.8 36 C44 39.5 56 39.5 66 35.5" stroke="${shade(band, 0.35)}" stroke-width="0.6" fill="none"/>
          <rect x="47" y="36.2" width="7" height="6" rx="0.8" fill="none" stroke="${gold}" stroke-width="1.4"/>
          <path d="M44 28 C47 20 51 13 57 8" stroke="#fff" stroke-opacity="0.3" stroke-width="1.6" fill="none"/>
          <path d="M16 44 C30 50 70 48 84 38" stroke="#fff" stroke-opacity="0.18" stroke-width="0.8" fill="none"/>`;
      }
      const hood = `url(#${id}hood)`;
      const circlet = u.cls === 'mage'
        ? `<path d="M34 42 Q50 35 67 42" stroke="${gold}" stroke-width="1.5" fill="none"/>
           <path d="M50.5 36.5 L53 40 L50.5 43.2 L48 40 Z" fill="#b04aff" stroke="#7a5418" stroke-width="0.4"/>
           <path d="M45 38 l-2 -4 M56 38 l2 -4" stroke="${gold}" stroke-width="0.8"/>`
        : '';
      return `<path d="M22 96 C15 60 22 20 44 13.5 Q53 9.5 60 12.5 C78 20 85 60 78 96 L70 94 C70.5 78 71 66 69.5 55 C68 39 61 30.5 50.5 30.5 C40 30.5 33 39 31.5 55 C30 66 30.5 78 31 94 Z" fill="${hood}"/>
        <path d="M31 94 C30.5 78 30 66 31.5 55 C33 39 40 30.5 50.5 30.5 C61 30.5 68 39 69.5 55 C71 66 70.5 78 70 94" stroke="#000" stroke-opacity="0.35" stroke-width="1.6" fill="none"/>
        <path d="M31 94 C30.5 78 30 66 31.5 55 C33 39 40 30.5 50.5 30.5 C61 30.5 68 39 69.5 55 C71 66 70.5 78 70 94" stroke="${gold}" stroke-width="0.7" fill="none" transform="translate(0 -0.6) scale(1)"/>
        <path d="M27 50 C28 34 38 20 50 17" stroke="#fff" stroke-opacity="0.25" stroke-width="1.4" fill="none"/>
        ${circlet}`;
    }
    case 'warlord': {
      const bear = `url(#${id}bear)`;
      let fur = '';
      for (let i = 0; i < 14; i++) {
        const t = i / 13, a = Math.PI * (1.05 + t * 0.9);
        const x = 50.5 + Math.cos(a) * 25, y = 36 + Math.sin(a) * 22;
        fur += `M${F(x)} ${F(y)} l${F(Math.cos(a) * 3)} ${F(Math.sin(a) * 3 - 0.5)} `;
      }
      return `<path d="M22 96 C16 74 18 46 26 32 C32 20 41 13 50.5 13 C60 13 69 20 75 32 C83 46 85 74 79 96 L71 94 C72 78 71 64 69 55 C67 49 61 46.5 50.5 46.5 C40 46.5 34 49 32 55 C30 64 29 78 30 94 Z" fill="${bear}"/>
        <circle cx="30" cy="22" r="7.5" fill="${bear}"/><circle cx="30.5" cy="22.5" r="4" fill="#3a2418"/>
        <circle cx="71" cy="22" r="7" fill="${bear}"/><circle cx="70.5" cy="22.5" r="3.6" fill="#3a2418"/>
        <path d="${fur}" stroke="#c4a488" stroke-width="0.7" opacity="0.6" fill="none"/>
        <path d="M31 30 C37 20 44 17 50 16.5" stroke="#d8bea0" stroke-opacity="0.55" stroke-width="1.4" fill="none"/>
        <ellipse cx="50.5" cy="38" rx="9" ry="6.5" fill="#a07e62"/>
        <ellipse cx="50.5" cy="35.2" rx="3.4" ry="2.3" fill="#1a1010"/><ellipse cx="49.6" cy="34.5" rx="1" ry="0.6" fill="#fff" opacity="0.6"/>
        <ellipse cx="41.5" cy="30" rx="2" ry="2.3" fill="#1a1010"/><ellipse cx="59.5" cy="30" rx="2" ry="2.3" fill="#1a1010"/>
        <circle cx="41" cy="29.3" r="0.6" fill="#fff"/><circle cx="59" cy="29.3" r="0.6" fill="#fff"/>
        <path d="M34 47 l2 4.5 2 -4 2.4 5.5 2.2 -5 M58 47.5 l2.3 5 2.3 -5.4 2 4.3 2 -4.6" fill="#f2ead8" stroke="#6a5a3a" stroke-width="0.4"/>
        <path d="M32 47.5 C38 44.5 44 43.8 50.5 43.8 C57 43.8 63 44.5 69 47.5" stroke="#2a1a10" stroke-width="1.2" fill="none"/>`;
    }
    case 'brigand': {
      const band = `url(#${id}cloth)`;
      return `<path d="M31 52 C29 33 39 25.5 50.5 25.5 C62 25.5 72 33 70.5 52 C66 45.5 59 43 50.5 43 C42 43 35 45.5 31 52 Z" fill="${band}"/>
        <path d="M31 52 C35 45.5 42 43 50.5 43 C59 43 66 45.5 70.5 52" stroke="${shade(f.cloth, -0.45)}" stroke-width="1.2" fill="none"/>
        <path d="M37 33 C43 30 52 29.5 60 32 M34 42 C44 38 58 38 67 41" stroke="#000" stroke-opacity="0.25" stroke-width="0.9" fill="none"/>
        <g fill="#f0e0c8" opacity="0.8"><circle cx="41" cy="35" r="0.9"/><circle cx="48" cy="32" r="0.9"/><circle cx="56" cy="33" r="0.9"/><circle cx="62" cy="37" r="0.9"/><circle cx="45" cy="39" r="0.9"/><circle cx="53" cy="38" r="0.9"/></g>
        <path d="M68 44 C72 43 75 45 75 48 C72 49 69 48 68 44 Z" fill="${band}"/>
        <path d="M72 47 C78 52 80 60 78 68 C76 62 73 56 69 51 Z M73 47 C80 49 85 54 87 60 C82 57 77 54 71 51 Z" fill="${band}" stroke="${shade(f.cloth, -0.45)}" stroke-width="0.5"/>`;
    }
    default:
      return '';
  }
}

// Props in front of the bust: archers' longbows, Vex's open spellbook (KayKit Spellbook_open) with a violet glow.
function front(c) {
  const { id, u } = c;
  if (u.cls === 'archer') {
    // longbow held upright across the near shoulder, like the battlefield model
    return `<path d="M30 32 Q4 78 12 126" stroke="#3e2716" stroke-width="3.6" fill="none" stroke-linecap="round"/>
      <path d="M29 34 Q5 78 12.5 124" stroke="#a8784a" stroke-width="1" fill="none"/>
      <path d="M30 32 L12 126" stroke="#efe6d2" stroke-width="0.5"/>
      <path d="M14.6 80 L11.6 90" stroke="url(#${id}gold)" stroke-width="3.4"/>
      <circle cx="30" cy="32" r="1.6" fill="url(#${id}gold)"/>`;
  }
  if (u.cls !== 'mage' || u.faction !== 'red') return '';
  return `<ellipse cx="27" cy="101" rx="15" ry="9" fill="#c46aff" opacity="0.45" filter="url(#${id}soft2)"/>
    <path d="M11 105 L26 99 L42 102 L41 114 L27 111 L12 117 Z" fill="#5a1a20"/>
    <path d="M13 104.5 L26 99.5 L27 110 L14 115 Z" fill="#f4ead6"/>
    <path d="M26.5 99.5 L40 102 L39.5 112.5 L27 110 Z" fill="#e2d4bc"/>
    <path d="M15.5 106 L24 102.6 M16 108.5 L24.5 105.2 M16.5 111 L22 108.8 M29 103 L37.5 104.6 M29.2 105.6 L37 107.1 M29.4 108.2 L35 109.2" stroke="#8a3ab0" stroke-width="0.7"/>
    <path d="M26 90 l1 2.4 2.4 1 -2.4 1 -1 2.4 -1 -2.4 -2.4 -1 2.4 -1 Z M35 86 l0.7 1.7 1.7 0.7 -1.7 0.7 -0.7 1.7 -0.7 -1.7 -1.7 -0.7 1.7 -0.7 Z" fill="#e2b0ff"/>`;
}

let uid = 0;
export function portraitSVG(u, opts = {}) {
  const variant = opts.variant || 'full';
  const f = FACTION[u.faction] || FACTION.blue;
  const P = persona(u);
  const L = u.look;
  const id = `p${(uid++).toString(36)}`;
  const skin = L.skin;
  const c = {
    u, L, f, P, id, skin,
    r: rng(u.id || u.name || 'x'),
    skinSh: mix(skin, '#8a3a5a', 0.32),
    lash: mix(L.hair, '#140a10', 0.72),
    hoodIn: shade(f.clothDark, -0.55),
  };
  const hoodCol = u.faction === 'blue' ? '#1f4f8a' : '#8a2a20';
  const hatCol = u.faction === 'blue' ? '#2a55b4' : '#b0302a';
  const extraDefs = `
    <linearGradient id="${id}hood" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${shade(hoodCol, 0.25)}"/><stop offset="0.5" stop-color="${hoodCol}"/><stop offset="1" stop-color="${shade(hoodCol, -0.45)}"/>
    </linearGradient>
    <linearGradient id="${id}hat" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${shade(hatCol, 0.3)}"/><stop offset="0.55" stop-color="${hatCol}"/><stop offset="1" stop-color="${shade(hatCol, -0.5)}"/>
    </linearGradient>`;
  const full = variant !== 'bust';
  // framed variants crop in on the head; the bust keeps the whole figure
  const vb = variant === 'mini' ? '18 22 64 76.8' : variant === 'full' ? '10 14 80 96' : '0 0 100 120';
  return `<svg viewBox="${vb}"xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${u.name} portrait" preserveAspectRatio="xMidYMax meet">
    <defs>${defs(c)}${extraDefs}</defs>
    ${full ? backdrop(c) : ''}
    <g filter="url(#${id}ink)">
    ${behind(c)}
    ${backHair(c)}
    ${body(c)}
    ${neck(c)}
    ${face(c)}
    ${frontHair(c)}
    ${headwear(c)}
    ${front(c)}
    </g>
    ${full ? `<rect width="100" height="120" fill="url(#${id}key)" style="mix-blend-mode:soft-light"/><rect width="100" height="120" fill="url(#${id}vig)"/><rect width="100" height="120" filter="url(#${id}grain)" opacity="0.14"/>` : ''}
  </svg>`;
}
