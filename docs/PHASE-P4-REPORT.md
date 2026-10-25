# Phase P4 — Organisations and LadWani bodies: delivery report

> **Database update (25 Oct 2026):** LadWani runs on **PostgreSQL** (Neon). This report was written when the work was on MySQL; its phpMyAdmin scripts and MySQL migrations were replaced by one PostgreSQL migration and `scripts/postgres/`. See [`POSTGRESQL-PORT.md`](POSTGRESQL-PORT.md); its steps replace the MySQL ones below.

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
1. ~~**OP-06**~~ — decided: the old council design is replaced by Taluka → District → State → Country (§9).
2. ~~**Community groups vs organisations**~~ — decided: groups are copied into organisations; the groups themselves are kept (§10).
3. ~~**Body Presidents**~~ — decided: an Admin, or an Operator of the area, appoints each LadWani organisation's President, Secretary and Chairman from its members (§9).

## 9. Follow-up: local (taluka) organisations and automatic promotion (your decisions)
**What you decided**
- Any user can create a **local organisation at taluka level**: organisation name, **start date**, **taluka** (State › District › Taluka from the location master), **city / town**, and its **current management body**: the President, Secretary and Chairman plus any other members. All of them are **registered members**, each accepts, and each member's town is shown from their profile. Registration number, address, purpose and certificate are now **optional**.
- It still goes live only after **two Operators** of the district approve it blind (as before) **and** the three office bearers accept.
- Every level has a **President, Secretary and Chairman**. **Chairman replaces Treasurer.**
- **Automatic promotion, at most 3 per unit:** once a taluka organisation is active, its President, Secretary and Chairman automatically become members of the **LadWani District organisation**. The same happens from District to **State**, and from State to **Country**. The person holds the seat while they hold the post. When a post changes hands (handover, term end, leaving, death), the seat moves to the new holder, and everything above that came from it ends.
- The District / State / Country organisations' own President, Secretary and Chairman are **appointed by an Admin, or an Operator of that district (District) or of a district in that state (State)**, from their members. Country level is Admin only. The person accepts, then goes up automatically.
- **OP-06:** the old council design is replaced by this chain.

**What changed**
- **Replaced:** the manual flow, where the President nominated exactly 2 people, the nominees accepted and the body confirmed. `api/organisations/[id]/nominations` and `api/body-seats/[id]` are **removed**. Both were built in this PR and never released.
- **Code:**
  - `src/lib/organisations.ts`: `OFFICES` = President / Secretary / Chairman; new `syncPromotions` (called on activation, on a post handover or appointment, and when a term ends) and `canAppointBodyOffice`; the bodies are named "LadWani District / State / Country Organisation — <area>".
  - `api/organisations` POST: the new fields; taluka instead of district; certificate optional; other body members.
  - `api/organisations/[id]`: town, start date, members' towns, "represented on", and `canAppoint`.
  - `members/[memberId]`: appointment on bodies by Admin / Operator; promotions synced after a handover.
  - The Operator's verification screen shows the start date, taluka, town and the whole management body, and the checklist wording changed accordingly.
  - UI: the new "Create a local organisation" form, the organisation page ("Represented on the …", "Appoint as…" for Admins / Operators), and the list labels.
- **Unchanged:**
  - The data-view role that comes with a seat (District / State / National team view).
  - The one-holder-per-post database guard.
  - Members inviting and requesting to join.
  - Terms, the daily term-end job, and expiry handling.
  - Community groups.
- **Migration** `20261024100000_p4_taluka_chain` (phpMyAdmin: `database/phpmyadmin/add_p4_taluka_chain.sql`):
  - Adds `organisations.startedOn` and `organisations.town`.
  - Renames the designation value TREASURER → CHAIRMAN in `organisation_members`. Those rows can exist only where this PR was already deployed to a test site.
  - Rollback: its `down.sql` (Chairman → Treasurer, drop the two columns).
  - Verified on the test database: the script applies, the one-holder guard follows the renamed value, `prisma migrate status` is up to date with zero schema difference, and `down.sql` restores Treasurer.
- **On a test site that already ran P4:**
  - Local organisations created before this change keep their district as their area. They still work, because promotion finds the district above any area.
  - Open nominations from the old flow are left as they are; they no longer do anything.
- **Tests:** `tests/p4/F26-F31-organisations-bodies.test.ts` (my own, from this PR) is rewritten for the new rules, 12 tests:
  - creation needs a start date (not in the future), a taluka and a town; the certificate is optional;
  - the whole body is invited, and the Operator sees the start date, town and body;
  - activation promotes exactly the 3 office bearers to the District organisation, with District team view;
  - a handover or term end moves the seat;
  - Admin or Operator appointment at District and State level, and Admin only at Country level; another district's Operator is refused;
  - promotion to State and Country with their team views;
  - losing the bottom post ends everything above, together with its access;
  - expiry; the non-member summary.

  **414 passed** twice in a row on a fresh database; typecheck clean; build OK.
- **Browser check (production build):** the "Create a local organisation" form shows Organisation name, Start date, State › District › Taluka (no village level), City / town, President / Secretary / Chairman and "Add a member", with no Treasurer.

**Then decided:** turning community groups (mandals) into organisations (§10).

## 10. Follow-up: community groups become local organisations (your decisions)
**What you decided:**
- Turn groups into organisations.
- Each copy is checked by two Operators.
- Keep both: the group is not changed.
- Map the roles and leave a missing post vacant.
- Work out the taluka where possible, and list the groups where it is not.

**How it works:** an Admin opens **Settings → Convert Groups to Organisations** (`/admin/group-conversion`). The screen lists every ACTIVE group with what its organisation will look like, and has **Copy N ready group(s)** and **Undo copies not yet active** buttons. Nothing is copied until the Admin presses Copy. Run it on test first.

| Group | Organisation |
|---|---|
| Name, description | Name, purpose |
| Convener / Secretary / Treasurer | President / Secretary / Chairman. If two people hold the same role, the earlier one gets the post and the other becomes a Member. A role nobody holds stays **vacant**. |
| Other roster members | Members |
| Place | **Taluka:** the group's own taluka (or city), or the taluka above its village. **Town:** the village / town, or the taluka's name. A group placed at district level or above, or with no place, is listed as "Needs a taluka" and not copied. Set its place on the group and copy again. |
| Created on | Start date |
| Status ACTIVE | A new organisation, PENDING_APPROVAL. Groups that are pending, rejected or inactive are not copied. |

- **People:** only registered members (active, with an active login) are carried over, as for any organisation. Profiles without a login are listed under "Not carried over".
- **Who applies:** the convener is the applicant and is President at once, as when someone names themselves on the form. Everyone else is invited, is notified, and accepts or declines on the Organisations page. With no convener, the Admin running the copy is the applicant.
- **Checks:** the usual two-Operator round of the district (F26). The organisation becomes ACTIVE once both Operators approve and all three posts are filled and accepted. Its office bearers then move up to the District organisation (F28).
- **Vacant post:** the President or Secretary (or an Admin) hands the post to an active member, who accepts. **Fixed on the way:** accepting a hand-over did not re-check activation, so an approved organisation whose last post was filled this way would have stayed pending. It now activates.
- **Undo:** removes every copy that is not ACTIVE yet, with its invitations and verification tasks. An ACTIVE copy is kept: it is a real organisation by then, with seats on the District body, and is ended like any other. Groups are never touched. A removed copy can be made again.
- **Safe to run twice:** each group is copied at most once (`organisations.sourceGroupId` is unique).
- **Audited:** `organisation.convert_from_group` (with vacant posts and the people not carried over) and `organisation.convert_from_group.undo`.
- **Migration** `20261025090000_group_conversion` (+ `down.sql`; phpMyAdmin: `add_group_conversion.sql`) adds one nullable column `organisations.sourceGroupId` with a unique index, and no data changes. **Rollback:** press Undo first, then `down.sql` drops the index and the column. Checked on a scratch database: deploy → `down.sql` → phpMyAdmin script → `prisma migrate status` up to date, `migrate diff` no difference.
- **Tests added:** `tests/p4/F26-groups-to-organisations.test.ts`, 5 tests:
  - Admin only.
  - The preview maps roles, derives taluka and town from a village, uses the creation date, skips a profile without a login, lists district-level and unplaced groups, and ignores a pending group.
  - Apply creates a pending organisation (the convener is President; the others are invited and notified), two Operator tasks, and an audit entry. The group is unchanged, and a second run copies nothing.
  - A vacant Chairman: approved but not active until the post is taken by hand-over, then active with 3 seats on the District body.
  - Undo removes the pending copy and keeps the active one and every group.

  No existing test changed. **427 passed**, twice in a row on a fresh database; typecheck clean; build OK.
- **Browser check (production build):** Admin → Settings → Convert Groups to Organisations shows a sample group: "Ready · Taluka: Daskroi · Town: Aslali", with President and Secretary mapped and "Chairman: vacant". After Copy it shows "Copied" with a link that opens the new organisation. A member calling the API gets 403.
- **Differs from what I offered:** I said "an Admin/Operator" fills a vacant post. In fact an Admin or the organisation's own President / Secretary fills it. Operators appoint posts only on the LadWani District / State bodies (your earlier decision), so I did not widen that.
