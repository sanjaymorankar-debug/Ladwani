# Phase P1 — Registration and dual approval: delivery report

Prepared 9 Oct 2026. Branch `claude/intelligent-ritchie-8b37zt` (same PR as
P0). The stack is unchanged (Next.js 14 + Prisma + MySQL) — see
`PHASE-P0-REPORT.md`.

## 0. The four P0 decisions you approved — done first

| Decision | What was built | Tests |
|---|---|---|
| 1. Admin 2-factor login (F32) | After the password, an Admin gets a 6-digit code by email (CSPRNG, stored hashed, single use, burned after 5 wrong guesses). The login form asks for it. `AUTH_ADMIN_2FA=false` switches it off for mail-less local setups only. | `tests/p0/DEC-admin-2fa-session-refresh.test.ts` |
| 2. Session roles re-read every request | The NextAuth `jwt` callback reloads roles, status and memberId from the database on every request. A suspended, blocked, deactivated or deleted account loses its session at once. | same file |
| 3. Operators narrowed to their tasks | Full member view (contact details, DOB…) is Admin only, or an Operator **while holding an undecided verification task** for that member. Operators can no longer edit members or manage families (`member-auth`, `family-auth`, `visibility`, member page, matrimony profile). They keep the existing generic approvals queue, post moderation and group/asset approvals (features outside the workbook, left as they were). | `F04-F07-dual-blind-approval.test.ts` ("decision 3") |
| 4. Directory redaction | `/api/members`, `/api/search` and the `/members` page apply each member's privacy settings (batched), as `/api/members/[id]` already did. | `tests/p0/DEC-directory-redaction.test.ts` |

## 1. Gap analysis (Phase = P1, flows F01–F08)

| Flow | Status before | Existing files / tables | What was missing or wrong | Change made | Risk to existing data |
|---|---|---|---|---|---|
| F01 Self-registration | PARTIAL | `api/auth/register`, `(auth)/register`, `users`, `members` | Gender, DOB, Mul Gaon not captured. No under-18 rule. New accounts were immediately ACTIVE (no DRAFT). No welcome message. OTP codes came from `Math.random` with no attempt limit, and "User not found" revealed accounts. Mobile is optional (**CONFLICT**: the workbook says mandatory — see decisions). | Gender, DOB (18+), Mul Gaon from the location master. Status DRAFT (or PENDING → DRAFT after the email OTP). Welcome notification. CSPRNG codes with 5-try limit and no enumeration. DRAFT accounts can't create/join families, post, register groups/assets or use matrimony. | Existing users keep their status (ACTIVE); nothing rewritten. |
| F02 Complete profile | PARTIAL | `members/[id]` PATCH + edit page, `addresses`, `education_records`, `member_profile_details` | Social status didn't use the workbook list. No Service/Business/Professional details. No permanent address or "same as current". Addresses not linked to the location master. Education had no university or grade. Completeness % used other criteria. | `src/lib/occupation.ts`. Occupation fields in the existing form. PERMANENT address with `sameAsCurrent`. `addresses.areaId`. Education university/grade. `profileCompleteness()` used by the profile page and enforced on submit. Income stays a band. | Older social-status values (EMPLOYED…) are read and mapped, never rewritten. |
| F03 ID proof + declaration | MISSING | — | Everything. | `id_proofs` (AES-256-GCM files, number encrypted, Aadhaar last-4 only per OP-01). Upload, sniffed type, 5 MB limit. Declaration text + version, OTP-confirmed. Consent record with text, version, time, IP, OTP reference. Copy sent by email/SMS. Proof viewer restricted and audited. | New tables/columns only. |
| F04 Two approvers | MISSING | — | No task model, no operator selection. | `approval_tasks`. Two Operators of the subject's district: least open work first, then round robin. Never the subject or anyone in their families. A missing slot goes to Admin with an alert. Each Operator is alerted. | — |
| F05 Blind verification | MISSING (existing single-reviewer `approvals` is not blind) | `api/approvals` (left as is) | — | Operator queue and task view pinned to the caller's own rows (someone else's task returns 404). Checklist + remarks. Decision final (conditional update); only an Admin reopens. | — |
| F06 Final outcome | MISSING | — | — | Both approve → ACTIVE. Any reject → REJECTED. Otherwise send-back → CORRECTION_REQUIRED. The combined reason never names operators. Resubmit = new round, same Operators. SLA (Setting `approval.sla_days`, default 7) escalation via `/api/cron/approval-sla` reassigns and alerts District team + Admin. | — |
| F07 Approval monitor | MISSING | — | — | `/approval-monitor` + API. Admin sees all; State team sees its own state (OP-03). Filters by state, district, operator, age, status. Admin reassign / reopen, all audited. | — |
| F08 Sensitive changes | PARTIAL / CONFLICT | `members/[id]` PATCH, `approvals.ts` address gate | Name/DOB/gender saved directly. ID-proof and Mul Gaon changes didn't exist. History had no old/new values. **CONFLICT**: an ACTIVE member's address edit goes to the existing single-reviewer queue, while the workbook says address saves instantly. | For ACTIVE users, name/DOB/gender/Mul Gaon/ID proof changes open a `profile_change_requests` row and the same two-slot blind tasks. The old value stays live until approval. Locked while PENDING_APPROVAL. Direct while DRAFT. Every member update audited with old/new. Address gate kept for ACTIVE users (bypassed before approval) — **decision needed**. | None. |

**Status mapping (workbook → code):**

| Workbook | Code |
|---|---|
| DRAFT | `DRAFT` (new) |
| PENDING_APPROVAL | `PENDING_APPROVAL` (new) |
| ACTIVE | `ACTIVE` |
| CORRECTION_REQUIRED | `CORRECTION_REQUIRED` (new) |
| REJECTED | `REJECTED` (new) |
| SUSPENDED | `SUSPENDED` |
| EXPIRED | `members.status = DECEASED` |
| — | `PENDING` keeps its old meaning: email not yet verified |

**Approval task statuses:**

| Workbook | Code |
|---|---|
| OPEN | `OPEN` |
| APPROVED | `APPROVED` |
| REJECTED | `REJECTED` |
| SENT_BACK | `SENT_BACK` |
| ESCALATED | `ESCALATED` |

Plus `REASSIGNED`, used when an Admin moves a task.

## 2. Change list

| File | Flow / rule | Reason |
|---|---|---|
| `prisma/migrations/20261009130000_otp_attempts/*` | F32 decision 1 | `verification_tokens.attempts` |
| `prisma/migrations/20261009140000_p1_registration_approval/*` | F01–F08 | Statuses, consent OTP ref, address area, education, occupation, 3 new tables (+ down.sql) |
| `database/phpmyadmin/add_p1_registration_approval.sql` | deploy | Both migrations + migration records + SLA setting (verified) |
| `prisma/schema.prisma` | F01–F08 | Models for the above |
| `prisma/seeds/seed.ts` | F06, OP-04 | SLA setting; 2 more Pune operators (dev/test only) |
| `src/lib/otp.ts` | F32, F01, F03 | CSPRNG OTP with attempt limit |
| `src/lib/auth.ts`, `auth-config.ts`, `api/auth/login-check`, `(auth)/login/page.tsx` | F32 decisions 1–2 | 2FA; per-request claims |
| `src/lib/visibility.ts`, `member-auth.ts`, `family-auth.ts`, `members/[id]/page.tsx`, `matrimony/profiles/[id]` | decision 3, 4 | Operator narrowing; batch redaction |
| `src/app/api/members/route.ts`, `api/search/route.ts`, `(dashboard)/members/page.tsx` | decision 4 | Redaction |
| `src/lib/secure-files.ts` | F03, rule 7 | Encryption, type sniffing, masking |
| `src/lib/declaration.ts` | F03, rule 8 | Versioned declaration text |
| `src/lib/locations.ts` | F01, F02 | Location chain helpers |
| `src/lib/account-state.ts` + 11 POST routes (families, join-requests, family members, posts, comments, reactions, groups, assets, bookings, matrimony profiles, interests) | F01 | DRAFT accounts limited to their own profile |
| `src/lib/verification.ts` | F04–F08 | Blind dual-approval engine |
| `src/lib/registration.ts` | F02, F03, F06 | Completeness, ID number rules, submit/resubmit |
| `src/lib/occupation.ts` | F02 | Social status and occupation rules |
| `api/auth/register`, `api/auth/verify-otp`, `api/areas` (new), `src/middleware.ts` | F01 | Registration fields, DRAFT, public location cascade, cron path |
| `api/members/[id]/route.ts`, `addresses`, `education`, `mul-gaon` (new), `src/lib/approvals.ts` | F02, F08 | Occupation, addresses, change requests, audit old/new |
| `api/verification/*`, `api/id-proofs/[id]/file` (new) | F03, F05 | Applicant and operator APIs |
| `api/approval-monitor/*`, `api/cron/approval-sla` (new) | F06, F07 | Monitor, admin actions, SLA cron |
| `(auth)/register/page.tsx`, `components/shared/AreaCascadePicker.tsx` | F01 | Form fields and location cascade |
| `(dashboard)/verification`, `admin/verification/*`, `(dashboard)/approval-monitor` (new pages) | F02–F07 | Screens |
| `(dashboard)/members/[id]/edit/page.tsx`, `components/profile/RegistrationDetailsPanel.tsx`, `EducationManager.tsx`, `(dashboard)/profile/page.tsx`, `(dashboard)/dashboard/page.tsx`, `Sidebar.tsx` | F01, F02 | Occupation, Mul Gaon, addresses, completeness, banner, navigation |
| `.env.example` | deploy | `AUTH_ADMIN_2FA`, `NEXT_PUBLIC_REGISTRATION_REQUIRE_MOBILE`, `ID_PROOF_KEY`, `CRON_SECRET` |
| `tests/p0/DEC-*`, `tests/p1/*` (new) | testing | 69 new tests |

**Existing tests changed** (rule: tell you which and why — each now asserts the approved / workbook behaviour):
1. `tests/uat/privacy-matrimony.test.ts` TC-PRIV-003 — the "staff can see the field" actor changed from OPERATOR-01 to ADMIN-01 (decision 3). The Operator case is covered in the new F05 tests.
2. `tests/registration-intent.test.ts`:
   - The request body gains the F01-mandatory gender, DOB and Mul Gaon.
   - Cleanup removes the new Mul Gaon link and welcome notification.
   - A new account is `DRAFT`, not `ACTIVE`.
   - The family-creation step marks the user approved first (F09 needs an ACTIVE user).
3. `tests/verification-mode.test.ts` — same body and cleanup additions.
4. `tests/uat/auth.test.ts` — same body and cleanup additions.

No test was skipped or deleted, and no assertion was weakened beyond the changed behaviour.

**Deliberately untouched:**
- The generic `approvals` queue and its rules (family.create, marital/spouse, deceased, karta change, address).
- Groups, assets, fees, payments, posts moderation.
- The NATIVE address editor.
- Spouse linking (P3).

## 3. Migrations (run order)
1. `20261009130000_otp_attempts` — one column with default 0. Rollback: `down.sql`.
2. `20261009140000_p1_registration_approval`:
   - Contents: enum values added; nullable columns; 3 new tables.
   - Backfill: none needed.
   - Rollback (`down.sql`): drops the 3 tables, parks P1-only statuses as PENDING, then shrinks the enum. Tested: down → re-apply OK.

## 4. Tests — before vs after

| | Test files | Tests | Typecheck | Build |
|---|---|---|---|---|
| After P0 | 19 | 245 | clean | OK |
| After decisions + P1 | 25 | **314 passed** | clean | OK |

The suite was run twice back-to-back on the same database to prove the new tests leave no state behind.

The browser run against the production build covered:
1. Registering through the form, including the Mul Gaon cascade.
2. Profile completion.
3. ID proof upload.
4. Declaration with an emailed code.
5. Two of the three Pune Operators approving through their own queues, while the third had no task.
6. The applicant becoming ACTIVE.
7. Admin signing in with the 2FA code and opening the Approval Monitor.

## 5. Deployment (shared hosting, dev → test only)
1. New env keys:
   - `ID_PROOF_KEY` — **required in production**; uploads return 503 without it.
   - `CRON_SECRET` — 16+ characters.
   - Optional: `AUTH_ADMIN_2FA`, `NEXT_PUBLIC_REGISTRATION_REQUIRE_MOBILE`.
   - Admin 2FA needs working SMTP (SMTP-SETUP.md). Without SMTP the code is only written to the server log.
2. Migrate: `npx prisma migrate deploy && npm run db:seed`. Or in phpMyAdmin, import `add_p1_registration_approval.sql` after `add_p0_team_roles.sql`.
3. Cron (hPanel → Advanced → Cron Jobs), hourly:
   `curl -fsS -H "x-cron-secret: <CRON_SECRET>" https://<site>/api/cron/approval-sla`
4. Storage: `UPLOAD_DIR` must be outside `public_html` and writable by the Node app (`id-proofs/` is created inside it). Back up the key and the directory together.
5. Map at least 2 (OP-04: 3) Operators per district in Admin → Users → Location-mapped roles, or registrations from that district wait for an Admin to assign.
6. Rebuild and restart the Node app.

## 6. Exit criteria (Phase Plan, P1)
- **Operator cannot see the other operator's decision** — ✅. Queue, task view, decision and proof endpoints are pinned to the caller's own row (someone else's returns 404). The monitor is Admin/State only. Tested in `F04-F07` and checked in the browser.
- **Consent record stored** — ✅. Version, exact text, timestamp, IP and OTP reference (`F03` tests).
- **Deliverable "Registration to ACTIVE works end to end"** — ✅. Automated tests and the browser run.

## 7. Assumptions
- **A person's district is their Mul Gaon's district.** It decides who verifies them and which District/State team sees them.
- Mul Gaon is a sensitive field, like name.
- Approve needs all four checklist ticks; Reject / Send back need remarks.
- Reject outranks send-back when the two operators differ.
- The outcome waits for both decisions.
- After a send-back, resubmitting needs a fresh declaration and goes to the same two Operators when still eligible.
- Escalation reassigns to a third eligible Operator. If none is available, the task stays with the original Operator, marked ESCALATED, and an Admin is alerted.
- A profile-change send-back counts as a rejection of that change; the member can request again.
- Accounts created before P1 stay ACTIVE without going through dual approval (no data rewritten).
- SMS still uses the LOG driver (OP-10), so OTP and alerts go by email and in-app.

## 8. Decisions needed
1. **Mobile mandatory at sign-up?** The workbook says yes; the earlier email-first design says no. One switch: `NEXT_PUBLIC_REGISTRATION_REQUIRE_MOBILE=true`.
2. **Address changes by verified members**: the workbook F08 says they save instantly; the existing §28 rule sends them to a single reviewer. Currently kept for ACTIVE members. Remove the gate?
3. **Accounts that pre-date P1** are ACTIVE without dual approval. Leave them, or ask them to submit ID proof (status → DRAFT)? The latter would rewrite data, so it needs your yes.
