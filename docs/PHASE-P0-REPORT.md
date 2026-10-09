# Phase P0 — Foundation: gap analysis and delivery report

Prepared 9 Oct 2026 against `LadWani_Community_Website_Flows_and_Plan.xlsx`
(workbook) and the build prompt. Branch `claude/intelligent-ritchie-8b37zt`.

## Before you read: two deviations from the prompt

1. **The prompt's `<PHASE>` placeholder was not filled in.** This run did **P0
   (Foundation)** — the first phase, and the one every later phase builds on.
2. **The codebase is not Laravel.** It is Next.js 14 (App Router) +
   TypeScript + Prisma 5 + MySQL, deployed as a Node.js app on Hostinger
   hPanel (`DEPLOYMENT.md`). The prompt and the workbook both assume
   PHP/Laravel. Porting would delete every existing feature, which the prompt
   says needs your approval first, so all work follows the existing stack
   and patterns. The prompt's "no Node server" condition can't be met by the
   current app: it has always needed hPanel's Node.js hosting. Note that
   `AGENTS.md` warns about "a Next.js with breaking changes" — the installed
   version is 14.2.35, which works the way the existing code expects.

## Step 1 — Gap analysis (Phase = P0)

P0 scope (Phase Plan): login + OTP, role and scope engine, location master
(State > District > Taluka > Village), audit log, notification service.
Flows with Phase = P0: **F32, F33**.

| Flow ID | Status (before) | Existing files / tables involved | What is missing or wrong | Proposed change | Risk to existing data or features |
|---|---|---|---|---|---|
| F32 Role assignment | **PARTIAL** | `src/app/admin/users/*`, `src/app/api/admin/users/[id]/route.ts`; tables `roles`, `user_roles` (`areaId` column present, never written) | (1) An Operator can't be mapped to districts. (2) There are no District, State or National team roles. (3) Role changes are not audit-logged, and status changes are logged without the old value (breaks rule 9). (4) Nothing stops an Admin removing the last Admin, which would lock everyone out. (5) The user is not alerted. (6) The Admin check reads roles from the 30-day session JWT, so a revoked Admin can keep assigning roles. (7) Admin login has no 2-factor step. (8) An invalid status value returns HTTP 500. | Map scoped roles through the existing `user_roles.areaId`. Add the team roles as data rows. Audit every role and status change with old and new values. Enforce at least 2 active Admins, with a row lock. Notify the user. Check Admin from the DB. Validate the status. **2FA: needs your decision (changes login).** | Low. The existing `toggleRole` / `status` request bodies still work, and no rows are changed. |
| F33 Scoped data views | **MISSING** | `/members` directory and `/api/members`, `/api/search` (open to every member); `member_areas` (unused); `areas` | No team roles, no scoped directory and no export. Scope is not enforced anywhere because the concept does not exist yet. The ID-proof part of the rule depends on P1 (there are no ID-proof files yet). | New scope engine (`src/lib/scope.ts`), scoped directory page, API and CSV export. Export needs Admin or the Admin-granted `DATA_EXPORT`. Scope comes from the DB on every request. | None: everything is additive. The existing `/members` directory is unchanged. |

P0 scope items that have no Flow ID:

| Item | Status before | Notes |
|---|---|---|
| Login + OTP | **PARTIAL** | Email + password login with lockout. A 6-digit **email** OTP exists behind `NEXT_PUBLIC_AUTH_REQUIRE_VERIFICATION` (off by default) and is tested in `tests/verification-mode.test.ts`. There is no SMS OTP because there is no gateway (OP-10). Not changed: it changes how login works. |
| Role & scope engine | MISSING | Added `src/lib/scope.ts`. |
| Location master | PARTIAL | The `areas` table has a parent/child tree, but there is no Taluka or Village level, no admin screen (Settings linked to a non-existent `/admin/areas`), and no District rows (Pune, Mumbai and Nagpur are seeded as `CITY`). |
| Audit log | PARTIAL | The `audit_logs` table (old/new/IP/UA) and the Admin viewer exist. Writes are ad-hoc, and many mutations are not logged (see rule 9 below). Added a helper; new code uses it. |
| Notification service | PARTIAL | The in-app `notifications` table and SMTP email exist separately, with no single service and no SMS. Added `src/lib/notify.ts`. |

### (a) Existing features not in the workbook — left untouched
Community assets with booking and (mock) payments; family registration fee
(₹2,000) and fee invoices; community groups (mandals) with roster review;
matrimony module (profiles, interests, saved profiles); skills master;
businesses; admin-configurable physical-detail fields; 7-level photo/field
privacy; ASSET_OWNER role; blocked users; password reset; account lockout.
Several overlap later workbook flows and will need reconciling in their
phase, not now:
- Matrimony ↔ F37/F38 (P5)
- Member invitations / claim tokens ↔ F17 (P2)
- Family join requests and Karta invites ↔ F14/F15 (P2)
- Karta-change approval ↔ F16 (P2)
- Posts and moderation ↔ F36 (P5)
- Community groups ↔ local organisations, F26–F27 (P4)

### (b) Schema differences against "Data Fields"
| Workbook field | Existing column | Difference |
|---|---|---|
| Person ID | `members.memberNumber` | `MEM-YYYY-NNNNN` from `Math.random` (5 digits). Collisions will start failing inserts as the registry grows. |
| Gender (M/F/Other, mandatory) | `members.gender` | Extra `NOT_STATED`, which is the default. |
| Date of birth (mandatory) | `members.dateOfBirth` | Nullable. Age is never stored ✓ (rule 6 met). |
| Mobile (mandatory, OTP-verified, unique) | `users.mobile` | Optional. Email is the primary identifier (a documented deliberate deviation in SPEC-STATUS.md). |
| Gotra / Kuldevta (person) | — | Only on `families` (`gotra`, `kuladevata`, `kuladevi`). |
| Person status Active/Expired | `members.status` | `ACTIVE/INACTIVE/DECEASED/SUSPENDED`. Mapping: EXPIRED = `DECEASED`, date of death = `deceasedAt`. |
| Current / permanent address with location | `addresses` | Free-text state/district/taluka strings, not linked to the location master. No "same as current" flag. |
| Mul Gaon (from location master) | `members.nativeVillage/District/State` | Free text. |
| Education rows | `education_records` | No University or Grade. Passing year = `yearCompleted`. |
| Social status | `members.employmentStatus` | Free string, not the 5-value list. |
| Source of income / service type / profession | `employment_records.employmentType`, `member_profile_details.jobSector` | `JOB/BUSINESS/PROFESSION/…`; no PSU; no profession dropdown. |
| Income band | `income_ranges` **and** `member_profile_details.annualIncomeRange` | Two parallel band stores. |
| Earning status (auto) | `member_profile_details.isEarning` | A user toggle, not derived. |
| Marital status | `members.maritalStatus` | Extra `SEPARATED`, `NOT_STATED`. |
| ID type/number, proof, self-signed copy | — | Missing (P1). No ID data is stored anywhere today. |
| Declaration consent (text version, time, IP, OTP ref) | `consent_records` | Has version, time and IP, but **no OTP reference**. Registration writes no IP (P1). |
| Verification status | `users.status` | Mapping: Draft → (none), Pending → `PENDING`, Correction → (none), Active → `ACTIVE`, Rejected → (none). Also `SUSPENDED/BLOCKED/DEACTIVATED`. P1 needs the missing three. |
| Family ID / Karta | `families.registrationNumber`, `families.kartaMemberId` + `family_members.isKarta` | Karta is stored twice, and **no DB constraint enforces one active Karta** (rule 2, P2). |
| Membership (role, relative-to, start/end, status) | `family_members` | No role or relative-to column (the role lives in `member_relationships`). Status is just `leftAt`. Unique on (family, member). P2. |
| Organisation / org level / designations | `community_groups` | Nearest match. Roles are `CONVENER/SECRETARY/TREASURER/MEMBER`. No level, registration no. or certificate (P4). The `governance_units/members` tables the prompt mentions **do not exist** here. |

### (c) Role & access differences against "Roles & Access"
- **National/State/District team roles**: missing → **added** in P0 (Admin-assigned; seat-derived assignment is P4).
- **Operator — CONFLICT, not changed.** The workbook gives Operators only their assigned tasks in their mapped districts. The code treats OPERATOR as platform staff:
  - reads every member unredacted
  - can edit any member, mark members deceased and approve families
  - can moderate posts and configure skills
  - gets into `/admin`

  Narrowing this removes existing capability, so it needs your call. P1 (blind approval tasks) is the natural place.
- **User/member "own + limited view of others"**: `/api/members` and `/api/search` return full rows (see security finding 2).
- **Export**: there was no export → now Admin, or a team role plus the Admin-granted `DATA_EXPORT` role ("with Admin permission").
- **Admin 2-factor login**: missing (decision needed).
- **Assign roles / view audit log — Admin only**: matches. Role assignment is now checked against the DB.
- **Moderate group posts**: the code lets Operators and Admin moderate everything. The workbook moderates per body (P5).

### (d) Open Points affecting P0
- **OP-10 (SMS/DLT)** — followed. The SMS channel uses a `LOG` driver that never claims delivery; email and in-app carry alerts until DLT templates exist.
- **OP-04 (Operators)** — followed. Admin appoints Operators and maps them per district (multiple districts allowed). The "minimum 3 per district" is an availability target for P1 task assignment, not enforced here.
- **OP-03 (State team sees approval status)** — followed. State team (own state) and Admin see the pending-review count; District and National teams see the final account status only.
- **OP-01 (Aadhaar)** — nothing to do in P0. No ID numbers or proofs are stored anywhere yet.
- **OP-06** — the old governance tables aren't in this codebase, so there is nothing to extend or remove.

### (e) Security findings — reported only, not fixed
1. **High — stale roles in the session.** The JWT carries roles and status for 30 days, and about 48 existing checks trust it, so a revoked Admin or Operator, or a suspended user, keeps access until the token expires. The new P0 code re-reads the DB, but the old routes don't. Proposed fix: re-read roles and status in the `jwt` callback on each request, or every few minutes. This changes session behaviour, so it waits for your approval.
2. **High — directory leaks private fields.** `GET /api/members` and `GET /api/search` return whole `members` rows (mobile, email, DOB, deceased notes…) to any signed-in user. That bypasses the privacy settings `/api/members/[id]` enforces. Proposed fix: run rows through `redactMemberForViewer` or select only public columns.
3. **Medium — OTP brute force.** `/api/auth/verify-otp` and `/api/auth/reset-password` have no attempt limit on a 6-digit code (10-minute window). verify-otp also answers "User not found" (account enumeration), and codes come from `Math.random` rather than a CSPRNG.
4. **Medium — Operator over-privilege** (the CONFLICT above).
5. **Medium — default Admin password.** `scripts/mysql/02-reference-data.sql` ships a published Admin password (documented), and `seed.ts` falls back to `Admin@123456` if `ADMIN_PASSWORD` is unset.
6. **Low — random IDs.** Member and family numbers are random 5-digit values, and a collision returns a 500.
7. *(Fixed in passing, as part of F32: the admin user PATCH stored any status string.)*

**Rule check (prompt's non-negotiable rules) — current code, report only.**
Rules 1–5, 7, 8 and 10 belong to P1–P5 flows:
- Rule 1 (one person = one row): partly met. Membership rows lack role and relative-to.
- Rule 2 (one Karta): not DB-enforced.
- Rule 3 (blind dual approval): not built (P1).
- Rule 4 (marriage trigger): spouse link exists, but no request goes to the spouse-family Karta.
- Rule 6 (age from DOB): met.
- Rule 9 (audit everything): partial. Member education, employment, business, skills, photos, addresses, relationship types, settings and most family edits write no audit row. P0 code is fully audited.
- Rule 10 (bureau toggle): matrimony auto-withdraws on marriage, but not on death, and has no earning or legal-age gate.

## Step 2 — What was changed

### Final gap table
| Flow ID | Status before | Status after | Files changed | Tests passing | Notes |
|---|---|---|---|---|---|
| F32 | PARTIAL | **DONE except 2FA** | `api/admin/users/[id]/route.ts`, `admin/users/[id]/page.tsx`, `admin/users/page.tsx`, `lib/scope.ts`, `lib/audit.ts`, `lib/notify.ts`, migration, seed | 12/12 (`tests/p0/F32-role-assignment.test.ts`) | Admin 2-factor login needs your decision (it changes how login works). |
| F33 | MISSING | **DONE** | `lib/scope.ts`, `lib/directory.ts`, `api/directory/route.ts`, `api/directory/export/route.ts`, `(dashboard)/team-directory/page.tsx`, `Sidebar.tsx` | 19/19 (`tests/p0/F33-scoped-views.test.ts`) | The "ID proof visible only to Operators/Admin" rule applies once ID proofs exist (P1). |
| P0 location master | PARTIAL | DONE | `api/admin/areas/*`, `admin/areas/page.tsx`, `LocationMasterAdmin.tsx`, `lib/scope.ts`, seed | 5/5 (`tests/p0/P0-location-master.test.ts`) | Members' addresses are not yet linked to it (P1, F01/F02). |
| P0 notification service | PARTIAL | DONE (SMS = log only) | `lib/notify.ts`, `.env.example` | 5/5 (`tests/p0/P0-notification-service.test.ts`) | Real SMS waits on OP-10. Sending is inline, not a DB queue or cron (matches the existing email code). |
| P0 audit log | PARTIAL | PARTIAL (P0 code fully audited) | `lib/audit.ts` | covered in F32/F33/location tests | Retro-fitting older routes is outside P0. |
| P0 login + OTP | PARTIAL | unchanged | — | existing `verification-mode.test.ts` passes | SMS OTP needs a gateway. Email OTP works when the flag is on and SMTP is set. |

### Change list
| File | Reason | One-line reason |
|---|---|---|
| `prisma/migrations/20261009120000_p0_team_roles/migration.sql` (new) | F32/F33 | Inserts the NATIONAL_TEAM, STATE_TEAM, DISTRICT_TEAM and DATA_EXPORT roles (data only). |
| `prisma/migrations/20261009120000_p0_team_roles/down.sql` (new) | rule: working down() | Manual rollback (Prisma has no down step). |
| `database/phpmyadmin/add_p0_team_roles.sql` (new) | deploy path A | The same inserts for phpMyAdmin import. |
| `prisma/schema.prisma` | F32, location master | Comments only (allowed `areas.type` values; meaning of `user_roles.areaId`). No DDL. |
| `prisma/seeds/seed.ts` | F32/F33, location master | Team roles plus permission rows. Dev/test-only demo locations and team accounts behind `SEED_TEST_ACCOUNTS`. |
| `src/lib/scope.ts` (new) | F32/F33 | Role and scope engine; roles and status read from the DB. |
| `src/lib/directory.ts` (new) | F33 | Scoped directory query, field rules and CSV. |
| `src/lib/audit.ts` (new) | rule 9 | Audit helper (old/new, IP, user agent; transaction-aware). |
| `src/lib/notify.ts` (new) | P0 notification service | In-app + email + SMS (LOG driver). |
| `src/app/api/admin/users/[id]/route.ts` | F32 | DB Admin check, district/state mapping, 2-Admin floor, audit, alert, status validation. |
| `src/app/admin/users/[id]/page.tsx` | F32 | Team-role toggles plus a "Location-mapped roles" panel. |
| `src/app/admin/users/page.tsx` | F32 | Shows the area on scoped role badges (and fixes a duplicate React key). |
| `src/app/api/admin/areas/route.ts`, `…/[id]/route.ts` (new) | location master | List, create (hierarchy-checked), rename and deactivate, all audited. |
| `src/app/admin/areas/page.tsx`, `src/components/admin/LocationMasterAdmin.tsx` (new) | location master | Admin tree editor at the URL Settings already linked to. |
| `src/app/api/directory/route.ts`, `…/export/route.ts` (new) | F33 | Scoped JSON directory and audited CSV export. |
| `src/app/(dashboard)/team-directory/page.tsx` (new) | F33 | Team Directory screen. |
| `src/components/layout/Sidebar.tsx` | F33 | "Team Directory" link for Admin and team roles. |
| `.env.example` | P0 notification service | `SMS_DRIVER=LOG`. |
| `tests/p0/*` (new) | testing rule 2 | Flow-ID tests plus fixtures. |
| `docs/PHASE-P0-REPORT.md` (new) | deliverable | This report. |

**Deliberately untouched:**
- Login and session code (`src/lib/auth.ts`, `auth-config.ts`, `middleware.ts`) and every existing role check.
- The `/members` directory, `/api/members`, `/api/search`.
- Operator powers.
- All family, matrimony, asset, fee, group and post code.
- Existing migrations and existing tests.
- The legacy `CITY` area rows (Pune, Mumbai, Nagpur were *not* re-typed as districts; new District rows sit beside them).
- README and docker-compose (stale Postgres references).

### New migrations (run order)
1. `20261009120000_p0_team_roles` — `INSERT IGNORE` of 4 rows into `roles`.
   - No schema change and no backfill needed: scoped roles reuse the existing nullable `user_roles.areaId`.
   - **Rollback:** run `down.sql` in that folder, then delete its row from `_prisma_migrations`. This deletes any assignments of those 4 roles. It was verified on the test DB: down → 0 rows → re-apply OK.

### Test output — baseline vs final
| | Typecheck | Test files | Tests | Build |
|---|---|---|---|---|
| Baseline (before any change) | clean | 15 passed | **204 passed** | — |
| Final | clean | 19 passed | **245 passed** (204 + 41 new) | `next build` OK |

How it was run: MariaDB 10.11 locally (CI uses MySQL 8.0), using the CI
`.env.test`, `prisma migrate deploy`, `db:seed` and `db:seed:uat`. No
existing test was edited.

There was also a browser check against the production build:
- Admin signs in, opens a user, and assigns "District team — Pune". The audit row and the notification were written.
- The District team account sees only the Pune-district member.
- A plain member opening `/team-directory` is redirected.

### Deployment (Hostinger hPanel, dev → test only; prod not touched)
1. Pull the branch and run `npm ci && npm run build`.
2. Migrate:
   - **SSH:** `npx prisma migrate deploy`, then `npm run db:seed` (idempotent upserts — never overwrites existing rows; leave `SEED_TEST_ACCOUNTS` unset outside dev/test).
   - **phpMyAdmin:** import `database/phpmyadmin/add_p0_team_roles.sql` (after `01`/`02`, or after `03-upgrade-existing.sql` on staging). It is `INSERT IGNORE`, safe to import twice, and records the migration in `_prisma_migrations`, so a later `prisma migrate deploy` skips it (verified).
3. New env key (optional): `SMS_DRIVER=LOG`. No other new keys.
4. No cron entry or storage-permission change is needed for P0. Uploads are unchanged.
5. Restart the Node app in hPanel.
6. Exit criterion "OTP works on test": on the **test** environment set `NEXT_PUBLIC_AUTH_REQUIRE_VERIFICATION=true` and working `SMTP_*` (see `SMTP-SETUP.md`), rebuild (it's a `NEXT_PUBLIC_` key), then register a new account and enter the emailed code.
7. Post-deploy:
   - Add your districts and states under **Admin → Settings → Community Areas** (`/admin/areas`).
   - Assign a **second Admin** (the 2-Admin floor means the first can't be removed until one exists).

### Exit criteria (Phase Plan, P0)
- **Role scope tests pass** — ✅ 41 P0 tests, including forged-session, revoked-role, suspended-account, wrong-mapping and out-of-scope-filter bypass attempts.
- **OTP works on test** — ⚠️ The email OTP is built and covered by an automated test. It still has to be switched on in the test environment with real SMTP, which is a config step for you (step 6). SMS OTP is blocked by OP-10.
- **Deliverable "Admin can log in and assign roles"** — ✅ verified in a browser against the production build.

### Assumptions made
- A member's district or state is their **primary `member_areas` row** (their home location).
  - Existing members have none, so District and State teams see nobody from legacy data until P1 (F01/F02) records each person's location.
  - Admin and National see everyone. A one-off backfill from address text is possible but would guess at free-text district names, so it was not done.
- `DATA_EXPORT` is modelled as an Admin-assigned role. That's how "export with Admin permission" fits the existing per-role permission tables.
- Body teams never see mobile or email in the directory (the Data Fields sheet lists those as Self, Karta, Operator, Admin).
- "Approval status" for the State team is shown as the count of open reviews on the member, using today's approval table. The per-operator status arrives with P1.

### Decisions needed from you
1. **Admin 2-factor login (F32)** — this changes login. Proposal: an email OTP step after the password for users holding ADMIN, reusing the existing verification-token table.
2. **Stale-session roles (security finding 1)** — OK to re-read roles and status from the DB in the session callback?
3. **Operator scope CONFLICT** — narrow Operators to their assigned tasks in their mapped districts now, or in P1 alongside blind approval?
4. **Directory field leak (security finding 2)** — OK to redact `/api/members` and `/api/search`?
5. **Next phase** — confirm P1. It is the first phase that needs the Data Fields gaps above (DRAFT / CORRECTION_REQUIRED / REJECTED statuses, ID proof, consent OTP reference).
