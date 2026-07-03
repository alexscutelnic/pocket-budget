import { getSettings, listCategories, listTransactions, listPotEntries } from '../db.js';
import { getRecentPeriods, toISODateString } from '../period.js';
import { formatMoney, formatShortDate, escapeHtml } from '../format.js';
import { icon } from '../icons.js';
import { paletteColor, labelInkForIndex } from '../palette.js';
import { barChart, stackedBarChart, lineChart, paceLineChart, legend } from '../charts.js';

const MONTH_SHORT = new Intl.DateTimeFormat('en-GB', { month: 'short' });
const DEFAULT_PERIOD_COUNT = 6;
const PERIOD_COUNT_OPTIONS = [3, 6, 12];

// A period is labeled by the month it ENDS in (its last included day, since
// period.end is exclusive): Jun 25 – Jul 24 reads as "Jul" — the month most
// of the cycle covers and the payday month people think of it as.
function shortLabel(period) {
  return MONTH_SHORT.format(new Date(period.end.getTime() - 86400000));
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

    return `
      ${renderPeriodPaceCard()}
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

  // Cumulative spend by day, this period vs the same day-of-period last
  // period — "am I spending faster or slower than last month?".
  function renderPeriodPaceCard() {
    const current = chronological[chronological.length - 1];
    const previous = chronological[chronological.length - 2];
    const days = Math.round((current.end - current.start) / 86400000);

    const today = new Date();
    const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const todayIdx = Math.min(Math.max(Math.round((startOfToday - current.start) / 86400000), 0), days - 1);

    function cumulativeByDay(period, numDays) {
      const perDay = new Array(numDays).fill(0);
      for (const t of allTx) {
        if (t.date < period.startISO || t.date >= period.endISO) continue;
        const [y, m, d] = t.date.split('-').map(Number);
        const idx = Math.round((new Date(y, m - 1, d) - period.start) / 86400000);
        if (idx >= 0 && idx < numDays) perDay[idx] += t.amountMinor;
      }
      let running = 0;
      return perDay.map((v) => (running += v));
    }

    const currentCum = cumulativeByDay(current, days).slice(0, todayIdx + 1);
    const prevDays = Math.round((previous.end - previous.start) / 86400000);
    // Clip the previous period to the current period's day domain — the
    // comparison is day-for-day, and its full total already has its own card.
    const prevCum = cumulativeByDay(previous, prevDays).slice(0, days);

    const spentSoFar = currentCum[currentCum.length - 1] || 0;
    const prevHasData = (prevCum[prevCum.length - 1] || 0) > 0;

    if (spentSoFar === 0 && !prevHasData) {
      return `<div class="card-header">This period, day by day</div><div class="card">${chartEmptyNote('No spending recorded yet.')}</div>`;
    }

    const sameDayIdx = Math.min(todayIdx, prevCum.length - 1);
    const sameDayLast = prevCum[sameDayIdx] || 0;
    const delta = spentSoFar - sameDayLast;
    const up = delta > 0;
    const deltaColor = delta === 0 ? 'var(--label-secondary)' : (up ? 'var(--red)' : 'var(--green)');
    const deltaLabel = delta === 0
      ? 'Level with this point last period'
      : `${formatMoney(Math.abs(delta))} ${up ? 'more' : 'less'} than this point last period`;

    // Biggest mover on the same day-for-day basis as the rest of the card:
    // each category's spend so far this period vs its spend by the same day
    // of the previous period — so all numbers here answer one question.
    const todayISO = toISODateString(startOfToday);
    const prevCutoffISO = toISODateString(new Date(previous.start.getTime() + (sameDayIdx + 1) * 86400000));
    let mover = null;
    let moverDiff = 0;
    categories.forEach((c) => {
      const cur = allTx
        .filter((t) => t.categoryId === c.id && t.date >= current.startISO && t.date <= todayISO)
        .reduce((sum, t) => sum + t.amountMinor, 0);
      const prev = allTx
        .filter((t) => t.categoryId === c.id && t.date >= previous.startISO && t.date < prevCutoffISO)
        .reduce((sum, t) => sum + t.amountMinor, 0);
      const diff = cur - prev;
      if (Math.abs(diff) > Math.abs(moverDiff)) { moverDiff = diff; mover = c; }
    });

    const ticks = [];
    for (let i = 0; i < days; i += 7) {
      ticks.push({ index: i, label: formatShortDate(toISODateString(new Date(current.start.getTime() + i * 86400000))) });
    }

    const chart = paceLineChart({
      days,
      ticks,
      current: currentCum,
      previous: prevHasData ? prevCum : [],
      valueFormatter: compactMoney,
    });

    const chartLegend = prevHasData
      ? legend([
          { label: 'This period', color: 'var(--blue)' },
          { label: 'Last period', color: 'color-mix(in srgb, var(--blue) 35%, transparent)' },
        ])
      : '';

    return `
      <div class="card-header">This period, day by day</div>
      <div class="card chart-card">
        <div class="summary-row" style="padding:12px 12px 0;">
          <span class="summary-spent">${formatMoney(spentSoFar)}</span>
          <span class="summary-limit">${current.label}</span>
        </div>
        <p class="summary-caption" style="color:${deltaColor};padding:0 12px;">
          ${delta !== 0 ? icon(up ? 'arrow-up-circle' : 'arrow-down-circle', { size: 14 }) : ''} ${deltaLabel}
        </p>
        ${chart}
        ${chartLegend}
        ${mover && moverDiff !== 0 ? `
          <div class="mover-row" style="margin:10px 12px 4px;">
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
