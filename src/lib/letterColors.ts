// Padel Lobsters — letter→color lookup for player avatars.
// Locked 2026-04-30. Replaces the older 12-color name-hash palette.
// Every avatar's color is determined by the first letter of the player's name,
// so every "A" is the same red, every "B" is the same navy, etc.

export const LETTER_COLORS = {
  A: '#E63946', // red
  B: '#1D3557', // navy
  C: '#2A9D8F', // teal
  D: '#DAA520', // goldenrod
  E: '#9C27B0', // purple
  F: '#AD1457', // rose
  G: '#1B5E20', // forest
  H: '#B7791F', // mustard
  I: '#283593', // indigo
  J: '#0277BD', // blue
  K: '#455A64', // slate
  L: '#558B2F', // olive green
  M: '#5E35B1', // deep purple
  N: '#EF6C00', // orange
  O: '#C2185B', // magenta
  P: '#00838F', // dark cyan
  Q: '#4A148C', // plum
  R: '#00695C', // deep teal
  S: '#37474F', // blue-grey
  T: '#5D4037', // brown
  U: '#6D8C5A', // sage
  V: '#E76F51', // coral
  W: '#827717', // olive-yellow
  X: '#1565C0', // royal blue
  Y: '#8B2635', // maroon
  Z: '#F4B400', // bright yellow
}

// Spares for diacritics (Ñ, Ø, Ü, etc.) — not currently mapped:
//   #6A4C93 dusty purple
//   #6A1B9A dark magenta
//   #16A085 sea green

// Fallback color for unknown / non-A-Z first letters.
const FALLBACK = '#999'

export function letterColor(name) {
  const ch = ((name || '').trim()[0] || '?').toUpperCase()
  return LETTER_COLORS[ch] || FALLBACK
}

export function initials(name) {
  return (name || '')
    .split(/\s+/)
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase()
}
