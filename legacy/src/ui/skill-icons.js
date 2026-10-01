// Shared card art, drawn as SVG so icons stay crisp at every screen size.
export function skillIcon(id){
 const shapes={
  brace:'<path d="M12 2 21 6v7c0 5-6 8-9 10-3-2-9-5-9-10V6z"/>',
  focusedShot:'<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/><path d="M1 12h6m10 0h6M12 1v6m0 10v6"/>',
  rally:'<path d="M9 3h6v6h6v6h-6v6H9v-6H3V9h6z"/>',
  secondWind:'<path d="M4 10a8 8 0 1 1 1 8M4 3v7h7"/>',
  charge:'<path d="m4 20 15-15M12 4h8v8M4 10l6 6"/>',
  closeRanks:'<path d="M4 3v18M12 3v18M20 3v18M1 7l3-4 3 4m2 0 3-4 3 4m2 0 3-4 3 4"/>',
 };
 return `<span class="skill-art" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${shapes[id]||(id?'<path d="m12 2 3 7 7 3-7 3-3 7-3-7-7-3 7-3z"/>':'<path d="M12 5v14M5 12h14"/>')}</svg></span>`;
}
