// Pay-cycle math: periods run resetDay -> resetDay (exclusive), clamped to
// the last day of shorter months.

import { dateLocale } from './i18n.js';

// Day + month formatted together by Intl so each locale gets its own word
// order AND grammar — Russian needs the genitive ("25 июня", not "25 июнь"),
// which only combined formatting produces.
function monthDay(date) {
  return new Intl.DateTimeFormat(dateLocale(), { day: 'numeric', month: 'short' }).format(date);
}

function daysInMonth(year, monthIndex) {
  return new Date(year, monthIndex + 1, 0).getDate();
}

function clampDay(year, monthIndex, day) {
  return Math.min(day, daysInMonth(year, monthIndex));
}

function makeResetDate(year, monthIndex, resetDay) {
  return new Date(year, monthIndex, clampDay(year, monthIndex, resetDay));
}

function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function toISODateString(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function todayISODateString() {
  return toISODateString(new Date());
}

function addMonths(year, monthIndex, delta) {
  let m = monthIndex + delta;
  let y = year;
  while (m > 11) { m -= 12; y += 1; }
  while (m < 0) { m += 12; y -= 1; }
  return { year: y, monthIndex: m };
}

export function getPeriodForDate(resetDay, refDate = new Date()) {
  const ref = startOfDay(refDate);
  const y = ref.getFullYear();
  const m = ref.getMonth();

  let periodStart = makeResetDate(y, m, resetDay);
  let endParts = addMonths(y, m, 1);

  if (ref < periodStart) {
    const startParts = addMonths(y, m, -1);
    periodStart = makeResetDate(startParts.year, startParts.monthIndex, resetDay);
    endParts = { year: y, monthIndex: m };
  }

  const periodEnd = makeResetDate(endParts.year, endParts.monthIndex, resetDay);
  const lastDay = new Date(periodEnd.getTime() - 86400000);
  const daysRemaining = Math.max(0, Math.round((periodEnd - ref) / 86400000));

  const label = `${monthDay(periodStart)} – ${monthDay(lastDay)}`;

  return {
    start: periodStart,
    end: periodEnd,
    startISO: toISODateString(periodStart),
    endISO: toISODateString(periodEnd),
    label,
    daysRemaining,
  };
}

// Returns the N most recent periods, most recent first, for Trends.
export function getRecentPeriods(resetDay, count, refDate = new Date()) {
  const periods = [];
  let cursor = getPeriodForDate(resetDay, refDate);
  periods.push(cursor);
  for (let i = 1; i < count; i++) {
    const dayBeforeStart = new Date(cursor.start.getTime() - 86400000);
    cursor = getPeriodForDate(resetDay, dayBeforeStart);
    periods.push(cursor);
  }
  return periods;
}
