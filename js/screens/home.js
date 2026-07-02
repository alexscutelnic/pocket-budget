import {
  getSettings,
  updateSettings,
  listCategories,
  listTransactions,
  addTransaction,
  updateTransaction,
  softDeleteTransaction,
  listPotEntries,
} from '../db.js';
import { getPeriodForDate, todayISODateString } from '../period.js';
import { formatMoney, parseAmountToMinor, formatShortDate, escapeHtml } from '../format.js';
import { icon } from '../icons.js';
import { stableColorForId } from '../palette.js';

function progressClass(ratio) {
  if (ratio > 1) return 'over';
  if (ratio > 0.75) return 'warn';
  return '';
}

export async function mount(root) {
  let settings = await getSettings();
  let categories = await listCategories();
  let period = getPeriodForDate(settings.resetDay);
  let transactions = await listTransactions({ from: period.startISO, to: period.endISO });
  let potEntries = await listPotEntries();

  const view = { screen: 'list', categoryId: null };
  let sheet = null; // { mode: 'add' | 'edit', categoryId, txId?, defaults? }

  async function reloadData() {
    settings = await getSettings();
    categories = await listCategories();
    period = getPeriodForDate(settings.resetDay);
    transactions = await listTransactions({ from: period.startISO, to: period.endISO });
    potEntries = await listPotEntries();
  }

  function categorySpend(categoryId) {
    return transactions
      .filter((t) => t.categoryId === categoryId)
      .reduce((sum, t) => sum + t.amountMinor, 0);
  }

  // Net money moved into pots this period (deposits positive, withdrawals
  // negative via amountMinor's own sign) — pot contributions count as an
  // outflow from income; withdrawals give money back.
  function netPotChangeThisPeriod() {
    return potEntries
      .filter((e) => e.date >= period.startISO && e.date < period.endISO)
      .reduce((sum, e) => sum + e.amountMinor, 0);
  }

  function shouldShowExportBanner() {
    const reference = settings.lastExportAt || settings.createdAt;
    if (!reference) return false;
    const daysSince = (Date.now() - new Date(reference).getTime()) / 86400000;
    if (daysSince <= 30) return false;
    if (settings.exportBannerDismissedAt) {
      const daysSinceDismiss = (Date.now() - new Date(settings.exportBannerDismissedAt).getTime()) / 86400000;
      if (daysSinceDismiss < 7) return false;
    }
    return true;
  }

  function render() {
    root.innerHTML = view.screen === 'category' ? renderCategoryDetail() : renderList();
    if (sheet) {
      root.insertAdjacentHTML('beforeend', renderSheet());
      const amountInput = root.querySelector('#tx-amount');
      if (amountInput) {
        amountInput.focus();
        updateSaveState();
      }
    }
  }

  // ---- List screen -----------------------------------------------------

  function renderList() {
    const totalSpent = transactions.reduce((sum, t) => sum + t.amountMinor, 0);

    const rows = categories.map((c) => {
      const spent = categorySpend(c.id);
      const ratio = c.limitMinor > 0 ? spent / c.limitMinor : 0;
      return `
        <div class="list-row category-row tappable" data-action="open-category" data-category-id="${c.id}">
          <div class="category-top">
            <div class="icon-bubble" style="background:${stableColorForId(c.id)}">${icon(c.icon)}</div>
            <div class="category-name">${escapeHtml(c.name)}</div>
            <div class="category-amounts"><strong>${formatMoney(spent)}</strong> / ${formatMoney(c.limitMinor)}</div>
            <span class="chevron">${icon('chevron')}</span>
          </div>
          <div class="progress-track"><div class="progress-fill ${progressClass(ratio)}" style="width:${Math.min(ratio, 1) * 100}%"></div></div>
        </div>`;
    }).join('');

    return `
      <div class="large-title-header">
        <h1 class="title">Home</h1>
        <p class="subtitle">${period.label} · ${period.daysRemaining} day${period.daysRemaining === 1 ? '' : 's'} left</p>
      </div>

      ${shouldShowExportBanner() ? renderExportBanner() : ''}
      ${settings.incomeMinor > 0 ? renderRemainingCard(totalSpent) : renderIncomeNudge()}

      <div class="card-header">Categories</div>
      <div class="card">${rows || emptyCategoriesState()}</div>

      <button class="fab" data-action="open-add" aria-label="Add transaction">${icon('plus')}</button>
    `;
  }

  function renderRemainingCard(totalSpent) {
    const netPotChange = netPotChangeThisPeriod();
    const remaining = settings.incomeMinor - totalSpent - netPotChange;
    const spentRatio = (totalSpent + netPotChange) / settings.incomeMinor;

    const breakdown = [`Income ${formatMoney(settings.incomeMinor)}`, `Spent ${formatMoney(totalSpent)}`];
    if (netPotChange > 0) breakdown.push(`Saved ${formatMoney(netPotChange)}`);
    else if (netPotChange < 0) breakdown.push(`Withdrew ${formatMoney(-netPotChange)}`);

    return `
      <div class="card summary-card">
        <div class="summary-row">
          <span class="summary-spent">${formatMoney(remaining)}</span>
          <span class="summary-limit">of ${formatMoney(settings.incomeMinor)}</span>
        </div>
        <p class="summary-caption" style="${remaining < 0 ? 'color:var(--red)' : ''}">${remaining < 0 ? 'over your income this period' : 'remaining this period'}</p>
        <div class="summary-progress progress-track">
          <div class="progress-fill ${progressClass(spentRatio)}" style="width:${Math.min(Math.max(spentRatio, 0), 1) * 100}%"></div>
        </div>
        <p class="summary-breakdown">${breakdown.join(' · ')}</p>
      </div>
    `;
  }

  function renderIncomeNudge() {
    return `
      <div class="card summary-card">
        <div class="nudge-row">
          <div class="icon-bubble" style="background:var(--fill-quaternary);color:var(--label-secondary);">${icon('pots')}</div>
          <div style="flex:1;">
            <p style="margin:0;font-weight:600;">Set your income</p>
            <p style="margin:2px 0 0;font-size:13px;color:var(--label-secondary);">Add your monthly income in Settings to see what's left to spend.</p>
          </div>
        </div>
        <button class="save-btn" data-action="goto-settings" style="margin-top:12px;">Go to Settings</button>
      </div>
    `;
  }

  function renderExportBanner() {
    return `
      <div class="banner">
        <span style="color:var(--orange);flex-shrink:0;">${icon('doc-text', { size: 20 })}</span>
        <p>It's been a while since your last backup. <span data-action="goto-settings" style="color:var(--blue);font-weight:600;">Export now</span></p>
        <button data-action="dismiss-export-banner" aria-label="Dismiss">${icon('xmark', { size: 14 })}</button>
      </div>
    `;
  }

  function emptyCategoriesState() {
    return `<div class="empty-state">
      <div class="icon-bubble">${icon('cart')}</div>
      <h3>No categories yet</h3>
      <p>Add a category in Settings to start tracking spending.</p>
    </div>`;
  }

  // ---- Category detail screen -------------------------------------------

  function renderCategoryDetail() {
    const category = categories.find((c) => c.id === view.categoryId);
    if (!category) {
      view.screen = 'list';
      return renderList();
    }
    const txs = transactions.filter((t) => t.categoryId === category.id);
    const spent = categorySpend(category.id);
    const ratio = category.limitMinor > 0 ? spent / category.limitMinor : 0;

    const rows = txs.map((t) => `
      <div class="list-row tx-row">
        <div class="tx-date">${formatShortDate(t.date)}</div>
        <div class="tx-note">
          <div class="note-text ${t.note ? '' : 'no-note'}">${escapeHtml(t.note) || 'No note'}</div>
        </div>
        <div class="tx-amount">${formatMoney(t.amountMinor)}</div>
        <div class="row-actions" style="padding:0;">
          <button data-action="edit-tx" data-tx-id="${t.id}" aria-label="Edit">${icon('pencil')}</button>
          <button data-action="delete-tx" data-tx-id="${t.id}" aria-label="Delete" style="color:var(--red)">${icon('trash')}</button>
        </div>
      </div>`).join('');

    return `
      <div class="nav-bar">
        <button class="back-btn" data-action="back-to-list">${icon('chevron', { className: 'back-chevron' })}<span>Home</span></button>
      </div>
      <div class="large-title-header">
        <div class="icon-bubble" style="background:${stableColorForId(category.id)};margin-bottom:8px;">${icon(category.icon)}</div>
        <h1 class="title">${escapeHtml(category.name)}</h1>
        <p class="subtitle">${formatMoney(spent)} of ${formatMoney(category.limitMinor)} · ${period.label}</p>
      </div>
      <div class="card summary-card" style="padding-top:0;padding-bottom:14px;">
        <div class="progress-track"><div class="progress-fill ${progressClass(ratio)}" style="width:${Math.min(ratio, 1) * 100}%"></div></div>
      </div>
      <div class="card-header">Transactions</div>
      <div class="card">${rows || emptyTransactionsState()}</div>
      <button class="fab" data-action="open-add" aria-label="Add transaction">${icon('plus')}</button>
    `;
  }

  function emptyTransactionsState() {
    return `<div class="empty-state">
      <div class="icon-bubble">${icon('doc-text')}</div>
      <h3>Nothing here yet</h3>
      <p>Transactions you add to this category this period will show up here.</p>
    </div>`;
  }

  // ---- Add / edit sheet -------------------------------------------------

  function openAddSheet() {
    const defaultCategoryId = view.screen === 'category' ? view.categoryId : (categories[0]?.id ?? null);
    sheet = {
      mode: 'add',
      categoryId: defaultCategoryId,
      defaults: { amountMinor: null, note: '', date: todayISODateString() },
    };
    render();
  }

  function openEditSheet(txId) {
    const t = transactions.find((tx) => tx.id === txId);
    if (!t) return;
    sheet = {
      mode: 'edit',
      txId,
      categoryId: t.categoryId,
      defaults: { amountMinor: t.amountMinor, note: t.note || '', date: t.date },
    };
    render();
  }

  function closeSheet() {
    sheet = null;
    render();
  }

  function renderSheet() {
    const chips = categories.map((c) => `
      <div class="category-chip ${c.id === sheet.categoryId ? 'selected' : ''}" data-action="select-category" data-category-id="${c.id}">
        <div class="icon-bubble" style="background:${stableColorForId(c.id)}">${icon(c.icon)}</div>
        <div class="chip-label">${escapeHtml(c.name)}</div>
      </div>`).join('');

    const amountValue = sheet.defaults.amountMinor != null ? (sheet.defaults.amountMinor / 100).toFixed(2) : '';

    return `
      <div class="sheet-backdrop">
        <div class="sheet">
          <div class="sheet-header">
            <h2>${sheet.mode === 'edit' ? 'Edit Transaction' : 'Add Transaction'}</h2>
            <button class="sheet-close" data-action="close-sheet">${icon('xmark')}</button>
          </div>

          <input id="tx-amount" class="amount-input" type="text" inputmode="decimal" placeholder="£0.00" value="${amountValue}" />

          <div class="field-group">
            <p class="field-label">Category</p>
          </div>
          <div class="category-picker">${chips}</div>

          <div class="field-group" style="margin-top:12px;">
            <p class="field-label">Note (optional)</p>
            <input id="tx-note" type="text" placeholder="e.g. Coffee with Sam" value="${escapeHtml(sheet.defaults.note)}" />
          </div>

          <div class="field-group">
            <p class="field-label">Date</p>
            <input id="tx-date" type="date" value="${sheet.defaults.date}" />
          </div>

          <button id="tx-save" class="save-btn" data-action="save-tx">Save</button>
          ${sheet.mode === 'edit' ? `<div class="row-actions" style="margin-top:10px;"><button class="destructive" data-action="delete-tx-in-sheet">${icon('trash')} Delete Transaction</button></div>` : ''}
        </div>
      </div>
    `;
  }

  function updateSaveState() {
    const amountInput = root.querySelector('#tx-amount');
    const saveBtn = root.querySelector('#tx-save');
    if (!amountInput || !saveBtn) return;
    const minor = parseAmountToMinor(amountInput.value);
    const valid = minor != null && minor > 0 && !!sheet.categoryId;
    saveBtn.disabled = !valid;
  }

  async function saveSheet() {
    const amountInput = root.querySelector('#tx-amount');
    const noteInput = root.querySelector('#tx-note');
    const dateInput = root.querySelector('#tx-date');
    const amountMinor = parseAmountToMinor(amountInput.value);
    if (amountMinor == null || amountMinor <= 0 || !sheet.categoryId) return;

    const payload = {
      categoryId: sheet.categoryId,
      amountMinor,
      note: noteInput.value.trim(),
      date: dateInput.value || todayISODateString(),
    };

    if (sheet.mode === 'edit') {
      await updateTransaction(sheet.txId, payload);
    } else {
      await addTransaction(payload);
    }
    sheet = null;
    await reloadData();
    render();
  }

  async function deleteTransaction(txId) {
    if (!window.confirm('Delete this transaction?')) return;
    await softDeleteTransaction(txId);
    sheet = null;
    await reloadData();
    render();
  }

  // ---- Event delegation ---------------------------------------------------

  root.addEventListener('click', async (e) => {
    const backdrop = e.target.closest('.sheet-backdrop');
    if (backdrop && e.target === backdrop) {
      closeSheet();
      return;
    }

    const actionEl = e.target.closest('[data-action]');
    if (!actionEl) return;
    const action = actionEl.dataset.action;

    if (action === 'open-add') return openAddSheet();
    if (action === 'close-sheet') return closeSheet();
    if (action === 'open-category') {
      view.screen = 'category';
      view.categoryId = actionEl.dataset.categoryId;
      return render();
    }
    if (action === 'back-to-list') {
      view.screen = 'list';
      view.categoryId = null;
      return render();
    }
    if (action === 'select-category') {
      sheet.categoryId = actionEl.dataset.categoryId;
      root.querySelectorAll('.category-chip').forEach((chip) => {
        chip.classList.toggle('selected', chip.dataset.categoryId === sheet.categoryId);
      });
      updateSaveState();
      return;
    }
    if (action === 'edit-tx') return openEditSheet(actionEl.dataset.txId);
    if (action === 'delete-tx') return deleteTransaction(actionEl.dataset.txId);
    if (action === 'delete-tx-in-sheet') return deleteTransaction(sheet.txId);
    if (action === 'save-tx') return saveSheet();
    if (action === 'goto-settings') {
      root.dispatchEvent(new CustomEvent('navigate', { detail: { tab: 'settings' }, bubbles: true }));
      return;
    }
    if (action === 'dismiss-export-banner') {
      await updateSettings({ exportBannerDismissedAt: new Date().toISOString() });
      await reloadData();
      return render();
    }
  });

  root.addEventListener('input', (e) => {
    if (e.target.id === 'tx-amount' && sheet) updateSaveState();
  });

  render();
}
