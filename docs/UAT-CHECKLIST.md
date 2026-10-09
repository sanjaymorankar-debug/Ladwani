# LadWani — UAT checklist (all 40 workbook flows)

Run this on the **test** site after the deployment steps in `PHASE-P6-REPORT.md`.

**Accounts:**
- The UAT seed accounts (`npm run db:seed:uat`): password `TestPass@123`, emails `<role>NN@uat.test`. **Test database only.**
- Admins sign in with the 6-digit code sent to their email (2FA).

Tick each line and note anything unexpected. The automated test for each flow is named by its Flow ID under `tests/p*/`.

## P0 — Roles and scope
- [ ] F32 Admin assigns Operator / District / State team roles mapped to an area. Removing the last-but-one Admin is refused.
- [ ] F33 A District team member sees only their district in Team Directory; a plain member is sent away.

## P1 — Registration and approval
- [ ] F01 Register with gender, DOB (18+) and Mul Gaon; email code; the account is DRAFT.
- [ ] F02 Fill the profile until 100% (addresses, social status, education).
- [ ] F03 Upload an ID proof and self-signed copy (Aadhaar: last 4 digits only); accept the declaration with an emailed code.
- [ ] F04/F05 Two different Pune Operators each see only their own task and decide with the checklist.
- [ ] F06 Both approve → ACTIVE. One sends back → correction → resubmit → new round.
- [ ] F07 The Admin's Approval Monitor shows both decisions; reassign and reopen work.
- [ ] F08 An ACTIVE member's name or DOB change waits for two Operators; the old value stays live.

## P2 — Family and Karta
- [ ] F09 Create a family (Mul Gaon picker; duplicate warning on the same surname + Mul Gaon + Gotra).
- [ ] F10 Add a member; a "Daughter" who is male is refused; duplicate name + DOB is refused.
- [ ] F11 Remove a member with a reason; their other family is unaffected.
- [ ] F12 Mark a member Expired (shown as "Late"). If they were Karta, the family becomes Karta-vacant.
- [ ] F13 Add a new-born: choose father and mother; the name may be "Baby of …".
- [ ] F14/F15 A non-member requests to join; the Karta corrects the role and accepts, or rejects with a reason.
- [ ] F16 Karta hand-over (the nominee accepts) and vacancy (the district Operator confirms).
- [ ] F17 A new registrant finds their Karta-made profile, says "This is me", and the Karta confirms the merge.
- [ ] F18 The district Operator changes a member's role with a remark.

## P3 — Family tree
- [ ] F19 Tree builder: add parents, grandparents, great-grandparents (a 4th level is refused).
- [ ] F20 Spouse side: add your spouse's parents.
- [ ] F21 Add a sibling at any level; tick "has own family on site".
- [ ] F22 Link the sibling to the person in the other family; resolve any difference; the other Karta accepts → one person in both trees.
- [ ] F23 Record a marriage (date, legal age); the spouse's family Karta gets a "Marriage" request.
- [ ] F24 Someone in two families sees "My Families" with a role in each.
- [ ] F25 Tree: zoom, collapse, person card, jump icon, Print / Save as PDF. Someone from an unrelated family gets "not found".

## P4 — Organisations
- [ ] F26 Register an organisation with a certificate; three office bearers accept; two Operators approve → ACTIVE.
- [ ] F27 Invite / accept, request / approve, hand the President post over (the new holder accepts), set a term.
- [ ] F28–F30 Nominate exactly 2 to the District body, then 2 to the State body, then 2 to the National body; each confirmed. The seat gives the team view.
- [ ] F31 A nominee resigns → their seats above end and their access goes; the vacancy is alerted.

## P5 — Social and bureau
- [ ] F34 Family album photo with "Family" visibility; an outsider cannot open it; three reports hide it.
- [ ] F35 Find a friend by Gotra; request / accept; make a list; removing the friend removes them from the list.
- [ ] F36 Post to your family (instant) and to your district (waits for the District body President).
- [ ] F37 Bureau: a 20-year-old man cannot list; turning the listing on tells the Karta.
- [ ] F38 Search by district / Gotra (same-Gotra flagged); interest → accept (also by the Karta) → contact shown.

## P6 — Reports and data rights
- [ ] F39 A District team member's Reports show only their district; CSV opens in Excel; the Admin sees the Operator SLA.
- [ ] F40 Settings → Download My Data. Request deletion → Admin → Data requests → Anonymise; the person stays in trees as "Former member". Search consents by Person ID. Audit Logs → "ID proof only".

## Sign-off
| Area | Tester | Date | Result |
|---|---|---|---|
| P0–P1 | | | |
| P2–P3 | | | |
| P4 | | | |
| P5 | | | |
| P6 + backup / restore drill | | | |
