# LedgerWise

**A local-first, offline personal finance planner for working households.**  
Track income, spending, net worth, debt, investments, goals, and forward projections — all from one encrypted desktop app. No cloud account. No subscriptions. Your data never leaves your machine.

> Built with Electron · React · TypeScript · SQLite (AES-256 via SQLCipher) · Tailwind CSS

---

## Why LedgerWise?

Modern money apps require cloud accounts and ongoing subscriptions. Local tools like GnuCash feel like accounting software. LedgerWise fills the gap: the privacy and control of offline software combined with the clarity of a modern household financial dashboard.

- **100% offline** — no internet required, no servers, no sync
- **Encrypted at rest** — AES-256 SQLCipher with Argon2id key derivation; your passphrase never leaves the device
- **File-based imports** — CSV, OFX, QFX, and QIF from Chase, Wells Fargo, Robinhood, Vanguard, Wealthfront, Edfinancial, and more
- **Household balance sheet** — all accounts (checking, savings, credit cards, loans, retirement, brokerage, HSA, real estate) in one net-worth view
- **Goals-first planning** — debt paydown, emergency fund, sinking funds, down payment, retirement, and general savings goals with monthly contribution tracking
- **Deterministic projections** — 12, 24, and 60-month cash-flow and net-worth forecasts with editable assumptions
- **Decision memory** — timestamped plan notes preserve every major financial decision and its rationale
- **Cross-platform** — macOS, Windows, and Linux; packaged into native installers

---

## Table of Contents

1. [Requirements](#requirements)
2. [Quick Start (Development)](#quick-start-development)
3. [First Run](#first-run)
4. [Building a Desktop Installer](#building-a-desktop-installer)
5. [Importing Transactions](#importing-transactions)
6. [Supported Institutions](#supported-institutions)
7. [Application Overview](#application-overview)
8. [Data & Security](#data--security)
9. [Backup and Export](#backup-and-export)
10. [Running Tests](#running-tests)
11. [Project Structure](#project-structure)
12. [Troubleshooting](#troubleshooting)
13. [Roadmap](#roadmap)
14. [Contributing](#contributing)
15. [License](#license)

---

## Requirements

| Requirement | Version |
|---|---|
| Node.js | 18 LTS or 20 LTS |
| npm | 9+ (bundled with Node) |
| macOS | 12 Monterey+ |
| Windows | 10 or 11 (64-bit) |
| Linux | Ubuntu 20.04+ / Fedora 36+ / any distro with glibc 2.31+ |

Native modules (`@signalapp/better-sqlite3`, `argon2`) are compiled during `npm install`. You need:
- **macOS**: Xcode Command Line Tools — `xcode-select --install`
- **Windows**: Visual Studio Build Tools 2019+ with the "Desktop development with C++" workload, or run `npm install --global windows-build-tools`
- **Linux**: `build-essential` and `python3` — `sudo apt install build-essential python3` (or distro equivalent)

---

## Quick Start (Development)

```bash
# 1. Clone the repository
git clone https://github.com/yourusername/ledgerwise.git
cd ledgerwise

# 2. Install dependencies (also compiles native modules for your Electron version)
npm install

# 3. Start the app in development mode with hot-reload
npm run dev
```

The app window opens automatically. On the very first launch you will be prompted to create a passphrase — see [First Run](#first-run).

---

## First Run

When you open LedgerWise for the first time, you will see the **Setup** screen.

1. **Choose a passphrase** — this is the only credential protecting your data. Use something strong and memorable. There is no password reset; if you lose this passphrase, the database cannot be recovered.
2. **Confirm the passphrase** — type it again to confirm.
3. **Create vault** — LedgerWise generates a random 256-bit encryption key, wraps it with your passphrase using Argon2id, and creates an encrypted SQLite database in your system's app-data folder.
4. You land on the **Dashboard**. Start by adding accounts under **Accounts → Add Account**.

On every subsequent launch you will see the **Unlock** screen. Enter your passphrase to open the database.

**Data location:**

| OS | Path |
|---|---|
| macOS | `~/Library/Application Support/ledgerwise/` |
| Windows | `%APPDATA%\ledgerwise\` |
| Linux | `~/.config/ledgerwise/` |

Files in that folder:
- `ledgerwise.db` — encrypted SQLite database (unreadable without the passphrase)
- `key.json` — encrypted key metadata (salt, wrapped DEK) — **never commit this to version control**

---

## Building a Desktop Installer

```bash
# Build the app and create a native installer for your current OS
npm run package
```

Output is written to the `dist/` folder:

| OS | Format | File |
|---|---|---|
| macOS | DMG + ZIP | `LedgerWise-0.1.0.dmg` |
| Windows | NSIS installer + portable EXE | `LedgerWise Setup 0.1.0.exe` |
| Linux | AppImage + .deb | `LedgerWise-0.1.0.AppImage` |

To build only (without packaging):

```bash
npm run build
```

Output lands in `out/` and can be launched with `npm run preview`.

---

## Importing Transactions

LedgerWise supports four file formats: **CSV**, **OFX**, **QFX**, and **QIF**.

### How to import

1. Download a statement export from your bank or brokerage (see [Supported Institutions](#supported-institutions) for exact steps per institution).
2. Open LedgerWise and navigate to **Import** in the sidebar.
3. **Select the file** — drag and drop onto the import panel, or click "Browse" to choose a file.
4. **Choose the destination account** — pick which account these transactions belong to.
5. **Select the institution template** — LedgerWise auto-detects the format but you can override the column mapping if needed.
6. **Review the preview** — a table shows the parsed transactions. Duplicate detection runs automatically; any rows already in the database are flagged.
7. **Confirm** — click "Import X transactions" to save them. Imported transactions land in the **Review Queue** (status: pending) so you can categorize and approve them before they affect your reports.

### Review Queue

Transactions imported or entered manually start with status **Pending** and appear in the Review Queue tab on the Transactions page. To approve:
- Click the checkmark on a single row to mark it reviewed.
- Use **Bulk Approve** to clear all pending transactions at once.

---

## Supported Institutions

### Chase
- Go to chase.com → account → "Download account activity"
- Formats: **CSV**, **QFX**, **QIF**
- Template: auto-detected as "Chase Checking/Credit"

### Wells Fargo
- Go to wellsfargo.com → account activity → "Download Account Activity"
- Formats: **CSV** (spreadsheet), **QFX** (Quicken Web Connect)
- Template: auto-detected as "Wells Fargo"

### Robinhood
- Go to robinhood.com → Account → Statements & History → "Download CSV"
- Format: **CSV**
- Template: auto-detected as "Robinhood"

### Vanguard (personal/brokerage)
- Go to vanguard.com → account → "Download" → CSV
- Format: **CSV**
- Template: auto-detected as "Vanguard"

### Wealthfront
- Go to wealthfront.com → Documents → "Export to Quicken"
- Format: **QFX**
- Template: standard OFX/QFX (auto-detected)

### Edfinancial (student loans)
- Go to edfinancial.com → Statements → "Export to spreadsheet"
- Format: **CSV**
- Template: use "Generic CSV" and map columns if needed

### TruStone Financial
- Download monthly PDF statements from the member portal
- Import via the **PDF** fallback path; transactions are extracted from statement text
- Review extracted rows carefully before confirming

### Any other institution
- Export whatever CSV or OFX/QFX/QIF file your bank provides
- Choose **"Generic CSV"** template and map the Date, Amount, and Description columns in the preview step

---

## Application Overview

### Dashboard
The home screen gives a full household snapshot:
- **Net Worth** — total assets minus total liabilities with a 12-month trend line
- **Monthly Income / Spending / Savings Rate** — derived from reviewed transactions in the current month
- **Account Balances** — cards for every account grouped by type
- **Spending Breakdown** — category-level bar chart
- **Upcoming Bills** — next occurrences of active recurring items

### Accounts
Add and manage every account type:

| Type | Examples |
|---|---|
| Checking | Chase Total Checking, Wells Fargo Everyday |
| Savings | High-yield savings, money market |
| Credit Card | Chase Sapphire, Discover |
| Loan / Student Loan | Edfinancial, Navient |
| Brokerage | Robinhood, Fidelity taxable |
| Retirement | Vanguard 401(k), IRA |
| HSA | Fidelity HSA |
| Real Estate | Home equity asset |
| Manual Asset / Liability | Car value, personal loan |

### Transactions
- Full ledger with date, payee, category, account, amount, and status
- **Review Queue** tab for newly imported or manually added transactions
- Filters: date range, account, category, free-text search
- Edit any transaction inline; add notes, tags, or attachments
- Split a transaction across multiple categories

### Goals
Create and track financial goals:
- Emergency Fund — target X months of core expenses
- Debt Paydown — link to a loan/credit account, set payoff date
- Sinking Fund — accumulate for a future expense (car repair, vacation)
- Down Payment — save toward a purchase
- Retirement — project contributions over time
- General Savings — any target amount and date

Each goal shows: current amount, target amount, progress bar, required monthly contribution, and projected completion date.

### Investments
- Holdings table: symbol, name, quantity, cost basis, current value, gain/loss, asset class, tax bucket
- Allocation chart: current allocation vs. target allocation pie, with drift indicators
- Tax bucket rollup: taxable / tax-deferred / tax-free breakdown
- Add allocation targets and tolerance bands (e.g. "60% US equity ±5%")

### Projections
Deterministic forward planning with editable assumptions:

| Assumption | Default |
|---|---|
| Investment return rate | 7% / year |
| Inflation rate | 3% / year |
| Income growth rate | 3% / year |
| Months to project | 12 |

Output: monthly net-worth line chart, projected savings accumulation, debt payoff dates, and emergency-fund runway. Change any assumption and recalculate instantly.

### Plan Notes (Decision Log)
A timestamped log of every major financial decision. Add entries when you:
- Change a savings target or allocation
- Start or pay off a debt
- Adjust a projection assumption
- Review your financial plan

Each entry has a title, effective date, category (goal change, allocation change, debt plan, etc.), and free-text body.

### Settings
- **Categories** — add, rename, or delete transaction categories
- **Category Rules** — auto-assign categories by payee pattern
- **Recurring Items** — define expected monthly income and bills for the projections engine
- **Backup & Export** — see [Backup and Export](#backup-and-export)
- **Change Passphrase** — re-wrap the encryption key without touching the database

---

## Data & Security

LedgerWise was designed to keep sensitive financial data safe on a local device.

### Encryption model
1. On first run, a random 256-bit **Data Encryption Key (DEK)** is generated.
2. Your passphrase is fed through **Argon2id** (time=3, memory=65536, parallelism=4) to derive a **Key Encryption Key (KEK)**.
3. The DEK is encrypted with the KEK using **AES-256-GCM** and stored in `key.json` alongside the salt and IV.
4. The database is opened with the raw DEK via **SQLCipher** (`PRAGMA key`), which encrypts the entire file — including the write-ahead log and rollback journal — with AES-256-CBC.
5. **`PRAGMA temp_store = MEMORY`** ensures no sensitive data is written to disk temp files.
6. **`PRAGMA synchronous = FULL`** prevents data loss on unexpected shutdown.

### What is NOT stored
- Bank credentials or login tokens
- Plaintext account numbers in logs
- Any data outside the encrypted database and `key.json`

### File permissions
LedgerWise sets `0700` on the app-data directory and `0600` on `ledgerwise.db` and `key.json` at startup. On Windows, the `%APPDATA%` folder is ACL-restricted to the current user by default.

### Threat model
LedgerWise protects against: laptop theft, backup compromise, accidental file sharing. It does **not** protect against local malware, keyloggers, or an attacker with your unlocked session (OS-level disk encryption such as FileVault or BitLocker is recommended as a complementary layer).

---

## Backup and Export

### Encrypted backup
Settings → Backup & Export → **Export Backup**

Writes an encrypted copy of `ledgerwise.db` (including current WAL checkpoint) to a file you choose. The backup is protected by the same passphrase as the live database.

To restore: Settings → **Import Backup** → select the backup file → enter passphrase.

### CSV export
Settings → Backup & Export → **Export Transactions as CSV**

Exports all reviewed transactions to a plaintext CSV. Treat this file as sensitive — it contains unencrypted financial data.

### Manual backup (advanced)
You can copy `ledgerwise.db` and `key.json` together to any location. Both files are required to restore. The database file alone cannot be decrypted without the matching `key.json` and passphrase.

---

## Running Tests

```bash
# Run all unit and integration tests once
npm test

# Run tests in watch mode
npm run test:watch
```

Test coverage includes:
- CSV parser — all institution templates (Chase, Wells Fargo, Robinhood, Vanguard, generic)
- OFX/QFX parser — SGML and XML variants
- QIF parser — bank, credit card, and investment record types
- PDF parser — statement text extraction
- Balance logic — running balance calculations and deduplication
- Projection engine — 12-month deterministic forecast accuracy (within 1%)

---

## Project Structure

```
ledgerwise/
├── electron-builder.yml        # Packaging config (DMG, NSIS, AppImage)
├── electron.vite.config.ts     # electron-vite build config
├── tailwind.config.js
├── tsconfig.json
├── src/
│   ├── main/                   # Electron main process (Node.js)
│   │   ├── index.ts            # Window creation, app lifecycle
│   │   ├── preload.ts          # Context bridge → exposes IPC to renderer
│   │   ├── database/
│   │   │   ├── index.ts        # DB open/init, key management, WAL setup
│   │   │   └── migrations.ts   # Versioned SQL schema migrations
│   │   ├── ipc/                # IPC handlers (one file per domain)
│   │   │   ├── accounts.ts
│   │   │   ├── transactions.ts
│   │   │   ├── categories.ts
│   │   │   ├── goals.ts
│   │   │   ├── holdings.ts
│   │   │   ├── import.ts
│   │   │   ├── projections.ts
│   │   │   ├── backup.ts
│   │   │   ├── dashboard.ts
│   │   │   └── plan-notes.ts
│   │   └── parsers/            # File format parsers
│   │       ├── csv.ts          # CSV with per-institution templates
│   │       ├── ofx.ts          # OFX/QFX (SGML + XML)
│   │       ├── qif.ts          # QIF (bank, credit card, investment)
│   │       └── pdf.ts          # PDF statement text extraction (fallback)
│   ├── shared/
│   │   └── types.ts            # TypeScript interfaces shared by main + renderer
│   └── renderer/               # React frontend
│       ├── index.html
│       └── src/
│           ├── App.tsx         # Router + auth gate
│           ├── main.tsx        # React root
│           ├── store/
│           │   └── appStore.ts # Zustand global state
│           ├── components/     # Shared UI components
│           ├── pages/          # One file per route
│           └── styles/
│               └── globals.css
├── src/tests/                  # Vitest unit + integration tests
└── doc/                        # PRD and ADR reference documents
```

---

## Troubleshooting

**`npm install` fails with node-gyp errors**

Native modules require build tools. Install them for your OS (see [Requirements](#requirements)), then re-run `npm install`. On macOS:
```bash
xcode-select --install
npm install
```

**App opens but shows a blank white screen**

Run `npm run dev` and check the terminal for TypeScript errors. If the renderer fails to compile, the window will be blank. Fix the reported errors and the window will hot-reload.

**Wrong passphrase error on unlock**

LedgerWise cannot recover from a forgotten passphrase. If you have a recent backup made before the passphrase was changed, restore it via Settings → Import Backup with the passphrase that was active when the backup was created.

**Duplicate transactions after import**

LedgerWise deduplicates by `FITID` (bank-provided ID in OFX/QFX) or by a `date + abs(amount) + payee` fingerprint for CSV. If duplicates still appear, check that the date range of your export does not overlap a previously imported file. The review queue lets you delete unwanted rows before approving the import.

**Chart shows no data**

Dashboard charts read from *reviewed* transactions only. If all transactions are still in the Review Queue (status: pending), approve them first via Transactions → Review Queue → Bulk Approve.

**`PRAGMA key` / database encryption error at startup**

This usually means `key.json` was deleted or moved. Without it, the encrypted database cannot be opened. Restore `key.json` from a backup, or restore the entire database from a backup export.

---

## Roadmap

### v0.2
- [ ] Per-institution PDF statement templates (Chase, Wells Fargo)
- [ ] Recurring transaction auto-detection from import history
- [ ] Partner / household mode (shared passphrase, single database)
- [ ] Optional read-only live price refresh (yfinance / Alpha Vantage) when online

### v0.3
- [ ] Monte Carlo retirement simulation
- [ ] Tax-bucket optimization suggestions
- [ ] Full investment analytics (XIRR, benchmark comparison)
- [ ] OS keychain integration (optional — store DEK without re-entering passphrase)

### Later
- [ ] FDX-based permissioned connectivity (if online features are ever added)

---

## Contributing

1. Fork the repository and create a branch: `git checkout -b feature/my-feature`
2. Make your changes and add tests where applicable
3. Ensure `npm test` passes and `npm run build` succeeds
4. Open a pull request with a clear description of what changed and why

Please do not commit `ledgerwise.db`, `key.json`, or any file containing real financial data.

---

## License

MIT — see [LICENSE](LICENSE) for details.

---

<!-- SEO meta: LedgerWise local-first personal finance app offline budget tracker net worth goals investments Electron SQLite encrypted desktop macOS Windows Linux -->
