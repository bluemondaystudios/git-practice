# EDRAM Admin: build context

Handoff document for building **EDRAM Admin**, the internal records and invoicing system for EDRAM Shuttle and Tours. Everything below was decided in an earlier session with the developer. Build from it; don't reopen the decisions unless the developer asks.

**How to use this file:** put it in the root of the new `edram-admin` repo as `CLAUDE.md`. The database schema in Appendix A has been run and tested against PostgreSQL 16, using the test kit in Appendix B. Everything else is design and specification; no app code exists yet.

---

## 1. The business and the people

- **Business:** EDRAM Shuttle and Tours, a passenger transport business in Gezina, Pretoria, South Africa. Services: airport transfers (O.R. Tambo, Lanseria), local trips, hourly and full-day hire, tours and charters, funeral shuttles, and staff and school transport.
- **Fleet:** 5-seater SUV ×3, 7-seater van ×2, 15-seater shuttle ×1, 22-seater coach ×1.
- **Founder and main user:** Edward Ramotholo, who works mostly from his phone.
- **Developer:** the person handing you this file (GitHub org `bluemondaystudios`). They're the second user of the system.
- **Contact details:** 299 12th Avenue, Lenora, Gezina, Pretoria · 081 215 3162 · bookings@edramshuttle.co.za
- **Public website:** https://edramshuttle.co.za, from repo `bluemondaystudios/git-practice`, a static site on GitHub Pages (see section 19).

## 2. The problem and the goals

The owner constantly sends invoices, and he struggles when **SARS emails asking for his records**. He is **not VAT-registered**. The system's real job is **record-keeping**; invoicing is one part of it.

**Goals**
1. Create, send and track invoices from the phone, quickly.
2. Record money received (payments) against invoices.
3. Capture business expenses with a photo of each receipt, because expenses lower his tax.
4. Produce, at any time, a tax-year pack (income, expenses, every invoice PDF and receipt) to answer SARS or hand to an accountant.
5. Keep records safe and unaltered for **at least 5 years**.

**Non-goals (for now):** VAT, payroll, full double-entry accounting, a customer login or portal, and online card payments.

**Record rules this system enforces** (general guidance, not tax advice; an accountant should confirm specifics):
- Invoices say **"INVOICE"**, never "Tax Invoice", because he isn't VAT-registered.
- Invoice numbers are sequential and **gap-free**. An issued invoice is never edited or deleted. Mistakes are **voided with a reason**, and the void stays on record.
- Expenses are never hard-deleted (soft delete only), and receipt images are never deleted.
- Every change to a financial record goes into an audit log.

## 3. Decisions already made

| Decision | Choice | Why |
|---|---|---|
| App type | **Progressive Web App (PWA)**, installable to the home screen | No app store or APK sideloading; updates reach him automatically; also works on a laptop later |
| Priority | **Phone first**, then laptop | He works from his phone |
| Repo | New, separate repo **`bluemondaystudios/edram-admin`** | Keeps the public website and the internal system apart |
| Address | **`admin.edramshuttle.co.za`**, plus a redirect from `edramshuttle.co.za/admin` | A separate origin isolates his financial data from the public site; `/admin` is easy to remember |
| Hosting | **GitHub Pages**, deployed by GitHub Actions | Free; same setup as the website |
| Backend | **Supabase free tier**: Postgres, Auth, Storage | Free; login, database and file storage in one; Row Level Security |
| Users | Exactly two: the owner and the developer. **Sign-ups disabled** | Only they may access records |
| Data in the repo | **Never.** No customer data and no secrets in Git | The repo is public (Pages on a free plan). The Supabase URL and publishable (anon) key are designed to be public; RLS protects the data |
| Connectivity | **Online-first.** The app opens offline; expense capture works offline from phase 2 | Keeps v1 simple; covers capturing receipts at the pump without signal |
| Pricing | No price list. Every price is typed per invoice | Matches the website, which is quote-led |

## 4. Architecture

```
 Phone / laptop (PWA)                         Supabase (free tier)
 ┌──────────────────────────────┐   HTTPS    ┌──────────────────────────────┐
 │ admin.edramshuttle.co.za     │ ─────────▶ │ Auth: email + password,      │
 │  React + Vite + TS (static)  │            │   2 users, sign-ups off      │
 │  Service worker (app shell)  │            │ Postgres: tables + RLS,      │
 │  PDF generated on device     │ ◀───────── │   rules in triggers/RPCs     │
 │  Receipts compressed on      │            │ Storage: private 'receipts'  │
 │   device before upload       │            │   bucket                     │
 └──────────────┬───────────────┘            └──────────────────────────────┘
                │ share sheet (Web Share API)
                ▼
         WhatsApp / email → customer

 GitHub: bluemondaystudios/edram-admin ── Actions: test, build, deploy ──▶ GitHub Pages
 DNS:    admin.edramshuttle.co.za  CNAME  bluemondaystudios.github.io
 Website: edramshuttle.co.za/admin  ──redirect──▶  admin.edramshuttle.co.za
```

- **Business rules live in the database** (Appendix A), not only in the UI: gap-free numbering, frozen issued invoices, void-with-reason, payments only on issued invoices, soft deletes and the audit log. The app calls `issue_invoice()` and `void_invoice()` over RPC.
- **The PDF is generated on the device** from the invoice row. Issued invoices store `customer_snapshot` and `seller_snapshot`, so an old invoice always renders exactly as issued, even if bank details or a customer's address change later. PDFs are **not stored**; they're generated on demand and in exports.

## 5. Tech stack

- **React** (current stable), **Vite**, **TypeScript** in strict mode.
- **Routing:** React Router with a **hash router** (`#/invoices/…`). GitHub Pages has no server-side rewrites for single-page apps.
- **Data:** `@supabase/supabase-js` v2, with **TanStack Query** for fetching and caching.
- **Forms:** `react-hook-form` and `zod`.
- **PDF:** `jspdf` and `jspdf-autotable`.
- **ZIP exports:** `fflate`, streaming so large exports don't exhaust phone memory.
- **PWA:** `vite-plugin-pwa` (Workbox) for the manifest, icons and app-shell caching.
- **Offline queue (phase 2):** IndexedDB via `idb-keyval`.
- **Styling:** plain CSS with custom properties, matching the website's approach. No CSS framework.
- **Tests:** Vitest for all pure logic (money, dates, tax years, numbering display, CSV, file names). The database tests in Appendix B run in CI against a Postgres service container.

**Gotchas to handle**
- **Supabase auth redirects put tokens in the URL hash, which clashes with the hash router.** Create the client with `auth: { flowType: 'pkce' }`, so redirects use `?code=`. Simpler still for v1: no self-service password reset; the developer resets passwords in the Supabase dashboard.
- **`Intl` formats `en-ZA` amounts with special spaces** (U+00A0 and U+202F). jsPDF's built-in fonts can't draw them, so replace them with normal spaces before writing to the PDF.
- **Phone inputs:** use `font-size: 16px` or more on inputs, to stop iOS zooming in. Use `inputmode="decimal"` for amounts, `inputmode="tel"` for phone numbers, and `type="date"` for dates.

## 6. Repo layout

```
edram-admin/
  CLAUDE.md                     ← this file
  index.html
  vite.config.ts                ← vite-plugin-pwa config, base '/'
  public/icons/                 ← PWA icons (192, 512, maskable), favicon
  src/
    main.tsx, App.tsx, router.tsx
    lib/
      supabase.ts               ← client (VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY)
      money.ts                  ← cents <-> rands, formatZAR(), parseZAR()
      dates.ts                  ← display formats, financialYear(), dueDate()
      phone.ts                  ← SA number to wa.me format (0821234567 -> 27821234567)
      pdf/invoicePdf.ts         ← builds the invoice PDF (section 10)
      export/                   ← csv.ts, zipPack.ts, backup.ts
      images.ts                 ← receipt compression
      offlineQueue.ts           ← phase 2
    features/
      auth/  dashboard/  invoices/  payments/  customers/
      expenses/  vehicles/  reports/  settings/
    ui/                         ← Button, Sheet, ListRow, StatusPill, MoneyInput, EmptyState…
    styles/tokens.css, base.css
  supabase/
    migrations/0001_init.sql    ← Appendix A, verbatim
    tests/supabase_stub.sql     ← Appendix B
    tests/db_tests.sql          ← Appendix B
  .github/workflows/deploy.yml  ← test, build, deploy to Pages
  .env.example                  ← variable names only, no values
```

## 7. Data model (summary; the full SQL is Appendix A)

All money is **integer cents** (`bigint`). Never use floats for money. Dates are `date`; timestamps are `timestamptz`.

| Table | Purpose | Key rules |
|---|---|---|
| `team_members` | Allowlist of the two users (`user_id` refers to `auth.users`) | `is_team_member()` gates every policy |
| `business_settings` | Single row: names, entity type, registration number, address, bank details, `invoice_prefix` (default `EDR-`), `payment_terms_days` (default 7), footer, `financial_year_start_month` (default 3 = March), `last_backup_at` | Captured into `seller_snapshot` when an invoice is issued |
| `invoice_counter` | Single-row counter | Hidden from clients; only `issue_invoice()` uses it, so numbering is gap-free |
| `customers` | People and organisations billed: individuals, schools, funeral parlours, companies | Archive instead of deleting; can't be deleted once invoiced |
| `vehicles` | The fleet, e.g. "15 Seater #1" with its registration plate | Optional on invoice lines and expenses |
| `invoices` | `status` is `draft`, `issued` or `void`. `number` and `seq` are set only when issued. Snapshots, dates, total, void reason | Inserted as drafts only. Issued only through `issue_invoice()`, voided only through `void_invoice()`. Issued invoices are otherwise frozen. Only drafts can be deleted |
| `invoice_lines` | Description, service date, vehicle, quantity, unit price; `amount_cents` is generated | Editable only while the invoice is a draft; the invoice total is recalculated automatically |
| `payments` | Date, amount, method (`eft`, `cash`, `card`, `other`), reference | Only against issued invoices. Voiding requires no payments, so remove a mistaken payment first; the audit log keeps it |
| `expenses` | Date, amount, category, vehicle, supplier, method, `receipt_path`, `deleted_at` | No hard delete; soft delete only |
| `audit_log` | Every insert, update and delete on financial tables, with old and new row and the user who did it | Read-only to the team |

**Expense categories:** `fuel`, `maintenance_repairs`, `tyres`, `tolls`, `insurance`, `vehicle_finance`, `licensing`, `driver_wages`, `cleaning`, `parking`, `phone_data`, `office_admin`, `other`. Show friendly labels and icons (section 9).

**Views** (`security_invoker`, so RLS applies):
- `invoice_balances`: total, paid, balance, and `is_overdue` per invoice. Use it for every invoice list.
- `ledger`: one row per payment received (income) and per non-deleted expense. Use it for reports and exports.

**RPCs:**
- `issue_invoice(p_invoice_id uuid, p_issue_date date default current_date)`: returns the issued invoice row.
- `void_invoice(p_invoice_id uuid, p_reason text)`: returns the voided invoice row.

**Storage:** a private bucket, `receipts`. Path: `{yyyy}/{mm}/{expense_id}.jpg`. Team members can read, upload and replace receipts; nobody can delete them.

## 8. Security model

- Sign-ups are disabled in Supabase Auth. The two users are created in the dashboard, then given `team_members` rows through the SQL editor (section 17).
- **RLS is on for every table.** A signed-in stranger and an anonymous visitor see nothing (tested in Appendix B).
- **The browser only ever has the publishable (anon) key.** The `service_role` or secret key never goes in the app, the repo or CI.
- The PWA keeps the Supabase session in `localStorage`, under its own origin (`admin.` subdomain), isolated from the public website.
- Add `<meta name="robots" content="noindex, nofollow">` and a `robots.txt` with `Disallow: /`.
- **POPIA:** customer names and numbers are personal information. Keep them only in Supabase, never in Git, logs, analytics or error trackers. Choose the closest Supabase region on offer; if it's outside South Africa, note that for the owner.
- Settings has a "Sign out" button. If a phone is lost, the developer revokes the sessions in the Supabase dashboard.

## 9. App design

**Brand tokens** (from the website):

```css
--green: #5cb848;  --green-dark: #489a36;  --green-light: #7fd06b;
--black: #0b0b0b;  --charcoal: #161616;   --off-white: #f3f4f3;
--white: #ffffff;  --grey: #6b6b6b;       --text: #1a1a1a;
--radius: 12px;    font-family: "Montserrat", system-ui, sans-serif;
```

**Principles**
- **Records app, not a marketing site.** Light content areas (white cards on off-white) for legibility, with a black top bar carrying the EDRAM van logo and wordmark. Green marks the main action on each screen.
- **One-handed on a phone:** bottom navigation, primary actions in a sticky bottom bar, touch targets of at least 48px, and nothing important in the top corners.
- **Speed targets:** log an expense in under 20 seconds; create and send an invoice in under 60 seconds.
- **Calm states:** every list has an empty state that explains the next step. Errors say what happened and what to do, in plain language.
- **Motion:** subtle only (sheet slide-up, a 150ms press state). Honour `prefers-reduced-motion`. None of the website's playful effects.

**Status colours** (always pill plus text, never colour alone):

| Status | Pill |
|---|---|
| Draft | grey `#6b6b6b` |
| Unpaid (issued, balance > 0, not overdue) | amber `#b7791f` |
| Overdue | red `#c53030` |
| Partly paid | amber, with the amount paid shown |
| Paid | green `#489a36` |
| Void | grey with struck-through number |

**Navigation:** a bottom tab bar on phone, a left rail on screens 900px and wider.
- Tabs: **Home** · **Invoices** · **＋** (raised centre button: *New invoice*, *Log expense*, *Record payment*) · **Expenses** · **More**
- **More** contains Customers, Vehicles, Reports and export, Backup, Settings and Sign out.

**Screens**
1. **Sign in:** logo, email, password, "Sign in". No sign-up link.
2. **Home (dashboard)**
   - Four tiles: *Received this month*, *Outstanding* (with count), *Overdue* (count, red when above zero), *Expenses this month*.
   - Below: overdue invoices (tap to open), then the five most recent invoices.
   - A banner when the last backup is more than 30 days old.
3. **Invoices list**
   - Filter chips: All, Unpaid, Overdue, Paid, Drafts, Void. Search by number or customer.
   - Each row: number (or "Draft"), customer, issue date, total, status pill. Sorted newest first.
4. **Invoice editor** (draft)
   - Customer picker, with search and "+ New customer" in a sheet.
   - Lines: description, with a picker of presets plus free text; service date; vehicle (optional); quantity; unit price. Presets: Airport transfer – O.R. Tambo; Airport transfer – Lanseria; Local trip; Hourly hire; Full day hire (8 hours); Tour / charter; Funeral shuttle; Staff transport (monthly); School transport (monthly); Waiting time; Toll fees.
   - Notes; a live total.
   - Sticky bar: *Save draft* and *Issue invoice*. Issuing asks for confirmation: "Issue EDR-00xx? It can't be edited after this."
5. **Invoice detail** (issued or void)
   - Summary, lines, payments, and the balance.
   - Actions: **Share** (PDF to WhatsApp or email), **Download PDF**, **Record payment**, **Duplicate as new draft**, **Void** (needs a reason; blocked while payments exist, explaining why).
6. **Record payment** (sheet): amount (defaults to the balance), date (today), method, reference.
7. **Expenses list:** grouped by month with monthly totals. Filter by category and vehicle. A row shows the category icon, supplier, date, amount and a receipt thumbnail.
8. **Log expense** (camera-first)
   - A big *Snap receipt* button (`<input type="file" accept="image/*" capture="environment">`), then amount (autofocus), category as a grid of large icon buttons, date (today), vehicle, supplier (optional), method.
   - Save. Saving without a photo is allowed but asks for confirmation.
9. **Customers and vehicles:** simple lists and forms. Customers show their invoice history and balance.
10. **Reports:** a tax-year selector, e.g. "2026/27 (1 Mar 2026 – 28 Feb 2027)". Shows:
    - money received; invoiced; outstanding at year end
    - expenses by category, and by vehicle
    - received minus expenses
    - *Export pack* button (section 12)
11. **Backup:** *Download everything* (section 13) and the date of the last backup.
12. **Settings:** business details, bank details, invoice prefix (locked once the first invoice is issued), payment terms, footer, and financial-year start month.

## 10. Invoice PDF

A4, generated with jsPDF on the device. File name: `EDR-0001.pdf`.

- **Header:** the EDRAM logo (van) and "EDRAM SHUTTLE AND TOURS" on the left. On the right, **INVOICE** in large type, then the invoice number, issue date and due date.
- **From:** from `seller_snapshot`: trading name, legal name and registration number (if set), address, phone, email.
- **Bill to:** from `customer_snapshot`: name, contact person, address, phone, email.
- **Lines table:** Date · Description · Vehicle · Qty · Unit price · Amount.
- **Totals:** Total · Paid · **Balance due** (bold).
- **Payment box:** bank, account name, account number, branch code, account type, and "Please use **EDR-0001** as your payment reference."
- **Footer:** the business footer ("Reliable • Safe • On-Time • Professional") and "Thank you for travelling with EDRAM."
- **Stamps:**
  - Fully paid: a green **PAID** stamp, with the payment date.
  - Void: a large diagonal **VOID** and the reason. Void invoices are still downloadable.
- **Never** write "Tax Invoice" or show VAT.

## 11. Sending an invoice

1. Build the PDF and wrap it as a `File`.
2. If `navigator.canShare({ files: [file] })` is true, call `navigator.share({ files: [file], title, text })`. The text is: "Hi {name}, please find invoice EDR-0001 for R 2 225,00 attached. Thank you, EDRAM Shuttle and Tours." Android Chrome and iOS Safari both support this, and WhatsApp accepts the PDF.
3. Otherwise, download the PDF and offer **Open WhatsApp** (`https://wa.me/27…?text=…`, without the attachment) and **Copy message**.

## 12. Reports and the export pack

- **Financial year:** starts on the first day of `financial_year_start_month` (default March), ending on the last day of the month before (28 or 29 February). Write `financialYear(date, startMonth)` with tests, including leap years.
- **Income** is counted when it's received (`ledger` income rows, by `paid_on`). Also show invoiced totals and the outstanding balance at year end. The accountant decides the basis.
- **Export pack:** a ZIP named `EDRAM-records-2026-27.zip`, built in the browser, streamed with fflate.

```
EDRAM-records-2026-27/
  README.txt            ← what each file is, the date range, generated-at time
  summary.csv           ← totals: received, invoiced, outstanding, expenses by category, net
  invoices.csv          ← every invoice issued in the year, void ones included (number, status, dates, customer, total, paid, balance, void reason)
  payments.csv          ← every payment received in the year
  expenses.csv          ← every expense in the year (date, category, vehicle, supplier, method, amount, receipt file name)
  invoices/EDR-0001.pdf …
  receipts/2026-11-26_fuel_1200.50_<expense-id>.jpg …
```

- **CSV format:** UTF-8 with BOM (so Excel opens it cleanly), comma separated, amounts as plain decimals (`1200.50`), and dates in ISO format (`2026-11-26`).

## 13. Backup

**Download everything:** a ZIP containing `data.json` (every table, including `audit_log` and `business_settings`), `receipts/` (all images), and an `invoices/` folder of PDFs. Afterwards, update `business_settings.last_backup_at`. Home shows a banner when the last backup is more than 30 days old.

Why this matters on the free tier:
- Supabase's free plan has **no downloadable database backups**, and **pauses a project after about a week without activity**. Daily use prevents the pause, and a paused project can be restored from the dashboard.
- **Storage is 1 GB.** At about 250 KB per compressed receipt, that's roughly 4,000 receipts, or about two years at five a day.
- Before the limits bite, upgrade to Supabase Pro or archive older years' receipts after exporting them.
- Check current free-tier limits on supabase.com when you start; they change.

## 14. Receipt images

Compress on the device before uploading. Draw the image to a canvas with its longest side at most **1400px**, export as **JPEG at quality 0.65**, and aim for no more than **250 KB**. Respect EXIF orientation; `createImageBitmap(file, { imageOrientation: 'from-image' })` handles it.

## 15. Offline behaviour

- **Phase 1:** the service worker caches the app shell, so the app always opens. Data is fetched network-first. When offline, show a slim banner ("You're offline. Changes can't be saved right now.") and disable save buttons.
- **Phase 2:** **Log expense works offline.** The expense, with its compressed image as a Blob, goes into an IndexedDB queue and syncs when the app is back online (`online` event, plus a retry on app start). Queued items appear in the list with a "Waiting to upload" badge. Generate the expense `id` (UUID) on the device so a retried sync can't create duplicates; upsert on `id`.

## 16. Formatting rules (one helper each, unit-tested)

- **Money:** store cents. Display with `formatZAR(cents)`, i.e. `Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR' })`, giving "R 2 225,00". Use the same helper in the PDF, after replacing the special spaces. Parse input with `parseZAR()`, accepting `2225`, `2225.5`, `2 225,50` and `R2,225.50`.
- **Dates:** ISO in the database. Display as `26 Nov 2026`.
- **Invoice number:** `prefix + zero-padded seq`, e.g. `EDR-0001`, generated by the database. Never generated in the client.
- **Phone:** store as typed. Convert for `wa.me` with `toWhatsAppNumber('082 123 4567')`, giving `27821234567`.

## 17. Setup steps

The developer does steps 1–3 and 5–6, which need their accounts. The building session does step 4, after receiving access.

1. **Supabase:** create a free project **in the owner's name** (a business email), so he owns his data, and invite the developer.
   - Auth → Providers: Email on.
   - Auth → Settings: **"Allow new users to sign up": off**.
   - Auth → Users → Add user, twice (the owner and the developer), each with a strong password.
   - Auth → URL configuration: Site URL `https://admin.edramshuttle.co.za`.
2. **GitHub:** create the public repo `bluemondaystudios/edram-admin` and add this file as `CLAUDE.md`. Settings → Pages → Source: **GitHub Actions**.
3. **DNS:** add a **CNAME record**: host `admin`, value `bluemondaystudios.github.io`. Then in the repo, Settings → Pages → Custom domain: `admin.edramshuttle.co.za`. With Actions deployments, the custom domain comes from this setting, not a CNAME file. Tick **Enforce HTTPS** once the certificate is issued.
4. **Database:**
   - Apply `supabase/migrations/0001_init.sql`, through the SQL editor, or with `supabase db push` if a Supabase access token is available.
   - Then run, with the two real user ids:
     ```sql
     insert into public.team_members (user_id, display_name) values
       ('<owner-auth-user-id>', 'Edward Ramotholo'),
       ('<developer-auth-user-id>', '<developer name>');
     ```
   - Fill in `business_settings` (entity type, bank details and so on) in the app's Settings screen once it exists, or with SQL.
5. **App configuration:** in the repo, Settings → Secrets and variables → Actions → **Variables** (these values are public by design): `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`. For local development, use `.env.local`, which is gitignored.
6. **Network access for the building session:** the cloud session needs to reach the Supabase project host (`<project-ref>.supabase.co`) to test against it. If requests are blocked, the developer adds that host to the session environment's allowed hosts. Never paste keys into chat; request credentials through the secure form.

**CI (`deploy.yml`)**, on push to `main` and on pull requests:
- `npm ci`, then `npm test` (Vitest).
- A Postgres 16 service container runs `supabase_stub.sql`, then `0001_init.sql`, then `db_tests.sql`. The job fails unless the output contains `ALL TESTS PASSED`.
- `npm run build`, with the `VITE_` variables.
- On `main` only: `actions/upload-pages-artifact` and `actions/deploy-pages`.

## 18. Build phases and acceptance criteria

**Phase 0: foundation**
- Scaffold (stack in section 5), tokens and base styles, router, PWA manifest and icons (EDRAM van on black), and CI deploying to `admin.edramshuttle.co.za`.
- Migration applied, DB tests green in CI, sign-in working.
- ✅ When: the owner can install the app from the browser on his phone, sign in, and see an empty Home.

**Phase 1: invoices** *(the owner's biggest pain point; ship this first)*
- Customers, vehicles, invoice editor, issue, invoice detail, PDF, share, record payment, void, and the invoice list with filters.
- Home tiles: Received this month, Outstanding, Overdue.
- ✅ When:
  - On a phone, a new invoice for a new customer can be created, issued and shared to WhatsApp as a PDF in under a minute.
  - Numbers run EDR-0001, EDR-0002… with no gaps.
  - Recording a full payment shows **Paid**, and the PDF shows the PAID stamp.
  - A voided invoice keeps its number and shows VOID with the reason.

**Phase 2: expenses**
- Camera-first expense capture with compression, the expenses list, filters, the Expenses tile, and the offline expense queue.
- ✅ When:
  - An expense with a receipt photo can be logged in under 20 seconds.
  - With flight mode on, an expense can be logged and then appears in Supabase after reconnecting, exactly once.

**Phase 3: records**
- Reports by tax year, the export pack, Download everything, and the backup reminder.
- ✅ When the 2026/27 export pack opens cleanly in Excel and contains every invoice PDF and receipt for the year.

**Phase 4: later (confirm with the developer first)**
- Quotes (draft, sent, accepted, converted to an invoice).
- Quote requests from the website form landing in the system. This needs an insert-only public endpoint with spam protection; design it carefully.
- A trip log per vehicle and driver, and customer statements.

## 19. The public website (repo `bluemondaystudios/git-practice`)

- A static one-page site served by GitHub Pages at `edramshuttle.co.za` (`index.html`, `css/styles.css`, `js/main.js`, `assets/`).
- Sections: Fleet, Services, Funerals, Quotes, Why Us, Contact, with a Google map.
- The site shows **no prices**: "Get a quote" links pre-fill a form that opens WhatsApp to 081 215 3162.
- The funeral section uses a calmer visual language: Cormorant Garamond serif headings, with stone (`#e9e6e0`) and sage (`#a3b99d`) tones.
- **Task for whoever has that repo:** add `admin/index.html` to the website, redirecting to `https://admin.edramshuttle.co.za/`. Use `<meta http-equiv="refresh" content="0; url=…">`, `location.replace(…)`, a visible fallback link, and `<meta name="robots" content="noindex">`. That makes `edramshuttle.co.za/admin` work.

## 20. Working conventions with this developer

- Work on a feature branch. Commit with clear messages, then push.
- Open a pull request and merge to `main` only when the developer asks. The developer has asked for each merge explicitly.
- Before pushing: run the unit tests and the DB tests, and check the UI in a headless browser at phone (390×844) and desktop (1366×768) sizes. Send the developer screenshots of new screens.
- Explain choices in plain language; the developer is learning Git and shares updates with a non-technical client.
- Keep secrets out of chat, the repo and logs.

## 21. Inputs still needed from the developer or owner

1. The Supabase project, created in the owner's name, with the developer invited.
2. The two users' email addresses.
3. Entity type (sole proprietor or (Pty) Ltd), and the CIPC registration number if any. This goes on invoices.
4. Bank details for invoices: bank, account name, number, branch code, account type.
5. Confirmation of the invoice prefix `EDR-`, and default payment terms (7 days is assumed).
6. A higher-resolution logo if one exists. Otherwise use the website's van icon and the EDRAM wordmark in Montserrat 800.

---

## Appendix A: `supabase/migrations/0001_init.sql`

Tested on PostgreSQL 16 with the kit in Appendix B: all checks pass. Copy it verbatim into the repo.

```sql
-- EDRAM Admin: initial schema (Supabase / PostgreSQL)
-- Money is stored as integer cents (bigint). Never use floats for money.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Team: only users listed here can see or change anything
-- ---------------------------------------------------------------------------

create table public.team_members (
  user_id      uuid primary key references auth.users (id) on delete cascade,
  display_name text not null,
  created_at   timestamptz not null default now()
);

create or replace function public.is_team_member()
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (select 1 from public.team_members where user_id = auth.uid());
$$;

-- ---------------------------------------------------------------------------
-- Business settings (single row) and the invoice counter (single row)
-- ---------------------------------------------------------------------------

create table public.business_settings (
  id                         smallint primary key default 1 check (id = 1),
  trading_name               text not null default 'EDRAM Shuttle and Tours',
  legal_name                 text,
  entity_type                text check (entity_type in ('sole_proprietor', 'pty_ltd', 'other')),
  registration_no            text,
  income_tax_no              text,
  address                    text not null default '299 12th Avenue, Lenora, Gezina, Pretoria',
  phone                      text not null default '081 215 3162',
  email                      text not null default 'bookings@edramshuttle.co.za',
  bank_name                  text,
  account_name               text,
  account_no                 text,
  branch_code                text,
  account_type               text,
  invoice_prefix             text not null default 'EDR-',
  payment_terms_days         int  not null default 7 check (payment_terms_days >= 0),
  invoice_footer             text default 'Reliable • Safe • On-Time • Professional',
  financial_year_start_month smallint not null default 3 check (financial_year_start_month between 1 and 12),
  last_backup_at             timestamptz,
  updated_at                 timestamptz not null default now()
);
insert into public.business_settings default values;

-- Gap-free numbering: a counter row, not a sequence (sequences skip on rollback)
create table public.invoice_counter (
  id       smallint primary key default 1 check (id = 1),
  last_seq int not null default 0
);
insert into public.invoice_counter default values;

-- ---------------------------------------------------------------------------
-- Customers and vehicles
-- ---------------------------------------------------------------------------

create table public.customers (
  id             uuid primary key default gen_random_uuid(),
  name           text not null,
  contact_person text,
  phone          text,
  email          text,
  address        text,
  notes          text,
  archived       boolean not null default false,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create table public.vehicles (
  id                 uuid primary key default gen_random_uuid(),
  label              text not null,          -- e.g. '7 Seater #1'
  registration_plate text,
  seats              smallint check (seats > 0),
  active             boolean not null default true,
  created_at         timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Invoices
-- ---------------------------------------------------------------------------

create type public.invoice_status as enum ('draft', 'issued', 'void');

create table public.invoices (
  id                uuid primary key default gen_random_uuid(),
  seq               int  unique,
  number            text unique,
  status            public.invoice_status not null default 'draft',
  customer_id       uuid not null references public.customers (id),
  customer_snapshot jsonb,   -- customer as it was when issued
  seller_snapshot   jsonb,   -- business details (incl. bank) as they were when issued
  issue_date        date,
  due_date          date,
  notes             text,
  total_cents       bigint not null default 0 check (total_cents >= 0),
  void_reason       text,
  voided_at         timestamptz,
  created_by        uuid default auth.uid() references auth.users (id),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  constraint invoice_number_matches_status check (
    (status = 'draft' and number is null and seq is null)
    or (status <> 'draft' and number is not null and seq is not null and issue_date is not null)
  ),
  constraint void_needs_reason check (status <> 'void' or (void_reason is not null and voided_at is not null))
);

create table public.invoice_lines (
  id               uuid primary key default gen_random_uuid(),
  invoice_id       uuid not null references public.invoices (id) on delete cascade,
  position         smallint not null default 0,
  service_date     date,
  description      text not null,
  vehicle_id       uuid references public.vehicles (id),
  quantity         numeric(10, 2) not null default 1 check (quantity > 0),
  unit_price_cents bigint not null check (unit_price_cents >= 0),
  amount_cents     bigint generated always as (round(quantity * unit_price_cents)::bigint) stored
);
create index on public.invoice_lines (invoice_id);

-- ---------------------------------------------------------------------------
-- Payments and expenses
-- ---------------------------------------------------------------------------

create type public.payment_method as enum ('eft', 'cash', 'card', 'other');

create table public.payments (
  id           uuid primary key default gen_random_uuid(),
  invoice_id   uuid not null references public.invoices (id),
  paid_on      date not null default current_date,
  amount_cents bigint not null check (amount_cents > 0),
  method       public.payment_method not null default 'eft',
  reference    text,
  notes        text,
  created_by   uuid default auth.uid() references auth.users (id),
  created_at   timestamptz not null default now()
);
create index on public.payments (invoice_id);

create type public.expense_category as enum (
  'fuel', 'maintenance_repairs', 'tyres', 'tolls', 'insurance', 'vehicle_finance',
  'licensing', 'driver_wages', 'cleaning', 'parking', 'phone_data', 'office_admin', 'other'
);

create table public.expenses (
  id             uuid primary key default gen_random_uuid(),
  spent_on       date not null default current_date,
  amount_cents   bigint not null check (amount_cents > 0),
  category       public.expense_category not null,
  vehicle_id     uuid references public.vehicles (id),
  supplier       text,
  description    text,
  payment_method public.payment_method not null default 'card',
  receipt_path   text,          -- path in the private 'receipts' storage bucket
  deleted_at     timestamptz,   -- soft delete only: records are kept
  created_by     uuid default auth.uid() references auth.users (id),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index on public.expenses (spent_on);

-- ---------------------------------------------------------------------------
-- Audit log: every change to financial records is kept
-- ---------------------------------------------------------------------------

create table public.audit_log (
  id         bigint generated always as identity primary key,
  table_name text not null,
  row_id     text,
  action     text not null,
  old_row    jsonb,
  new_row    jsonb,
  actor      uuid default auth.uid(),
  at         timestamptz not null default now()
);

create or replace function public.write_audit_log()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  insert into public.audit_log (table_name, row_id, action, old_row, new_row)
  values (
    tg_table_name,
    (case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end) ->> 'id',
    tg_op,
    case when tg_op = 'INSERT' then null else to_jsonb(old) end,
    case when tg_op = 'DELETE' then null else to_jsonb(new) end
  );
  return null;
end;
$$;

create trigger audit after insert or update or delete on public.business_settings for each row execute function public.write_audit_log();
create trigger audit after insert or update or delete on public.customers         for each row execute function public.write_audit_log();
create trigger audit after insert or update or delete on public.invoices          for each row execute function public.write_audit_log();
create trigger audit after insert or update or delete on public.invoice_lines     for each row execute function public.write_audit_log();
create trigger audit after insert or update or delete on public.payments          for each row execute function public.write_audit_log();
create trigger audit after insert or update or delete on public.expenses          for each row execute function public.write_audit_log();

-- ---------------------------------------------------------------------------
-- Integrity rules
-- ---------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger set_updated_at before update on public.business_settings for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.customers         for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.invoices          for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.expenses          for each row execute function public.set_updated_at();

-- Invoices: new rows are drafts; only issue_invoice() may issue; only void_invoice() may void
create or replace function public.guard_invoice()
returns trigger language plpgsql as $$
declare
  frozen text[] := array['status', 'void_reason', 'voided_at', 'updated_at'];
begin
  if tg_op = 'INSERT' then
    if new.status <> 'draft' then
      raise exception 'New invoices must start as drafts';
    end if;
    return new;
  end if;

  if old.status = 'draft' then
    if new.status = 'issued' and coalesce(current_setting('edram.issuing', true), '') <> 'on' then
      raise exception 'Use issue_invoice() to issue an invoice';
    end if;
    if new.status = 'void' then
      raise exception 'Delete a draft instead of voiding it';
    end if;
    return new;
  end if;

  if old.status = 'issued'
     and new.status = 'void'
     and coalesce(current_setting('edram.voiding', true), '') = 'on'
     and (to_jsonb(new) - frozen) = (to_jsonb(old) - frozen) then
    return new;
  end if;

  raise exception 'Invoice % is %: it cannot be changed. Void it and issue a new one.', old.number, old.status;
end;
$$;

create trigger guard_invoice before insert or update on public.invoices
  for each row execute function public.guard_invoice();

-- Lines can only change while their invoice is a draft
create or replace function public.guard_invoice_lines()
returns trigger language plpgsql as $$
declare
  v_status public.invoice_status;
begin
  select status into v_status from public.invoices
  where id = coalesce(new.invoice_id, old.invoice_id);

  -- v_status is null while a draft is being deleted (cascade)
  if v_status is not null and v_status <> 'draft' then
    raise exception 'Lines of an issued or void invoice cannot be changed';
  end if;
  return coalesce(new, old);
end;
$$;

create trigger guard_invoice_lines before insert or update or delete on public.invoice_lines
  for each row execute function public.guard_invoice_lines();

-- Keep invoices.total_cents equal to the sum of its lines
create or replace function public.recalc_invoice_total()
returns trigger language plpgsql as $$
begin
  update public.invoices i
  set total_cents = coalesce((select sum(amount_cents) from public.invoice_lines l where l.invoice_id = i.id), 0)
  where i.id = coalesce(new.invoice_id, old.invoice_id)
    and i.status = 'draft';
  return null;
end;
$$;

create trigger recalc_invoice_total after insert or update or delete on public.invoice_lines
  for each row execute function public.recalc_invoice_total();

-- Payments only against issued invoices
create or replace function public.guard_payment()
returns trigger language plpgsql as $$
declare
  v_status public.invoice_status;
begin
  select status into v_status from public.invoices where id = coalesce(new.invoice_id, old.invoice_id);
  if v_status <> 'issued' then
    raise exception 'Payments can only be recorded against issued invoices';
  end if;
  return coalesce(new, old);
end;
$$;

create trigger guard_payment before insert or update or delete on public.payments
  for each row execute function public.guard_payment();

-- ---------------------------------------------------------------------------
-- Actions (called from the app with supabase.rpc)
-- ---------------------------------------------------------------------------

create or replace function public.issue_invoice(p_invoice_id uuid, p_issue_date date default current_date)
returns public.invoices
language plpgsql security definer set search_path = public
as $$
declare
  v_inv      public.invoices;
  v_settings public.business_settings;
  v_customer public.customers;
  v_seq      int;
begin
  if not public.is_team_member() then
    raise exception 'Not allowed';
  end if;

  select * into v_inv from public.invoices where id = p_invoice_id for update;
  if not found then
    raise exception 'Invoice not found';
  end if;
  if v_inv.status <> 'draft' then
    raise exception 'Only drafts can be issued';
  end if;
  if not exists (select 1 from public.invoice_lines where invoice_id = p_invoice_id) then
    raise exception 'Add at least one line before issuing';
  end if;

  select * into v_settings from public.business_settings where id = 1;
  select * into v_customer from public.customers where id = v_inv.customer_id;

  update public.invoice_counter set last_seq = last_seq + 1 where id = 1
  returning last_seq into v_seq;

  perform set_config('edram.issuing', 'on', true);

  update public.invoices
  set status            = 'issued',
      seq               = v_seq,
      number            = v_settings.invoice_prefix || lpad(v_seq::text, 4, '0'),
      issue_date        = p_issue_date,
      due_date          = p_issue_date + v_settings.payment_terms_days,
      customer_snapshot = to_jsonb(v_customer),
      seller_snapshot   = to_jsonb(v_settings)
  where id = p_invoice_id
  returning * into v_inv;

  perform set_config('edram.issuing', 'off', true);
  return v_inv;
end;
$$;

create or replace function public.void_invoice(p_invoice_id uuid, p_reason text)
returns public.invoices
language plpgsql security definer set search_path = public
as $$
declare
  v_inv public.invoices;
begin
  if not public.is_team_member() then
    raise exception 'Not allowed';
  end if;
  if p_reason is null or btrim(p_reason) = '' then
    raise exception 'A reason is required to void an invoice';
  end if;
  if exists (select 1 from public.payments where invoice_id = p_invoice_id) then
    raise exception 'This invoice has payments recorded. Remove them before voiding.';
  end if;

  perform set_config('edram.voiding', 'on', true);

  update public.invoices
  set status = 'void', void_reason = btrim(p_reason), voided_at = now()
  where id = p_invoice_id and status = 'issued'
  returning * into v_inv;

  -- Check before any PERFORM: PERFORM resets FOUND
  if not found then
    raise exception 'Only issued invoices can be voided';
  end if;

  perform set_config('edram.voiding', 'off', true);
  return v_inv;
end;
$$;

revoke execute on function public.issue_invoice(uuid, date) from public, anon;
revoke execute on function public.void_invoice(uuid, text)  from public, anon;
grant  execute on function public.issue_invoice(uuid, date) to authenticated;
grant  execute on function public.void_invoice(uuid, text)  to authenticated;

-- ---------------------------------------------------------------------------
-- Views (security_invoker so RLS applies to whoever queries them)
-- ---------------------------------------------------------------------------

create view public.invoice_balances with (security_invoker = true) as
select
  i.id,
  i.number,
  i.status,
  i.customer_id,
  coalesce(i.customer_snapshot ->> 'name', c.name) as customer_name,
  i.issue_date,
  i.due_date,
  i.total_cents,
  coalesce(p.paid_cents, 0)                 as paid_cents,
  i.total_cents - coalesce(p.paid_cents, 0) as balance_cents,
  (i.status = 'issued'
   and i.total_cents - coalesce(p.paid_cents, 0) > 0
   and i.due_date < current_date)           as is_overdue
from public.invoices i
join public.customers c on c.id = i.customer_id
left join (
  select invoice_id, sum(amount_cents) as paid_cents from public.payments group by invoice_id
) p on p.invoice_id = i.id;

-- Money in (payments received) and money out (expenses), one row per entry
create view public.ledger with (security_invoker = true) as
select
  p.paid_on                        as entry_date,
  'income'::text                   as kind,
  p.amount_cents,
  i.number                         as reference,
  i.customer_snapshot ->> 'name'   as party,
  'payment'::text                  as category,
  p.method::text                   as method,
  null::text                       as receipt_path,
  p.id                             as source_id
from public.payments p
join public.invoices i on i.id = p.invoice_id
union all
select
  e.spent_on,
  'expense',
  e.amount_cents,
  null,
  e.supplier,
  e.category::text,
  e.payment_method::text,
  e.receipt_path,
  e.id
from public.expenses e
where e.deleted_at is null;

-- ---------------------------------------------------------------------------
-- Row Level Security: team members only; nothing for anyone else
-- ---------------------------------------------------------------------------

alter table public.team_members      enable row level security;
alter table public.business_settings enable row level security;
alter table public.invoice_counter   enable row level security;  -- no policies: only issue_invoice() touches it
alter table public.customers         enable row level security;
alter table public.vehicles          enable row level security;
alter table public.invoices          enable row level security;
alter table public.invoice_lines     enable row level security;
alter table public.payments          enable row level security;
alter table public.expenses          enable row level security;
alter table public.audit_log         enable row level security;

create policy team_read   on public.team_members      for select to authenticated using (public.is_team_member());

create policy team_read   on public.business_settings for select to authenticated using (public.is_team_member());
create policy team_update on public.business_settings for update to authenticated using (public.is_team_member()) with check (public.is_team_member());

create policy team_all    on public.customers         for all    to authenticated using (public.is_team_member()) with check (public.is_team_member());
create policy team_all    on public.vehicles          for all    to authenticated using (public.is_team_member()) with check (public.is_team_member());
create policy team_all    on public.invoice_lines     for all    to authenticated using (public.is_team_member()) with check (public.is_team_member());
create policy team_all    on public.payments          for all    to authenticated using (public.is_team_member()) with check (public.is_team_member());

create policy team_read   on public.invoices          for select to authenticated using (public.is_team_member());
create policy team_insert on public.invoices          for insert to authenticated with check (public.is_team_member());
create policy team_update on public.invoices          for update to authenticated using (public.is_team_member()) with check (public.is_team_member());
create policy team_delete_drafts on public.invoices   for delete to authenticated using (public.is_team_member() and status = 'draft');

-- Expenses: no delete policy, so rows are soft-deleted with deleted_at
create policy team_read   on public.expenses          for select to authenticated using (public.is_team_member());
create policy team_insert on public.expenses          for insert to authenticated with check (public.is_team_member());
create policy team_update on public.expenses          for update to authenticated using (public.is_team_member()) with check (public.is_team_member());

create policy team_read   on public.audit_log         for select to authenticated using (public.is_team_member());

-- ---------------------------------------------------------------------------
-- Storage: private bucket for receipt photos
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public) values ('receipts', 'receipts', false);

create policy receipts_read   on storage.objects for select to authenticated using (bucket_id = 'receipts' and public.is_team_member());
create policy receipts_insert on storage.objects for insert to authenticated with check (bucket_id = 'receipts' and public.is_team_member());
create policy receipts_update on storage.objects for update to authenticated using (bucket_id = 'receipts' and public.is_team_member());
-- No delete policy: receipts are records and are kept
```

## Appendix B: database test kit

`supabase_stub.sql` stands in for the parts of Supabase the migration needs (the `anon` and `authenticated` roles, `auth.users`, `auth.uid()` and the storage tables), so the schema can be tested on plain PostgreSQL, locally or in CI. **Never run the stub against the real Supabase project.**

Run locally (or in CI with a `postgres:16` service):

```bash
createdb edram_test
psql -d edram_test -v ON_ERROR_STOP=1 -q -f supabase/tests/supabase_stub.sql
psql -d edram_test -v ON_ERROR_STOP=1 -q -f supabase/migrations/0001_init.sql
psql -d edram_test -f supabase/tests/db_tests.sql   # last line must be: ALL TESTS PASSED
```

The tests cover:
- draft totals, gap-free numbering, and snapshots on issue
- issued invoices frozen; direct status changes refused
- payments only on issued invoices; void needs a reason and no payments
- drafts deletable (with their lines); expenses and receipts never hard-deleted
- the audit log written, and the counter hidden
- a second team member sees the same data; a signed-in stranger and an anonymous visitor see nothing and can't write

### `supabase/tests/supabase_stub.sql`

```sql
-- Minimal stand-in for the parts of Supabase the migration relies on
do $$ begin create role anon nologin; exception when duplicate_object then null; end $$;
do $$ begin create role authenticated nologin; exception when duplicate_object then null; end $$;
create schema auth;
create table auth.users (id uuid primary key, email text);
create function auth.uid() returns uuid language sql stable
  as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
create schema storage;
create table storage.buckets (id text primary key, name text, public boolean);
create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text references storage.buckets, name text, owner uuid);
alter table storage.objects enable row level security;
grant usage on schema public, auth, storage to anon, authenticated;
grant execute on function auth.uid() to anon, authenticated;
grant all on storage.objects to anon, authenticated;
grant select on storage.buckets to anon, authenticated;
-- Supabase grants table rights to these roles by default; RLS is what protects data
alter default privileges in schema public grant all on tables to anon, authenticated;
alter default privileges in schema public grant all on sequences to anon, authenticated;
```

### `supabase/tests/db_tests.sql`

```sql
\set ON_ERROR_STOP 1
\set QUIET 1
create function pg_temp.expect_error(q text, pat text) returns void language plpgsql as $f$
begin
  execute q;
  raise exception 'EXPECTED ERROR NOT RAISED: %', q;
exception when others then
  if sqlerrm like 'EXPECTED ERROR NOT RAISED%' then raise; end if;
  if sqlerrm !~* pat then raise exception 'Wrong error for [%]: %', q, sqlerrm; end if;
  raise notice 'ok, refused: %', left(sqlerrm, 90);
end $f$;
grant execute on function pg_temp.expect_error(text, text) to anon, authenticated;

-- Users: A and B are the team, X is a signed-in stranger
insert into auth.users values
  ('00000000-0000-0000-0000-00000000000a', 'owner@example.com'),
  ('00000000-0000-0000-0000-00000000000b', 'dev@example.com'),
  ('00000000-0000-0000-0000-0000000000ff', 'stranger@example.com');
insert into public.team_members values
  ('00000000-0000-0000-0000-00000000000a', 'Owner'),
  ('00000000-0000-0000-0000-00000000000b', 'Developer');

-- ===== As team member A =====
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);

insert into customers (id, name, phone) values ('c0000000-0000-0000-0000-000000000001', 'Mokoena Family', '082 000 0000');
insert into vehicles  (id, label, seats) values ('d0000000-0000-0000-0000-000000000001', '15 Seater #1', 15);
insert into invoices  (id, customer_id) values ('10000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001');
insert into invoices  (id, customer_id) values ('10000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000001');
insert into invoice_lines (invoice_id, position, description, vehicle_id, quantity, unit_price_cents) values
  ('10000000-0000-0000-0000-000000000001', 1, 'Airport transfer: O.R. Tambo to Gezina', 'd0000000-0000-0000-0000-000000000001', 2, 85000),
  ('10000000-0000-0000-0000-000000000001', 2, 'Waiting time', null, 1.5, 35000);
do $$ begin
  assert (select total_cents from invoices where id = '10000000-0000-0000-0000-000000000001') = 222500, 'draft total should be 2x850 + 1.5x350 = R2,225.00';
  raise notice 'ok, draft total recalculated: R2,225.00';
end $$;

-- Issuing an empty draft fails and does not use up a number
select pg_temp.expect_error($q$ select issue_invoice('10000000-0000-0000-0000-000000000002') $q$, 'at least one line');

-- Tampering: drafts cannot be issued or created as issued directly
select pg_temp.expect_error($q$ update invoices set status = 'issued', seq = 99, number = 'EDR-0099', issue_date = current_date where id = '10000000-0000-0000-0000-000000000001' $q$, 'issue_invoice');
select pg_temp.expect_error($q$ insert into invoices (customer_id, status, seq, number, issue_date) values ('c0000000-0000-0000-0000-000000000001', 'issued', 50, 'EDR-0050', current_date) $q$, 'drafts');

-- Issue invoice 1
select number, issue_date = current_date as today, due_date - issue_date as terms_days, seller_snapshot->>'address' as seller_address
from issue_invoice('10000000-0000-0000-0000-000000000001');

-- Issued invoices are frozen
select pg_temp.expect_error($q$ update invoices set notes = 'changed' where id = '10000000-0000-0000-0000-000000000001' $q$, 'cannot be changed');
select pg_temp.expect_error($q$ update invoice_lines set unit_price_cents = 1 where invoice_id = '10000000-0000-0000-0000-000000000001' $q$, 'cannot be changed');
select pg_temp.expect_error($q$ insert into invoice_lines (invoice_id, description, unit_price_cents) values ('10000000-0000-0000-0000-000000000001', 'sneaky', 100) $q$, 'cannot be changed');
select pg_temp.expect_error($q$ update invoices set status = 'void' where id = '10000000-0000-0000-0000-000000000001' $q$, 'cannot be changed');
do $$ declare n int; begin
  delete from invoices where id = '10000000-0000-0000-0000-000000000001';
  get diagnostics n = row_count;
  assert n = 0, 'issued invoice must not be deletable';
  raise notice 'ok, issued invoice not deletable (0 rows)';
end $$;

-- Payments
select pg_temp.expect_error($q$ insert into payments (invoice_id, amount_cents) values ('10000000-0000-0000-0000-000000000002', 1000) $q$, 'issued invoices');
insert into payments (id, invoice_id, amount_cents, method, reference) values ('e0000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 100000, 'eft', 'EDR-0001');
select number, total_cents, paid_cents, balance_cents, is_overdue from invoice_balances where id = '10000000-0000-0000-0000-000000000001';

-- Voiding
select pg_temp.expect_error($q$ select void_invoice('10000000-0000-0000-0000-000000000001', 'Wrong customer') $q$, 'payments recorded');
select pg_temp.expect_error($q$ update invoices set status = 'void', void_reason = 'bypass', voided_at = now() where id = '10000000-0000-0000-0000-000000000001' $q$, 'cannot be changed');
delete from payments where id = 'e0000000-0000-0000-0000-000000000001';
select pg_temp.expect_error($q$ select void_invoice('10000000-0000-0000-0000-000000000001', '  ') $q$, 'reason is required');
select number, status, void_reason from void_invoice('10000000-0000-0000-0000-000000000001', 'Wrong customer');
select pg_temp.expect_error($q$ select void_invoice('10000000-0000-0000-0000-000000000001', 'again') $q$, 'Only issued');
select pg_temp.expect_error($q$ select void_invoice('10000000-0000-0000-0000-000000000002', 'draft') $q$, 'Only issued');

-- Next invoice gets the next number: no gap from the failed attempt
insert into invoice_lines (invoice_id, description, quantity, unit_price_cents) values ('10000000-0000-0000-0000-000000000002', 'Funeral shuttle: 15 Seater, full day', 1, 500000);
select number as second_number from issue_invoice('10000000-0000-0000-0000-000000000002');
insert into payments (invoice_id, amount_cents, method) values ('10000000-0000-0000-0000-000000000002', 500000, 'cash');

-- Drafts can be deleted, lines go with them
insert into invoices (id, customer_id) values ('10000000-0000-0000-0000-000000000003', 'c0000000-0000-0000-0000-000000000001');
insert into invoice_lines (invoice_id, description, unit_price_cents) values ('10000000-0000-0000-0000-000000000003', 'temp', 100);
delete from invoices where id = '10000000-0000-0000-0000-000000000003';
do $$ begin
  assert not exists (select 1 from invoices where id = '10000000-0000-0000-0000-000000000003'), 'draft should be deleted';
  assert not exists (select 1 from invoice_lines where invoice_id = '10000000-0000-0000-0000-000000000003'), 'lines should cascade';
  raise notice 'ok, draft and its lines deleted';
end $$;

-- Expenses: soft delete only
insert into expenses (id, amount_cents, category, vehicle_id, supplier, receipt_path) values
  ('f0000000-0000-0000-0000-000000000001', 120050, 'fuel', 'd0000000-0000-0000-0000-000000000001', 'Engen Gezina', '2026/11/f0000000-0000-0000-0000-000000000001.jpg'),
  ('f0000000-0000-0000-0000-000000000002', 9900, 'tolls', null, 'SANRAL', null);
do $$ declare n int; begin
  delete from expenses where id = 'f0000000-0000-0000-0000-000000000002';
  get diagnostics n = row_count;
  assert n = 0, 'expenses must not be hard-deletable';
  update expenses set deleted_at = now() where id = 'f0000000-0000-0000-0000-000000000002';
  raise notice 'ok, expense hard delete refused (0 rows), soft delete works';
end $$;
select entry_date = current_date as today, kind, amount_cents, reference, party, category from ledger order by kind;

-- Receipts bucket
insert into storage.objects (bucket_id, name) values ('receipts', '2026/11/f0000000-0000-0000-0000-000000000001.jpg');
do $$ declare n int; begin
  delete from storage.objects where bucket_id = 'receipts';
  get diagnostics n = row_count;
  assert n = 0, 'receipts must not be deletable';
  raise notice 'ok, receipt upload works, delete refused (0 rows)';
end $$;

do $$ begin
  assert (select count(*) from invoice_counter) = 0, 'counter must be hidden from clients';
  assert (select count(*) from audit_log) > 10, 'audit log should have entries';
  raise notice 'ok, counter hidden; audit log has % entries', (select count(*) from audit_log);
end $$;

-- ===== As team member B: sees the same data =====
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000b', false);
do $$ begin
  assert (select count(*) from invoices) = 2, 'team member B should see both invoices';
  raise notice 'ok, second team member sees the same records';
end $$;

-- ===== As a signed-in stranger =====
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000ff', false);
do $$ begin
  assert (select count(*) from invoices) = 0 and (select count(*) from customers) = 0
     and (select count(*) from expenses) = 0 and (select count(*) from storage.objects) = 0
     and (select count(*) from audit_log) = 0 and (select count(*) from business_settings) = 0,
     'stranger must see nothing';
  raise notice 'ok, stranger sees no rows anywhere';
end $$;
select pg_temp.expect_error($q$ insert into customers (name) values ('x') $q$, 'row-level security');
select pg_temp.expect_error($q$ select issue_invoice('10000000-0000-0000-0000-000000000002') $q$, 'Not allowed');
select pg_temp.expect_error($q$ insert into storage.objects (bucket_id, name) values ('receipts', 'x.jpg') $q$, 'row-level security');

-- ===== Not signed in (anon) =====
reset role;
set role anon;
select set_config('request.jwt.claim.sub', '', false);
do $$ begin
  assert (select count(*) from invoices) = 0, 'anon must see nothing';
  raise notice 'ok, anonymous visitor sees nothing';
end $$;
select pg_temp.expect_error($q$ select issue_invoice('10000000-0000-0000-0000-000000000002') $q$, 'permission denied');
reset role;
\echo ALL TESTS PASSED
```
