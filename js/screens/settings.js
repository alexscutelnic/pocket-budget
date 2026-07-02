import {
  getSettings,
  updateSettings,
  listCategories,
  addCategory,
  updateCategory,
  archiveCategory,
  exportAll,
  importAll,
} from '../db.js';
import { todayISODateString } from '../period.js';
import { formatMoney, parseAmountToMinor, escapeHtml } from '../format.js';
import { icon, CATEGORY_ICON_KEYS } from '../icons.js';
import { stableColorForId } from '../palette.js';

function ordinal(n) {
  const suffixes = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return `${n}${suffixes[(v - 20) % 10] || suffixes[v] || suffixes[0]}`;
}

export async function mount(root) {
  let settings = await getSettings();
  let categories = await listCategories();

  let sheet = null; // { type: 'income' | 'reset-day' | 'category', ... }

  async function reloadData() {
    settings = await getSettings();
    categories = await listCategories();
  }

  function render() {
    root.innerHTML = renderScreen();
    if (sheet) {
      root.insertAdjacentHTML('beforeend', renderSheet());
      const firstInput = root.querySelector('#income-amount, #reset-day-input, #cat-name');
      if (firstInput) firstInput.focus();
      updateSaveState();
    }
  }

  function renderScreen() {
    return `
      <div class="large-title-header">
        <h1 class="title">Settings</h1>
      </div>

      <div class="card-header">Budget</div>
      <div class="card">
        <div class="list-row tappable" data-action="edit-income">
          <div style="flex:1;">Monthly Income</div>
          <div style="color:var(--label-secondary);">${settings.incomeMinor > 0 ? formatMoney(settings.incomeMinor) : 'Not set'}</div>
          <span class="chevron">${icon('chevron', { size: 16 })}</span>
        </div>
        <div class="list-row tappable" data-action="edit-reset-day">
          <div style="flex:1;">Reset Day</div>
          <div style="color:var(--label-secondary);">${ordinal(settings.resetDay)}</div>
          <span class="chevron">${icon('chevron', { size: 16 })}</span>
        </div>
      </div>

      <div class="card-header">Categories</div>
      <div class="card">${renderCategoryRows()}</div>

      <div class="card-header">Data</div>
      <div class="card">
        <div class="list-row tappable" data-action="export-data">
          <div style="flex:1;">Export Data</div>
          <span class="chevron">${icon('chevron', { size: 16 })}</span>
        </div>
        <div class="list-row tappable" data-action="trigger-import">
          <div style="flex:1;">Import Data</div>
          <span class="chevron">${icon('chevron', { size: 16 })}</span>
        </div>
      </div>
      <p class="field-label" style="padding:0 16px;">Last backup: ${settings.lastExportAt ? new Date(settings.lastExportAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Never'}</p>
      <input type="file" id="import-file-input" accept="application/json,.json" style="display:none" />

      <div class="card-header">About</div>
      <div class="card">
        <div class="list-row">
          <div style="flex:1;">Pocket Budget</div>
          <div style="color:var(--label-secondary);">v1.0</div>
        </div>
      </div>
    `;
  }

  function renderCategoryRows() {
    const rows = categories.map((c, i) => `
      <div class="list-row tappable" data-action="edit-category" data-category-id="${c.id}">
        <div class="icon-bubble" style="background:${stableColorForId(c.id)}">${icon(c.icon)}</div>
        <div style="flex:1;min-width:0;">
          <div>${escapeHtml(c.name)}</div>
          <div style="font-size:13px;color:var(--label-secondary);">${formatMoney(c.limitMinor)} per period</div>
        </div>
        ${i > 0 ? `<button class="reorder-btn" data-action="move-category-up" data-category-id="${c.id}" aria-label="Move up" style="transform:rotate(-90deg);">${icon('chevron', { size: 16 })}</button>` : `<span class="reorder-btn"></span>`}
        ${i < categories.length - 1 ? `<button class="reorder-btn" data-action="move-category-down" data-category-id="${c.id}" aria-label="Move down" style="transform:rotate(90deg);">${icon('chevron', { size: 16 })}</button>` : `<span class="reorder-btn"></span>`}
      </div>`).join('');

    const addRow = `
      <div class="list-row tappable" data-action="add-category">
        <div class="icon-bubble" style="background:var(--fill-quaternary);color:var(--blue);">${icon('plus')}</div>
        <div style="color:var(--blue);font-weight:500;">Add Category</div>
      </div>`;

    return rows + addRow;
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
            <h2>Monthly Income</h2>
            <button class="sheet-close" data-action="close-sheet">${icon('xmark')}</button>
          </div>
          <input id="income-amount" class="amount-input" type="text" inputmode="decimal" placeholder="£0.00" value="${value}" />
          <button id="income-save" class="save-btn" data-action="save-income">Save</button>
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
            <h2>Reset Day</h2>
            <button class="sheet-close" data-action="close-sheet">${icon('xmark')}</button>
          </div>
          <div class="field-group">
            <p class="field-label">Day of month your pay cycle resets (1–31)</p>
            <input id="reset-day-input" type="number" inputmode="numeric" min="1" max="31" value="${sheet.defaults.day}" />
          </div>
          <button id="reset-day-save" class="save-btn" data-action="save-reset-day">Save</button>
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
      sheet = { type: 'category', mode, categoryId: c.id, icon: c.icon, defaults: { name: c.name, limitMinor: c.limitMinor } };
    } else {
      sheet = { type: 'category', mode: 'create', icon: CATEGORY_ICON_KEYS[0], defaults: { name: '', limitMinor: null } };
    }
    render();
  }

  function renderCategorySheet() {
    const icons = CATEGORY_ICON_KEYS.map((key) => `
      <div class="category-chip ${key === sheet.icon ? 'selected' : ''}" data-action="select-category-icon" data-icon-key="${key}">
        <div class="icon-bubble" style="background:${sheet.icon === key ? 'var(--blue)' : 'var(--fill-quaternary)'};color:${sheet.icon === key ? '#fff' : 'var(--label-secondary)'}">${icon(key)}</div>
      </div>`).join('');

    const limitValue = sheet.defaults.limitMinor != null ? (sheet.defaults.limitMinor / 100).toFixed(2) : '';

    return `
      <div class="sheet-backdrop">
        <div class="sheet">
          <div class="sheet-header">
            <h2>${sheet.mode === 'edit' ? 'Edit Category' : 'New Category'}</h2>
            <button class="sheet-close" data-action="close-sheet">${icon('xmark')}</button>
          </div>

          <div class="field-group">
            <p class="field-label">Name</p>
            <input id="cat-name" type="text" placeholder="e.g. Groceries" value="${escapeHtml(sheet.defaults.name)}" />
          </div>

          <div class="field-group">
            <p class="field-label">Icon</p>
          </div>
          <div class="category-picker">${icons}</div>

          <div class="field-group" style="margin-top:12px;">
            <p class="field-label">Limit per period</p>
            <input id="cat-limit" type="text" inputmode="decimal" placeholder="£0.00" value="${limitValue}" />
          </div>

          <button id="cat-save" class="save-btn" data-action="save-category">Save</button>
          ${sheet.mode === 'edit' ? `<div class="row-actions" style="margin-top:10px;"><button class="destructive" data-action="archive-category-in-sheet">${icon('trash')} Archive Category</button></div>` : ''}
        </div>
      </div>
    `;
  }

  async function saveCategorySheet() {
    const name = root.querySelector('#cat-name').value.trim();
    const limitMinor = parseAmountToMinor(root.querySelector('#cat-limit').value);
    if (!name || limitMinor == null || limitMinor <= 0) return;

    const payload = { name, icon: sheet.icon, limitMinor };
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
    if (!window.confirm('Archive this category? It will be hidden from Home, but its past transactions are kept.')) return;
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
      window.alert('That file is not valid JSON.');
      return;
    }
    if (!data || typeof data !== 'object' || !('schemaVersion' in data)) {
      window.alert("That doesn't look like a Pocket Budget export file.");
      return;
    }
    if (!window.confirm('Importing will overwrite all data currently on this device. Continue?')) return;
    await importAll(data);
    window.location.reload();
  }

  // ---- Sheet dispatch -------------------------------------------------

  function renderSheet() {
    if (sheet.type === 'income') return renderIncomeSheet();
    if (sheet.type === 'reset-day') return renderResetDaySheet();
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
      if (btn) btn.disabled = !name || limit == null || limit <= 0;
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
        bubble.style.background = selected ? 'var(--blue)' : 'var(--fill-quaternary)';
        bubble.style.color = selected ? '#fff' : 'var(--label-secondary)';
      });
      return;
    }
    if (action === 'save-category') return saveCategorySheet();
    if (action === 'archive-category-in-sheet') return archiveCurrentCategory();
    if (action === 'export-data') return exportData();
    if (action === 'trigger-import') return root.querySelector('#import-file-input').click();
  });

  root.addEventListener('change', (e) => {
    if (e.target.id === 'import-file-input') handleImportFile(e.target.files[0]);
  });

  root.addEventListener('input', (e) => {
    if (!sheet) return;
    if (['income-amount', 'reset-day-input', 'cat-name', 'cat-limit'].includes(e.target.id)) updateSaveState();
  });

  render();
}
