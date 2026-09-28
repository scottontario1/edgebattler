// Procedural SVG bust portraits in a painted-fantasy style.
// viewBox is 100 x 120; the head centers around (50, 56). Being vector,
// they stay crisp at any size or screen density.

const FACTION = {
  blue: { bg1: '#4a7fd0', bg2: '#0c1834', cloth: '#2f62c4', trim: '#d4a93c', rim: '#9cc4ff' },
  red: { bg1: '#c44a3a', bg2: '#260909', cloth: '#a8302a', trim: '#c9a24a', rim: '#ffb08a' },
};

function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  const f = (v) => Math.max(0, Math.min(255, Math.round(v + 255 * amt)));
  const r = f(n >> 16), g = f((n >> 8) & 255), b = f(n & 255);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

const HEAD = 'M33 52 C33 36 40 32 50 32 C60 32 67 36 67 52 C67 66 60 78 50 80 C40 78 33 66 33 52 Z';

function defs(u, f, id) {
  const L = u.look;
  const cloak = u.faction === 'blue' ? '#3f6b3a' : '#4a2a2a';
  return `
    <radialGradient id="${id}bg" cx="50%" cy="32%" r="78%">
      <stop offset="0" stop-color="${f.bg1}"/><stop offset="1" stop-color="${f.bg2}"/>
    </radialGradient>
    <radialGradient id="${id}vig" cx="50%" cy="45%" r="72%">
      <stop offset="0.55" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity="0.5"/>
    </radialGradient>
    <linearGradient id="${id}skin" x1="0" y1="0" x2="1" y2="0.3">
      <stop offset="0" stop-color="${shade(L.skin, 0.06)}"/>
      <stop offset="0.55" stop-color="${L.skin}"/>
      <stop offset="1" stop-color="${shade(L.skin, -0.16)}"/>
    </linearGradient>
    <linearGradient id="${id}hair" x1="0" y1="0" x2="0.4" y2="1">
      <stop offset="0" stop-color="${shade(L.hair, 0.18)}"/>
      <stop offset="0.5" stop-color="${L.hair}"/>
      <stop offset="1" stop-color="${shade(L.hair, -0.18)}"/>
    </linearGradient>
    <linearGradient id="${id}metal" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#f1f4f8"/><stop offset="0.35" stop-color="#b9bec8"/>
      <stop offset="0.6" stop-color="#7d828c"/><stop offset="1" stop-color="#c9ced8"/>
    </linearGradient>
    <linearGradient id="${id}dark" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#6a6670"/><stop offset="0.5" stop-color="#3a3640"/><stop offset="1" stop-color="#1e1a22"/>
    </linearGradient>
    <linearGradient id="${id}cloth" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${shade(f.cloth, 0.12)}"/><stop offset="1" stop-color="${shade(f.cloth, -0.18)}"/>
    </linearGradient>
    <linearGradient id="${id}cloak" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${shade(cloak, 0.1)}"/><stop offset="1" stop-color="${shade(cloak, -0.15)}"/>
    </linearGradient>
    <linearGradient id="${id}gold" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#ffe9a0"/><stop offset="0.5" stop-color="${f.trim}"/><stop offset="1" stop-color="#8a6420"/>
    </linearGradient>
    <radialGradient id="${id}iris" cx="50%" cy="40%" r="60%">
      <stop offset="0" stop-color="${shade(L.eyes, 0.25)}"/><stop offset="1" stop-color="${shade(L.eyes, -0.2)}"/>
    </radialGradient>
    <filter id="${id}grain" x="0" y="0" width="100%" height="100%">
      <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="4"/>
      <feColorMatrix values="0 0 0 0 0.5  0 0 0 0 0.45  0 0 0 0 0.35  0 0 0 0.5 0"/>
      <feComposite operator="in" in2="SourceGraphic"/>
    </filter>`;
}

function shoulders(u, f, id) {
  const body = 'M4 122 C6 98 24 88 50 88 C76 88 94 98 96 122 Z';
  const metal = `url(#${id}metal)`;
  const edge = '#5d626c';
  switch (u.cls) {
    case 'knight':
    case 'cavalier':
      return `<path d="${body}" fill="url(#${id}cloth)"/>
        <path d="M20 122 C22 102 34 92 50 92 C66 92 78 102 80 122 Z" fill="${metal}" stroke="${edge}" stroke-width="0.8"/>
        <path d="M30 108 C40 104 60 104 70 108" stroke="#fff" stroke-opacity="0.35" stroke-width="1.2" fill="none"/>
        <ellipse cx="18" cy="100" rx="17" ry="11" fill="${metal}" stroke="${edge}" stroke-width="1"/>
        <ellipse cx="82" cy="100" rx="17" ry="11" fill="${metal}" stroke="${edge}" stroke-width="1"/>
        <path d="M6 100 C12 94 24 94 32 100" stroke="url(#${id}gold)" stroke-width="1.6" fill="none"/>
        <path d="M68 100 C76 94 88 94 94 100" stroke="url(#${id}gold)" stroke-width="1.6" fill="none"/>
        <path d="M40 92 L50 106 L60 92" fill="none" stroke="url(#${id}gold)" stroke-width="2.2"/>`;
    case 'warlord':
      return `<path d="${body}" fill="url(#${id}dark)"/>
        <path d="M2 104 L10 82 L20 98 L28 84 L34 100 Z" fill="url(#${id}dark)" stroke="#111" stroke-width="1"/>
        <path d="M98 104 L90 82 L80 98 L72 84 L66 100 Z" fill="url(#${id}dark)" stroke="#111" stroke-width="1"/>
        <path d="M34 122 L40 92 L60 92 L66 122 Z" fill="url(#${id}cloth)"/>
        <circle cx="50" cy="100" r="4" fill="url(#${id}gold)"/>`;
    case 'brigand':
      return `<path d="${body}" fill="#6a4a2e"/>
        <path d="M14 98 q6 -8 12 0 q6 -8 12 0 q6 -8 12 0 q6 -8 12 0 q6 -8 12 0 q6 -8 12 0 L86 108 L14 108 Z" fill="#8a7a62"/>
        <path d="M14 98 q6 -8 12 0 q6 -8 12 0 q6 -8 12 0 q6 -8 12 0 q6 -8 12 0 q6 -8 12 0" stroke="#b8a888" stroke-width="1" fill="none"/>
        <path d="M30 122 L44 92 L50 92 L36 122 Z" fill="#3a2a1a"/>`;
    case 'mage':
      return `<path d="${body}" fill="url(#${id}cloth)"/>
        <path d="M30 94 L40 80 L50 92 L60 80 L70 94 L60 100 L50 96 L40 100 Z" fill="${shade(f.cloth, -0.2)}" stroke="url(#${id}gold)" stroke-width="1.5"/>
        <circle cx="50" cy="104" r="4.5" fill="url(#${id}gold)"/>
        <circle cx="50" cy="104" r="2" fill="${u.faction === 'blue' ? '#ff9a4a' : '#c46aff'}"/>`;
    case 'archer':
      return `<path d="${body}" fill="url(#${id}cloak)"/>
        <path d="M26 122 C30 104 40 96 50 96 C60 96 70 104 74 122 Z" fill="#7a5a3a"/>
        <path d="M34 110 L66 110" stroke="#4a2e1a" stroke-width="1" stroke-dasharray="2 2"/>
        <path d="M66 90 L84 122" stroke="#4a2e1a" stroke-width="5"/>
        <path d="M70 86 l2 -8 M74 88 l3 -8 M78 90 l3 -7" stroke="#d8d0c0" stroke-width="1.2"/>`;
    default: // lord
      return `<path d="${body}" fill="#f2ead8"/>
        <path d="M16 122 C18 100 32 92 50 92 C68 92 82 100 84 122 Z" fill="url(#${id}cloth)"/>
        <path d="M36 92 L50 110 L64 92" fill="none" stroke="url(#${id}gold)" stroke-width="2.5"/>
        <ellipse cx="22" cy="98" rx="12" ry="7" fill="url(#${id}gold)"/>
        <ellipse cx="78" cy="98" rx="12" ry="7" fill="url(#${id}gold)"/>
        <circle cx="50" cy="112" r="3" fill="#4ab0e0" stroke="url(#${id}gold)" stroke-width="1"/>`;
  }
}

function backHair(u, id) {
  const L = u.look;
  if (L.style !== 'long' || ['knight', 'warlord', 'brigand'].includes(u.cls)) return '';
  return `<path d="M30 50 C24 70 25 92 30 106 L70 106 C75 92 76 70 70 50 Z" fill="url(#${id}hair)"/>
    <path d="M32 70 C31 84 32 96 34 104 M68 70 C69 84 68 96 66 104" stroke="${shade(L.hair, -0.25)}" stroke-width="0.8" fill="none"/>`;
}

function face(u, f, id) {
  const L = u.look;
  const skinDark = shade(L.skin, -0.14);
  let s = `
    <path d="M42 70 L58 70 L58 90 L42 90 Z" fill="${skinDark}"/>
    <path d="M42 74 C46 78 54 78 58 74 L58 80 C54 84 46 84 42 80 Z" fill="${shade(L.skin, -0.25)}" opacity="0.5"/>
    <ellipse cx="33" cy="58" rx="4" ry="6" fill="${L.skin}"/>
    <ellipse cx="67" cy="58" rx="4" ry="6" fill="${skinDark}"/>
    <path d="${HEAD}" fill="url(#${id}skin)"/>
    <path d="M58 40 C66 46 67 60 60 74 C64 64 64 50 58 40 Z" fill="${skinDark}" opacity="0.45"/>
    <path d="M36 50 C36 64 42 76 50 79" stroke="${f.rim}" stroke-opacity="0.35" stroke-width="1.2" fill="none"/>`;
  if (u.cls === 'knight') return s;
  const eyeY = 56;
  const lash = shade(L.hair, -0.35);
  const eye = (cx, dir) => `
    <path d="M${cx - 4.5} ${eyeY} Q${cx} ${eyeY - 3.6} ${cx + 4.5} ${eyeY} Q${cx} ${eyeY + 2.8} ${cx - 4.5} ${eyeY} Z" fill="#fbf7f0"/>
    <circle cx="${cx + dir * 0.4}" cy="${eyeY}" r="2.3" fill="url(#${id}iris)"/>
    <circle cx="${cx + dir * 0.4}" cy="${eyeY}" r="1.05" fill="#140c08"/>
    <circle cx="${cx + dir * 0.4 + 0.8}" cy="${eyeY - 0.9}" r="0.65" fill="#fff"/>
    <path d="M${cx - 4.8} ${eyeY + 0.2} Q${cx} ${eyeY - 4} ${cx + 4.8} ${eyeY - 0.2}" stroke="${lash}" stroke-width="1.3" fill="none" stroke-linecap="round"/>
    <path d="M${cx - 3} ${eyeY + 2.4} Q${cx} ${eyeY + 3.2} ${cx + 3} ${eyeY + 2.2}" stroke="${shade(L.skin, -0.25)}" stroke-width="0.5" fill="none"/>`;
  s += eye(43, 1) + eye(57, -1);
  const brow = u.faction === 'red' ? 1.5 : 0;
  s += `
    <path d="M37.5 ${eyeY - 5 + brow} Q43 ${eyeY - 8} 47.5 ${eyeY - 5.5}" stroke="${shade(L.hair, -0.12)}" stroke-width="1.9" fill="none" stroke-linecap="round"/>
    <path d="M52.5 ${eyeY - 5.5} Q57 ${eyeY - 8} 62.5 ${eyeY - 5 + brow}" stroke="${shade(L.hair, -0.12)}" stroke-width="1.9" fill="none" stroke-linecap="round"/>
    <path d="M50.5 58 C50 61 48.5 64 48 65.5 C49 66.6 51 66.8 52.2 66" stroke="${shade(L.skin, -0.3)}" stroke-width="1" fill="none" stroke-linecap="round"/>
    <path d="M49 58 L49.5 64" stroke="#fff" stroke-opacity="0.25" stroke-width="0.8"/>
    <ellipse cx="40" cy="65" rx="4" ry="2.2" fill="#e0706a" opacity="0.14"/>
    <ellipse cx="60" cy="65" rx="4" ry="2.2" fill="#e0706a" opacity="0.14"/>
    <path d="M45 72 Q50 ${u.faction === 'red' ? 70.8 : 73.6} 55 72" stroke="${shade(L.skin, -0.42)}" stroke-width="1.2" fill="none" stroke-linecap="round"/>
    <path d="M46.5 73.2 Q50 75.4 53.5 73.2" stroke="${shade('#c9786a', 0)}" stroke-opacity="0.5" stroke-width="1.1" fill="none" stroke-linecap="round"/>`;
  if (u.cls === 'brigand') s += `<path d="M38 49 L44.5 64" stroke="#9a4a3a" stroke-width="1.3"/><path d="M39 52 l3 -1 M40.5 56 l3 -1 M42 60 l3 -1" stroke="#9a4a3a" stroke-width="0.7"/>`;
  if (L.beard) {
    s += `<path d="M34 62 C36 78 42 87 50 87 C58 87 64 78 66 62 C62 70 58 75 50 75 C42 75 38 70 34 62 Z" fill="url(#${id}hair)"/>
      <path d="M43 71 Q50 67.5 57 71" stroke="${L.hair}" stroke-width="3.2" fill="none" stroke-linecap="round"/>
      <path d="M40 76 L42 82 M46 79 L47 85 M54 79 L53 85 M60 76 L58 82" stroke="${shade(L.hair, 0.15)}" stroke-width="0.6"/>`;
  }
  return s;
}

function frontHair(u, id) {
  const L = u.look;
  if (['knight', 'warlord', 'brigand'].includes(u.cls)) return '';
  const fill = `url(#${id}hair)`;
  const hl = shade(L.hair, 0.3);
  const dk = shade(L.hair, -0.28);
  if (L.style === 'swept') {
    return `<path d="M31 56 C27 30 44 22 56 26 C68 28 74 40 69 58 C66 46 60 40 52 41 C58 36 48 34 42 42 C38 46 34 50 31 56 Z" fill="${fill}"/>
      <path d="M40 32 C48 27 60 28 66 38 M36 40 C42 32 52 30 58 34 M60 32 C66 36 68 44 68 52" stroke="${hl}" stroke-width="1.1" fill="none" stroke-linecap="round"/>
      <path d="M42 42 C46 38 52 37 55 38 M34 50 C36 46 38 44 41 42" stroke="${dk}" stroke-width="0.8" fill="none"/>`;
  }
  if (L.style === 'long') {
    return `<path d="M31 62 C26 34 40 25 50 25 C62 25 74 34 69 62 C68 50 64 42 58 38 C54 44 44 46 38 42 C34 48 32 54 31 62 Z" fill="${fill}"/>
      <path d="M40 30 C48 27 58 28 64 34 M36 36 C40 32 46 30 50 30 M62 40 C66 46 68 52 68 58" stroke="${hl}" stroke-width="1.1" fill="none" stroke-linecap="round"/>
      <path d="M38 42 C36 48 34 54 33 60 M58 38 C62 44 64 50 66 56" stroke="${dk}" stroke-width="0.8" fill="none"/>`;
  }
  return `<path d="M32 52 C30 32 42 26 50 26 C60 26 70 32 68 52 C66 44 62 40 56 40 L52 44 L50 40 L44 44 L42 40 C38 42 34 46 32 52 Z" fill="${fill}"/>
    <path d="M40 30 C46 28 56 28 62 32 M36 38 C40 34 44 32 48 32" stroke="${hl}" stroke-width="1" fill="none" stroke-linecap="round"/>`;
}

function headgear(u, f, id) {
  const metal = `url(#${id}metal)`;
  const edge = '#5d626c';
  const gold = `url(#${id}gold)`;
  switch (u.cls) {
    case 'lord':
      return `<path d="M33 44 Q50 36 67 44 L67 47.5 Q50 39.5 33 47.5 Z" fill="${gold}"/>
        <path d="M46 40 L50 34 L54 40 Z" fill="${gold}"/>
        <circle cx="50" cy="41" r="2.8" fill="#4ab0e0" stroke="#8a6420" stroke-width="0.6"/>
        <circle cx="49.2" cy="40.2" r="0.8" fill="#fff" opacity="0.8"/>`;
    case 'knight':
      return `<path d="M30 60 C28 34 40 26 50 26 C60 26 72 34 70 60 L70 76 C62 82 38 82 30 76 Z" fill="${metal}" stroke="${edge}" stroke-width="1.2"/>
        <path d="M50 26 L50 54" stroke="${edge}" stroke-width="1.5"/>
        <path d="M36 34 C40 30 46 28 50 28" stroke="#fff" stroke-opacity="0.6" stroke-width="1.5" fill="none"/>
        <path d="M34 54 L66 54 L66 58 L34 58 Z" fill="#141414"/>
        <path d="M34 54 L66 54" stroke="#fff" stroke-opacity="0.35" stroke-width="0.6"/>
        <rect x="48.5" y="58" width="3" height="18" fill="${edge}"/>
        <g fill="#333"><circle cx="38" cy="64" r="1"/><circle cx="38" cy="68" r="1"/><circle cx="62" cy="64" r="1"/><circle cx="62" cy="68" r="1"/></g>
        <path d="M30 76 C38 82 62 82 70 76" stroke="${gold}" stroke-width="1.6" fill="none"/>
        <path d="M50 26 C54 14 66 10 78 16 C68 16 62 22 57 30 Z" fill="url(#${id}cloth)"/>
        <path d="M54 22 C60 16 68 14 74 15" stroke="#fff" stroke-opacity="0.3" stroke-width="0.8" fill="none"/>`;
    case 'cavalier':
      return `<path d="M31 50 C31 32 40 26 50 26 C60 26 69 32 69 50 L66 50 C64 40 58 36 50 36 C42 36 36 40 34 50 Z" fill="${metal}" stroke="${edge}" stroke-width="1"/>
        <path d="M37 34 C41 30 46 28 50 28" stroke="#fff" stroke-opacity="0.6" stroke-width="1.4" fill="none"/>
        <path d="M32 44 Q50 38 68 44" stroke="${gold}" stroke-width="1.4" fill="none"/>
        <rect x="48.5" y="44" width="3" height="16" fill="${edge}"/>
        <path d="M31 50 L33 66 L37 66 L35 50 Z" fill="${metal}"/><path d="M69 50 L67 66 L63 66 L65 50 Z" fill="${metal}"/>`;
    case 'archer':
      return `<path d="M24 92 C20 50 32 20 50 20 C68 20 80 50 76 92 C72 72 70 56 66 46 C60 38 40 38 34 46 C30 56 28 72 24 92 Z" fill="url(#${id}cloak)"/>
        <path d="M34 46 C40 38 60 38 66 46 C60 42 40 42 34 46 Z" fill="#000" opacity="0.3"/>
        <path d="M30 40 C34 28 42 22 50 22" stroke="#fff" stroke-opacity="0.2" stroke-width="1.2" fill="none"/>`;
    case 'mage': {
      const hat = u.faction === 'blue' ? '#2a2338' : '#1e1426';
      return `<path d="M36 40 C40 26 48 12 56 4 C58 12 62 16 70 18 C64 22 64 30 66 40 Z" fill="${hat}"/>
        <path d="M44 30 C48 20 52 12 56 6" stroke="#fff" stroke-opacity="0.18" stroke-width="1.2" fill="none"/>
        <ellipse cx="50" cy="41" rx="31" ry="6" fill="${hat}"/>
        <ellipse cx="50" cy="40" rx="30" ry="4.5" fill="none" stroke="#fff" stroke-opacity="0.12" stroke-width="0.8"/>
        <path d="M36 37 Q50 33 65 37 L65 40 Q50 36 36 40 Z" fill="${gold}"/>
        <path d="M58 22 l1.5 3 3 0.4 -2.3 2 0.6 3 -2.8 -1.5 -2.8 1.5 0.6 -3 -2.3 -2 3 -0.4 Z" fill="${gold}"/>`;
    }
    case 'brigand':
      return `<path d="M32 50 C30 32 40 28 50 28 C60 28 70 32 68 50 C60 44 40 44 32 50 Z" fill="url(#${id}cloth)"/>
        <path d="M36 44 C42 42 58 42 64 44" stroke="#000" stroke-opacity="0.25" stroke-width="1" fill="none"/>
        <path d="M66 46 L78 52 L74 56 L80 62 L68 52 Z" fill="url(#${id}cloth)"/>
        <circle cx="67" cy="60" r="1.8" fill="none" stroke="${gold}" stroke-width="0.8"/>`;
    case 'warlord':
      return `<path d="M31 54 C30 34 40 28 50 28 C60 28 70 34 69 54 L66 54 C64 44 58 40 50 40 C42 40 36 44 34 54 Z" fill="url(#${id}dark)" stroke="#111" stroke-width="1"/>
        <path d="M33 42 C20 40 12 30 10 14 C18 26 26 30 36 34 Z" fill="#ece0c4" stroke="#8a7a5a" stroke-width="1"/>
        <path d="M67 42 C80 40 88 30 90 14 C82 26 74 30 64 34 Z" fill="#ece0c4" stroke="#8a7a5a" stroke-width="1"/>
        <path d="M14 22 l3 1 M18 28 l3 0 M86 22 l-3 1 M82 28 l-3 0" stroke="#8a7a5a" stroke-width="0.8"/>
        <path d="M38 32 C42 30 46 29 50 29" stroke="#fff" stroke-opacity="0.3" stroke-width="1.2" fill="none"/>
        <path d="M48 40 L50 50 L52 40 Z" fill="#111"/>
        <path d="M34 48 Q50 42 66 48" stroke="${gold}" stroke-width="1.2" fill="none"/>`;
    default:
      return '';
  }
}

let uid = 0;
export function portraitSVG(u) {
  const f = FACTION[u.faction];
  const id = `p${uid++}`;
  return `<svg viewBox="0 0 100 120" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${u.name} portrait" shape-rendering="geometricPrecision">
    <defs>${defs(u, f, id)}</defs>
    <rect width="100" height="120" fill="url(#${id}bg)"/>
    <g opacity="0.1" stroke="#fff" stroke-width="0.5">
      <path d="M0 20 L100 0 M0 40 L100 20 M0 60 L100 40 M0 80 L100 60 M0 100 L100 80 M0 120 L100 100"/>
    </g>
    <circle cx="50" cy="52" r="34" fill="${f.rim}" opacity="0.12"/>
    ${backHair(u, id)}
    ${shoulders(u, f, id)}
    ${face(u, f, id)}
    ${frontHair(u, id)}
    ${headgear(u, f, id)}
    <rect width="100" height="120" fill="url(#${id}vig)"/>
    <rect width="100" height="120" filter="url(#${id}grain)" opacity="0.18"/>
  </svg>`;
}
