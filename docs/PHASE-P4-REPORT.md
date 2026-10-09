# Phase P4 — Organisations and LadWani bodies: delivery report

Prepared 9 Oct 2026. Branch `claude/intelligent-ritchie-8b37zt` (same PR as P0–P3).

## 1. Gap analysis (Phase = P4, flows F26–F31)

**What existed:** no organisation, body, nomination or seat tables.
- The nearest feature is **community groups** (mandals: a convener, a roster of up to 25, single-reviewer approval). That is a different thing, so it was **left untouched**.
- Turning groups into organisations would rename CONVENER to PRESIDENT in live rows, which is a data rewrite (see decisions).
- **OP-06** (the old Village > Taluka > District > State > World Council design): no trace of it exists in the code or the database, so nothing had to be removed. The new Local > District > State > National chain is built as the workbook says.

| Flow | Status before | What was missing | Change made | Risk to existing data |
|---|---|---|---|---|
| F26 Register an organisation | MISSING | — | `POST api/organisations` (form + certificate). Fields: name, registration no., address, **district from the location master**, purpose, certificate (sniffed type, 5 MB, **stored encrypted** like ID proofs), and three different ACTIVE users as President, Secretary and Treasurer. <br>Nominees are alerted and accept on the organisation page; a decliner is replaced by the applicant. <br>**Same two-Operator blind round as P1:** new task kind ORGANISATION in `approval_tasks`, Operators of the organisation's district, people named in the organisation excluded. It has its own checklist, and the same outcome rules, SLA escalation and Admin reassign/reopen. Send back → correct → resubmit = new round. <br>The organisation is **ACTIVE only when both Operators approved and all three office bearers accepted**. | None (new tables) |
| F27 Members and designations | MISSING | — | President or Secretary invites a member, who accepts. Users ask to join and the President or Secretary accepts. Remove with a reason; resign. <br>**Exactly one President, Secretary and Treasurer**, enforced by the database (generated column + unique index): a post is handed over, the new holder accepts, and the outgoing holder becomes a Member. Office bearers cannot be removed or demoted directly, or resign without handing over. <br>Term start/end for office bearers. Every change is audited (old/new) and the person affected is alerted. | None |
| F28 Local org → District body | MISSING | — | The President nominates **exactly 2** members, enforced under a row lock (none open → name two; one open → name one). Nominees must be ACTIVE members of the organisation. <br>Nominees accept, then the **District body's President, or an Admin while it has none**, confirms. The person becomes a member of the LadWani District body for that district; the body is created on first use, one per district. <br>Replacing a nominee ends the old seat. | None |
| F29 District → State body | MISSING | — | Same, from the District body (by its President) to the State body of the district's state. Each body has its own President, Secretary, Treasurer and Members; an Admin appoints the first President, who accepts. | None |
| F30 State → National body; data roles | MISSING | — | Same, to the National body. **A confirmed seat grants the matching data-view role**: DISTRICT_TEAM for the district, STATE_TEAM for the state, NATIONAL_TEAM. It is linked to the seat (`user_roles.bodySeatId`), so the P0 scope engine applies it. | Additive column |
| F31 Term end / vacancy | MISSING | — | Ending a seat (replaced, resigned, removed, member expired, or the lower seat lost) ends the body membership and **removes the data-view role**, then **every seat above that came from it**, recursively. The nominating unit is told the seat is vacant. <br>A lost office post alerts the unit and the Admins. Expired members (F12) lose all posts and seats. <br>The daily cron (`/api/cron/daily`) ends office terms past their end date and flags the post vacant. | None |

### a) Found in code, not in the workbook (left as they are)
- Community groups (mandals), with their convener/secretary/treasurer roles, roster reviews and approval.

### b) Schema differences (all additive)
- `organisations`
- `organisation_members` (with generated `officeGuard`)
- `body_seats`
- `approval_tasks.organisationId`
- `user_roles.bodySeatId`

### c) Role differences
- An Admin may also confirm seats and appoint a body's first President, because a new body has no President yet.
- A body's President is appointed from its members by the Admin; the workbook does not say how.

### d) Open points
- **OP-06:** see above. Please confirm that the old council design is replaced (nothing of it exists to migrate).

### e) Security
- Certificates are encrypted at rest. Only the applicant, the office bearers, Admins and the Operators holding a task for that organisation can open one, and each opening is audited.
- Non-members see an active organisation's summary only (name, district, purpose, office bearers).

## 2. Change list

| File | Flow | Why |
|---|---|---|
| migration `20261009170000_p4_organisations` (+ `down.sql`), `schema.prisma` | F26–F31 | Tables and columns above |
| `src/lib/organisations.ts` (new) | F26–F31 | Activation, body chain, confirm seat + role, end seat cascade, vacancies, expiry, term-end job |
| `src/lib/verification.ts` | F26 | ORGANISATION task kind (district, conflicts, outcome, reopen, own checklist) |
| `api/organisations` (+ `[id]`, `/submit`, `/certificate`, `/members`, `/members/[memberId]`, `/nominations`), `api/body-seats/[id]` (new) | F26–F31 | API |
| `api/verification/tasks` (+ `[id]`), `admin/verification` (+ `[id]`) | F26 | Operators see the organisation, office bearers and certificate |
| `src/lib/family-rules.ts`, `api/cron/daily` | F31 | Expired member → posts and seats vacant; term-end job |
| UI: `organisations` (list, `new`, `[id]`), `MemberPicker`, `AreaCascadePicker` (district-only mode), `Sidebar` | F26–F31 | Screens |
| `database/phpmyadmin/add_p4_organisations.sql` | deploy | Same SQL plus the migration record |

## 3. Migration
`20261009170000_p4_organisations`:
- Additive: 3 tables and 2 nullable columns. No backfill.
- Rollback: `down.sql` removes seat-granted roles and organisation tasks first.
- Tested: the database refuses a second active President (error 1062) and accepts an invited one. Up → down → up works. The phpMyAdmin script was checked on a P3-state database: no pending migrations and zero schema diff afterwards.

## 4. Tests — before vs after

| | Test files | Tests | Typecheck | Build |
|---|---|---|---|---|
| After P3 | 29 | 363 | clean | OK |
| After P4 | 30 | **376 passed** (twice in a row on one database) | clean | OK |

New: `tests/p4/F26-F31-organisations-bodies.test.ts` (13 tests). They cover:
- validation;
- encryption at rest;
- blind tasks (an Operator never sees the other's task);
- activation needing both approvals and all three acceptances;
- send-back and resubmit;
- replacing a decliner;
- invite and request;
- handover;
- the database guard;
- remove and terms;
- term-end vacancy;
- exactly two nominees;
- accept and confirm;
- the full District → State → National chain with roles;
- the cascade on losing a lower seat;
- an expired member;
- a non-member's limited view.

No existing test was edited.

A browser run against the production build covered:
1. Registering through the form (district picker, certificate upload, three office bearers found by name search).
2. A nominee accepting on the organisation page.
3. An assigned Pune Operator opening the task, which shows the organisation, the office bearers with acceptance state, the certificate link and the organisation checklist.

## 5. Deployment (shared hosting, dev → test only)
1. Back up, then `npx prisma migrate deploy`, or import `add_p4_organisations.sql` after the P3 script.
2. Rebuild and restart.

There are no new environment keys. The existing `ID_PROOF_KEY` encrypts certificates, and the existing daily cron covers term ends.

## 6. Exit criteria (Phase Plan, P4)
- **Exactly 2 nominees per unit enforced** — ✅. Enforced under a row lock: a third nomination is refused, and "name exactly the number of free seats" (tested).
- **Access follows seat** — ✅. A confirmed seat grants the District, State or National team role tied to that seat. Losing the seat, or any seat below it, removes the role (tested through all three levels).
- **Deliverable "Organisation and body screens"** — ✅. Organisations list, register, organisation/body page with members, posts, nominations and confirmations, and the Operator task view.

## 7. Assumptions
- The applicant becomes a Member of the organisation if they are not one of the office bearers. If they name themselves as an office bearer, that post is accepted at once.
- A local organisation nominates to the District body of its own district.
- Bodies are created automatically on the first nomination and are ACTIVE at once (they are LadWani's own bodies; no registration certificate).
- Office bearers' terms are optional. With no end date set, the post does not lapse.
- Only local organisations take members by invitation or request; bodies take members only by confirmed seats.

## 8. Decisions needed
1. **OP-06:** confirm the old council structure is replaced (nothing of it exists in the code).
2. **Community groups vs organisations:** keep both, or later turn mandals into organisations? Doing that would rename CONVENER to PRESIDENT in existing rows and needs your yes.
3. **Body Presidents:** an Admin appoints each body's first President from its members. Should bodies elect instead? (Not in the workbook.)
