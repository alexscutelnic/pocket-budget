// Shared categorical palette for categories/pots across Home, Pots, and Trends,
// so the same entity always reads as the same color. Values are CSS custom
// properties (see :root / dark-mode block in styles.css) so each swatch swaps
// to its Apple-documented dark-mode variant automatically — light-mode iOS
// system colors read too light/washed at the same lightness on a black surface.
export const PALETTE = [
  'var(--pal-1)', 'var(--pal-2)', 'var(--pal-3)', 'var(--pal-4)',
  'var(--pal-5)', 'var(--pal-6)', 'var(--pal-7)', 'var(--pal-8)',
];
export const PALETTE_SIZE = PALETTE.length;

// Text color for a label sitting directly on a palette fill (e.g. a Trends
// stacked-bar percentage). Picked per slot, not computed live, since these
// are CSS custom properties and their real color isn't known to JS — values
// checked against both the light- and dark-mode hex variant of each slot.
// Every slot reads well with dark ink except indigo, where white wins.
const LIGHT_TEXT_SLOTS = new Set([7]);
const INK_ON_FILL = 'rgba(0, 0, 0, 0.82)';
const WHITE_ON_FILL = '#FFFFFF';

export function paletteColor(i) {
  return PALETTE[i % PALETTE_SIZE];
}

export function labelInkForIndex(i) {
  return LIGHT_TEXT_SLOTS.has(i % PALETTE_SIZE) ? WHITE_ON_FILL : INK_ON_FILL;
}

// Color follows the entity, never its position in a filtered/reordered list —
// archiving or reordering a category/pot must not repaint its neighbors. So
// each category/pot is assigned a slot ONCE at creation time (stored as
// colorIndex on its own record) rather than derived live. This picks the
// first slot not already in use by other current entities, so simultaneously
// visible categories/pots never collide — falls back to round-robin reuse
// once every slot is taken (more than 8 categories/pots).
export function nextColorIndex(usedIndexes) {
  const used = new Set(usedIndexes.filter((v) => v != null));
  for (let i = 0; i < PALETTE_SIZE; i++) {
    if (!used.has(i)) return i;
  }
  return usedIndexes.length % PALETTE_SIZE;
}
