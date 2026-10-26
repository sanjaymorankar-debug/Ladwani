# Phase P5 — Social and marriage bureau: delivery report

> **Database update (25 Oct 2026):** LadWani runs on **PostgreSQL** (Neon). This report was written when the work was on MySQL; its phpMyAdmin scripts and MySQL migrations were replaced by one PostgreSQL migration and `scripts/postgres/`. See [`POSTGRESQL-PORT.md`](POSTGRESQL-PORT.md); its steps replace the MySQL ones below.

Prepared 9 Oct 2026. Branch `claude/intelligent-ritchie-8b37zt` (same PR as P0–P4).

## 0. Security findings fixed (they sat inside P5 flows)

| Finding | Where | Fix (flow) |
|---|---|---|
| **Password hashes reached the browser.** Post and comment authors were loaded as full user rows: `passwordHash`, email, mobile, `lastLoginIp`, lock counters. They were returned by `GET /api/posts/[id]/comments` and serialized into the community pages. | `api/posts/[id]/comments`, `(dashboard)/community` pages | Authors are now names only (`AUTHOR_SELECT`) everywhere (F36). |
| **The matrimony APIs returned the whole Member row** (mobile, email, DOB, blood group, disability…) to any signed-in user, before any interest was accepted. | `api/matrimony/profiles`, `…/[id]` | Limited cards only. Contact details go out only after an interest is accepted, per the person's contact preference (F38). |
| **A mistyped photo visibility made a photo public.** The upload stored any string, and unknown values counted as "everyone". | `api/members/[id]/photos`, `lib/visibility.ts` | The value is validated on upload, and unknown values are treated as private (F34). |
| Comments on unpublished or hidden posts were readable; reactions were accepted on any post id. | comments, reactions | Both now follow the post's audience and require a live post (F36). |
| Moderation accepted any status, so a rejected post could be approved and a hidden one republished. | `api/posts/[id]/moderate` | Approve/reject only a waiting post; hide only a live one (F36). |
| The image type came from the browser, and sharp also opened GIF/TIFF/SVG. Originals (with camera GPS data) went to any viewer. | `lib/storage.ts`, photo file route | The type is detected from the bytes (JPEG/PNG/WEBP only) with a pixel limit. Only the uploader, the member and Admins get the original; everyone else gets the re-encoded copy (F34). |

## 1. Gap analysis (Phase = P5, flows F34–F38)

| Flow | Status before | Existing | Missing / wrong | Change made | Risk to existing data |
|---|---|---|---|---|---|
| F34 Upload photos | PARTIAL | Member gallery (resized copies, private storage, visibility); one family photo; asset photos | No family album. No Friends / friend-list visibility. No report abuse (the `reports` table was unused). The security items above. | **Family album**: members upload, each photo with Only me / Family / Friends / Community; delete by uploader or Karta. **FRIENDS** and **FRIEND_LIST** visibility. **Report abuse** on photos, posts and comments: once reports from `moderation.report_threshold` (3) different people are open, the item is hidden until a moderator restores or removes it. A Reported Content queue for Operators and Admins. | None (additive column `photos.audienceListId`) |
| F35 Friend lists | MISSING | — | — | Search by name, Gotra, Mul Gaon, district (no contact details). Request → accept / decline / cancel. Named lists (only friends can be in a list). **Removing a friend silently takes them out of both people's lists.** An expired member (F12) is removed from friends and lists. | New tables |
| F36 Posts to groups | PARTIAL | Posts, moderation by any Operator, likes, comments | No audience: everyone saw every post. No family / friend-list / organisation / district / state posts. No moderation "by that body". No edit / delete. No photos on posts. No report abuse. | **Audience** on each post: Community (existing behaviour, still Operator-moderated), Family, Friend list or Organisation (published at once, members alerted), and District / State / National (held until **that LadWani body's President or Secretary**, or an Admin, approves). The feed, the post page, comments and reactions all follow the audience. Authors edit (a moderated post goes back for approval) and delete. Photos on posts follow the post's audience. Report abuse with threshold hiding. | Additive columns. Existing posts become audience COMMUNITY, which is exactly how they are shown today. |
| F37 Bureau opt in / out | PARTIAL | Listing toggle; auto-off on marriage and death | No legal-age check. Listing allowed for Divorced / Widowed and without earning (**CONFLICT**, see decisions). No horoscope or contact preference. Karta not told. A Separated member stayed listed. | **Legal age 18 F / 21 M** is checked always. Extra details: expectations, horoscope (optional), contact preference (me / Karta / both). The **Karta is told** on opt-in. The toggle shows only when eligible, with the reason otherwise. Auto-off when the status becomes ineligible. **The workbook's "Unmarried AND earning" rule is on** (`bureau.workbook_rules`, switched on by your decision — see §9). | Additive columns |
| F38 Browse and interest | PARTIAL | List, detail, interests (send / accept) | Contact details leaked (see §0). No occupation / district / Gotra filters. No same-Gotra flag. Income not shown as a band. Karta could not answer. No contact sharing. Anyone could browse (**CONFLICT**). | Filters: age, education, occupation, district, Gotra (plus gender). Limited cards; **same-Gotra flagged**; income as a band. **The Karta** can send for a family member and accept / decline for them (recorded as `respondedBy`). **Contact shared on acceptance** per preference. "Only listed users and their Karta browse" is built behind the same setting. An Interests panel was added (none existed). | Additive column |

### a) Found in code, not in the workbook (left as they are)
- Reaction types beyond "like".
- Pinned / announcement posts.
- The single family photo.
- Asset photos.
- Matrimony preferences.

### b) Schema
- **New tables:** `friendships`, `friend_lists`, `friend_list_members`.
- **New columns:**
  - `photos.audienceListId`
  - `posts.audienceType` and `posts.audienceId`
  - `matrimonial_profiles.expectations`, `horoscope` and `contactPreference`
  - `matrimonial_interests.respondedBy`
- **Other:** an index on `reports`, and two settings.

### c) Role differences
- Community-wide posts stay with Operators and Admins (as before); the workbook does not name a moderator for them. **Confirmed by your decision (§11).**
- Reported items are reviewed by Operators and Admins. Body officers can also review reported posts addressed to their body.

### d) Open points
- **OP-08** (Widowed / Divorced in the bureau) — decided: allowed (see §10).

## 2. Change list

| File | Flow | Why |
|---|---|---|
| migration `20261009180000_p5_social_bureau` (+ `down.sql`), `schema.prisma` | F34–F38 | Above |
| `src/lib/friends.ts`, `api/friends` (+ `[id]`, `search`), `api/friend-lists` (+ `[id]`, `[id]/members`), `(dashboard)/friends` | F35 | Friends and lists |
| `src/lib/reports.ts`, `api/reports` (+ `review`), `admin/moderation` | F34, F36 | Report abuse and review |
| `src/lib/photo-access.ts`, `src/lib/visibility.ts`, `src/lib/storage.ts`, `api/photos/[photoId]` (+ `file`, `url`), `api/members/[id]/photos` (+ `[photoId]`), `api/families/[id]/album`, `FamilyAlbum`, `PhotoManager` | F34 | Album, friend visibility, hardening |
| `src/lib/posts.ts`, `api/posts` (+ `[id]`, `audiences`, `[id]/photos`, `[id]/moderate`, `[id]/comments`, `[id]/reactions`), `api/comments/[id]`, community pages, `PostCard`, new-post page | F36 | Audience, moderation by body, edit / delete, safe authors |
| `src/lib/bureau.ts`, `src/lib/bureau-fields.ts`, `api/matrimony/**`, matrimony pages, `BureauBrowser`, `InterestsPanel` | F37, F38 | Bureau rules, cards, Karta, contact sharing |
| `src/lib/family-rules.ts`, `api/members/[id]` | F12, F37 | Expired → off friend lists; ineligible status → listing down |
| `Sidebar` | — | Friends, Reported Content |
| `database/phpmyadmin/add_p5_social_bureau.sql` | deploy | Same SQL + migration record |

## 3. Migration
`20261009180000_p5_social_bureau` is additive: 3 tables, 7 nullable or defaulted columns, 2 indexes and 2 settings. There is no backfill.

Rollback is `down.sql`. It is tested up → down → up, and the phpMyAdmin script was checked on a P4-state database: no pending migrations and zero schema diff.

## 4. Tests — before vs after

| | Test files | Tests | Typecheck | Build |
|---|---|---|---|---|
| After P4 | 30 | 376 | clean | OK |
| After P5 | 32 | **397 passed** (twice in a row on one database) | clean | OK |

The new tests are named by Flow ID:
- `tests/p5/F34-F36-social.test.ts` (14)
- `tests/p5/F37-F38-marriage-bureau.test.ts` (7), covering both bureau modes.

All existing photo and post tests pass unchanged. The existing matrimony tests were updated to the workbook rules **on your instruction** (see §9).

A browser run against the production build covered:
1. A Karta finds a member by name on Friends and sends a request; the member accepts.
2. The Karta posts to "Sharma family". A family member sees it in the feed; a non-member does not.
3. The Marriage Bureau page shows the search with district and Gotra filters.

## 5. Deployment (shared hosting, dev → test only)
1. Back up the database.
2. Run `npx prisma migrate deploy`, or import `add_p5_social_bureau.sql` in phpMyAdmin after the P4 script.
3. Rebuild and restart the app.

There are no new environment keys.

Settings to review:
- `moderation.report_threshold` (default 3)
- `bureau.workbook_rules` (on; set to false to return to the earlier rules)

## 6. Exit criteria (Phase Plan, P5)
- **Bureau toggle rules enforced** — ✅.
  - Legal age, Unmarried AND earning, auto-off, and the "toggle only when eligible" behaviour are enforced and tested.
  - Only listed members and their Karta browse and send interests (tested).
- **Abuse reporting works** — ✅.
  - Photos, posts and comments can be reported; one report per person.
  - The item is hidden at the threshold. A moderator restores or removes it, and the owner is told.
- **Deliverable "Feed, friends, bureau screens"** — ✅.
  - Feed with audiences, Friends page, Marriage Bureau with search and interests, family album, Reported Content queue.

## 7. Assumptions
- District / State posts go to the author's **own** district or state (from their Mul Gaon). An Admin may target any.
- Only bounded audiences (a family, a friend list, an organisation) get a notification per post. District, State and National posts do not, to avoid mass alerts.
- An edited post that needed moderation goes back to "waiting" until approved again.
- Friendships are between members with a login.
- A deleted friend list leaves the friendships; items shared with that list become visible only to their owner.
- Contact preference defaults to the member's own details. "Karta" shares the Karta's details instead.

## 8. Decisions needed
1. ~~**OP-08**~~ — decided: Widowed and Divorced members may list (§10).
2. ~~**Community-wide posts**~~ — decided: keep Operator moderation (§11).

No P5 decisions remain open.

## 9. Follow-up: workbook bureau rules switched on (your decision)
- **Migration** `20261009200000_bureau_workbook_rules_on` (phpMyAdmin: `set_bureau_workbook_rules_on.sql`) sets `bureau.workbook_rules` = true. The code also treats a missing setting as on. Rollback: `down.sql` sets it back to false.
- **Effect on live data:** no member rows change. Listings that no longer qualify (anyone not marked as earning; at the time also Divorced or Widowed members, reversed by OP-08 in §10) stay switched on but are hidden from search until the member qualifies. Members who want to list must set their social status to Working and choose an income band. Members who are not listed (and are not a listed member's Karta) can no longer browse or send interests.
- **Existing tests updated to the new behaviour.** Each test now makes its UAT members bureau-ready (earning, listed) inside `try/finally` and puts them back afterwards, using the new helper `bureauReady` in `tests/uat/helpers.ts`. What each test checks:
  - `TC-MAT-001/002`: a listed viewer sees the profile and loses it on opt-out. **Added:** a viewer who is not listed gets 403.
  - `TC-MAT-007/008`: a listed member sends an interest that is accepted.
  - `TC-MAT-009`: as before, a stranger cannot accept someone else's interest. The sender is now listed, and the send is checked to succeed.
  - `TC-MAT-010`: the viewer is now listed, so the search really runs. Before this change it returned 403 and the test passed without checking anything.
  - `TC-MAT-012`: **added** a check that a member who isn't earning is refused with the earning reason; after becoming earning they opt in and appear. The viewer changed from KARTA-02 (married, so can never be listed) to a listed member.
  - `TC-MAT-013`: the same viewer change; marriage still withdraws the listing.
- **My own P5 bureau tests** now run with the rules on by default. A new test checks that switching the setting off restores the earlier rules.
- Tests: **406 passed**, twice in a row on a fresh database. Typecheck clean; build OK.
- Fixed in passing: the bureau search showed wrong income-band labels (10L_25L / 25L_50L instead of the schema's 10L_20L / 20L_50L).

## 10. Follow-up: OP-08 decided — Widowed and Divorced may list (your decision)
- **Rule now:** Unmarried, Divorced and Widowed members may list, as long as they are of legal age and (with the workbook rules on) earning. Married and Separated members may not (a separation leaves the marriage legally standing). Browsing and interests are unchanged: listed members and their Karta.
- **Code:** `src/lib/bureau.ts` `bureauEligibility` now uses the same eligible-status list as the search filter (`MATRIMONY_ELIGIBLE_STATUSES`) in both modes. The reason shown for Married / Separated is the existing one from `src/lib/matrimony.ts`.
- **No migration, no data change.** Divorced or Widowed members who had already switched their listing on (and are earning) reappear in search.
- **Tests:** my own P5 test that encoded the old assumption ("Divorced is refused") was replaced with a test named for F37 / OP-08. It checks that Divorced and Widowed members are refused until earning, then list and appear in search, and that Married and Separated members are refused with a reason. No existing UAT test depended on the old rule. **407 passed**, twice in a row on a fresh database; typecheck clean.

## 11. Follow-up: community-wide posts keep Operator moderation (your decision)
- **Rule:** a member's post to the whole community waits as "Pending approval" until an Operator or Admin approves it, as it did before this PR. District / State / National posts go to the body's President as in F36. Family, friend-list and organisation posts publish at once.
- **No code, migration or data change.** This was already the behaviour.
- **Test added** to lock the decision in: `F36 community-wide posts keep Operator moderation` in `tests/p5/F34-F36-social.test.ts`. A member's community post is pending and hidden from others; another member cannot approve it (403); an Operator approves it and it appears. **408 passed**, twice in a row on a fresh database.
