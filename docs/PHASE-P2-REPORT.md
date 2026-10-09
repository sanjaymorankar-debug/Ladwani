# Phase P2 — Family and Karta: delivery report

Prepared 9 Oct 2026. Branch `claude/intelligent-ritchie-8b37zt` (same PR as
P0 and P1). The stack is unchanged (Next.js 14 + Prisma + MySQL).

## 1. Gap analysis (Phase = P2, flows F09–F18)

| Flow | Status before | Existing files / tables | What was missing or wrong | Change made | Risk to existing data |
|---|---|---|---|---|---|
| F09 Create family, become Karta | PARTIAL | `api/families`, `family/setup`, `families`, `family_members` | Anyone already in **any** family was blocked (the workbook allows member of many, Karta of one). No duplicate check. Mul Gaon was free text. Nothing in the DB stopped two Kartas in one family. | Block only "already Karta elsewhere". Mul Gaon from the location master (FamilyArea). Duplicate warning on surname + Mul Gaon + Gotra, with "this is a different family" confirm. Rule 2 enforced by the database (generated column + unique index). Audit. | Additive. The new unique index fails safely if live data already has two active Kartas in one family — run the pre-check first. |
| F10 Karta adds a member | PARTIAL | `api/families/[id]/members`, `join-requests` (KARTA_INVITE), `members/new` page | No gender/role check ("Daughter" could be male). The duplicate check was name + DOB only. The role was not kept on the membership. An existing user in another family could not be invited. | Gender/role check against the relationship master. Duplicate check also on name + father's name. `relationshipRole` and `relativeToMemberId` on the membership. Invite works across families. | None. |
| F11 Karta removes a member | MISSING | — | No removal at all. | `DELETE api/families/[id]/members/[memberId]` with reason (wrongly added / moved out / duplicate). Ends only this membership (status REMOVED or ENDED, kept as history). Karta cannot remove self. Removed member is alerted. | None. Rows are closed, never deleted. |
| F12 Mark member Expired | PARTIAL | `api/members/[id]/deceased`, `approvals` (§28 gate) | Only the member's manager could mark them, so a Karta could not mark a member with a login. Other Kartas were not told. A dead Karta left the family headless. | Any Karta of a family the person belongs to may mark them. Date checks (not future, not before DOB) kept. Login is disabled and matrimony hidden (existing). Other Kartas alerted. A dead Karta triggers F16. "Late" shown on the family page. | None. **Kept:** the existing §28 review queue still applies to non-staff (see decisions). |
| F13 Add new-born | MISSING | — | — | `POST api/families/[id]/newborn` and the family-page panel. Picks father and mother from the family (gender and age checked). Name optional ("Baby of <mother>"). No login, no ID proof. Linked as son/daughter of both parents. Family members alerted. | None. |
| F14 Search and request to join | PARTIAL | `api/families` GET, `join-requests` | Search returned full family rows to anyone. Search only covered the name. Members of another family could not ask. One-open-request was enforced by a unique index that also blocked a second rejection. | Search by family name, Karta name, Mul Gaon, Gotra, district → limited summary only. Non-members see a summary page and "Request to join" with role + relative. One open request per family, enforced in code. The Karta is alerted. | Index swap (the new index is created before the old one is dropped). |
| F15 Karta accepts / rejects | PARTIAL | `join-requests/[reqId]`, `JoinRequestsInbox` | The Karta could not correct the role. Requests never expired. Rejection had no reason. | Role correction on accept. Membership and links created in both directions; earlier membership re-activated. The inbox asks for a reason on reject (the API still accepts none — see decisions). Expiry after `family.join_request_expiry_days` (Setting, default 30), checked on read and by the daily cron. Requester alerted. | None. |
| F16 Karta transfer / succession | PARTIAL | `api/families/[id]/karta`, `ChangeKartaPanel`, `approvals` (Karta change) | The Karta change went straight to Admin review: the nominee never accepted. No vacancy handling. | **Voluntary:** nomination → nominee accepts/declines → the existing Admin review → applied. **Vacancy:** the family becomes KARTA_VACANT; the eldest active adult with a login is suggested; an Operator of the family's district (or Admin) confirms. The old Karta becomes a normal member. All members alerted. SLA alert to District team + Admin via the daily cron (once). | Additive enum value. **Kept:** the Admin review (see decisions). |
| F17 Claim a non-login profile | MISSING | — | — | `api/claims`: a registrant sees matching account-less profiles (name + DOB, or mobile) in a limited view and says "This is me" on the verification page. The Karta confirms or rejects in the family inbox. On confirm the records merge: the Karta-created record gets the login, keeps every family link, and blanks are filled from the registration. The registration record is retired (soft-deleted). The user's own 2-operator approval is unaffected. | Merge is one transaction and audited. Only runs after the Karta confirms. |
| F18 Operator changes a member's role | MISSING | — | — | `PATCH api/families/[id]/members/[memberId]`: an Operator of the family's district (mandatory remark) or the Karta. Gender check applies. Audited old/new. Karta and member alerted. | None. |

### a) Found in code, not in the workbook (left as they are)
- Family photos and the family registration number format.
- The generic `approvals` queue for family.create / Karta change / deceased.
- Account-less member invitations (`members/[id]/invite`).

### b) Schema differences (now resolved additively)
- `family_members` gains `relationshipRole`, `relativeToMemberId`, `status` and the generated `kartaGuard`.
- `families.status` gains KARTA_VACANT.
- The relationship master (`relationship_types`) gains `localName`, `generation`, `side` and `linkType`, plus the missing Relationships-sheet rows. Existing codes are kept.
- New tables: `karta_transfers`, `profile_claims`.

### c) Role differences
- F18 allows the Karta as well as the Operator, because the Karta already edits roles when accepting a request (F15).

### d) Open points touched
- None of the OP list blocks P2.
- SMS is still the LOG driver (OP-10), so alerts go in-app and by email.

### e) Security findings (report only)
- Family search used to return full family rows to any signed-in user. Fixed under F14 (summary only).
- No new findings.

## 2. Change list

| File | Flow | Why |
|---|---|---|
| `prisma/schema.prisma`, migration `20261009150000_p2_family_karta` (+ `down.sql`) | F09–F18 | Columns, enum value, index swap, master rows, 2 tables, 1 setting |
| `src/lib/family-rules.ts` (new) | F09, F12, F15, F16 | Karta-of-one-family check, role/gender check, vacancy, eldest-adult suggestion, expiry, daily jobs |
| `src/lib/claims.ts` (new) | F17 | Match and merge |
| `src/lib/cron.ts` (new), `api/cron/daily` (new), `api/cron/approval-sla` (refactor only) | F15, F16 | Shared cron-secret guard; daily housekeeping |
| `src/lib/approvals.ts` | F16 | Karta change sets membership roles, clears KARTA_VACANT |
| `api/families` | F09, F14 | Karta-of-one rule, Mul Gaon, duplicate check, limited search |
| `api/families/[id]/members`, `.../members/[memberId]` (new) | F10, F11, F18 | Role/gender, duplicate, removal, role change |
| `api/families/[id]/newborn` (new) | F13 | New-born |
| `api/families/[id]/join-requests`, `.../[reqId]` | F14, F15 | Cross-family requests, role correction, expiry, reasons, claims list |
| `api/families/[id]/karta`, `api/karta-transfers` (new) | F16 | Nomination / accept / decline / cancel / vacancy confirm |
| `api/members/[id]/deceased`, `api/approvals/[id]` | F12, F16 | Karta authority; after-death hooks; close transfer after review |
| `api/claims` (new) | F17 | Claim and confirm |
| UI: `family/[id]` page, `family/setup`, `verification`, `dashboard`, `admin/verification`; components `RelationshipSelect`, `MemberManageActions`, `NewbornPanel`, `JoinFamilyPanel`, `VacancyConfirmList`, `JoinRequestsInbox` | F09–F18 | Screens for the above |
| `database/phpmyadmin/add_p2_family_karta.sql` | deploy | Same SQL with pre-checks and the migration record |
| `.env.example` | deploy | Daily cron line |

## 3. Migration
`20261009150000_p2_family_karta`, one migration:
- Adds columns.
- Backfills from existing data:
  - ended memberships get status ENDED/REMOVED;
  - the Karta's membership gets role `karta`;
  - other roles are copied from the existing `member_relationships` rows.
- Enum value, index swap, master rows (`INSERT IGNORE`), 2 tables, 1 setting.
- **No existing value is changed or deleted.**

Rollback: `down.sql`.
- It drops the 2 tables and the new master rows, and restores the old join-request index.
- It parks KARTA_VACANT families as ACTIVE before shrinking the enum.
- Tested: up → down → up on a seeded database, and the phpMyAdmin script on a P1-state database ("No pending migrations", zero schema diff afterwards).

**Note:** restoring the old unique join-request index fails if two rows now share (family, member, status, direction), for example two REJECTED requests. `down.sql` says how to clear them first.

## 4. Tests — before vs after

| | Test files | Tests | Typecheck | Build |
|---|---|---|---|---|
| After P1 | 25 | 314 | clean | OK |
| After P2 | 27 | **347 passed** | clean | OK |

The new tests are `tests/p2/F09-F13-family-karta.test.ts` (17) and `tests/p2/F14-F18-requests-transfer-claims.test.ts` (16), named by Flow ID. No existing test was edited for P2.

A browser run against the production build covered:
1. The Karta adding a new-born from the family page.
2. A non-member seeing only the summary and sending a join request with a role.
3. The Karta approving from the inbox.
4. The Karta nominating a member, and the nominee accepting (the hand-over then waits for Admin review).

## 5. Deployment (shared hosting, dev → test only)
1. **Pre-check** on the target database. The two SELECTs at the top of `add_p2_family_karta.sql` must return no rows.
2. **Migrate.** Either run `npx prisma migrate deploy`, or import `add_p2_family_karta.sql` in phpMyAdmin after the P1 script. Back up first.
3. **Daily cron** (hPanel → Advanced → Cron Jobs), once a day:
   `curl -fsS -H "x-cron-secret: <CRON_SECRET>" https://<site>/api/cron/daily`
4. **Rebuild and restart** the Node app.

No new environment keys.

## 6. Exit criteria (Phase Plan, P2)
- **One Karta per family enforced** — ✅. The database refuses a second active Karta (unique index on a generated column, tested). "Karta of only one family" is enforced in every path that makes a Karta (create, transfer, vacancy).
- **Duplicates blocked** — ✅.
  - Families: the surname + Mul Gaon + Gotra warning needs an explicit confirm.
  - Persons: name + DOB and name + father's name are refused.
  - Profiles: the claim merge turns two records into one.
  - Join requests: one open request per family.

## 7. Assumptions
- **Vacancy SLA** reuses `approval.sla_days` (default 7) rather than adding another setting.
- **The suggested Karta** is the eldest **active adult with a login**, because F16 requires a user.
- **A claim** matches on name + DOB, **or** on mobile (the workbook lists all three; requiring all three would miss most Karta-created profiles, which rarely have a mobile).
- **On merge** the Karta-created record keeps its values; registration data only fills blanks.
- **A removal reason** of "wrongly added" or "duplicate" gives status REMOVED; "moved out" gives ENDED.

## 8. Decisions needed
1. **Admin review of a Karta change.**
   - Today: after the nominee accepts, the existing Admin review still applies.
   - The workbook F16 has no Admin step for a voluntary hand-over.
   - Remove the review? This is a switch in the Approval Rules screen (`family.karta.change`); no code change is needed.
2. **Review queue for marking Expired.**
   - Today: a non-staff Karta's request goes to the existing §28 review before it takes effect.
   - The workbook F12 makes it immediate.
   - Remove the gate? Same switch, `member.mark_deceased`.
3. **Reject without a reason (F15).** The workbook says reject with a reason. The inbox now asks for one, but the API still accepts a rejection without it, because the existing test TC-FAM-009 rejects without a note and expects success. Enforce it in the API? That test would then need a note added.
4. **"Removed from friend lists" (F12)** waits for P5, because no friend/connection table exists yet.
