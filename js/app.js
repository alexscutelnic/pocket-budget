import { initDB, getSettings } from './db.js';
import { setCurrency } from './format.js';
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

// iOS Safari keeps `position: fixed` elements sized against the full layout
// viewport even when the on-screen keyboard is open, so a bottom sheet can
// end up with its lower half hidden behind the keyboard. Track the real
// visible height AND its offset via VisualViewport — offsetTop matters too:
// iOS scrolls the page to keep a focused input visible while the keyboard
// opens/closes, and a fixed element that ignores that scroll ends up
// mispositioned (dropping behind the tab bar) once the keyboard animation
// settles. Re-check after focus changes too, since the resize/scroll events
// don't always fire promptly around the exact moment the keyboard closes.
function setupViewportTracking() {
  if (!window.visualViewport) return;
  const update = () => {
    document.documentElement.style.setProperty('--app-vh', `${window.visualViewport.height}px`);
    document.documentElement.style.setProperty('--app-vh-offset', `${window.visualViewport.offsetTop}px`);
  };
  window.visualViewport.addEventListener('resize', update);
  window.visualViewport.addEventListener('scroll', update);
  document.addEventListener('focusin', () => setTimeout(update, 50));
  document.addEventListener('focusout', () => setTimeout(update, 50));
  update();
}

async function main() {
  await initDB();
  const settings = await getSettings();
  setCurrency(settings.currency);
  paintTabIcons();
  setupViewportTracking();

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
