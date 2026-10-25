# Phase P6 — Reports, data rights and hardening: delivery report

Prepared 9 Oct 2026. Branch `claude/intelligent-ritchie-8b37zt` (same PR as P0–P5).

**Production has not been touched.** Per your instruction, the production deployment below is a prepared runbook only.

## 1. Gap analysis (Phase = P6, flows F39–F40)

| Flow | Status before | Existing | Missing / wrong | Change made | Risk to existing data |
|---|---|---|---|---|---|
| F39 Dashboards and reports | PARTIAL | `api/admin/stats`: five global counts, for Admin and Operators | No counts by state / district. No age or education distribution. No Operator SLA report. No export. Not scoped (a State team would have seen everything). | `/reports` and `api/reports/dashboard`: families, members, pending approvals and organisations **by state and district**; age bands; highest education; **Operator SLA** (open, overdue, decided, escalated, average hours; Admin only). All **within the viewer's scope** (Admin / National: all; State team: own state; District team: own district). **Excel (CSV) export** with BOM for Excel and formula-injection protection, for Admins and DATA_EXPORT holders, every export audited. Aggregated in a few grouped queries (cheap on shared hosting). | None |
| F40 Audit log and data rights | PARTIAL | Audit log (P0 helper); Admin page showing the last 100; ID-proof upload and view already audited (P1); a settings card whose "Request My Data" / "Request Deletion" buttons did nothing | No user data download. No deletion request or processing. Consents not searchable. Audit log not searchable. | **Download My Data** (JSON: profile, families, relationships, photos list, posts, consents, bureau, friends, organisations; never the password hash). **Request deletion** → Admin queue → **Anonymise**: the person stays in every tree as "Former member" (birth year only), and contact details, addresses, documents and ID-proof files, photos, profile details, bureau, friendships and posts are erased. The login is closed (email/mobile cleared, password scrambled, roles removed). Consents and the audit log are kept. A Karta must hand over first. The user is confirmed by email at request and completion. **Consent search** (name, email, mobile, Person ID, type, dates; CSV). **Audit log filters** (action, entity, actor, dates, "ID proof only"). | Additive table `data_deletion_requests`. Anonymising rewrites one person's data **only when an Admin processes that person's own request**. |

## 2. Security review (hardening)

| Area | Status |
|---|---|
| Secrets in responses | Swept the API for full user rows reaching clients: the P5 post/comment leak was the last. Authors are names only everywhere. |
| Personal data in APIs | Members, search and bureau are redacted (decisions + P5). ID proofs and certificates are encrypted at rest, served only to entitled viewers, and audited. |
| Access control | Every new route re-checks roles from the database (P0 decision 2). Tree, organisation, post and photo visibility are each checked server-side on every request. |
| Uploads | Type detected from the bytes (JPEG/PNG/WEBP, PDF for documents); size and pixel limits; stored outside `public_html`; originals (with GPS) only for owner and staff. |
| Login | Admin 2FA; lockout after repeated failures (existing); OTPs hashed and burned after 5 tries. |
| Headers | Existing: X-Frame-Options DENY, nosniff, Referrer-Policy, Permissions-Policy. **Added HSTS** (1 year). |
| Exports | Scoped, permission-gated, audited, formula-injection safe. |
| Content-Security-Policy | **Added** (§11): pages only; no outside scripts, plugins, framing or `<base>`. |
| Rate limits | **Added** (§11): sign-up, sign-up code, password reset, search, directory and bureau listings (login already had one). |
| Not done (proposal) | A DLT SMS gateway (OP-10). |

**Performance on shared hosting:**
- Reports use grouped queries (no per-district loops).
- New list endpoints are capped (30–500 rows).
- Indexes were added for every new lookup (posts audience, reports, seats, links, friendships).
- Recommendation: set `connection_limit=5` in `DATABASE_URL` on Hostinger and run a single `next start` process.

## 3. Backup and restore (exit criterion)
- **New scripts:**
  - `scripts/backup.sh`: mysqldump `--single-transaction --no-tablespaces` (works without the PROCESS privilege on shared hosting), plus the uploads folder; keeps 14 days; files are written private (`umask 077`).
  - `scripts/restore.sh`: restores **only into a new, empty database**, and refuses the live one.
  - `scripts/verify-restore.sh`: compares row counts table by table.
- **Tested here** on the full test database (68 tables, including the generated-column tables):
  1. Backup.
  2. Restore into a fresh database plus the uploads archive.
  3. "restore verified: every table matches".
  4. Restoring over the live database and over a non-empty database were both refused.
- **The `ID_PROOF_KEY` is not in the backup.** Keep it separately; encrypted proofs and certificates cannot be read without it.

## 4. Change list

| File | Flow | Why |
|---|---|---|
| migration `20261009190000_p6_data_rights` (+ `down.sql`), `schema.prisma` | F40 | Deletion requests |
| `src/lib/dashboard.ts`, `api/reports/dashboard`, `(dashboard)/reports` | F39 | Reports, export |
| `src/lib/data-rights.ts`, `api/my/data`, `api/my/deletion-request`, `api/admin/deletion-requests` (+ `[id]`), `api/admin/consents`, `admin/data-requests`, settings page | F40 | Data rights, consent search |
| `admin/audit-logs` page | F40 | Filters, ID-proof view |
| `next.config.js` | hardening | HSTS |
| `scripts/backup.sh`, `restore.sh`, `verify-restore.sh`, `.gitignore` | hardening | Backup / restore |
| `Sidebar`, `admin/page.tsx` | — | Links |
| `docs/UAT-CHECKLIST.md` | UAT | Every flow, for sign-off |
| `database/phpmyadmin/add_p6_data_rights.sql` | deploy | Same SQL plus the migration record |

## 5. Migration
`20261009190000_p6_data_rights` adds one table and nothing else. Rollback is `down.sql`. The phpMyAdmin script was verified on a P5-state database: no pending migrations and zero schema diff.

## 6. Tests — before vs after

| | Test files | Tests | Typecheck | Build |
|---|---|---|---|---|
| Baseline (before this PR) | 15 | 204 | clean | OK |
| After P5 | 32 | 397 | clean | OK |
| After P6 | 33 | **405 passed** (twice in a row on one database) | clean | OK |

New tests: `tests/p6/F39-F40-reports-data-rights.test.ts` (8).
- **Scope:** district, state and admin each see their own area; a plain member gets 403. Age and education follow scope.
- **Export:** needs DATA_EXPORT; the SLA export is Admin only; exports are audited; CSV formula injection is blocked.
- **Data rights:** own-data download (no password hash); deletion with the tree kept intact, login closed and consents kept; Karta refusal, rejection and cancellation; consent search.

No existing test was edited in P6.

A browser run against the production build covered:
1. Admin signing in with 2FA.
2. Reports with the SLA table and a CSV download.
3. The data-requests page.
4. Audit Logs with "ID proof only".
5. The HSTS header being present.

## 7. Deployment runbook (test first; production only on your instruction)
1. **Back up** with `scripts/backup.sh`, using `scripts/.backup.env` with the hosting database credentials (the file is git-ignored).
2. **Migrate** with `npx prisma migrate deploy`. Or, in phpMyAdmin, import in order:
   - `add_p0_team_roles.sql`
   - `add_p1_registration_approval.sql`
   - `add_p2_family_karta.sql` (run its PRE-CHECK first)
   - `add_p3_tree_links.sql`
   - `add_p4_organisations.sql`
   - `add_p5_social_bureau.sql`
   - `add_p6_data_rights.sql`
   - `set_bureau_workbook_rules_on.sql`
   - `set_address_changes_instant.sql`
   - `add_p4_taluka_chain.sql`
   - `add_death_certificate.sql`
   - `add_group_conversion.sql` (then, when ready: Admin → Settings → Convert Groups to Organisations; test first; P4 report §10)
   - **production only, at go-live:** `set_death_certificate_required_on.sql` (from then on an Expired request needs a death certificate; P2 report §10)

   Then run `npm run db:seed` (reference data only; it does not overwrite real data). **Never run `db:seed:uat` on production.**
3. **Environment:** `ID_PROOF_KEY` (32 random bytes, base64, kept safe), `CRON_SECRET` (16+ characters), working SMTP (Admin 2FA, confirmations). Optional: `AUTH_ADMIN_2FA`, `NEXT_PUBLIC_REGISTRATION_REQUIRE_MOBILE`, `CSP_REPORT_ONLY` (build-time; `true` only reports CSP violations, the rollback switch in §11). `UPLOAD_DIR` must be outside `public_html`. Run **one** `next start` process: the rate limits are kept in memory.
4. **Cron jobs (hPanel):**
   - hourly: `/api/cron/approval-sla`
   - daily: `/api/cron/daily`
   - nightly: `scripts/backup.sh`
5. **Map Operators:** at least 3 per district (OP-04).
6. **Rebuild and restart** the Node app.
7. **Run the UAT checklist** (`docs/UAT-CHECKLIST.md`) and a **restore drill**: restore last night's backup into a scratch database and run `verify-restore.sh`.
8. **Production:** the same steps, after UAT sign-off and your explicit go-ahead.

## 8. Exit criteria (Phase Plan, P6)
- **UAT sign-off** — ⏳ yours. The checklist covers every flow.
- **Backup and restore tested** — ✅ here (scripted and verified). Repeat the drill on the hosting account.
- **Deliverable "Production release"** — ⏳ waiting for your instruction (production not touched).

## 9. Decisions needed
1. ~~**Production go-live**~~ — your answer: everything stays on **test only** until you say otherwise. Production is not touched.
2. ~~**Content-Security-Policy and rate limiting**~~ — decided: build them (§11).
3. ~~**Operator access to global counts**~~ — decided: Admin only (§10).

## 10. Follow-up: global counts are Admin only (your decision)
- **`/api/admin/stats`** now answers only Admins. Operators, State / District teams and members get 403. The Admin role is checked against the database, not taken from the session token (as in P0 decision 2).
- **The `/admin` page** showed Operators the same global counts. It now shows them only to Admins. Operators still open the page as their "Operator Dashboard" and keep its Quick Actions; the counts, the "pending approvals" banner and the Pending Actions card are hidden. Their own work stays under My Verification Tasks. Scoped teams keep `/reports`.
- **No migration, no data change.** No existing test covered this endpoint.
- **Test added:** `F39 the global counts (/api/admin/stats) are Admin only` in `tests/p6/F39-F40-reports-data-rights.test.ts` (Operator, District team, State team and member get 403; Admin gets the five counts). **409 passed**, twice in a row on a fresh database; typecheck clean; build OK.
- **Browser check (production build):** Operator → `/admin` shows "Operator Dashboard" with no counts and `/api/admin/stats` returns 403; Admin → counts shown and the API returns 200.

## 11. Follow-up: Content-Security-Policy and rate limits (your decision)
**Content-Security-Policy** (`next.config.js`), sent on every page, not on `/api` routes (they return JSON or files; an ID proof or certificate PDF must still open inline):

| Directive | Value | Why |
|---|---|---|
| `default-src` | `'self'` | Nothing from other sites unless listed below. |
| `script-src` | `'self' 'unsafe-inline'` (+ `'unsafe-eval'` on the dev server only) | Next.js 14 writes small inline scripts into every page. A per-request nonce would make every page dynamic (slower on shared hosting), so inline stays allowed; scripts from any other site are blocked. |
| `style-src` | `'self' 'unsafe-inline' https://fonts.googleapis.com` | Inline styles (Next.js, Leaflet) and the Google Fonts stylesheet. |
| `font-src` | `'self' data: https://fonts.gstatic.com` | Google Fonts files. |
| `img-src` | `'self' data: blob:`, OpenStreetMap tiles, and the image hosts already allowed in `next.config.js` | Photos, previews, the profile map. |
| `connect-src` | `'self'` | The app only calls its own API. |
| `object-src` / `base-uri` / `form-action` / `frame-ancestors` | `'none'` / `'self'` / `'self'` / `'none'` | No plugins, no `<base>` hijack, forms post only here, no framing by other sites. |

- **Rollback without code:** build with `CSP_REPORT_ONLY=true`. The browser then only reports violations (`Content-Security-Policy-Report-Only`).
- **Browser check (production build):** 51 pages visited, covering every page route: 6 public pages signed out, and 45 signed in as an Admin (with 2FA). Each was watched for CSP violation events and page errors: **0 violations, 0 page errors**. The profile map (Leaflet) loads its tiles with no violation. `/login` carries the header; `/api/areas` does not.

**Rate limits** (`src/lib/rate-limit.ts`, the in-memory limiter login already used). Over the limit the answer is **429** "Too many requests. Please wait a few minutes and try again." with a `Retry-After` header.

| What | Limit | Counted per |
|---|---|---|
| Login (existing, unchanged) | 10 / 15 min | address + account; plus the existing lock after 5 wrong passwords |
| Sign-up (`/api/auth/register`) | 20 / hour | address (generous: mobile networks share addresses) |
| Sign-up code (`/api/auth/verify-otp`) | 10 / 15 min | account; a code also dies after 5 wrong tries (existing) |
| Password-reset code sent | 5 / hour per account, 20 / hour per address | both |
| Password-reset code guesses | 5 / 15 min | account |
| Search, Directory, Bureau listings | 60 / minute, shared | signed-in user |

- Limits on an account are counted **before** the account lookup, so an unknown account answers the same way (no enumeration), and changing address does not reset them.
- **Shared hosting:** the counts live in the app's memory, so run a single `next start` process (runbook step 3). A restart clears them.
- **Fixed on the way (found while adding the limits; no behaviour change for users):**
  - The password-reset code could be guessed without limit. It is a 6-digit code valid for 10 minutes, so this was a real account-takeover risk. It is now capped at 5 guesses per 15 minutes.
  - The reset code was made with `Math.random`. It now uses `crypto.randomInt`, as the other codes already did.
  - The server log printed every reset code, in production too. It now prints only on dev and test (where it is how a mobile reset is tested without SMS).
- **Removed (your decision):** `/api/auth/verify/email`, an old, unused route that anyone could call. Given a user id and a code, it would have marked the account ACTIVE and skipped the P1 approval. It could never succeed, because it checked a SHA-256 hash while codes are stored as bcrypt, but it was a trap if anyone "fixed" it. Nothing in the app or the tests called it. Sign-up codes are still checked by `/api/auth/verify-otp` (rate-limited, 5 tries per code).
- **No migration, no data change.**
- **Tests added:** `tests/p6/P6-hardening-csp-rate-limits.test.ts` has 6 tests: sign-up 20/hour then 429 with Retry-After while another address is unaffected; reset guesses 5 per account from changing addresses; reset codes 5 per account, the same for an unknown account; sign-up code 10 per account (case-insensitive); search + directory 60/minute per user while another user is unaffected; and the CSP directives, applied to pages and not to `/api`. No existing test changed. **422 passed**, twice in a row on a fresh database; typecheck clean; build OK.
