// Hand-rolled inline SVG chart primitives — no chart library, per the
// project's "vendor or hand-roll" constraint. Each function returns markup
// for a responsive (viewBox-scaled) SVG plus any legend/label HTML the
// caller should place alongside it.

const GAP = 2; // surface-color gap between touching marks, per design spec

function roundedTopPath(x, y, w, h, r) {
  const rr = Math.max(0, Math.min(r, h / 2, w / 2));
  if (h <= 0 || w <= 0) return '';
  return `M${x},${y + h} L${x},${y + rr} Q${x},${y} ${x + rr},${y} L${x + w - rr},${y} Q${x + w},${y} ${x + w},${y + rr} L${x + w},${y + h} Z`;
}

function niceMax(value) {
  if (value <= 0) return 1;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  const normalized = value / magnitude;
  let niceNormalized;
  if (normalized <= 1) niceNormalized = 1;
  else if (normalized <= 2) niceNormalized = 2;
  else if (normalized <= 5) niceNormalized = 5;
  else niceNormalized = 10;
  return niceNormalized * magnitude;
}

// Single-hue magnitude bar chart — total per period, most recent emphasized.
export function barChart(bars, { width = 328, height = 150, barMaxWidth = 28, valueFormatter = String } = {}) {
  const padTop = 22;
  const padBottom = 20;
  const chartH = height - padTop - padBottom;
  const max = niceMax(Math.max(...bars.map((b) => b.value), 0));
  const n = bars.length;
  const slot = width / n;
  const barW = Math.min(barMaxWidth, slot * 0.55);

  const baseline = padTop + chartH;

  const parts = bars.map((b, i) => {
    const cx = slot * i + slot / 2;
    const x = cx - barW / 2;
    const h = max > 0 ? (b.value / max) * chartH : 0;
    const y = baseline - h;
    const emphasis = i === n - 1;
    const opacity = emphasis ? 1 : 0.45;
    const path = h > 0 ? `<path d="${roundedTopPath(x, y, barW, h, 4)}" fill="var(--blue)" opacity="${opacity}"/>` : '';
    const labelY = h > 0 ? y - 6 : baseline - 6;
    const label = b.value > 0
      ? `<text x="${cx}" y="${labelY}" text-anchor="middle" font-size="11" font-weight="${emphasis ? '600' : '400'}" fill="${emphasis ? 'var(--label-primary)' : 'var(--label-secondary)'}">${valueFormatter(b.value)}</text>`
      : '';
    const tick = `<text x="${cx}" y="${height - 4}" text-anchor="middle" font-size="11" fill="var(--label-secondary)">${escapeXml(b.label)}</text>`;
    return `<g>${path}${label}${tick}</g>`;
  }).join('');

  return `
    <svg viewBox="0 0 ${width} ${height}" width="100%" height="${height}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Total spend per period">
      <line x1="0" y1="${baseline}" x2="${width}" y2="${baseline}" stroke="var(--separator)" stroke-width="1"/>
      ${parts}
    </svg>
  `;
}

// Stacked bar chart — spend by category per period. Categories keep a fixed
// slot/color across the whole app (see js/palette.js); a legend is always
// shown since this chart has >1 series (categorical color rule).
const SEGMENT_LABEL_MIN_HEIGHT = 16; // below this, "NN%" won't fit with padding — skip it, per marks spec

export function stackedBarChart(periods, series, { width = 328, height = 150, barMaxWidth = 28 } = {}) {
  const padTop = 10;
  const padBottom = 20;
  const chartH = height - padTop - padBottom;
  const totals = periods.map((p) => series.reduce((sum, s) => sum + (s.valuesByPeriod[p.key] || 0), 0));
  const max = niceMax(Math.max(...totals, 0));
  const n = periods.length;
  const slot = width / n;
  const barW = Math.min(barMaxWidth, slot * 0.55);
  const baseline = padTop + chartH;

  const bars = periods.map((p, i) => {
    const cx = slot * i + slot / 2;
    const x = cx - barW / 2;
    const activeSeries = series.filter((s) => (s.valuesByPeriod[p.key] || 0) > 0);
    const periodTotal = totals[i];
    let cumulative = 0;
    const segs = activeSeries.map((s, segIdx) => {
      const value = s.valuesByPeriod[p.key] || 0;
      const rawH = max > 0 ? (value / max) * chartH : 0;
      const segTop = cumulative + rawH;
      const isFirst = segIdx === 0;
      const isLast = segIdx === activeSeries.length - 1;
      const yBottomPx = baseline - cumulative - (isFirst ? 0 : GAP / 2);
      const yTopPx = baseline - segTop + (isLast ? 0 : GAP / 2);
      const h = Math.max(0, yBottomPx - yTopPx);
      cumulative = segTop;
      if (h <= 0) return '';
      const shape = isLast
        ? `<path d="${roundedTopPath(x, yTopPx, barW, h, 4)}" fill="${s.color}"/>`
        : `<rect x="${x}" y="${yTopPx}" width="${barW}" height="${h}" fill="${s.color}"/>`;
      let label = '';
      if (h >= SEGMENT_LABEL_MIN_HEIGHT && periodTotal > 0) {
        const pct = Math.round((value / periodTotal) * 100);
        const labelY = yTopPx + h / 2 + 3.5;
        label = `<text x="${cx}" y="${labelY}" text-anchor="middle" font-size="10" font-weight="600" fill="${s.textColor || 'var(--label-primary)'}">${pct}%</text>`;
      }
      return shape + label;
    }).join('');
    const tick = `<text x="${cx}" y="${height - 4}" text-anchor="middle" font-size="11" fill="var(--label-secondary)">${escapeXml(p.label)}</text>`;
    return `<g>${segs}${tick}</g>`;
  }).join('');

  return `
    <svg viewBox="0 0 ${width} ${height}" width="100%" height="${height}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Spend by category per period">
      <line x1="0" y1="${baseline}" x2="${width}" y2="${baseline}" stroke="var(--separator)" stroke-width="1"/>
      ${bars}
    </svg>
  `;
}

// Single-series line chart — e.g. total savings over time. No legend needed
// (one series; the card title already names it) — end point is direct-labeled.
export function lineChart(points, { width = 328, height = 130, color = 'var(--green)', valueFormatter = String } = {}) {
  const padTop = 24;
  const padBottom = 10;
  const padX = 8;
  const chartH = height - padTop - padBottom;
  const values = points.map((p) => p.value);
  const max = niceMax(Math.max(...values, 0));
  const min = Math.min(0, ...values);
  const range = max - min || 1;
  const n = points.length;
  const stepX = n > 1 ? (width - padX * 2) / (n - 1) : 0;

  const coords = points.map((p, i) => {
    const x = padX + stepX * i;
    const y = padTop + chartH - ((p.value - min) / range) * chartH;
    return [x, y];
  });

  const linePath = coords.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x},${y}`).join(' ');
  const baselineY = padTop + chartH - ((0 - min) / range) * chartH;

  const dots = coords.map(([x, y], i) => {
    const isLast = i === coords.length - 1;
    return `<circle cx="${x}" cy="${y}" r="${isLast ? 5 : 3}" fill="${color}" stroke="var(--bg-secondary)" stroke-width="2"/>`;
  }).join('');

  const [lastX, lastY] = coords[coords.length - 1];
  const endLabel = points.length
    ? `<text x="${Math.min(lastX, width - 4)}" y="${Math.max(lastY - 12, 12)}" text-anchor="end" font-size="12" font-weight="600" fill="var(--label-primary)">${valueFormatter(points[points.length - 1].value)}</text>`
    : '';

  const ticks = points.map((p, i) => {
    const [x] = coords[i];
    return `<text x="${x}" y="${height - 2}" text-anchor="middle" font-size="10" fill="var(--label-secondary)">${escapeXml(p.label)}</text>`;
  }).join('');

  return `
    <svg viewBox="0 0 ${width} ${height}" width="100%" height="${height}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Total savings over time">
      <line x1="0" y1="${baselineY}" x2="${width}" y2="${baselineY}" stroke="var(--separator)" stroke-width="1"/>
      <path d="${linePath}" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      ${dots}
      ${endLabel}
      ${ticks}
    </svg>
  `;
}

// Pass an `id` per item to make it tappable — the caller handles
// `data-action="select-legend-item"` / `data-id` via its own delegation.
export function legend(items) {
  return `<div class="chart-legend">${items.map((it) => `
    <div class="legend-item ${it.id ? 'legend-item-tappable' : ''}" ${it.id ? `data-action="select-legend-item" data-id="${it.id}"` : ''}>
      <span class="legend-swatch" style="background:${it.color}"></span>
      <span class="legend-label">${escapeXml(it.label)}</span>
    </div>`).join('')}</div>`;
}

function escapeXml(str) {
  return String(str ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}
