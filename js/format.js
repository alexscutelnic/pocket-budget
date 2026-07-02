// Current app-wide currency (set once at boot from settings, and again
// whenever the user changes it in Settings — see app.js / screens/settings.js).
// Formatting uses the device's own locale (undefined) so decimal/thousands
// separators and symbol placement follow the user's own region, while the
// currency itself follows what they picked in the app.
let currentCurrency = 'GBP';
const formatterCache = new Map();
const symbolCache = new Map();

export function setCurrency(code) {
  currentCurrency = code || 'GBP';
}

function getFormatter(code) {
  if (!formatterCache.has(code)) {
    formatterCache.set(code, new Intl.NumberFormat(undefined, { style: 'currency', currency: code }));
  }
  return formatterCache.get(code);
}

export function formatMoney(amountMinor, currencyCode) {
  return getFormatter(currencyCode || currentCurrency).format((amountMinor || 0) / 100);
}

// Just the symbol ("£", "$", "€", …) — for input placeholders like "£0.00".
export function currencySymbol(currencyCode) {
  const code = currencyCode || currentCurrency;
  if (!symbolCache.has(code)) {
    const parts = getFormatter(code).formatToParts(0);
    const symbolPart = parts.find((p) => p.type === 'currency');
    symbolCache.set(code, symbolPart ? symbolPart.value : code);
  }
  return symbolCache.get(code);
}

// Parses user input like "12.5", "12", "£12.50" into integer pence.
// Returns null if the input isn't a valid non-negative amount.
export function parseAmountToMinor(input) {
  if (input == null) return null;
  const cleaned = String(input).replace(/[^0-9.]/g, '');
  if (cleaned === '' || cleaned === '.') return null;
  const value = Number(cleaned);
  if (!Number.isFinite(value) || value < 0) return null;
  return Math.round(value * 100);
}

export function formatShortDate(isoDateString) {
  const [y, m, d] = isoDateString.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' }).format(date);
}

export function formatLongDate(isoDateString) {
  const [y, m, d] = isoDateString.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).format(date);
}

export function escapeHtml(str) {
  return String(str ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}
