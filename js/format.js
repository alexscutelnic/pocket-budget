const MONEY_FORMATTER = new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' });

export function formatMoney(amountMinor) {
  return MONEY_FORMATTER.format((amountMinor || 0) / 100);
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
