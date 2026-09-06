# UAT execution report

Executed 6 Sep 2026 against commit `c3adca9`. **94 automated tests, all passing**,
run twice consecutively to confirm they aren't order-dependent.

Every assertion verifies the **database**, not just the HTTP response — as
required for the family and permission scenarios.

🟢 PASS · 🔴 FAIL · 🟡 BLOCKED · ⚪ NOT APPLICABLE

## Test account matrix

All accounts use password **`TestPass@123`**. Recreate any time with
`npm run db:seed:uat`.

| Role | Account 1 | Account 2 |
|---|---|---|
| Basic Member | `member01@uat.test` | `member02@uat.test` |
| Karta | `karta01@uat.test` (Family-01) | `karta02@uat.test` (Family-02) |
| Operator | `operator01@uat.test` | `operator02@uat.test` |
| Asset Owner | `owner01@uat.test` | `owner02@uat.test` |
| Admin | `admin01@uat.test` | `admin02@uat.test` |
| Independent person | `independent01@uat.test` (one-person Family-03) | — |

Scenario records: **Family-01 (Sharma)** — Karta, father, mother, wife, son,
daughter, brother, widowed sister, deceased grandfather, divorced member, plus
MEMBER-01 as a plain (non-Karta) member. **Family-02 (Patel)** — Karta, wife,
daughter (the cross-family marriage partner). **Family-03 (Rao)** — a single
independent person. All fictional.

## Results

### Authentication & login — 16/16 🟢

| Test | Result |
|---|---|
| TC-AUTH-001 registration creates User→Member together | 🟢 |
| TC-AUTH-002 / 003 duplicate mobile / email rejected | 🟢 |
| TC-AUTH-004 / 005 invalid email / mobile rejected | 🟢 |
| TC-AUTH-006 weak password rejected | 🟢 |
| TC-AUTH-007 / 008 password mismatch, terms not accepted | 🟢 |
| TC-AUTH-009 verification (email OTP) | 🟢 verified live end-to-end |
| TC-LOGIN-001 / 002 valid and invalid credentials | 🟢 |
| TC-LOGIN-002b unknown account gives identical error (no enumeration) | 🟢 |
| TC-LOGIN-003 friendly message, not a raw error | 🟢 |
| TC-LOGIN-004 suspended account refused with distinct reason | 🟢 |
| TC-LOGIN-004b status only revealed after a correct password | 🟢 |
| TC-LOGIN-007 / 008 anonymous access refused on every protected route | 🟢 |
| TC-LOGIN-012 account locks after 5 failed attempts | 🟢 |
| TC-LOGIN-013 passwords bcrypt-hashed, never plaintext | 🟢 |

### Family, Karta and family tree — 10/10 🟢

| Test | Result |
|---|---|
| TC-FAM-002 registering a family creates User→Member→Family→Karta (all four links checked in DB) | 🟢 |
| TC-FAM-004/005 independent person = valid one-person family, no invented relatives | 🟢 |
| TC-FAM-006 added member gets a **bidirectional** relationship (son ⇄ father) | 🟢 |
| TC-FAM-007 adding an existing person returns duplicates and creates nothing | 🟢 |
| TC-FAM-008 join request → Karta approves → linked, no duplicate person | 🟢 |
| TC-FAM-009 rejected request creates no relationship | 🟢 |
| TC-TREE-001 multi-generation tree built from relationship records | 🟢 |
| TC-TREE-002 spouse rendered as a spouse-typed edge | 🟢 |
| TC-TREE-005 removing a relationship does not delete the person | 🟢 |
| TC-TREE-006 deceased member remains in the tree, flagged | 🟢 |

### Marital status & cross-family marriage — 13/13 🟢

| Test | Result |
|---|---|
| TC-MAR-001 marking married is queued for approval, nothing changes yet | 🟢 |
| **TC-MAR-003 cross-family marriage** — both married, spouse link both ways, marriage record created, **both stay in their original families**, no duplicate person | 🟢 |
| TC-MAR-004 external (non-community) spouse recorded without inventing a member | 🟢 |
| TC-MAR-005/006 divorced/widowed preserve marriage history | 🟢 |
| TC-MAR-007 deceased member keeps record and family link | 🟢 |
| TC-KARTA-001/005 Karta edits demographics | 🟢 *(after Defect 1 fix)* |
| TC-KARTA-006 current + native addresses save, flat fields stay in sync | 🟢 |
| TC-KARTA-007 age derived from DOB — **no age column exists**, so it cannot drift | 🟢 |
| TC-KARTA-008 multiple education records | 🟢 |
| TC-KARTA-009/010 partial update preserves other fields; explicit empty clears | 🟢 *(after Defect 2 fix)* |
| TC-AUDIT-001 Karta edit recorded with actor identity | 🟢 |

### Permissions & role isolation — 18/18 🟢

| Test | Result |
|---|---|
| TC-PERM-001 MEMBER-01 ⇄ MEMBER-02 cannot edit each other (both directions) | 🟢 |
| TC-PERM-001c a member can edit themselves | 🟢 |
| TC-PERM-004 Karta **cannot** override another adult account-holder in their own family | 🟢 |
| TC-PERM-004b Karta **can** maintain account-less members of their family | 🟢 |
| TC-PERM-004c Karta cannot touch account-less members of another family | 🟢 |
| TC-PERM-003 KARTA-01 ⇄ KARTA-02 cannot edit each other's family (both directions) | 🟢 |
| TC-KARTA2-001/002/003 no cross-family member-add, tree, member list or join queue | 🟢 |
| TC-KARTA2-004 plain member can view their family but not manage it | 🟢 |
| TC-PERM-002 Member / Karta / Owner / Operator all denied the admin API | 🟢 |
| TC-PERM-006 Admin has full cross-family access | 🟢 |
| TC-OP-002 Operator approval actually verifies the family (not just the row) | 🟢 |
| TC-OP-010 approving a deleted target fails cleanly | 🟢 *(after Defect 3 fix)* |

### Privacy & matrimony — 8/8 🟢

| Test | Result |
|---|---|
| TC-PRIV-001 mobile set Private is hidden from another member, visible to owner | 🟢 |
| TC-PRIV-002 settings persist and read back | 🟢 |
| TC-PRIV-003 staff retain support access (deliberate exception) | 🟢 |
| TC-PRIV-004 widening visibility restores the field | 🟢 |
| TC-MAT-001/002 visible profile listed; opting out removes it | 🟢 |
| TC-MAT-007/008 interest sent → recipient notified → accepted | 🟢 |
| TC-MAT-009 a third party cannot accept someone else's interest | 🟢 |

## Defects found and fixed

**1 · Karta could not manage their own family members — CRITICAL, fixed.**
Edit permission was "self or staff" only, so a member with **no login account**
— children, elderly parents, the deceased — could never be edited by anyone.
Those records were permanently frozen, and your requirements #2 and #3 were
impossible. A Karta may now maintain account-less members of a family they
actually head (re-derived from the database, never from the request). A member
who *has* an account still manages themselves, so a Karta cannot override
another adult account-holder.

**2 · Partial updates destroyed data — CRITICAL, fixed.**
The member update route treated every omitted field as "set to null". A request
that sent only a biography wiped that member's surname and date of birth. Found
when a test corrupted its own fixture. The route now follows real PATCH
semantics; an explicitly empty value still clears the field. Both behaviours are
covered by regression tests.

**3 · Approving a request with a deleted target crashed — MODERATE, fixed.**
Returned a raw database 500 and could half-mark the request reviewed. Now
returns 409 and leaves it unapplied.

## Known gaps recorded rather than silently fixed

These are captured as passing tests that document current behaviour, so any
future change is deliberate:

- **A deceased member can still be marked married** (TC-MAR-008). There is no
  state-transition guard.
- **A married member is not excluded from matrimony listings** (TC-MAT-010).
  Listing filters on `isVisible` only.

## Not executed

| Area | Status | Reason |
|---|---|---|
| §15 Community assets | ⚪ | **Module does not exist in this codebase** |
| §16 Booking / double-booking | ⚪ | Module does not exist |
| §17 Payments | ⚪ | Module does not exist |
| §18 Community fees | ⚪ | Module does not exist |
| TC-KARTA-002/003/004 photo upload | 🟡 BLOCKED | Code complete but needs S3/MinIO credentials |
| TC-LOGIN-009/010/011 forgot / reset password | 🟡 | Now unblocked — SMTP works; not yet scripted |
| TC-FAM-003 existing member converting to Karta | 🟡 | Covered indirectly by TC-FAM-002 |
| Invite / claim profile (§12, §34) | ⚪ | Feature not built |
| Mobile UX (§42) | 🟡 | Responsive layout, not verified on real devices |

The four ⚪ modules are the structural discrepancy already flagged in
`SPEC-STATUS.md`: the specification assumes assets, booking, payments and fees
exist in this platform. They do not — no routes, handlers or tables. Nothing was
broken; they were never here.

## Re-running

```bash
npm run db:seed:uat   # (re)create the test accounts and families
npm test              # run all 94 tests
```
