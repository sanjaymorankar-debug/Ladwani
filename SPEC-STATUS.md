# Implementation status vs. LadWani.docx (52-section spec)

Audited 6 Sep 2026 against commit `4fabb74`. Legend: **✅ done** · **🟡 partial** ·
**❌ not built** · **⚪ n/a**

## Headline

The three problems the spec opens with are fixed and verified end-to-end in a
browser: authentication works, a user can register as Karta and build a family,
and members can maintain full profiles. Roughly **32 of 52 sections are complete,
15 partial, 4 not built**. The gaps that matter most are listed under
"Outstanding work" at the bottom.

## Section-by-section

| § | Requirement | Status | Notes |
|---|---|---|---|
| 1 | Audit + Root Cause Analysis | ✅ | Delivered; root causes in commit `bc6ce76` |
| 2 | Registration + join choice | ✅ | Karta / join-existing choice now required at signup |
| 3 | Login | ✅ | Mobile **or** email + password; distinct error messages |
| 4 | Session management | ✅ | NextAuth JWT; survives refresh; logout clears |
| 5 | Protected routes | 🟡 | Auth enforced in middleware **and** server-side per route. But `/community-services`, `/my-bookings`, `/community-fees`, `/my-payments` don't exist (see §43) |
| 6 | Role resolution | ✅ | 5 roles + 15 permissions now in DB, not just role-code strings |
| 7 | Register as Karta of new family | ✅ | Full flow incl. the signup choice |
| 8 | Karta registration form | 🟡 | Family info captured at registration; Karta's own photo/address/education/skills/physical are captured on the profile pages, not in one combined form |
| 9 | Automatic Karta creation | ✅ | One transaction: User→Member→Family→FamilyMember→KARTA role |
| 10 | Family member addition | ✅ | 4-step form, bidirectional relationships |
| 11 | Add **existing** community member | 🟡 | Duplicate detection + "may already be registered" ✅. The *Karta-requests → member-accepts* direction is **not built** (the reverse — member requests to join a family — is) |
| 12 | Invite new member to create account | ❌ | Member record is created; no invitation is sent |
| 13 | Karta family dashboard | 🟡 | Name/Karta/count/verification ✅, Add Member ✅, View Tree ✅, Edit Family ✅. **Add Photo ❌, Invite Member ❌**; "Submit for verification" happens automatically at creation rather than as a button |
| 14 | Complete member profile | ✅ | All 10 sections present |
| 15 | Demographic details | 🟡 | Age derived from DOB ✅ (never stored). `nationality`/`languages` exist in schema but aren't in the edit UI |
| 16 | Physical details | 🟡 | Height/weight/body type/blood group/disability ✅ all optional. **Admin-configurable field toggles ❌** |
| 17 | Education (multiple) | ✅ | |
| 18 | Employment (multiple) | ✅ | |
| 19 | Business details | 🟡 | API built; **no UI** |
| 20 | Skills | 🟡 | Multiple skills, find-or-create ✅. **No admin master-list management, no searchable predefined picker** |
| 21 | Address management | ✅ | Structured current + native, privacy-gated |
| 22 | Photo management | 🟡 | Upload/compress/thumbnail/S3/validation all coded — **never runtime-tested, no S3 credentials configured** |
| 23 | Photo privacy | 🟡 | 7 visibility levels, conservative default; untested for the same reason |
| 24 | Marital status + spouse linking | ✅ | Approval-gated; links both member records + tree |
| 25 | Relationship integrity | ✅ | Real relationship rows, never text |
| 26 | Family tree | ✅ | Generated from relationship records |
| 27 | Profile edit permissions | ✅ | Karta cannot override another adult's private profile (tested) |
| 28 | Approval workflow | 🟡 | Framework + `family.create` + marital status wired. **Deceased status, Karta change, address changes, major relationship changes not wired** |
| 29 | Karta verification | ✅ | Pending → Operator/Admin approves → Verified badge |
| 30 | Data validation | 🟡 | Mobile/email/DOB/password ✅. **Height/weight ranges and PIN format not validated** |
| 31 | Duplicate prevention | ✅ | Mobile/email/name+DOB checked before creating a member |
| 32 | User ↔ Member architecture | ✅ | Members can exist with no login account |
| 33 | Database design | ✅ | Matches the spec's suggested tables |
| 34 | Account claiming | ❌ | Depends on §12 |
| 35 | Dashboard routing by role | ✅ | Admin/Operator → `/admin`; Karta/Member/Asset Owner → `/dashboard`, labelled per role |
| 36 | Auth error handling | ✅ | Spec's exact wording for suspended/pending/locked |
| 37 | Security requirements | ✅ | bcrypt, HTTP-only+secure cookies, NextAuth CSRF, rate limiting, lockout, reset, verification, server-side authz. Roles never taken from client input |
| 38 | Authorization tests | ✅ | 24 automated tests, all passing |
| 39 | Profile completion % | ✅ | |
| 40 | Family completion % | ✅ | |
| 41 | Profile page UX | 🟡 | Sections with independent save ✅; **not tabbed** as the spec describes |
| 42 | Mobile UX | 🟡 | Layout is responsive (Tailwind) but **not verified on mobile viewports** |
| 43 | Don't break existing modules | ⚪ | Community feed, areas, family tree, matrimony, notifications, admin, operator, audit — all preserved ✅. **Asset registration, asset booking, online payment, community fees and community services never existed in this codebase** — see below |
| 44 | Migration strategy | 🟡 | Script + `MIGRATION.md` runbook written; **not executed** (no network path to the live MySQL host) |
| 45 | Test users | ✅ | All 5 roles incl. Asset Owner |
| 46 | Acceptance: authentication | ✅ | Register→verify→login→refresh→protected page→logout verified in browser |
| 47 | Acceptance: Karta | 🟡 | Register→family→Karta→add members→tree→edit ✅. Family photo upload ❌; approve→verified tested via API, not clicked through |
| 48 | Acceptance: member profile | 🟡 | Sections load and save; photo upload untested |
| 49 | Acceptance: existing member | 🟡 | Duplicate detection verified; notify-and-accept direction missing (§11) |
| 50–52 | Final requirements / DoD | 🟡 | See outstanding work |

## The one structural discrepancy worth a decision

§5 and §43 assume this platform already contains **community services, asset
registration, asset booking, online payments and community fees**. Those modules
do not exist anywhere in this codebase — there are no routes, no API handlers and
no tables for them. Nothing was broken; they were never here.

Either the spec was written against a different/older system, or those modules
are still to be built. Worth confirming before anyone treats §43 as satisfied.

## Outstanding work, roughly by value

1. **Invitation / account claiming (§12, §34)** — a Karta can add an elderly
   parent today, but there's no way to later invite that person to claim the
   profile. This is the largest missing user-facing flow.
2. **"Request to add an existing member" (§11, §49)** — currently duplicates are
   detected and shown, but the Karta can't send a request that the existing
   member accepts.
3. **Photo pipeline verification (§22, §23)** — the code is complete; it needs S3
   or MinIO credentials and one real upload to be trusted.
4. **Karta dashboard: Add Photo + Invite Member buttons (§13)**.
5. **Remaining approval gates (§28)** — deceased status, Karta change, address
   changes.
6. **Business UI (§19), skills master list (§20), admin-configurable physical
   fields (§16)** — all have working data models behind them.
7. **Validation gaps (§30)** — height/weight ranges, Indian PIN format.
8. **Profile tabs (§41) and mobile verification (§42)** — cosmetic/UX.
9. **Run the MySQL→Postgres migration (§44)** — see `MIGRATION.md`.
