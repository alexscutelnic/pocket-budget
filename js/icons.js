// Small hand-rolled icon set in an SF-Symbols-like outline style.
// Each entry is the inner markup of a 24x24 viewBox SVG.

const PATHS = {
  home: '<path d="M3 11.5 12 4l9 7.5"/><path d="M5.5 10.5V20a1 1 0 0 0 1 1H9.5a.5.5 0 0 0 .5-.5V15a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v5.5a.5.5 0 0 0 .5.5H17.5a1 1 0 0 0 1-1V10.5"/>',
  pots: '<rect x="3" y="8" width="18" height="10" rx="3"/><path d="M3 12h18"/><circle cx="16" cy="15.2" r="1.2" fill="currentColor" stroke="none"/>',
  trends: '<rect x="4" y="12" width="3" height="8" rx="1"/><rect x="10.5" y="8" width="3" height="12" rx="1"/><rect x="17" y="4" width="3" height="16" rx="1"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M12 2.5v3M12 18.5v3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M2.5 12h3M18.5 12h3M4.9 19.1l2.1-2.1M17 7l2.1-2.1"/>',
  cart: '<circle cx="9" cy="20" r="1.2" fill="currentColor" stroke="none"/><circle cx="18" cy="20" r="1.2" fill="currentColor" stroke="none"/><path d="M3 4h2l2.2 11.2a2 2 0 0 0 2 1.6h7.6a2 2 0 0 0 2-1.6L21 8H6"/>',
  'fork-knife': '<path d="M7 2v6M9 2v6M11 2v6M9 8v13"/><path d="M15.5 2c1.6 1.6 1.6 5.4 0 7-.5.5-1 .7-1.5.7V21"/>',
  car: '<path d="M4 16v-3l2-5a2 2 0 0 1 2-1h8a2 2 0 0 1 2 1l2 5v3"/><rect x="3" y="16" width="18" height="3" rx="1"/><circle cx="7.5" cy="19.4" r="1.3" fill="currentColor" stroke="none"/><circle cx="16.5" cy="19.4" r="1.3" fill="currentColor" stroke="none"/>',
  'doc-text': '<path d="M7 3h7l4 4v14a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z"/><path d="M14 3v4h4"/><path d="M9 13h6M9 16h6M9 10h3"/>',
  'game-controller': '<rect x="3" y="8" width="18" height="9" rx="4"/><path d="M8 10.5v4M6 12.5h4"/><circle cx="16" cy="11.5" r="1" fill="currentColor" stroke="none"/><circle cx="18" cy="13.5" r="1" fill="currentColor" stroke="none"/>',
  bag: '<path d="M6 8h12l1 12a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1L6 8Z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/>',
  ellipsis: '<circle cx="6" cy="12" r="1.3" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.3" fill="currentColor" stroke="none"/><circle cx="18" cy="12" r="1.3" fill="currentColor" stroke="none"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  chevron: '<path d="M9 5l7 7-7 7"/>',
  xmark: '<path d="M6 6l12 12M18 6L6 18"/>',
  pencil: '<path d="M4 20l.9-4.2L15.6 5.1a1.5 1.5 0 0 1 2.1 0l1.2 1.2a1.5 1.5 0 0 1 0 2.1L8.2 19.1 4 20Z"/>',
  trash: '<path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M6 7l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13"/>',
  checkmark: '<path d="M5 12l5 5L19 7"/>',
  'arrow-up-circle': '<circle cx="12" cy="12" r="9"/><path d="M12 16V8M8.5 11.5 12 8l3.5 3.5"/>',
  'arrow-down-circle': '<circle cx="12" cy="12" r="9"/><path d="M12 8v8M8.5 12.5 12 16l3.5-3.5"/>',
  star: '<path d="M12 3.3l2.7 5.5 6.1.9-4.4 4.3 1 6-5.4-2.9-5.4 2.9 1-6-4.4-4.3 6.1-.9Z"/>',
  plane: '<path d="M22 2 11 13"/><path d="M22 2 15 22l-4-9-9-4Z"/>',
  heart: '<path d="M12 20s-7-4.2-9.4-8.4C.9 8.1 2.2 4.7 5.4 4.7c2 0 3.3 1 3.9 1.9.6-.9 1.9-1.9 3.9-1.9 3.2 0 4.5 3.4 2.8 6.9C19 15.8 12 20 12 20Z"/>',
  shield: '<path d="M12 3l7 3v5c0 5-3.5 8.5-7 10-3.5-1.5-7-5-7-10V6l7-3Z"/><path d="M9 12l2 2 4-4"/>',
  gift: '<rect x="4" y="9.5" width="16" height="10.5" rx="1.5"/><rect x="3.5" y="6.5" width="17" height="3" rx="1"/><path d="M12 6.5v13.5"/><path d="M12 6.5c0-2.8 2.2-4.5 3.6-3.3 1.4 1.2.4 3.3-3.6 3.3Z"/><path d="M12 6.5c0-2.8-2.2-4.5-3.6-3.3-1.4 1.2-.4 3.3 3.6 3.3Z"/>',
  'wine-glass': '<path d="M8 3h8c0 4.5-1.2 7.5-4 7.5S8 7.5 8 3Z"/><path d="M12 10.5V20"/><path d="M8.3 20.5h7.4"/>',
  tag: '<path d="M11 4H5a1 1 0 0 0-1 1v6a1 1 0 0 0 .3.7l9 9a1 1 0 0 0 1.4 0l6-6a1 1 0 0 0 0-1.4l-9-9A1 1 0 0 0 11 4Z"/><circle cx="8" cy="8" r="1.4" fill="currentColor" stroke="none"/>',
  paw: '<circle cx="7" cy="8.2" r="1.8"/><circle cx="12" cy="6.2" r="1.8"/><circle cx="17" cy="8.2" r="1.8"/><path d="M8 13c-2.4 0-4 1.9-4 3.8 0 1.7 1.7 2.8 3.3 1.9 1-.6 1.8-1 4.7-1s3.7.4 4.7 1c1.6.9 3.3-.2 3.3-1.9 0-1.9-1.6-3.8-4-3.8-2 0-2.9 1-4 1s-2-1-4-1Z"/>',
  medical: '<circle cx="12" cy="12" r="9"/><path d="M12 8v8M8 12h8"/>',
};

export function icon(name, { size = 24, className = '' } = {}) {
  const inner = PATHS[name] || PATHS.ellipsis;
  return `<svg class="icon ${className}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${inner}</svg>`;
}

export const CATEGORY_ICON_KEYS = [
  'cart', 'fork-knife', 'car', 'doc-text', 'game-controller', 'bag', 'ellipsis',
  'heart', 'gift', 'wine-glass', 'tag', 'paw', 'medical', 'home',
];
export const POT_ICON_KEYS = ['pots', 'star', 'plane', 'heart', 'home', 'shield', 'gift', 'bag'];
