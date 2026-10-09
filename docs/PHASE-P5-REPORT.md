# Phase P5 — Social and marriage bureau: delivery report

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
| F37 Bureau opt in / out | PARTIAL | Listing toggle; auto-off on marriage and death | No legal-age check. Listing allowed for Divorced / Widowed and without earning (**CONFLICT**, see decisions). No horoscope or contact preference. Karta not told. A Separated member stayed listed. | **Legal age 18 F / 21 M** is checked always. Extra details: expectations, horoscope (optional), contact preference (me / Karta / both). The **Karta is told** on opt-in. The toggle shows only when eligible, with the reason otherwise. Auto-off when the status becomes ineligible. **The workbook's "Unmarried AND earning" rule is built behind the `bureau.workbook_rules` setting** (default off). | Additive columns |
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
- Community-wide posts stay with Operators and Admins (as before); the workbook does not name a moderator for them.
- Reported items are reviewed by Operators and Admins. Body officers can also review reported posts addressed to their body.

### d) Open points
- **OP-08** (Widowed / Divorced in the bureau) — see decisions.

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

No existing test was edited. All existing photo, post and matrimony tests pass unchanged.

**With `bureau.workbook_rules` switched on**, these existing tests fail, because they pin the earlier rules:
- `TC-MAT-001/002`: an unlisted viewer browses.
- `TC-MAT-007/008`: an unlisted member sends an interest.
- `TC-MAT-009`: the sender is unlisted.
- `TC-MAT-012`: a member who isn't earning opts in, and an unlisted viewer browses.
- `TC-MAT-013`: an unlisted viewer browses.

That is why the setting is off by default.

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
- `bureau.workbook_rules` (default false)

## 6. Exit criteria (Phase Plan, P5)
- **Bureau toggle rules enforced** — ⚠ partly.
  - Legal age, auto-off and the "toggle only when eligible" behaviour are enforced and tested.
  - The workbook's "Unmarried AND earning" and "only listed users and their Karta browse" rules are **built and tested** but switched off pending your decision. Turning them on is one setting.
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
1. **Turn on the workbook bureau rules?** (`bureau.workbook_rules`.) This means only Unmarried and earning members may list, and only listed members and their Karta may browse and send interests. The 5 existing tests listed in §4 would then need updating to the new behaviour; your rules say I must not change them without your yes.
2. **OP-08:** with the workbook rules on, Widowed and Divorced members cannot list. Should they be allowed?
3. **Community-wide posts:** keep Operator moderation for every member post to the whole community, or publish them at once (the workbook only requires moderation for District / State / National posts)?
