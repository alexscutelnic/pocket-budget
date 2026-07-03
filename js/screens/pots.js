import {
  listPots,
  addPot,
  updatePot,
  archivePot,
  listPotEntries,
  addPotEntry,
  softDeletePotEntry,
} from '../db.js';
import { todayISODateString } from '../period.js';
import { formatMoney, parseAmountToMinor, formatShortDate, formatLongDate, currencySymbol, escapeHtml } from '../format.js';
import { t, tn } from '../i18n.js';
import { icon, POT_ICON_KEYS } from '../icons.js';
import { paletteColor } from '../palette.js';

function ringColor(ratio) {
  return ratio >= 1 ? 'var(--green)' : 'var(--blue)';
}

function ring(ratio, { size = 44, stroke = 4, color } = {}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c * (1 - Math.min(Math.max(ratio, 0), 1));
  return `<svg class="pot-ring" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
    <circle cx="${size / 2}" cy="${size / 2}" r="${r}" stroke="var(--track)" stroke-width="${stroke}" fill="none"/>
    <circle cx="${size / 2}" cy="${size / 2}" r="${r}" stroke="${color}" stroke-width="${stroke}" fill="none" stroke-linecap="round" stroke-dasharray="${c}" stroke-dashoffset="${offset}" transform="rotate(-90 ${size / 2} ${size / 2})"/>
  </svg>`;
}

export async function mount(root) {
  let pots = await listPots();
  let entries = await listPotEntries();

  const view = { screen: 'list', potId: null };
  let sheet = null; // { type: 'pot', mode, potId?, icon, defaults } | { type: 'entry', mode, potId, defaults }

  async function reloadData() {
    pots = await listPots();
    entries = await listPotEntries();
  }

  function balanceFor(potId) {
    return entries.filter((e) => e.potId === potId).reduce((sum, e) => sum + e.amountMinor, 0);
  }

  function render() {
    root.innerHTML = view.screen === 'detail' ? renderDetail() : renderList();
    if (sheet) {
      root.insertAdjacentHTML('beforeend', sheet.type === 'pot' ? renderPotSheet() : renderEntrySheet());
      const firstInput = root.querySelector('#pot-name, #entry-amount');
      if (firstInput) firstInput.focus();
      updateSaveState();
    }
  }

  // ---- List screen -----------------------------------------------------

  function renderList() {
    const totalSaved = pots.reduce((sum, p) => sum + balanceFor(p.id), 0);
    const totalTarget = pots.reduce((sum, p) => sum + p.targetMinor, 0);
    const overallRatio = totalTarget > 0 ? totalSaved / totalTarget : 0;

    const rows = pots.map((p) => {
      const saved = balanceFor(p.id);
      const ratio = p.targetMinor > 0 ? saved / p.targetMinor : 0;
      return `
        <div class="list-row pot-row tappable" data-action="open-pot" data-pot-id="${p.id}">
          <div class="pot-top">
            <div class="icon-bubble" style="background:${paletteColor(p.colorIndex)}">${icon(p.icon)}</div>
            <div class="pot-name">${escapeHtml(p.name)}</div>
            <div class="pot-amounts"><strong>${formatMoney(saved)}</strong> / ${formatMoney(p.targetMinor)}</div>
            <span class="chevron">${icon('chevron')}</span>
          </div>
          <div class="progress-track"><div class="progress-fill" style="width:${Math.min(ratio, 1) * 100}%;background:${ringColor(ratio)}"></div></div>
        </div>`;
    }).join('');

    return `
      <div class="large-title-header">
        <h1 class="title">${t('Pots')}</h1>
        <p class="subtitle">${pots.length ? `${formatMoney(totalSaved)} ${tn('saved-across-pots', pots.length)}` : t('No pots yet')}</p>
      </div>

      ${pots.length ? `
        <div class="card summary-card">
          <div class="summary-row">
            <span class="summary-spent">${formatMoney(totalSaved)}</span>
            <span class="summary-limit">${t('of {amount}', { amount: formatMoney(totalTarget) })}</span>
          </div>
          <p class="summary-caption">${t('saved toward targets')}</p>
          <div class="summary-progress progress-track">
            <div class="progress-fill" style="width:${Math.min(overallRatio, 1) * 100}%;background:${ringColor(overallRatio)}"></div>
          </div>
        </div>
        <div class="card-header">${t('Savings')}</div>
        <div class="card">${rows}</div>
      ` : emptyPotsState()}

      <button class="fab" data-action="open-add-pot" aria-label="${t('New Pot')}">${icon('plus')}</button>
    `;
  }

  function emptyPotsState() {
    return `<div class="empty-state">
      <div class="icon-bubble">${icon('pots')}</div>
      <h3>${t('No pots yet')}</h3>
      <p>${t('Create a pot to start saving toward something.')}</p>
    </div>`;
  }

  // ---- Detail screen -----------------------------------------------------

  function renderDetail() {
    const pot = pots.find((p) => p.id === view.potId);
    if (!pot) {
      view.screen = 'list';
      return renderList();
    }
    const saved = balanceFor(pot.id);
    const ratio = pot.targetMinor > 0 ? saved / pot.targetMinor : 0;
    const potEntries = entries.filter((e) => e.potId === pot.id).sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : b.createdAt.localeCompare(a.createdAt)));

    const rows = potEntries.map((e) => {
      const positive = e.amountMinor >= 0;
      return `
        <div class="list-row tx-row entry-row">
          <div class="tx-date">${formatShortDate(e.date)}</div>
          <div class="tx-note">
            <div class="note-text ${e.note ? '' : 'no-note'}">${escapeHtml(e.note) || (positive ? t('Added money') : t('Withdrawal'))}</div>
          </div>
          <div class="tx-amount entry-amount ${positive ? 'positive' : 'negative'}">${positive ? '+' : '−'}${formatMoney(Math.abs(e.amountMinor))}</div>
          <div class="row-actions" style="padding:0;">
            <button data-action="delete-entry" data-entry-id="${e.id}" aria-label="Delete" style="color:var(--red)">${icon('trash')}</button>
          </div>
        </div>`;
    }).join('');

    return `
      <div class="nav-bar">
        <button class="back-btn" data-action="back-to-pots">${icon('chevron', { className: 'back-chevron' })}<span>${t('Pots')}</span></button>
        <button class="nav-btn" data-action="edit-pot">${icon('pencil')}<span>${t('Edit')}</span></button>
      </div>
      <div class="large-title-header" style="text-align:center;">
        <h1 class="title">${escapeHtml(pot.name)}</h1>
        <p class="subtitle">${pot.targetDate ? t('Target: {date}', { date: formatLongDate(pot.targetDate) }) : t('No target date')}</p>
      </div>
      <div class="pot-detail-ring-wrap">
        <div class="ring-center">
          ${ring(ratio, { size: 160, stroke: 12, color: ringColor(ratio) })}
          <div class="ring-label">
            <span class="ring-saved">${formatMoney(saved)}</span>
            <span class="ring-target">${t('of {amount}', { amount: formatMoney(pot.targetMinor) })}</span>
          </div>
        </div>
      </div>
      <div class="row-actions" style="margin-top:8px;">
        <button data-action="open-deposit">${icon('arrow-up-circle')} ${t('Add Money')}</button>
        <button data-action="open-withdraw">${icon('arrow-down-circle')} ${t('Withdraw')}</button>
      </div>
      <div class="card-header">${t('History')}</div>
      <div class="card">${rows || emptyEntriesState()}</div>
    `;
  }

  function emptyEntriesState() {
    return `<div class="empty-state">
      <div class="icon-bubble">${icon('doc-text')}</div>
      <h3>${t('No activity yet')}</h3>
      <p>${t('Money you add or withdraw will show up here.')}</p>
    </div>`;
  }

  // ---- Pot create/edit sheet -----------------------------------------------

  function openPotSheet(mode) {
    if (mode === 'edit') {
      const pot = pots.find((p) => p.id === view.potId);
      if (!pot) return;
      sheet = {
        type: 'pot', mode, potId: pot.id, icon: pot.icon,
        defaults: { name: pot.name, targetMinor: pot.targetMinor, targetDate: pot.targetDate || '' },
      };
    } else {
      sheet = {
        type: 'pot', mode: 'create', icon: POT_ICON_KEYS[0],
        defaults: { name: '', targetMinor: null, targetDate: '' },
      };
    }
    render();
  }

  function renderPotSheet() {
    const icons = POT_ICON_KEYS.map((key) => `
      <div class="category-chip ${key === sheet.icon ? 'selected' : ''}" data-action="select-pot-icon" data-icon-key="${key}">
        <div class="icon-bubble" style="background:${sheet.icon === key ? 'var(--blue)' : 'var(--fill-quaternary)'};color:${sheet.icon === key ? '#fff' : 'var(--label-secondary)'}">${icon(key)}</div>
      </div>`).join('');

    const targetValue = sheet.defaults.targetMinor != null ? (sheet.defaults.targetMinor / 100).toFixed(2) : '';

    return `
      <div class="sheet-backdrop">
        <div class="sheet">
          <div class="sheet-header">
            <h2>${sheet.mode === 'edit' ? t('Edit Pot') : t('New Pot')}</h2>
            <button class="sheet-close" data-action="close-sheet">${icon('xmark')}</button>
          </div>

          <div class="field-group">
            <p class="field-label">${t('Name')}</p>
            <input id="pot-name" type="text" placeholder="${t('e.g. Holiday')}" value="${escapeHtml(sheet.defaults.name)}" />
          </div>

          <div class="field-group">
            <p class="field-label">${t('Icon')}</p>
          </div>
          <div class="category-picker">${icons}</div>

          <div class="field-group" style="margin-top:12px;">
            <p class="field-label">${t('Target amount')}</p>
            <input id="pot-target" type="text" inputmode="decimal" placeholder="${currencySymbol()}0.00" value="${targetValue}" />
          </div>

          <div class="field-group">
            <p class="field-label">${t('Target date (optional)')}</p>
            <input id="pot-target-date" type="date" value="${sheet.defaults.targetDate}" />
          </div>

          <button id="pot-save" class="save-btn" data-action="save-pot">${t('Save')}</button>
          ${sheet.mode === 'edit' ? `<div class="row-actions" style="margin-top:10px;"><button class="destructive" data-action="archive-pot-in-sheet">${icon('trash')} ${t('Archive Pot')}</button></div>` : ''}
        </div>
      </div>
    `;
  }

  async function savePotSheet() {
    const name = root.querySelector('#pot-name').value.trim();
    const targetMinor = parseAmountToMinor(root.querySelector('#pot-target').value);
    const targetDate = root.querySelector('#pot-target-date').value || null;
    if (!name || targetMinor == null || targetMinor <= 0) return;

    const payload = { name, icon: sheet.icon, targetMinor, targetDate };
    if (sheet.mode === 'edit') {
      await updatePot(sheet.potId, payload);
    } else {
      await addPot(payload);
    }
    sheet = null;
    await reloadData();
    render();
  }

  async function archiveCurrentPot() {
    if (!window.confirm(t('Archive this pot? It will be hidden from your pots list.'))) return;
    await archivePot(sheet.potId);
    sheet = null;
    view.screen = 'list';
    view.potId = null;
    await reloadData();
    render();
  }

  // ---- Add money / withdraw sheet -----------------------------------------

  function openEntrySheet(mode) {
    sheet = {
      type: 'entry', mode, potId: view.potId,
      defaults: { amountMinor: null, note: '', date: todayISODateString() },
    };
    render();
  }

  function renderEntrySheet() {
    const amountValue = sheet.defaults.amountMinor != null ? (sheet.defaults.amountMinor / 100).toFixed(2) : '';
    return `
      <div class="sheet-backdrop">
        <div class="sheet">
          <div class="sheet-header">
            <h2>${sheet.mode === 'withdraw' ? t('Withdraw') : t('Add Money')}</h2>
            <button class="sheet-close" data-action="close-sheet">${icon('xmark')}</button>
          </div>

          <input id="entry-amount" class="amount-input" type="text" inputmode="decimal" placeholder="${currencySymbol()}0.00" value="${amountValue}" />

          <div class="field-group">
            <p class="field-label">${t('Note (optional)')}</p>
            <input id="entry-note" type="text" placeholder="${t('e.g. Birthday money')}" value="${escapeHtml(sheet.defaults.note)}" />
          </div>

          <div class="field-group">
            <p class="field-label">${t('Date')}</p>
            <input id="entry-date" type="date" value="${sheet.defaults.date}" />
          </div>

          <button id="entry-save" class="save-btn" data-action="save-entry">${t('Save')}</button>
        </div>
      </div>
    `;
  }

  async function saveEntrySheet() {
    const amountMinor = parseAmountToMinor(root.querySelector('#entry-amount').value);
    const note = root.querySelector('#entry-note').value.trim();
    const date = root.querySelector('#entry-date').value || todayISODateString();
    if (amountMinor == null || amountMinor <= 0) return;

    const balance = balanceFor(sheet.potId);
    if (sheet.mode === 'withdraw' && amountMinor > balance) return;

    await addPotEntry({
      potId: sheet.potId,
      amountMinor: sheet.mode === 'withdraw' ? -amountMinor : amountMinor,
      note,
      date,
    });
    sheet = null;
    await reloadData();
    render();
  }

  async function deleteEntry(entryId) {
    if (!window.confirm(t('Delete this entry?'))) return;
    await softDeletePotEntry(entryId);
    await reloadData();
    render();
  }

  function updateSaveState() {
    if (!sheet) return;
    if (sheet.type === 'pot') {
      const name = root.querySelector('#pot-name')?.value.trim();
      const target = parseAmountToMinor(root.querySelector('#pot-target')?.value);
      const saveBtn = root.querySelector('#pot-save');
      if (saveBtn) saveBtn.disabled = !name || target == null || target <= 0;
    } else {
      const amountInput = root.querySelector('#entry-amount');
      const saveBtn = root.querySelector('#entry-save');
      if (!amountInput || !saveBtn) return;
      const minor = parseAmountToMinor(amountInput.value);
      let valid = minor != null && minor > 0;
      if (valid && sheet.mode === 'withdraw') valid = minor <= balanceFor(sheet.potId);
      saveBtn.disabled = !valid;
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

    if (action === 'open-add-pot') return openPotSheet('create');
    if (action === 'close-sheet') { sheet = null; return render(); }
    if (action === 'open-pot') {
      view.screen = 'detail';
      view.potId = actionEl.dataset.potId;
      return render();
    }
    if (action === 'back-to-pots') {
      view.screen = 'list';
      view.potId = null;
      return render();
    }
    if (action === 'edit-pot') return openPotSheet('edit');
    if (action === 'select-pot-icon') {
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
    if (action === 'save-pot') return savePotSheet();
    if (action === 'archive-pot-in-sheet') return archiveCurrentPot();
    if (action === 'open-deposit') return openEntrySheet('deposit');
    if (action === 'open-withdraw') return openEntrySheet('withdraw');
    if (action === 'save-entry') return saveEntrySheet();
    if (action === 'delete-entry') return deleteEntry(actionEl.dataset.entryId);
  });

  root.addEventListener('input', (e) => {
    if (!sheet) return;
    if (['pot-name', 'pot-target', 'entry-amount'].includes(e.target.id)) updateSaveState();
  });

  render();
}
