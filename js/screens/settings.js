import {
  getSettings,
  updateSettings,
  listCategories,
  addCategory,
  updateCategory,
  archiveCategory,
  listSubscriptions,
  addSubscription,
  updateSubscription,
  archiveSubscription,
  runDueSubscriptions,
  exportAll,
  importAll,
} from '../db.js';
import { todayISODateString } from '../period.js';
import { formatMoney, parseAmountToMinor, currencySymbol, setCurrency, escapeHtml } from '../format.js';
import { t, onDay, dayOrdinal, dateLocale, LANGUAGES } from '../i18n.js';
import { icon, CATEGORY_ICON_KEYS } from '../icons.js';
import { paletteColor, labelInkForIndex, nextColorIndex, PALETTE } from '../palette.js';

const CURRENCIES = [
  { code: 'GBP', name: 'British Pound' },
  { code: 'USD', name: 'US Dollar' },
  { code: 'EUR', name: 'Euro' },
  { code: 'CAD', name: 'Canadian Dollar' },
  { code: 'AUD', name: 'Australian Dollar' },
  { code: 'NZD', name: 'New Zealand Dollar' },
  { code: 'JPY', name: 'Japanese Yen' },
  { code: 'CHF', name: 'Swiss Franc' },
  { code: 'INR', name: 'Indian Rupee' },
  { code: 'ZAR', name: 'South African Rand' },
];

export async function mount(root) {
  let settings = await getSettings();
  let categories = await listCategories();
  let subscriptions = await listSubscriptions();

  let sheet = null; // { type: 'income' | 'reset-day' | 'category' | 'currency' | 'language' | 'subscription', ... }

  async function reloadData() {
    settings = await getSettings();
    categories = await listCategories();
    subscriptions = await listSubscriptions();
  }

  function render() {
    root.innerHTML = renderScreen();
    if (sheet) {
      root.insertAdjacentHTML('beforeend', renderSheet());
      const firstInput = root.querySelector('#income-amount, #reset-day-input, #cat-name, #sub-name');
      if (firstInput) firstInput.focus();
      updateSaveState();
    }
  }

  function renderScreen() {
    const currentLanguage = LANGUAGES.find((l) => l.code === (settings.language || 'en')) || LANGUAGES[0];
    return `
      <div class="large-title-header">
        <h1 class="title">${t('Settings')}</h1>
      </div>

      <div class="card-header">${t('Budget')}</div>
      <div class="card">
        <div class="list-row tappable" data-action="edit-income">
          <div style="flex:1;">${t('Monthly Income')}</div>
          <div style="color:var(--label-secondary);">${settings.incomeMinor > 0 ? formatMoney(settings.incomeMinor) : t('Not set')}</div>
          <span class="chevron">${icon('chevron', { size: 16 })}</span>
        </div>
        <div class="list-row tappable" data-action="edit-reset-day">
          <div style="flex:1;">${t('Reset Day')}</div>
          <div style="color:var(--label-secondary);">${dayOrdinal(settings.resetDay)}</div>
          <span class="chevron">${icon('chevron', { size: 16 })}</span>
        </div>
        <div class="list-row tappable" data-action="edit-currency">
          <div style="flex:1;">${t('Currency')}</div>
          <div style="color:var(--label-secondary);">${settings.currency} (${currencySymbol(settings.currency)})</div>
          <span class="chevron">${icon('chevron', { size: 16 })}</span>
        </div>
        <div class="list-row tappable" data-action="edit-language">
          <div style="flex:1;">${t('Language')}</div>
          <div style="color:var(--label-secondary);">${currentLanguage.name}</div>
          <span class="chevron">${icon('chevron', { size: 16 })}</span>
        </div>
      </div>

      <div class="card-header">${t('Categories')}</div>
      <div class="card">${renderCategoryRows()}</div>

      <div class="card-header">${t('Subscriptions')}</div>
      <div class="card">${renderSubscriptionRows()}</div>
      <p class="field-label" style="padding:0 16px;">${t('Charged automatically to their category each time you open the app on or after the billing day.')}</p>

      <div class="card-header">${t('Data')}</div>
      <div class="card">
        <div class="list-row tappable" data-action="export-data">
          <div style="flex:1;">${t('Export Data')}</div>
          <span class="chevron">${icon('chevron', { size: 16 })}</span>
        </div>
        <div class="list-row tappable" data-action="trigger-import">
          <div style="flex:1;">${t('Import Data')}</div>
          <span class="chevron">${icon('chevron', { size: 16 })}</span>
        </div>
      </div>
      <p class="field-label" style="padding:0 16px;">${t('Last backup: {date}', { date: settings.lastExportAt ? new Date(settings.lastExportAt).toLocaleDateString(dateLocale(), { day: 'numeric', month: 'short', year: 'numeric' }) : t('Never') })}</p>
      <input type="file" id="import-file-input" accept="application/json,.json" style="display:none" />

      <div class="card-header">${t('About')}</div>
      <div class="card">
        <div class="list-row">
          <div style="flex:1;">Pocket Budget</div>
          <div style="color:var(--label-secondary);">v1.2</div>
        </div>
      </div>
    `;
  }

  function renderCategoryRows() {
    const rows = categories.map((c, i) => `
      <div class="list-row tappable" data-action="edit-category" data-category-id="${c.id}">
        <div class="icon-bubble" style="background:${paletteColor(c.colorIndex)}">${icon(c.icon)}</div>
        <div style="flex:1;min-width:0;">
          <div>${escapeHtml(c.name)}</div>
          <div style="font-size:13px;color:var(--label-secondary);">${t('{amount} per period', { amount: formatMoney(c.limitMinor) })}</div>
        </div>
        ${i > 0 ? `<button class="reorder-btn" data-action="move-category-up" data-category-id="${c.id}" aria-label="Move up" style="transform:rotate(-90deg);">${icon('chevron', { size: 16 })}</button>` : `<span class="reorder-btn"></span>`}
        ${i < categories.length - 1 ? `<button class="reorder-btn" data-action="move-category-down" data-category-id="${c.id}" aria-label="Move down" style="transform:rotate(90deg);">${icon('chevron', { size: 16 })}</button>` : `<span class="reorder-btn"></span>`}
      </div>`).join('');

    const addRow = `
      <div class="list-row tappable" data-action="add-category">
        <div class="icon-bubble" style="background:var(--fill-quaternary);color:var(--blue);">${icon('plus')}</div>
        <div style="color:var(--blue);font-weight:500;">${t('Add Category')}</div>
      </div>`;

    return rows + addRow;
  }

  function renderSubscriptionRows() {
    const rows = subscriptions.map((s) => {
      const cat = categories.find((c) => c.id === s.categoryId);
      return `
      <div class="list-row tappable" data-action="edit-subscription" data-subscription-id="${s.id}">
        <div class="icon-bubble" style="background:${cat ? paletteColor(cat.colorIndex) : 'var(--fill-quaternary)'}">${icon(cat ? cat.icon : 'doc-text')}</div>
        <div style="flex:1;min-width:0;">
          <div>${escapeHtml(s.name)}</div>
          <div style="font-size:13px;color:var(--label-secondary);">${formatMoney(s.amountMinor)} ${onDay(s.dayOfMonth)} · ${cat ? escapeHtml(cat.name) : t('Uncategorized')}</div>
        </div>
        <div style="font-size:13px;color:var(--label-secondary);flex-shrink:0;">${t('{amount}/yr', { amount: formatMoney(s.amountMinor * 12) })}</div>
        <span class="chevron">${icon('chevron', { size: 16 })}</span>
      </div>`;
    }).join('');

    // The yearly total is the educational number — £15/mo reads as noise,
    // £180/yr reads as a decision.
    const monthlyTotal = subscriptions.reduce((sum, s) => sum + s.amountMinor, 0);
    const totalRow = subscriptions.length > 0 ? `
      <div class="list-row">
        <div style="flex:1;font-weight:600;">${t('Total')}</div>
        <div style="font-weight:600;">${t('{monthly}/mo · {yearly}/yr', { monthly: formatMoney(monthlyTotal), yearly: formatMoney(monthlyTotal * 12) })}</div>
      </div>` : '';

    const addRow = `
      <div class="list-row tappable" data-action="add-subscription">
        <div class="icon-bubble" style="background:var(--fill-quaternary);color:var(--blue);">${icon('plus')}</div>
        <div style="color:var(--blue);font-weight:500;">${t('Add Subscription')}</div>
      </div>`;

    return rows + totalRow + addRow;
  }

  // ---- Currency sheet -----------------------------------------------------

  function openCurrencySheet() {
    sheet = { type: 'currency' };
    render();
  }

  function renderCurrencySheet() {
    const rows = CURRENCIES.map((c) => `
      <div class="list-row tappable" data-action="select-currency" data-code="${c.code}">
        <div style="flex:1;">${t(c.name)} <span style="color:var(--label-secondary);">(${currencySymbol(c.code)})</span></div>
        ${c.code === settings.currency ? icon('checkmark', { size: 18 }) : ''}
      </div>`).join('');

    return `
      <div class="sheet-backdrop">
        <div class="sheet">
          <div class="sheet-header">
            <h2>${t('Currency')}</h2>
            <button class="sheet-close" data-action="close-sheet">${icon('xmark')}</button>
          </div>
          <div class="card" style="margin:0 16px 16px;">${rows}</div>
        </div>
      </div>
    `;
  }

  async function selectCurrency(code) {
    await updateSettings({ currency: code });
    setCurrency(code);
    sheet = null;
    // Reload so every screen's money formatting consistently picks up the
    // new currency, rather than only whatever's currently mounted.
    window.location.reload();
  }

  // ---- Language sheet -------------------------------------------------------

  function openLanguageSheet() {
    sheet = { type: 'language' };
    render();
  }

  function renderLanguageSheet() {
    // Each language is shown in its own name — recognizable even when the
    // app is currently in a language the user can't read.
    const rows = LANGUAGES.map((l) => `
      <div class="list-row tappable" data-action="select-language" data-code="${l.code}">
        <div style="flex:1;">${l.name}</div>
        ${l.code === (settings.language || 'en') ? icon('checkmark', { size: 18 }) : ''}
      </div>`).join('');

    return `
      <div class="sheet-backdrop">
        <div class="sheet">
          <div class="sheet-header">
            <h2>${t('Language')}</h2>
            <button class="sheet-close" data-action="close-sheet">${icon('xmark')}</button>
          </div>
          <div class="card" style="margin:0 16px 16px;">${rows}</div>
        </div>
      </div>
    `;
  }

  async function selectLanguage(code) {
    await updateSettings({ language: code });
    sheet = null;
    // Reload so every mounted screen re-renders in the new language.
    window.location.reload();
  }

  // ---- Income sheet -----------------------------------------------------

  function openIncomeSheet() {
    sheet = { type: 'income', defaults: { amountMinor: settings.incomeMinor || null } };
    render();
  }

  function renderIncomeSheet() {
    const value = sheet.defaults.amountMinor != null ? (sheet.defaults.amountMinor / 100).toFixed(2) : '';
    return `
      <div class="sheet-backdrop">
        <div class="sheet">
          <div class="sheet-header">
            <h2>${t('Monthly Income')}</h2>
            <button class="sheet-close" data-action="close-sheet">${icon('xmark')}</button>
          </div>
          <input id="income-amount" class="amount-input" type="text" inputmode="decimal" placeholder="${currencySymbol()}0.00" value="${value}" />
          <button id="income-save" class="save-btn" data-action="save-income">${t('Save')}</button>
        </div>
      </div>
    `;
  }

  async function saveIncomeSheet() {
    const minor = parseAmountToMinor(root.querySelector('#income-amount').value);
    if (minor == null || minor < 0) return;
    await updateSettings({ incomeMinor: minor });
    sheet = null;
    await reloadData();
    render();
  }

  // ---- Reset day sheet ----------------------------------------------------

  function openResetDaySheet() {
    sheet = { type: 'reset-day', defaults: { day: settings.resetDay } };
    render();
  }

  function renderResetDaySheet() {
    return `
      <div class="sheet-backdrop">
        <div class="sheet">
          <div class="sheet-header">
            <h2>${t('Reset Day')}</h2>
            <button class="sheet-close" data-action="close-sheet">${icon('xmark')}</button>
          </div>
          <div class="field-group">
            <p class="field-label">${t('Day of month your pay cycle resets (1–31)')}</p>
            <input id="reset-day-input" type="text" inputmode="numeric" value="${sheet.defaults.day}" />
          </div>
          <button id="reset-day-save" class="save-btn" data-action="save-reset-day">${t('Save')}</button>
        </div>
      </div>
    `;
  }

  async function saveResetDaySheet() {
    const day = parseInt(root.querySelector('#reset-day-input').value, 10);
    if (!Number.isInteger(day) || day < 1 || day > 31) return;
    await updateSettings({ resetDay: day });
    sheet = null;
    await reloadData();
    render();
  }

  // ---- Category sheet -----------------------------------------------------

  function openCategorySheet(mode, categoryId) {
    if (mode === 'edit') {
      const c = categories.find((cat) => cat.id === categoryId);
      if (!c) return;
      sheet = { type: 'category', mode, categoryId: c.id, icon: c.icon, colorIndex: c.colorIndex, defaults: { name: c.name, limitMinor: c.limitMinor } };
    } else {
      sheet = {
        type: 'category', mode: 'create', icon: CATEGORY_ICON_KEYS[0],
        colorIndex: nextColorIndex(categories.map((c) => c.colorIndex)),
        defaults: { name: '', limitMinor: null },
      };
    }
    render();
  }

  function renderCategorySheet() {
    const icons = CATEGORY_ICON_KEYS.map((key) => `
      <div class="category-chip ${key === sheet.icon ? 'selected' : ''}" data-action="select-category-icon" data-icon-key="${key}">
        <div class="icon-bubble" style="background:${sheet.icon === key ? paletteColor(sheet.colorIndex) : 'var(--fill-quaternary)'};color:${sheet.icon === key ? '#fff' : 'var(--label-secondary)'}">${icon(key)}</div>
      </div>`).join('');

    const swatches = PALETTE.map((_, i) => `
      <button class="color-swatch" data-action="select-category-color" data-color-index="${i}" style="background:${paletteColor(i)};color:${labelInkForIndex(i)}" aria-label="Color ${i + 1}">${i === sheet.colorIndex ? icon('checkmark', { size: 16 }) : ''}</button>`).join('');

    const limitValue = sheet.defaults.limitMinor != null ? (sheet.defaults.limitMinor / 100).toFixed(2) : '';

    return `
      <div class="sheet-backdrop">
        <div class="sheet">
          <div class="sheet-header">
            <h2>${sheet.mode === 'edit' ? t('Edit Category') : t('New Category')}</h2>
            <button class="sheet-close" data-action="close-sheet">${icon('xmark')}</button>
          </div>

          <div class="field-group">
            <p class="field-label">${t('Name')}</p>
            <input id="cat-name" type="text" placeholder="${t('e.g. Groceries')}" value="${escapeHtml(sheet.defaults.name)}" />
            <p id="cat-name-warning" class="field-warning"></p>
          </div>

          <div class="field-group">
            <p class="field-label">${t('Icon')}</p>
          </div>
          <div class="category-picker">${icons}</div>

          <div class="field-group" style="margin-top:12px;">
            <p class="field-label">${t('Color')}</p>
          </div>
          <div class="color-picker">${swatches}</div>

          <div class="field-group" style="margin-top:12px;">
            <p class="field-label">${t('Limit per period')}</p>
            <input id="cat-limit" type="text" inputmode="decimal" placeholder="${currencySymbol()}0.00" value="${limitValue}" />
            <p id="cat-limit-warning" class="field-warning"></p>
          </div>

          <button id="cat-save" class="save-btn" data-action="save-category">${t('Save')}</button>
          ${sheet.mode === 'edit' ? `<div class="row-actions" style="margin-top:10px;"><button class="destructive" data-action="archive-category-in-sheet">${icon('trash')} ${t('Archive Category')}</button></div>` : ''}
        </div>
      </div>
    `;
  }

  function isDuplicateName(name) {
    if (!name) return false;
    const normalized = name.trim().toLowerCase();
    return categories.some((c) => c.id !== sheet.categoryId && c.name.trim().toLowerCase() === normalized);
  }

  async function saveCategorySheet() {
    const name = root.querySelector('#cat-name').value.trim();
    const limitMinor = parseAmountToMinor(root.querySelector('#cat-limit').value);
    if (!name || limitMinor == null || limitMinor <= 0 || isDuplicateName(name)) return;

    const payload = { name, icon: sheet.icon, colorIndex: sheet.colorIndex, limitMinor };
    if (sheet.mode === 'edit') {
      await updateCategory(sheet.categoryId, payload);
    } else {
      await addCategory(payload);
    }
    sheet = null;
    await reloadData();
    render();
  }

  async function archiveCurrentCategory() {
    if (!window.confirm(t('Archive this category? It will be hidden from Home, but its past transactions are kept.'))) return;
    await archiveCategory(sheet.categoryId);
    sheet = null;
    await reloadData();
    render();
  }

  async function moveCategory(categoryId, direction) {
    const idx = categories.findIndex((c) => c.id === categoryId);
    const swapIdx = idx + direction;
    if (idx === -1 || swapIdx < 0 || swapIdx >= categories.length) return;
    const a = categories[idx];
    const b = categories[swapIdx];
    await updateCategory(a.id, { sortOrder: b.sortOrder });
    await updateCategory(b.id, { sortOrder: a.sortOrder });
    await reloadData();
    render();
  }

  // ---- Subscription sheet --------------------------------------------------

  function openSubscriptionSheet(mode, subscriptionId) {
    if (mode === 'edit') {
      const s = subscriptions.find((sub) => sub.id === subscriptionId);
      if (!s) return;
      sheet = {
        type: 'subscription', mode, subscriptionId: s.id, categoryId: s.categoryId,
        defaults: { name: s.name, amountMinor: s.amountMinor, dayOfMonth: s.dayOfMonth },
      };
    } else {
      sheet = {
        type: 'subscription', mode: 'create', categoryId: categories[0]?.id ?? null,
        defaults: { name: '', amountMinor: null, dayOfMonth: 1 },
      };
    }
    render();
  }

  function renderSubscriptionSheet() {
    const chips = categories.map((c) => `
      <div class="category-chip ${c.id === sheet.categoryId ? 'selected' : ''}" data-action="select-subscription-category" data-category-id="${c.id}">
        <div class="icon-bubble" style="background:${paletteColor(c.colorIndex)}">${icon(c.icon)}</div>
        <div class="chip-label">${escapeHtml(c.name)}</div>
      </div>`).join('');

    const amountValue = sheet.defaults.amountMinor != null ? (sheet.defaults.amountMinor / 100).toFixed(2) : '';

    return `
      <div class="sheet-backdrop">
        <div class="sheet">
          <div class="sheet-header">
            <h2>${sheet.mode === 'edit' ? t('Edit Subscription') : t('New Subscription')}</h2>
            <button class="sheet-close" data-action="close-sheet">${icon('xmark')}</button>
          </div>

          <div class="field-group">
            <p class="field-label">${t('Name')}</p>
            <input id="sub-name" type="text" placeholder="${t('e.g. Gym')}" value="${escapeHtml(sheet.defaults.name)}" />
          </div>

          <div class="field-group">
            <p class="field-label">${t('Category')}</p>
          </div>
          <div class="category-picker">${chips}</div>

          <div class="field-group" style="margin-top:12px;">
            <p class="field-label">${t('Amount per month')}</p>
            <input id="sub-amount" type="text" inputmode="decimal" placeholder="${currencySymbol()}0.00" value="${amountValue}" />
          </div>

          <div class="field-group">
            <p class="field-label">${t('Billing day (1–31)')}</p>
            <input id="sub-day" type="text" inputmode="numeric" value="${sheet.defaults.dayOfMonth}" />
          </div>

          <button id="sub-save" class="save-btn" data-action="save-subscription">${t('Save')}</button>
          ${sheet.mode === 'edit' ? `<div class="row-actions" style="margin-top:10px;"><button class="destructive" data-action="archive-subscription-in-sheet">${icon('trash')} ${t('Archive Subscription')}</button></div>` : ''}
        </div>
      </div>
    `;
  }

  async function saveSubscriptionSheet() {
    const name = root.querySelector('#sub-name').value.trim();
    const amountMinor = parseAmountToMinor(root.querySelector('#sub-amount').value);
    const dayOfMonth = parseInt(root.querySelector('#sub-day').value, 10);
    if (!name || amountMinor == null || amountMinor <= 0 || !sheet.categoryId) return;
    if (!Number.isInteger(dayOfMonth) || dayOfMonth < 1 || dayOfMonth > 31) return;

    const payload = { name, categoryId: sheet.categoryId, amountMinor, dayOfMonth };
    if (sheet.mode === 'edit') {
      await updateSubscription(sheet.subscriptionId, payload);
    } else {
      await addSubscription(payload);
    }
    // Charge right away rather than waiting for the next app launch, so a
    // subscription whose billing day already passed this cycle shows up
    // immediately instead of looking like nothing happened.
    await runDueSubscriptions();
    sheet = null;
    await reloadData();
    render();
  }

  async function archiveCurrentSubscription() {
    if (!window.confirm(t('Archive this subscription? It will stop creating new transactions automatically.'))) return;
    await archiveSubscription(sheet.subscriptionId);
    sheet = null;
    await reloadData();
    render();
  }

  // ---- Export / import ------------------------------------------------

  async function exportData() {
    const data = await exportAll();
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pocket-budget-${todayISODateString()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    await updateSettings({ lastExportAt: new Date().toISOString(), exportBannerDismissedAt: null });
    await reloadData();
    render();
  }

  async function handleImportFile(file) {
    if (!file) return;
    const text = await file.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      window.alert(t('That file is not valid JSON.'));
      return;
    }
    if (!data || typeof data !== 'object' || !('schemaVersion' in data)) {
      window.alert(t("That doesn't look like a Pocket Budget export file."));
      return;
    }
    if (!window.confirm(t('Importing will overwrite all data currently on this device. Continue?'))) return;
    await importAll(data);
    window.location.reload();
  }

  // ---- Sheet dispatch -------------------------------------------------

  function renderSheet() {
    if (sheet.type === 'currency') return renderCurrencySheet();
    if (sheet.type === 'language') return renderLanguageSheet();
    if (sheet.type === 'income') return renderIncomeSheet();
    if (sheet.type === 'reset-day') return renderResetDaySheet();
    if (sheet.type === 'subscription') return renderSubscriptionSheet();
    return renderCategorySheet();
  }

  function updateSaveState() {
    if (!sheet) return;
    if (sheet.type === 'income') {
      const minor = parseAmountToMinor(root.querySelector('#income-amount')?.value);
      const btn = root.querySelector('#income-save');
      if (btn) btn.disabled = minor == null || minor < 0;
    } else if (sheet.type === 'reset-day') {
      const day = parseInt(root.querySelector('#reset-day-input')?.value, 10);
      const btn = root.querySelector('#reset-day-save');
      if (btn) btn.disabled = !Number.isInteger(day) || day < 1 || day > 31;
    } else if (sheet.type === 'category') {
      const name = root.querySelector('#cat-name')?.value.trim();
      const limit = parseAmountToMinor(root.querySelector('#cat-limit')?.value);
      const btn = root.querySelector('#cat-save');
      const duplicate = isDuplicateName(name);
      const nameWarningEl = root.querySelector('#cat-name-warning');
      if (nameWarningEl) nameWarningEl.textContent = duplicate ? t('A category named "{name}" already exists.', { name }) : '';
      if (btn) btn.disabled = !name || limit == null || limit <= 0 || duplicate;
      updateLimitWarning(limit);
    } else if (sheet.type === 'subscription') {
      const name = root.querySelector('#sub-name')?.value.trim();
      const amount = parseAmountToMinor(root.querySelector('#sub-amount')?.value);
      const day = parseInt(root.querySelector('#sub-day')?.value, 10);
      const btn = root.querySelector('#sub-save');
      if (btn) btn.disabled = !name || amount == null || amount <= 0 || !sheet.categoryId || !Number.isInteger(day) || day < 1 || day > 31;
    }
  }

  function updateLimitWarning(limitMinor) {
    const warningEl = root.querySelector('#cat-limit-warning');
    if (!warningEl) return;
    if (!settings.incomeMinor || limitMinor == null || limitMinor <= 0) {
      warningEl.textContent = '';
      return;
    }
    const otherLimitsTotal = categories
      .filter((c) => c.id !== sheet.categoryId)
      .reduce((sum, c) => sum + c.limitMinor, 0);
    const newTotal = otherLimitsTotal + limitMinor;
    if (newTotal > settings.incomeMinor) {
      warningEl.textContent = t('Category limits would total {total} of {income} income.', { total: formatMoney(newTotal), income: formatMoney(settings.incomeMinor) });
    } else {
      warningEl.textContent = '';
    }
  }

  // ---- Event delegation ---------------------------------------------------

  root.addEventListener('click', async (e) => {
    const backdrop = e.target.closest('.sheet-backdrop');
    if (backdrop && e.target === backdrop) {
      sheet = null;
      return render();
    }

    const actionEl = e.target.closest('[data-action]');
    if (!actionEl) return;
    const action = actionEl.dataset.action;

    if (action === 'close-sheet') { sheet = null; return render(); }
    if (action === 'edit-currency') return openCurrencySheet();
    if (action === 'select-currency') return selectCurrency(actionEl.dataset.code);
    if (action === 'edit-language') return openLanguageSheet();
    if (action === 'select-language') return selectLanguage(actionEl.dataset.code);
    if (action === 'edit-income') return openIncomeSheet();
    if (action === 'save-income') return saveIncomeSheet();
    if (action === 'edit-reset-day') return openResetDaySheet();
    if (action === 'save-reset-day') return saveResetDaySheet();
    if (action === 'add-category') return openCategorySheet('create');
    if (action === 'edit-category') return openCategorySheet('edit', actionEl.dataset.categoryId);
    if (action === 'move-category-up') return moveCategory(actionEl.dataset.categoryId, -1);
    if (action === 'move-category-down') return moveCategory(actionEl.dataset.categoryId, 1);
    if (action === 'select-category-icon') {
      sheet.icon = actionEl.dataset.iconKey;
      root.querySelectorAll('.category-chip').forEach((chip) => {
        const selected = chip.dataset.iconKey === sheet.icon;
        chip.classList.toggle('selected', selected);
        const bubble = chip.querySelector('.icon-bubble');
        bubble.style.background = selected ? paletteColor(sheet.colorIndex) : 'var(--fill-quaternary)';
        bubble.style.color = selected ? '#fff' : 'var(--label-secondary)';
      });
      return;
    }
    if (action === 'select-category-color') {
      sheet.colorIndex = Number(actionEl.dataset.colorIndex);
      root.querySelectorAll('.color-swatch').forEach((sw) => {
        sw.innerHTML = Number(sw.dataset.colorIndex) === sheet.colorIndex ? icon('checkmark', { size: 16 }) : '';
      });
      const selectedBubble = root.querySelector('.category-chip.selected .icon-bubble');
      if (selectedBubble) selectedBubble.style.background = paletteColor(sheet.colorIndex);
      return;
    }
    if (action === 'save-category') return saveCategorySheet();
    if (action === 'archive-category-in-sheet') return archiveCurrentCategory();
    if (action === 'add-subscription') return openSubscriptionSheet('create');
    if (action === 'edit-subscription') return openSubscriptionSheet('edit', actionEl.dataset.subscriptionId);
    if (action === 'select-subscription-category') {
      sheet.categoryId = actionEl.dataset.categoryId;
      root.querySelectorAll('.category-chip').forEach((chip) => {
        chip.classList.toggle('selected', chip.dataset.categoryId === sheet.categoryId);
      });
      updateSaveState();
      return;
    }
    if (action === 'save-subscription') return saveSubscriptionSheet();
    if (action === 'archive-subscription-in-sheet') return archiveCurrentSubscription();
    if (action === 'export-data') return exportData();
    if (action === 'trigger-import') return root.querySelector('#import-file-input').click();
  });

  root.addEventListener('change', (e) => {
    if (e.target.id === 'import-file-input') handleImportFile(e.target.files[0]);
  });

  root.addEventListener('input', (e) => {
    if (!sheet) return;
    if (['income-amount', 'reset-day-input', 'cat-name', 'cat-limit', 'sub-name', 'sub-amount', 'sub-day'].includes(e.target.id)) updateSaveState();
  });

  render();
}
