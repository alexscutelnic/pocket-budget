import { getSettings, listCategories, listTransactions, listPotEntries } from '../db.js';
import { getRecentPeriods } from '../period.js';
import { formatMoney, escapeHtml } from '../format.js';
import { icon } from '../icons.js';
import { stableColorForId } from '../palette.js';
import { barChart, stackedBarChart, lineChart, legend } from '../charts.js';

const MONTH_SHORT = new Intl.DateTimeFormat('en-GB', { month: 'short' });
const PERIOD_COUNT = 6;

function shortLabel(period) {
  return MONTH_SHORT.format(period.start);
}

function compactMoney(minor) {
  const pounds = minor / 100;
  if (Math.abs(pounds) >= 1000) return `£${(pounds / 1000).toFixed(1).replace(/\.0$/, '')}k`;
  if (Number.isInteger(pounds)) return `£${pounds}`;
  return formatMoney(minor);
}

export async function mount(root) {
  const settings = await getSettings();
  // Include archived categories so historical spend still renders with its
  // original name/color instead of vanishing from past periods.
  const categories = await listCategories({ includeArchived: true });
  const chronological = getRecentPeriods(settings.resetDay, PERIOD_COUNT).reverse();
  const allTx = await listTransactions();
  const allPotEntries = await listPotEntries();

  const hasAnyData = allTx.length > 0 || allPotEntries.length > 0;

  root.innerHTML = `
    <div class="large-title-header">
      <h1 class="title">Trends</h1>
    </div>
    ${hasAnyData ? renderContent() : renderEmptyScreen()}
  `;

  function periodStatsFor(period) {
    const txs = allTx.filter((t) => t.date >= period.startISO && t.date < period.endISO);
    const total = txs.reduce((sum, t) => sum + t.amountMinor, 0);
    const byCategory = {};
    categories.forEach((c) => {
      byCategory[c.id] = txs.filter((t) => t.categoryId === c.id).reduce((sum, t) => sum + t.amountMinor, 0);
    });
    return { period, key: period.startISO, total, byCategory };
  }

  function renderContent() {
    const periodStats = chronological.map(periodStatsFor);
    const thisPeriod = periodStats[periodStats.length - 1];
    const lastPeriod = periodStats[periodStats.length - 2];

    return `
      ${allTx.length > 0 ? renderComparisonCard(thisPeriod, lastPeriod) : ''}
      ${renderSpendPerPeriodCard(periodStats)}
      ${renderSpendByCategoryCard(periodStats)}
      ${renderSavingsCard()}
    `;
  }

  function renderEmptyScreen() {
    return `<div class="empty-state">
      <div class="icon-bubble">${icon('trends')}</div>
      <h3>Nothing to show yet</h3>
      <p>Once you've logged some spending or added money to a pot, your trends will show up here.</p>
    </div>`;
  }

  function renderComparisonCard(thisPeriod, lastPeriod) {
    const delta = thisPeriod.total - lastPeriod.total;
    const up = delta > 0;
    const deltaLabel = delta === 0 ? 'No change' : `${up ? '+' : '−'}${formatMoney(Math.abs(delta))} vs last period`;
    const deltaColor = delta === 0 ? 'var(--label-secondary)' : (up ? 'var(--red)' : 'var(--green)');

    let mover = null;
    let moverDiff = 0;
    categories.forEach((c) => {
      const diff = (thisPeriod.byCategory[c.id] || 0) - (lastPeriod.byCategory[c.id] || 0);
      if (Math.abs(diff) > Math.abs(moverDiff)) { moverDiff = diff; mover = c; }
    });

    return `
      <div class="card summary-card">
        <div class="summary-row">
          <span class="summary-spent">${formatMoney(thisPeriod.total)}</span>
          <span class="summary-limit">${thisPeriod.period.label}</span>
        </div>
        <p class="summary-caption" style="color:${deltaColor}">
          ${delta !== 0 ? icon(up ? 'arrow-up-circle' : 'arrow-down-circle', { size: 14 }) : ''} ${deltaLabel}
        </p>
        ${mover && moverDiff !== 0 ? `
          <div class="mover-row">
            <span class="mover-label">Biggest mover</span>
            <span class="mover-value">${escapeHtml(mover.name)} ${moverDiff > 0 ? '+' : '−'}${formatMoney(Math.abs(moverDiff))}</span>
          </div>` : ''}
      </div>
    `;
  }

  function renderSpendPerPeriodCard(periodStats) {
    if (allTx.length === 0) {
      return `<div class="card-header">Spend per period</div><div class="card">${chartEmptyNote('No spending recorded yet.')}</div>`;
    }
    const bars = periodStats.map((ps) => ({ label: shortLabel(ps.period), value: ps.total }));
    return `
      <div class="card-header">Spend per period</div>
      <div class="card chart-card">${barChart(bars, { valueFormatter: compactMoney })}</div>
    `;
  }

  function renderSpendByCategoryCard(periodStats) {
    if (allTx.length === 0) {
      return `<div class="card-header">Spend by category</div><div class="card">${chartEmptyNote('No spending recorded yet.')}</div>`;
    }
    const series = categories.map((c) => ({
      id: c.id,
      label: c.name,
      color: stableColorForId(c.id),
      valuesByPeriod: Object.fromEntries(periodStats.map((ps) => [ps.key, ps.byCategory[c.id]])),
    }));
    const activeSeries = series.filter((s) => Object.values(s.valuesByPeriod).some((v) => v > 0));
    const chartPeriods = periodStats.map((ps) => ({ key: ps.key, label: shortLabel(ps.period) }));

    return `
      <div class="card-header">Spend by category</div>
      <div class="card chart-card">
        ${stackedBarChart(chartPeriods, activeSeries)}
        ${legend(activeSeries.map((s) => ({ label: s.label, color: s.color })))}
      </div>
    `;
  }

  function renderSavingsCard() {
    if (allPotEntries.length === 0) {
      return `<div class="card-header">Total savings</div><div class="card">${chartEmptyNote('No pot activity yet.')}</div>`;
    }
    const points = chronological.map((p) => ({
      label: shortLabel(p),
      value: allPotEntries.filter((e) => e.date < p.endISO).reduce((sum, e) => sum + e.amountMinor, 0),
    }));
    return `
      <div class="card-header">Total savings</div>
      <div class="card chart-card">${lineChart(points, { valueFormatter: compactMoney })}</div>
    `;
  }

  function chartEmptyNote(text) {
    return `<div class="empty-state" style="padding:32px 24px;">
      <p style="margin:0;">${escapeHtml(text)}</p>
    </div>`;
  }
}
