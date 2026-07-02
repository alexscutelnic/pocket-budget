import { initDB } from './db.js';
import { icon } from './icons.js';
import * as homeScreen from './screens/home.js';
import * as potsScreen from './screens/pots.js';
import * as trendsScreen from './screens/trends.js';
import * as settingsScreen from './screens/settings.js';

const TAB_ICONS = ['home', 'pots', 'trends', 'settings'];
const container = document.getElementById('screen-container');
const tabBar = document.getElementById('tab-bar');

// Re-mounts on every tap, even the already-active tab — tapping the current
// tab again should reset it to its root view (standard iOS tab-bar behavior),
// not no-op.
async function renderTab(tab) {
  tabBar.querySelectorAll('.tab-btn').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.tab === tab);
  });
  location.hash = tab;

  container.innerHTML = '';
  const screenEl = document.createElement('div');
  screenEl.className = 'screen';
  container.appendChild(screenEl);
  container.scrollTop = 0;

  if (tab === 'home') {
    await homeScreen.mount(screenEl);
  } else if (tab === 'pots') {
    await potsScreen.mount(screenEl);
  } else if (tab === 'trends') {
    await trendsScreen.mount(screenEl);
  } else if (tab === 'settings') {
    await settingsScreen.mount(screenEl);
  }
}

function paintTabIcons() {
  tabBar.querySelectorAll('.tab-icon').forEach((el) => {
    el.innerHTML = icon(el.dataset.icon, { size: 25 });
  });
}

function initialTab() {
  const fromHash = location.hash.replace('#', '');
  return TAB_ICONS.includes(fromHash) ? fromHash : 'home';
}

async function main() {
  await initDB();
  paintTabIcons();

  tabBar.addEventListener('click', (e) => {
    const btn = e.target.closest('.tab-btn');
    if (btn) renderTab(btn.dataset.tab);
  });

  document.addEventListener('navigate', (e) => {
    if (e.detail?.tab) renderTab(e.detail.tab);
  });

  await renderTab(initialTab());

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  }
}

main();
