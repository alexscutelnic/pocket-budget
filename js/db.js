// Data layer: raw IndexedDB wrapper + CRUD for all entities.
// Every record has id / createdAt / updatedAt; transactions & potEntries
// are soft-deleted via deletedAt so a future sync backend is a bolt-on.

import { nextColorIndex } from './palette.js';

const DB_NAME = 'pocket-budget';
const DB_VERSION = 1;

const DEFAULT_CATEGORIES = [
  { name: 'Groceries', icon: 'cart', limitMinor: 30000 },
  { name: 'Eating Out', icon: 'fork-knife', limitMinor: 10000 },
  { name: 'Transport', icon: 'car', limitMinor: 8000 },
  { name: 'Bills', icon: 'doc-text', limitMinor: 20000 },
  { name: 'Fun', icon: 'game-controller', limitMinor: 5000 },
  { name: 'Shopping', icon: 'bag', limitMinor: 5000 },
  { name: 'Other', icon: 'ellipsis', limitMinor: 5000 },
];

let dbPromise = null;

export function uuid() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function now() {
  return new Date().toISOString();
}

function openRawDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains('settings')) {
        db.createObjectStore('settings', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('categories')) {
        const s = db.createObjectStore('categories', { keyPath: 'id' });
        s.createIndex('sortOrder', 'sortOrder');
      }
      if (!db.objectStoreNames.contains('transactions')) {
        const s = db.createObjectStore('transactions', { keyPath: 'id' });
        s.createIndex('categoryId', 'categoryId');
        s.createIndex('date', 'date');
      }
      if (!db.objectStoreNames.contains('pots')) {
        db.createObjectStore('pots', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('potEntries')) {
        const s = db.createObjectStore('potEntries', { keyPath: 'id' });
        s.createIndex('potId', 'potId');
        s.createIndex('date', 'date');
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function tx(db, storeNames, mode, work) {
  return new Promise((resolve, reject) => {
    const t = db.transaction(storeNames, mode);
    let result;
    t.oncomplete = () => resolve(result);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error);
    Promise.resolve(work(t)).then((r) => { result = r; }).catch(reject);
  });
}

function reqToPromise(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function getDB() {
  if (!dbPromise) dbPromise = openRawDB();
  return dbPromise;
}

async function getAll(storeName) {
  const db = await getDB();
  return tx(db, [storeName], 'readonly', (t) => reqToPromise(t.objectStore(storeName).getAll()));
}

async function getOne(storeName, id) {
  const db = await getDB();
  return tx(db, [storeName], 'readonly', (t) => reqToPromise(t.objectStore(storeName).get(id)));
}

async function put(storeName, record) {
  const db = await getDB();
  await tx(db, [storeName], 'readwrite', (t) => reqToPromise(t.objectStore(storeName).put(record)));
  return record;
}

// ---- Bootstrap / seeding ----------------------------------------------

export async function initDB() {
  await getDB();
  const settings = await getOne('settings', 'settings');
  if (!settings) {
    await put('settings', {
      id: 'settings',
      resetDay: 25,
      currency: 'GBP',
      incomeMinor: 0,
      schemaVersion: 1,
      lastExportAt: null,
      exportBannerDismissedAt: null,
      createdAt: now(),
      updatedAt: now(),
    });
  }
  const categories = await getAll('categories');
  if (categories.length === 0) {
    let sortOrder = 0;
    let colorIndex = 0;
    for (const c of DEFAULT_CATEGORIES) {
      await put('categories', {
        id: uuid(),
        name: c.name,
        icon: c.icon,
        limitMinor: c.limitMinor,
        sortOrder: sortOrder++,
        colorIndex: colorIndex++,
        archivedAt: null,
        createdAt: now(),
        updatedAt: now(),
      });
    }
  }

  // Backfill colorIndex for records created before it existed, so upgrades
  // from an earlier version still get stable, collision-free colors.
  await backfillColorIndexes('categories');
  await backfillColorIndexes('pots');
}

async function backfillColorIndexes(storeName) {
  const records = await getAll(storeName);
  const used = records.map((r) => r.colorIndex).filter((v) => v != null);
  for (const r of records) {
    if (r.colorIndex != null) continue;
    const colorIndex = nextColorIndex(used);
    used.push(colorIndex);
    await put(storeName, { ...r, colorIndex, updatedAt: now() });
  }
}

// ---- Settings -----------------------------------------------------------

export async function getSettings() {
  return getOne('settings', 'settings');
}

export async function updateSettings(patch) {
  const current = (await getSettings()) || { id: 'settings' };
  const updated = { ...current, ...patch, id: 'settings', updatedAt: now() };
  return put('settings', updated);
}

// ---- Categories -----------------------------------------------------------

export async function listCategories({ includeArchived = false } = {}) {
  const all = await getAll('categories');
  const filtered = includeArchived ? all : all.filter((c) => !c.archivedAt);
  return filtered.sort((a, b) => a.sortOrder - b.sortOrder);
}

export async function getCategory(id) {
  return getOne('categories', id);
}

export async function addCategory({ name, icon, limitMinor, sortOrder }) {
  const all = await getAll('categories');
  const record = {
    id: uuid(),
    name,
    icon,
    limitMinor,
    sortOrder: sortOrder ?? all.length,
    colorIndex: nextColorIndex(all.map((c) => c.colorIndex)),
    archivedAt: null,
    createdAt: now(),
    updatedAt: now(),
  };
  return put('categories', record);
}

export async function updateCategory(id, patch) {
  const current = await getOne('categories', id);
  if (!current) throw new Error('Category not found');
  const updated = { ...current, ...patch, id, updatedAt: now() };
  return put('categories', updated);
}

export async function archiveCategory(id) {
  return updateCategory(id, { archivedAt: now() });
}

// ---- Transactions -----------------------------------------------------------

export async function listTransactions({ categoryId = null, from = null, to = null } = {}) {
  const all = await getAll('transactions');
  return all
    .filter((t) => !t.deletedAt)
    .filter((t) => !categoryId || t.categoryId === categoryId)
    .filter((t) => !from || t.date >= from)
    .filter((t) => !to || t.date < to)
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : b.createdAt.localeCompare(a.createdAt)));
}

export async function addTransaction({ categoryId, amountMinor, note = '', date }) {
  const record = {
    id: uuid(),
    categoryId,
    amountMinor,
    note,
    date,
    createdAt: now(),
    updatedAt: now(),
    deletedAt: null,
  };
  return put('transactions', record);
}

export async function updateTransaction(id, patch) {
  const current = await getOne('transactions', id);
  if (!current) throw new Error('Transaction not found');
  const updated = { ...current, ...patch, id, updatedAt: now() };
  return put('transactions', updated);
}

export async function softDeleteTransaction(id) {
  return updateTransaction(id, { deletedAt: now() });
}

// ---- Pots -----------------------------------------------------------

export async function listPots({ includeArchived = false } = {}) {
  const all = await getAll('pots');
  const filtered = includeArchived ? all : all.filter((p) => !p.archivedAt);
  return filtered.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export async function addPot({ name, icon, targetMinor, targetDate = null }) {
  const all = await getAll('pots');
  const record = {
    id: uuid(),
    name,
    icon,
    targetMinor,
    targetDate,
    colorIndex: nextColorIndex(all.map((p) => p.colorIndex)),
    archivedAt: null,
    createdAt: now(),
    updatedAt: now(),
  };
  return put('pots', record);
}

export async function updatePot(id, patch) {
  const current = await getOne('pots', id);
  if (!current) throw new Error('Pot not found');
  const updated = { ...current, ...patch, id, updatedAt: now() };
  return put('pots', updated);
}

export async function archivePot(id) {
  return updatePot(id, { archivedAt: now() });
}

// ---- Pot entries -----------------------------------------------------------

export async function listPotEntries({ potId = null } = {}) {
  const all = await getAll('potEntries');
  return all
    .filter((e) => !e.deletedAt)
    .filter((e) => !potId || e.potId === potId)
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
}

export async function addPotEntry({ potId, amountMinor, note = '', date }) {
  const record = {
    id: uuid(),
    potId,
    amountMinor,
    note,
    date,
    createdAt: now(),
    updatedAt: now(),
    deletedAt: null,
  };
  return put('potEntries', record);
}

export async function potBalance(potId) {
  const entries = await listPotEntries({ potId });
  return entries.reduce((sum, e) => sum + e.amountMinor, 0);
}

export async function updatePotEntry(id, patch) {
  const current = await getOne('potEntries', id);
  if (!current) throw new Error('Pot entry not found');
  const updated = { ...current, ...patch, id, updatedAt: now() };
  return put('potEntries', updated);
}

export async function softDeletePotEntry(id) {
  return updatePotEntry(id, { deletedAt: now() });
}

// ---- Export / import -----------------------------------------------------------

export async function exportAll() {
  const [settings, categories, transactions, pots, potEntries] = await Promise.all([
    getSettings(),
    getAll('categories'),
    getAll('transactions'),
    getAll('pots'),
    getAll('potEntries'),
  ]);
  return {
    schemaVersion: 1,
    exportedAt: now(),
    settings,
    categories,
    transactions,
    pots,
    potEntries,
  };
}

export async function importAll(data) {
  const db = await getDB();
  const stores = ['settings', 'categories', 'transactions', 'pots', 'potEntries'];
  await tx(db, stores, 'readwrite', async (t) => {
    for (const store of stores) {
      const clearReq = t.objectStore(store).clear();
      await reqToPromise(clearReq);
    }
    if (data.settings) t.objectStore('settings').put(data.settings);
    for (const c of data.categories || []) t.objectStore('categories').put(c);
    for (const tr of data.transactions || []) t.objectStore('transactions').put(tr);
    for (const p of data.pots || []) t.objectStore('pots').put(p);
    for (const pe of data.potEntries || []) t.objectStore('potEntries').put(pe);
  });
}
