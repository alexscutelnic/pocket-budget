# Pocket Budget — Project Spec

A personal budget tracker PWA for iPhone. Two people will each run their own
independent copy (no shared backend), installed via Safari "Add to Home Screen".
All data is stored locally on-device. Designed to feel like a native Apple app.

## Product goals

1. Track everyday spending against category limits, per pay cycle.
2. Grow savings via named pots with targets.
3. Give long-term visibility: trends over months, not just the current cycle.
4. Zero running costs. Zero accounts. Data never leaves the phone except via
   explicit export.

## Tech constraints

- **Static site only.** Must deploy to GitHub Pages (no server, no build step
  required at runtime). A Vite build step is acceptable if output is static.
- **Vanilla JS or a very light setup preferred.** No heavy frameworks. If a
  chart library is used, vendor it locally (no CDN at runtime — the app must
  work offline). Hand-rolled SVG charts are also fine and preferred if clean.
- **Storage: IndexedDB** (via a thin wrapper such as `idb`, vendored, or raw).
  Do NOT use localStorage for transactional data.
- **Money is stored as integer pence** (`amountMinor`). Format for display as
  GBP (`Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' })`).
- **PWA requirements:** `manifest.json` (standalone display, app icons incl.
  `apple-touch-icon` 180x180), service worker with cache-first app shell so it
  opens offline, `apple-mobile-web-app-capable` / status-bar meta tags,
  `viewport-fit=cover` and safe-area insets (iPhone 13 Pro / 14 have notches).
- Target devices: iPhone 13 Pro and iPhone 14, Safari. Test at 390px width.

## Design language — Apple / iOS

- Follow Apple Human Interface Guidelines aesthetics: system font stack
  (`-apple-system, SF Pro`), grouped inset cards with large corner radii
  (~12–16px), iOS system colors (system blue #007AFF, green #34C759, orange
  #FF9500, red #FF3B30), subtle hairline separators.
- Bottom tab bar navigation with SF-Symbol-style icons (inline SVG).
- Support light and dark mode via `prefers-color-scheme`.
- Large title headers that feel like iOS navigation bars.
- Progress bars for category limits: green → orange (>75%) → red (>100%).
- Haptic-feeling micro-interactions (fast transitions, no janky animations).
- Number pad (`inputmode="decimal"`) for amount entry.

## Budget cycle — payday to payday (IMPORTANT)

- User sets a **reset day** in Settings (1–31, default 25).
- The current period runs from the most recent reset day up to (and excluding)
  the next one. Example: reset day 25 → on 2026-07-02 the period is
  2026-06-25 → 2026-07-24.
- If the reset day exceeds the number of days in a month (e.g. 31 in
  February), clamp to the last day of that month.
- All "this period" totals, category progress, and the Home screen use this
  cycle. Trends aggregate per period (label periods by the month the period
  *ends* in: "Jun 25 – Jul 24" is labeled "Jul").

## Screens

### 1. Home (default tab)
- Header: current period label + days remaining.
- Summary card: total spent vs. sum of category limits this period.
- Category list: each shows icon, name, spent / limit, progress bar.
- Floating "+" button → quick-add sheet: amount (numeric pad first), category
  picker, optional note, date (defaults to today). Saving takes ≤ 3 taps.
- Tapping a category → its transactions this period, swipe/tap to edit or
  delete a transaction.

### 2. Pots
- List of saving pots: name, icon, saved / target, progress ring or bar.
- "Add money" and "Withdraw" actions per pot (creates a pot entry).
- Create/edit/archive pots with a target amount and optional target date.
- Header total: all pots combined.

### 3. Trends
- Bar chart: total spend per period, last 6–12 periods.
- Stacked or grouped view: spend by category per period.
- Line chart: total savings (all pots) over time.
- Simple comparison card: this period vs. last period (total + biggest mover).
- Empty states must look intentional (first period will have little data).

### 4. Settings
- Manage categories: add/rename/re-icon/re-order, set per-period limit,
  archive (never hard-delete a category that has transactions).
- Reset day picker.
- **Export data**: downloads/share-sheets a single JSON file of everything,
  with a schema version field. Filename: `pocket-budget-YYYY-MM-DD.json`.
- **Import data**: restores from an export file. Warn before overwriting.
- Gentle nudge: if last export was > 30 days ago, show a dismissible banner
  on Home suggesting a backup.
- About/version.

## Data model (design for future sync — do not simplify away)

Every record gets a UUID `id`, `createdAt`, `updatedAt`, and soft-delete via
`deletedAt` (nullable). This keeps a future shared-backend v2 a bolt-on, not a
rewrite. Never hard-delete transactions; filter `deletedAt IS NULL` in queries.

- `settings`: { resetDay, currency: "GBP", schemaVersion }
- `categories`: { id, name, icon, limitMinor, sortOrder, archivedAt? }
- `transactions`: { id, categoryId, amountMinor, note?, date (YYYY-MM-DD),
  createdAt, updatedAt, deletedAt? }
- `pots`: { id, name, icon, targetMinor, targetDate?, archivedAt? }
- `potEntries`: { id, potId, amountMinor (negative = withdrawal), note?,
  date, createdAt, updatedAt, deletedAt? }

Seed sensible default categories on first run: Groceries, Eating Out,
Transport, Bills, Fun, Shopping, Other — with placeholder limits the user is
prompted to adjust in a short first-run walkthrough (set reset day → confirm
limits → done).

## Quality bar

- Everything works fully offline after first load.
- No console errors; graceful empty states everywhere.
- Export → wipe → import must round-trip losslessly (write a small test or a
  manual checklist for this).
- Keep the codebase small and readable; prefer fewer files over cleverness.

## Deployment

- GitHub repo → GitHub Pages (Deploy from branch, or Actions if using Vite).
- Document the deploy steps and the "install on iPhone" steps in README.md
  (Safari → Share → Add to Home Screen).

## Out of scope for v1 (do not build yet)

- Any backend, accounts, or sync.
- Bank connections / Open Banking / CSV import.
- Notifications, widgets, FaceID lock.
