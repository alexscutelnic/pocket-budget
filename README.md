# Pocket Budget

A personal budget tracker PWA for iPhone. Track spending against category
limits each pay cycle, grow savings pots, and see trends over time. Built to
feel like a native Apple app — grouped cards, iOS system colors, light/dark
mode, a bottom tab bar.

Each install is fully independent: everything is stored locally on-device in
IndexedDB. There's no backend, no account, and no server — data never leaves
the phone except via an explicit export.

## Tech

Vanilla JS (ES modules), no framework, no build step. Charts are hand-rolled
inline SVG. Money is stored as integer pence and formatted as GBP. It's a
static site, so it deploys straight to GitHub Pages.

## Run it locally

Any static file server works — there's nothing to build. From the project
root:

```bash
python -m http.server 8420
```

or, with Node:

```bash
npx serve .
```

Then open `http://localhost:8420` in a browser. For the closest preview to a
phone, use your browser's device toolbar at 390px width (iPhone 13 Pro / 14).

## Deploy to GitHub Pages

1. Push this repo to GitHub.
2. In the repo, go to **Settings → Pages**.
3. Under **Build and deployment**, set **Source** to "Deploy from a branch".
4. Pick the `main` branch and the `/ (root)` folder, then **Save**.
5. GitHub publishes the site at `https://<your-username>.github.io/<repo-name>/`
   within a minute or two.

No Actions workflow or build step is needed — the repo is served as-is.

## Install on iPhone

1. Open the deployed GitHub Pages URL in **Safari** on the iPhone (must be
   Safari — other browsers can't install to the home screen on iOS).
2. Tap the **Share** icon (square with an arrow pointing up).
3. Scroll down and tap **Add to Home Screen**.
4. Tap **Add**.

The app now opens full-screen from the home screen icon, works offline after
the first load, and keeps its own local data separate from anything in
Safari itself.

## Backing up your data

Settings → **Export Data** downloads a single dated JSON file with
everything (settings, categories, transactions, pots, pot entries). Settings
→ **Import Data** restores from that file — it fully overwrites whatever's
currently on the device, so use it to move data to a new phone or recover
from a backup, not to merge.

## Project structure

```
index.html          App shell + tab bar
manifest.json        PWA manifest
sw.js                 Service worker (cache-first app shell, offline support)
css/styles.css        iOS-style design system, light + dark mode
js/
  app.js               Tab router, boot sequence
  db.js                IndexedDB data layer (settings/categories/transactions/pots/potEntries)
  period.js            Pay-cycle (reset-day to reset-day) math
  format.js             Money formatting, date formatting, small utils
  icons.js              Hand-rolled SF-Symbol-style SVG icon set
  palette.js            Shared per-entity color assignment (category/pot colors)
  charts.js              Hand-rolled inline SVG bar/stacked-bar/line chart primitives
  screens/
    home.js               Home tab — remaining balance, categories, quick-add
    pots.js               Pots tab — savings pots, add/withdraw, history
    trends.js              Trends tab — spend & savings charts over time
    settings.js            Settings tab — categories, income, reset day, export/import
```
