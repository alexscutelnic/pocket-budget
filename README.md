# Pocket Budget

A personal budget tracker PWA for iPhone. Track spending against category
limits each pay cycle, grow savings pots, and see trends over time. Built to
feel like a native Apple app — grouped cards, iOS system colors, light/dark
mode, a bottom tab bar.

Each install is fully independent: everything is stored locally on-device in
IndexedDB. There's no backend, no account, and no server — data never leaves
the phone except via an explicit export.

## What it does

The app is built around one idea: **see your money in and out, per pay
cycle**. You set a reset day (the day you get paid) and everything — budgets,
totals, trends — runs payday to payday instead of calendar months.

### Home — what's left right now

- One big number: **what's left to spend this period**, worked out as
  income + extra income − spending − money moved into savings pots.
- A **"Safe to spend" figure**: what you can spend per day from today to
  payday without going over.
- Your categories (Groceries, Eating Out, …) each with a spending limit and
  a progress bar that goes green → orange → red as you approach it.
- The **+** button logs a purchase in a few taps: amount, category, optional
  note, date. Purchases you log often (same amount, category and note — your
  usual coffee, say) appear as **one-tap favourite chips** that prefill the
  whole form.
- One-off money in (sold something, got a refund) goes under **Extra
  Income** and counts toward the period.

### Pots — named savings goals

Create pots ("Holiday", "Emergency fund"), give them a target, and move
money in or out. Money added to a pot counts as spoken-for on Home, so
saving happens first rather than from whatever's left.

### Trends — where it's all going

- **This period, day by day** — your running spend against the same days
  last period, plus a dotted projection: *"On track for ~£1,380 this
  period"*.
- **Spend per period** and **spend by category** across the last 3, 6 or 12
  cycles. Tap a category to see it broken down by note — handy for spotting
  what "Eating Out" actually was.
- **Total savings** across all pots over time.
- At the start of each new period you get a one-time **recap** of the one
  that just ended: income, spent, saved, what was left over, your savings
  rate, and which category moved most.

### Subscriptions — the money that leaves on its own

Add recurring payments (rent, streaming, gym) once in Settings and they're
charged to their category automatically each cycle when you open the app.
Settings also shows each one's **yearly** cost and the total — £15/mo reads
as noise, £180/yr reads as a decision.

### Settings

Income, reset day, currency, interface language (English or Russian),
category management (rename, re-icon, recolor, reorder, archive),
subscriptions, and full JSON export/import for backups. If you haven't
backed up in over 30 days, Home shows a gentle nudge.

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
everything (settings, categories, transactions, pots, pot entries, extra
income, subscriptions). Settings
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
  db.js                IndexedDB data layer (settings/categories/transactions/pots/potEntries/incomeEntries/subscriptions)
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
