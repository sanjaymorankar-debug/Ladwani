# Phase P3 — Family tree and cross-family links: delivery report

Prepared 9 Oct 2026. Branch `claude/intelligent-ritchie-8b37zt` (same PR as P0–P2). The stack is unchanged.

## 1. Gap analysis (Phase = P3, flows F19–F25)

| Flow | Status before | Existing files / tables | What was missing or wrong | Change made | Risk to existing data |
|---|---|---|---|---|---|
| F19 Ancestor tree (3 up) | MISSING | `member_relationships`, `relationship_types` | No tree builder. Ancestors could only be added one by one as members, with no pair, year-only birth or "expired" option. | `POST api/families/[id]/tree/parents`: father + mother as a husband–wife pair. Each has a name, a full date or just a birth year, and alive or expired (shown "Late"). They become non-login members with role father/mother relative to the child. Depth is limited by the setting `tree.ancestor_levels` (default **3**, OP-02). | None. |
| F20 Spouse-side tree | MISSING | — | — | Same builder for a spouse's parents. The Karta can add them, or a member for their own spouse. Both sides join at the marriage in the tree. "Link to the spouse's birth family" is F22. | None. |
| F21 Add siblings | MISSING | — | — | `POST api/families/[id]/tree/siblings` for anyone at any level. The sibling gets the person's recorded parents automatically. Duplicate first name among siblings is refused. "Has own family on site" leaves a link placeholder for F22. | None. |
| F22 Link to another family tree | MISSING | — | — | `api/tree-links` (+ `/[id]`, `/candidates`): <br>1. The Karta picks the other family and the matching person (limited view: name, gender, birth year). <br>2. Differences in name, surname, gender or date of birth are shown side by side; the requester chooses the correct value for each. <br>3. The other Karta accepts, choosing too. If both chose the same, the two records **merge into one person shown in both trees**; if not, an Operator of either family's district (or an Admin) decides. Reject needs a reason. <br>4. Alerts go to the target Karta, the requester and the Operators. | Merge is one transaction and audited (old and new values). The retired record is soft-deleted, not erased. Two records that both have a login are never merged. |
| F23 Marriage triggers family link | PARTIAL | `api/members/[id]/spouse`, `approvals` (§28 gate), `marriage_records` | No marriage date or legal-age check. A spouse not on the site could only be a name. The spouse's family was never asked to add the person. Divorce/widowhood changed only the person's status field; the marriage record stayed "MARRIED". | Marriage date (not in the future). Legal age **18 F / 21 M** on that date, for both partners. Optional "add the spouse as a person". After the marriage is applied (directly or after the existing review), a **request goes to each spouse's family Karta** to add the other partner as daughter-in-law / son-in-law (or wife / husband). These are marked "Marriage" in the inbox, and the birth-family Kartas are told. Nobody leaves their birth family. Divorced/widowed marks the marriage record (with date) and the spouse, and keeps history. | Additive column `family_join_requests.origin` (default MEMBER). **Kept:** the existing §28 review of marriages. |
| F24 One person, many families | PARTIAL | `family_members` (P2 roles) | `/family` showed only the first membership, including ones already left. There was no "My Families" list. | `/family` lists all active families with the role in each and switches between them (`?f=`). The dashboard has a "My Families" card with role and tree link. Personal data is one record, so edits show in every tree. | None. |
| F25 View tree | PARTIAL | `family/[id]/tree` page, `api/families/[id]/tree`, `FamilyTree.tsx` | **Security:** the tree *page* had no access check — any signed-in user could open any family's tree by URL (the API checked; the page did not). The layout treated every stored relationship row as parent → child, so the two-way rows produced loops. There was no generation order, no "Late", no profile card, no jump to linked families, and no collapse. | Access: family member or Admin sees the full tree. A member of a **linked** family sees only the connecting branch (the shared person, their parents, siblings, spouse and children), with no date of birth or city. Everyone else sees nothing (404 page / 403 API). <br>Layout: generation rows relative to the Karta, children under parents, spouses side by side. <br>Also: "Late" on expired people, a click-through profile card, jump links to the person's other families, collapse/expand per branch, and Print / Save as PDF (the app's sidebar and top bar are hidden on print). | None. |

### a) Found in code, not in the workbook (left as they are)
- The `/family/[id]/members/new` form.
- External spouse names without a record (TC-MAR-004).
- Matrimony withdrawal on marriage.

### b) Schema differences (resolved additively)
- `family_join_requests.origin`.
- `tree_link_requests` table.
- Setting `tree.ancestor_levels`.

### c) Role differences
- **F19 / F20 / F21 / F22:** any member of the family may build the tree, not only the Karta (your decision, §9). Accepting a link from another family stays with that family's Karta.
- **F22:** an unresolved conflict goes to an Operator of *either* family's district.

### d) Open points
- **OP-02 (tree depth):** built as 3 levels above the Karta, changeable in Settings (`tree.ancestor_levels`). Please confirm.
- **OP-11 (duplicate persons):** handled by F17 + F22, with Operator resolution.

### e) Security and data findings (report only unless noted)
1. **Tree page leaked any family's tree** to any signed-in user — **fixed** under F25, because it is the flow's own rule ("Non-members see nothing").
2. **Wrong-gender inverse links.**
   - The relationship master has one inverse per type, so adding a daughter relative to her mother stored the mother → daughter link as "father". The same happened with the other gendered pairs.
   - New links now use the right one (`src/lib/relations.ts`).
   - **Existing rows were not changed.** The tree still draws them correctly, since both father and mother mean "parent"; only the label is wrong.
   - A fix rewrites data, so it needs your approval. Rows affected:
     ```sql
     SELECT mr.id, rt.code, m.gender FROM member_relationships mr
       JOIN relationship_types rt ON rt.id = mr.relationshipTypeId
       JOIN members m ON m.id = mr.fromMemberId
      WHERE (rt.genderApplicable = 'MALE' AND m.gender = 'FEMALE') OR (rt.genderApplicable = 'FEMALE' AND m.gender = 'MALE');
     ```

## 2. Change list

| File | Flow | Why |
|---|---|---|
| migration `20261009160000_p3_tree_links` (+ `down.sql`), `schema.prisma` | F22, F23, OP-02 | Link table, join-request origin, depth setting |
| `src/lib/relations.ts` (new) | F10, F21, F23 | Gendered inverse, two-way linking, parents, blood-relation check |
| `src/lib/tree.ts` (new), `src/lib/tree-layout.ts` (new) | F24, F25 | Access modes, generations, edges, connecting branch; layout and collapse |
| `src/lib/tree-edit.ts` (new), `api/families/[id]/tree/parents`, `.../siblings` (new) | F19–F21 | Builder |
| `src/lib/merge.ts` (new), `src/lib/claims.ts` | F17, F22 | One shared person-merge (also moves relationships, marriages, groups, bookings…); F17 now uses it |
| `src/lib/tree-links.ts` (new), `api/tree-links/*` (new) | F22 | Link, conflicts, Operator review |
| `src/lib/marriage.ts` (new), `api/members/[id]/spouse`, `src/lib/approvals.ts`, `api/approvals/[id]` | F23 | Date, legal age, new spouse record, requests to both families |
| `api/members/[id]` | F23 | Divorced / widowed marks the marriage |
| `api/families/[id]/members`, `.../members/[memberId]`, `.../join-requests/[reqId]` | F10, F15, F21 | Gender-correct inverse links |
| `api/families/[id]/newborn`, `NewbornPanel` | F13 | No preselected parents (the browser run had picked the Karta's own mother); blood relatives refused as a parent pair |
| `api/families/[id]/tree` route + page, `TreeClient`, `FamilyTree`, `TreeBuilderActions` (new), `TreeLinksInbox` (new), `SpouseLink`, `JoinRequestsInbox`, family page, dashboard, `admin/verification`, `Sidebar`/`TopBar` (print) | F19–F25 | Screens |
| `database/phpmyadmin/add_p3_tree_links.sql` | deploy | Same SQL plus the migration record |

**P2 follow-ups in this commit:**
- The join-request inbox now asks for a rejection reason.
- `docs/PHASE-P2-REPORT.md` was corrected: the API does not require the reason, because of TC-FAM-009.
- One assertion in my own P2 test (F15 in `tests/p2/F14-F18…`, added earlier in this PR) expected the old "father" inverse. It now expects "mother". No test that existed before this PR was edited.

## 3. Migration
`20261009160000_p3_tree_links`:
- Adds one column with default `'MEMBER'`, so every existing request stays as it was.
- Adds one table and one setting. No backfill.
- Rollback: `down.sql`.
- Tested: up → down → up. The phpMyAdmin script was tested on a P2-state database: no pending migrations and zero schema diff afterwards.

## 4. Tests — before vs after

| | Test files | Tests | Typecheck | Build |
|---|---|---|---|---|
| After P2 | 27 | 347 | clean | OK |
| After P3 | 29 | **363 passed** (twice in a row on one database) | clean | OK |

The new tests are named by Flow ID:
- `tests/p3/F19-F21-tree-builder.test.ts` (8)
- `tests/p3/F22-F25-links-marriage-view.test.ts` (8)

**Test isolation note (not a P3 change).** Run the whole suite a *third* time on the same database without resetting it, and `authorization.test.ts › can edit their own profile` fails with 409.
- Cause: another test in that file renames the member to "AdminEdited". Since P1 (F08), the member renaming themselves back becomes a pending change request, which locks the profile.
- CI always starts from a fresh database, so it is not affected.
- Fixing it means changing that existing test, so I left it.

A browser run against the production build covered:
1. The UAT family tree draws in generation rows, with "Late" and the Karta badge.
2. Clicking a person opens their card, and "Add sibling" from the card draws the new sister under the shared parent.
3. Printing hides the app's sidebar and top bar.
4. A member of another family gets a 404 page and no tree.

## 5. Deployment (shared hosting, dev → test only)
1. Back up, then `npx prisma migrate deploy`, or import `add_p3_tree_links.sql` in phpMyAdmin after the P2 script.
2. Rebuild and restart the Node app.
3. No new environment keys or cron jobs.

## 6. Exit criteria (Phase Plan, P3)
- **One person = one record across families** — ✅. A person joins other families as an extra membership with its own role (F23, F24). A duplicate entered by two Kartas is merged by F22 into one record that appears in both trees, keeping every link. Tested.
- **Marriage trigger alerts both Kartas** — ✅. The spouse's family Karta gets the request and the birth-family Karta is told; tested for both partners.
- **Deliverable "Visual tree with jump links"** — ✅. Generation layout, profile card, jump links to the person's other families, branch-only view for linked families.

## 7. Assumptions
- **Tree depth** is counted above the Karta, on both the paternal and maternal sides. The spouse side is limited the same way.
- **Merge choice:** the record with a login is kept; otherwise the target family's record is kept. The chosen values override, and the other record only fills blanks.
- **The requester must choose** a value for each difference before sending (otherwise "both Kartas agree" cannot be checked).
- **Marriage role:** daughter-in-law / son-in-law relative to the spouse's parent when that parent is in the family; otherwise wife / husband relative to the spouse.
- **PDF** is the browser's "Save as PDF" from the print dialog. No server-side PDF library was added (no new package).

## 8. Decisions needed
1. **OP-02:** keep 3 generations up, or set `tree.ancestor_levels` to 2?
2. **Marriage review:** the existing §28 review still applies before a marriage takes effect, so the family requests follow the review. The workbook F23 has no review step. Remove it? It is the approval rule `member.marital_status.change`; there is no screen for it (see P2 report §9), so it would be switched off with a small migration.
3. **Wrong-gender inverse links in existing data:** may I correct them? That would mean a script with a rollback list, run first on test.
4. ~~**Members building the tree**~~ — decided: members may build the tree and its links (§9).

## 9. Follow-up: members may build the tree and its links (your decision)
- **Before:** members could add siblings anywhere and the parents of their own spouse. Adding ancestors (F19) and linking to another family's tree (F22) were for the Karta only.
- **Now:** any active member of the family (and staff, as before) may:
  - add the parents of anyone in the family's tree (F19 / F20). The depth limit (`tree.ancestor_levels`, OP-02) and the usual checks still apply: parents already recorded, parents older than the child, and so on;
  - add siblings, as before (F21);
  - ask to link a person in their tree to another family's tree (F22), search the other family's people for it (name, gender and birth year only, as before), and cancel their own request.
- **Unchanged:** a link request from another family is still accepted or rejected only by **that family's Karta**, because it changes their tree; differences still go to an Operator; the requester is told the result. The family's own Karta still sees all its sent links in the link inbox. Adding a new member to the family (F10) stays with the Karta.
- **Code:** `api/families/[id]/tree/parents` (Karta-only check removed), `api/tree-links` (POST for any family member; cancel also by the member who asked), `api/tree-links/candidates`, and the tree page's "Link to another family" button, now shown to every member.
- **No migration, no data change.**
- **Tests:** my own P3 test that expected a member to be refused for someone else's spouse side now checks the member's own spouse side only. New tests: a plain member adds ancestors for someone else in the family (the checks still apply; an outsider is still refused), and a plain member asks for a link that a non-Karta of the other family cannot accept, then cancels it. No existing test from before this PR depended on the old rule. **415 passed**, twice in a row on a fresh database; typecheck clean; build OK.
- **Still open in §8:** OP-02 tree depth, the marriage review step, and correcting existing wrong-gender relationship rows.
