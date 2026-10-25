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
- [ ] F01 Register with gender, DOB (18+), Mul Gaon and a mobile number (required); email code; the account is DRAFT. Leaving the mobile empty is refused.
- [ ] F02 Fill the profile until 100% (addresses, social status, education).
- [ ] F03 Upload an ID proof and self-signed copy (Aadhaar: last 4 digits only); accept the declaration with an emailed code.
- [ ] F04/F05 Two different Pune Operators each see only their own task and decide with the checklist.
- [ ] F06 Both approve → ACTIVE. One sends back → correction → resubmit → new round.
- [ ] F07 The Admin's Approval Monitor shows both decisions; reassign and reopen work.
- [ ] F08 An ACTIVE member's name or DOB change waits for two Operators; the old value stays live. An address change saves at once.

## P2 — Family and Karta
- [ ] F09 Create a family (Mul Gaon picker; duplicate warning on the same surname + Mul Gaon + Gotra).
- [ ] F10 Add a member; a "Daughter" who is male is refused; duplicate name + DOB is refused.
- [ ] F11 Remove a member with a reason; their other family is unaffected.
- [ ] F12 Mark a member Expired (shown as "Late"). If they were Karta, the family becomes Karta-vacant.
- [ ] F12 Attach a death certificate to the request. The Operator/Admin opens it from the review screen; the Karta cannot open it. (On test the certificate is optional; to try the go-live rule, run `scripts/postgres/set-death-certificate-required-on.sql` and check that a request without one is refused.)
- [ ] F13 Add a new-born: choose father and mother; the name may be "Baby of …".
- [ ] F14/F15 A non-member requests to join; the Karta corrects the role and accepts, or rejects with a reason.
- [ ] F15/F17/F27/F36 Try to reject a join request, a claim, an organisation join request and a post without a reason: each is refused until a reason is given. Declining an invitation needs none.
- [ ] F16 Karta hand-over (the nominee accepts, then an Admin approves) and vacancy (the district Operator confirms).
- [ ] F17 A new registrant finds their Karta-made profile, says "This is me", and the Karta confirms the merge.
- [ ] F18 The district Operator changes a member's role with a remark.

## P3 — Family tree
- [ ] F19 Tree builder: add parents, grandparents, great-grandparents (a 4th level is refused). Repeat as a plain member (not the Karta): it works too.
- [ ] F20 Spouse side: add your spouse's parents.
- [ ] F21 Add a sibling at any level; tick "has own family on site".
- [ ] F22 Link the sibling to the person in the other family (a plain member can ask too); resolve any difference; the other Karta accepts → one person in both trees.
- [ ] F23 Record a marriage (date, legal age); the spouse's family Karta gets a "Marriage" request.
- [ ] F24 Someone in two families sees "My Families" with a role in each.
- [ ] F25 Tree: zoom, collapse, person card, jump icon, Print / Save as PDF. Someone from an unrelated family gets "not found".

- [ ] F21 (data fix, test branch) Run `scripts/postgres/data-fixes/fix_relationship_gender_preview.sql`, check the list, run `..._apply.sql`: the listed people now show the right relationship (e.g. mother, not father). `..._rollback.sql` puts them back.

## P4 — Organisations
- [ ] F26 Create a local organisation: name, start date, taluka (State › District › Taluka), town, President / Secretary / Chairman and other members (certificate optional). Everyone named accepts; two Operators of the district approve → ACTIVE.
- [ ] F27 Invite / accept, request / approve, hand the President post over (the new holder accepts), set a term.
- [ ] F28 Once active, its President, Secretary and Chairman appear as members of the LadWani District organisation automatically (no nomination), and get the District team view.
- [ ] F29–F30 An Admin or an Operator of the district appoints the District organisation's President / Secretary / Chairman (they accept) → they appear in the State organisation; the same from State to Country (Country: Admin only).
- [ ] F26 (groups) Admin → Settings → Convert Groups to Organisations: check the preview (taluka, town, posts, people not carried over), press Copy, accept as the invited members, approve as two Operators; fill a vacant post by hand-over → ACTIVE. Undo removes copies not yet active; the groups are unchanged.
- [ ] F31 Hand a local post to someone else → the old holder's seats above end and their access goes; the new holder goes up instead.

## P5 — Social and bureau
- [ ] F34 Family album photo with "Family" visibility; an outsider cannot open it; three reports hide it.
- [ ] F35 Find a friend by Gotra; request / accept; make a list; removing the friend removes them from the list.
- [ ] F36 Post to your family (instant), to your district (waits for the District body President) and to the whole community (waits for an Operator or Admin).
- [ ] F37 Bureau: a 20-year-old man cannot list; a member who is not earning cannot list; a Divorced or Widowed earning member can (OP-08), a Separated one cannot; turning the listing on tells the Karta.
- [ ] F38 Search by district / Gotra (same-Gotra flagged); interest → accept (also by the Karta) → contact shown.

## P6 — Reports and data rights
- [ ] F39 A District team member's Reports show only their district; CSV opens in Excel; the Admin sees the Operator SLA; an Operator's Admin Panel shows no global counts.
- [ ] P6 Browse the site with the browser console open: no "Content Security Policy" errors (map, photos, fonts all load). Request a password reset and enter a wrong code 6 times: the 6th says "Too many requests".
- [ ] F40 Settings → Download My Data. Request deletion → Admin → Data requests → Anonymise; the person stays in trees as "Former member". Search consents by Person ID. Audit Logs → "ID proof only".

## Sign-off
| Area | Tester | Date | Result |
|---|---|---|---|
| P0–P1 | | | |
| P2–P3 | | | |
| P4 | | | |
| P5 | | | |
| P6 + backup / restore drill | | | |
