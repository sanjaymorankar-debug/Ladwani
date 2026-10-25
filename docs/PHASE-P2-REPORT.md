# Phase P2 — Family and Karta: delivery report

> **Database update (25 Oct 2026):** LadWani runs on **PostgreSQL** (Neon). This report was written when the work was on MySQL; its phpMyAdmin scripts and MySQL migrations were replaced by one PostgreSQL migration and `scripts/postgres/`. See [`POSTGRESQL-PORT.md`](POSTGRESQL-PORT.md); its steps replace the MySQL ones below.

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
1. ~~**Admin review of a Karta change.**~~ — decided: keep it (§9).
2. ~~**Review queue for marking Expired.**~~ — decided: the review stays, and a death certificate is added (§10).
3. ~~**Reject without a reason (F15)**~~ — decided: every rejection gives a reason (§11).
4. **"Removed from friend lists" (F12)** waits for P5, because no friend/connection table exists yet.

## 9. Follow-up: the Admin review of Karta hand-overs stays (your decision)
- **Rule:** a voluntary hand-over goes: the Karta nominates → the nominee accepts → an Admin reviews → the change applies. The Admin step comes from the existing approval rule `family.karta.change` (§28), which stays on. The workbook F16 has no Admin step; this is a deliberate difference.
- **Unchanged:** a vacancy (the Karta has died or left) is still confirmed by an Operator of the family's district or an Admin, not by this review.
- **No code, migration or data change.** This was already the behaviour.
- **Covered by an existing test:** `F16 voluntary: the nominee must accept; then the (existing) Admin review; the old Karta becomes a normal member` in `tests/p2/F14-F18-requests-transfer-claims.test.ts` checks that nothing changes until an Admin approves.
- **Correction to §8:** the earlier text said this rule could be switched in an "Approval Rules" screen. That screen does not exist: the Settings page links to it, but the link was already broken before this PR. Changing an approval rule needs a small migration.

## 10. Follow-up: Expired keeps its review and gains a death certificate (your decision)
- **Your answer:** marking a member Expired is still reviewed, and the request carries the death certificate "after go-live".
- **Review:** unchanged. A Karta's request goes to the existing §28 review (`member.mark_deceased`); staff still record it directly. The workbook F12 has no review step; this is a deliberate difference.
- **Certificate:** the "Mark as deceased" form now has a file field (JPG, PNG, WebP or PDF, up to 5 MB). The file is checked by its content, stored **encrypted** in `UPLOAD_DIR` (like the ID proofs), and travels with the review. When the request is approved it is kept on the member (`members.deathCertKey` / `deathCertMime`).
- **Who can open it:** Admins and Operators only, from the review screen ("View death certificate") via `/api/members/[id]/death-certificate`. Every view is written to the audit log. The Karta who uploaded it, and other members, get "not found".
- **"After go-live":** the setting `deceased.certificate_required` decides whether the certificate is required. It is **off** now, so existing deaths can be recorded without one during data loading (a certificate can still be attached). At go-live it is switched on with `scripts/postgres/set-death-certificate-required-on.sql` (P6 runbook step 2). From then on a request without a certificate is refused ("Attach the death certificate"), and the form marks the field as required.
- **Migration** `20261024110000_death_certificate` (+ `down.sql`; phpMyAdmin: `add_death_certificate.sql`). It adds two nullable columns to `members` and the setting (off). It does not change existing data. **Rollback:** `down.sql` deletes the setting and drops the two columns; certificate files already stored stay in the uploads folder (prefix `death-certificates/`) until deleted by hand. Checked on a scratch database: deploy → `down.sql` → phpMyAdmin script → `prisma migrate status` up to date, `migrate diff` no difference.
- **Tests added** in `tests/p2/F09-F13-family-karta.test.ts`: `F12 while the setting is off, a request without a certificate still goes through` and `F12 once switched on, the certificate is required; it is stored encrypted, travels with the review, and lands on the member when approved` (no file → 400; a non-image → 400; with a PNG → 202, not stored in the clear; the Karta cannot open it, an Admin can and the view is audited; after approval it is on the member). No existing test changed. **416 passed**, twice in a row on a fresh database; typecheck clean; build OK.
- **Browser check (production build):**
  - Setting off: the form shows "Death certificate (optional)"; the Karta submits with a PNG → "Submitted for review"; the Karta opening the file gets 404; an Operator sees "View death certificate" on the review screen, and it opens (200, image/png).
  - Setting on: the form shows "(required)"; submitting without a file shows "Attach the death certificate", and the API returns 400.
  - A production build without `ID_PROOF_KEY` refuses to store the file (503, "File storage is not configured"), as for ID proofs. The key is already in the P6 runbook step 3.
- **Finding (from before this PR) — fixed on your decision (§12):** `GET /api/approvals/[id]` returned any request to any signed-in user who knew its id.

## 11. Follow-up: every rejection gives a reason (your decision)
- **Rule:** when someone reviewing a request turns it down, the API now refuses to do so without a reason (blank or spaces count as none). The reason is stored and sent to the person, as before.

| Where | Action | Before |
|---|---|---|
| Family join request (F15) | Karta rejects | reason optional in the API (the inbox already asked) |
| Review queue §28 (`/api/approvals/[id]`): Karta change, Expired, spouse link, … | reject, **send back** | optional |
| Profile claim (F17) | Karta rejects | optional, and the inbox did not ask |
| Organisation join request (F27) | President / Secretary rejects | optional in the API (the page already asked) |
| Post moderation (F36) | reject | optional; an empty prompt was sent |
| Already required | Operator verification reject / send back (F04–F07), tree-link reject (F22), data-deletion reject (F40) | unchanged |

- **Not included on purpose:** a person declining something offered *to them*: an invitation to a family, a Karta or office nomination, a friend request, a marriage interest. That is their own choice, and asking them to explain would be intrusive (and for the bureau, unkind). Hiding a live post keeps its optional note.
- **Screens:** the claim "Reject" button now asks for the reason; post moderation stops if the reason prompt is empty; the review screen labels the note "required to reject or send back" and checks it before sending.
- **No migration, no data change.**
- **Existing test changed (your permission):** `TC-FAM-009` in `tests/uat/family.test.ts` now sends a note (`'Not a member of this family'`) with its rejection. Nothing else in it changed.
- **Tests added / extended (all mine, in this PR):**
  - `F15 every rejection gives a reason …; someone declining an invitation they received need not` (join request without / with blank reason → 400 and still pending; invitee declines without one → 200; review queue reject and send back without a note → 400).
  - `F17 rejecting a claim gives a reason`.
  - In F27, a President's reject without a reason → 400.
  - In F36, a moderator's reject without a reason → 400.

  **429 passed**, twice in a row on a fresh database; typecheck clean; build OK.

## 12. Follow-up: one review request is readable by staff only (your decision)
- **Before:** `GET /api/approvals/[id]` returned a whole request (its old and new values, e.g. a death certificate's file key or a changed name) to any signed-in user who knew the id.
- **Now:** only Admins and Operators get it; anyone else gets 403. Your words were "staff", so the person who sent the request cannot open it this way either. Members still see their own requests in the list (`GET /api/approvals?mine`), which was already limited to what they submitted. The only screen that opens a single request is the Admin review screen, so no member screen changes.
- **No migration, no data change.** No existing test read a single request.
- **Checks added** to my own test `F12 once switched on, the certificate is required …` in `tests/p2/F09-F13-family-karta.test.ts`: the Karta who sent the request gets 403 and an Admin gets 200. **432 passed**, twice in a row on a fresh database; typecheck clean; build OK.
