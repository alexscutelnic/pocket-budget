// Shared categorical palette for categories/pots across Home, Pots, and Trends,
// so the same entity always reads as the same color. Values are CSS custom
// properties (see :root / dark-mode block in styles.css) so each swatch swaps
// to its Apple-documented dark-mode variant automatically — light-mode iOS
// system colors read too light/washed at the same lightness on a black surface.
export const PALETTE = [
  'var(--pal-1)', 'var(--pal-2)', 'var(--pal-3)', 'var(--pal-4)',
  'var(--pal-5)', 'var(--pal-6)', 'var(--pal-7)', 'var(--pal-8)',
];

export function paletteColor(i) {
  return PALETTE[i % PALETTE.length];
}

// Color follows the entity, never its position in a filtered/reordered list —
// archiving or reordering a category/pot must not repaint its neighbors.
// Derived purely from the id, so it's stable for the entity's lifetime.
export function stableColorForId(id) {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31 + id.charCodeAt(i)) | 0;
  }
  return paletteColor(Math.abs(hash));
}
