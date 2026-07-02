import { getSettings, listCategories, listTransactions, listPotEntries } from '../db.js';
import { getRecentPeriods } from '../period.js';
import { formatMoney, escapeHtml } from '../format.js';
import { icon } from '../icons.js';
import { paletteColor, labelInkForIndex } from '../palette.js';
import { barChart, stackedBarChart, lineChart, legend } from '../charts.js';

const MONTH_SHORT = new Intl.DateTimeFormat('en-GB', { month: 'short' });
const DEFAULT_PERIOD_COUNT = 6;
const PERIOD_COUNT_OPTIONS = [3, 6, 12];

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
  const allTx = await listTransactions();
  const allPotEntries = await listPotEntries();

  const hasAnyData = allTx.length > 0 || allPotEntries.length > 0;

  let periodCount = DEFAULT_PERIOD_COUNT;
  let chronological = getRecentPeriods(settings.resetDay, periodCount).reverse();
  let rangeStartISO = chronological[0].startISO;
  let rangeEndISO = chronological[chronological.length - 1].endISO;

  const view = { screen: 'overview', categoryId: null };

  function setPeriodCount(n) {
    periodCount = n;
    chronological = getRecentPeriods(settings.resetDay, periodCount).reverse();
    rangeStartISO = chronological[0].startISO;
    rangeEndISO = chronological[chronological.length - 1].endISO;
    render();
  }

  function render() {
    root.innerHTML = view.screen === 'category-notes' ? renderCategoryNotes() : renderOverview();
  }

  // ---- Overview screen -----------------------------------------------------

  function renderOverview() {
    return `
      <div class="large-title-header">
        <h1 class="title">Trends</h1>
      </div>
      ${renderPeriodSlicer()}
      ${hasAnyData ? renderContent() : renderEmptyScreen()}
    `;
  }

  function renderPeriodSlicer() {
    return `
      <div class="segmented-control">
        ${PERIOD_COUNT_OPTIONS.map((n) => `<button class="${n === periodCount ? 'active' : ''}" data-action="set-period-count" data-count="${n}">Last ${n}</button>`).join('')}
      </div>
    `;
  }

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
      color: paletteColor(c.colorIndex),
      textColor: labelInkForIndex(c.colorIndex),
      valuesByPeriod: Object.fromEntries(periodStats.map((ps) => [ps.key, ps.byCategory[c.id]])),
    }));
    const activeSeries = series.filter((s) => Object.values(s.valuesByPeriod).some((v) => v > 0));
    const chartPeriods = periodStats.map((ps) => ({ key: ps.key, label: shortLabel(ps.period) }));

    return `
      <div class="card-header">Spend by category</div>
      <div class="card chart-card">
        ${stackedBarChart(chartPeriods, activeSeries)}
        ${legend(activeSeries.map((s) => ({ id: s.id, label: s.label, color: s.color })))}
        <p class="field-label" style="padding:8px 12px 0;">Tap a category to see how it breaks down.</p>
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

  // ---- Category note-breakdown screen ---------------------------------------

  function renderCategoryNotes() {
    const category = categories.find((c) => c.id === view.categoryId);
    if (!category) {
      view.screen = 'overview';
      return renderOverview();
    }
    const color = paletteColor(category.colorIndex);
    const txs = allTx.filter((t) => t.categoryId === category.id && t.date >= rangeStartISO && t.date < rangeEndISO);
    const total = txs.reduce((sum, t) => sum + t.amountMinor, 0);

    const groups = new Map();
    for (const t of txs) {
      const trimmed = (t.note || '').trim();
      const key = trimmed ? trimmed.toLowerCase() : '\0none';
      if (!groups.has(key)) groups.set(key, { label: trimmed || 'No note', amount: 0, count: 0 });
      const g = groups.get(key);
      g.amount += t.amountMinor;
      g.count += 1;
    }
    const rows = Array.from(groups.values()).sort((a, b) => b.amount - a.amount);

    const rowsHtml = rows.map((g) => {
      const pct = total > 0 ? Math.round((g.amount / total) * 100) : 0;
      return `
        <div class="list-row note-row">
          <div class="note-row-top">
            <span class="note-row-label">${escapeHtml(g.label)}${g.count > 1 ? ` <span class="note-row-count">×${g.count}</span>` : ''}</span>
            <span class="note-row-amount">${formatMoney(g.amount)}</span>
          </div>
          <div class="note-row-bottom">
            <div class="progress-track"><div class="progress-fill" style="width:${pct}%;background:${color}"></div></div>
            <span class="note-row-pct">${pct}%</span>
          </div>
        </div>`;
    }).join('');

    return `
      <div class="nav-bar">
        <button class="back-btn" data-action="back-to-trends">${icon('chevron', { className: 'back-chevron' })}<span>Trends</span></button>
      </div>
      <div class="large-title-header" style="text-align:center;">
        <div class="icon-bubble" style="background:${color};margin:0 auto 8px;">${icon(category.icon)}</div>
        <h1 class="title">${escapeHtml(category.name)}</h1>
        <p class="subtitle">${formatMoney(total)} · last ${chronological.length} periods</p>
      </div>
      <div class="card-header">By note</div>
      <div class="card">${rowsHtml || chartEmptyNote('No transactions in this range yet.')}</div>
    `;
  }

  // ---- Event delegation ---------------------------------------------------

  root.addEventListener('click', (e) => {
    const actionEl = e.target.closest('[data-action]');
    if (!actionEl) return;
    const action = actionEl.dataset.action;

    if (action === 'select-legend-item') {
      view.screen = 'category-notes';
      view.categoryId = actionEl.dataset.id;
      return render();
    }
    if (action === 'back-to-trends') {
      view.screen = 'overview';
      view.categoryId = null;
      return render();
    }
    if (action === 'set-period-count') {
      return setPeriodCount(parseInt(actionEl.dataset.count, 10));
    }
  });

  render();
}
