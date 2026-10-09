# Additional Details and interest groups

This change adds 23 optional "Additional Details" sections to every member's profile. It also adds community interest groups that are built from what members choose to share. Written 9 Oct 2026.

> **Stack note.** The brief describes a Laravel/PHP codebase. This repository is actually **Next.js 14 (App Router) + Prisma 5 + MySQL** (`package.json`, `prisma/schema.prisma`). Everything was built in that existing stack and style:
>
> - Laravel migrations → Prisma migrations, each with a `down.sql`
> - policies → `src/lib/*-auth.ts`-style access helpers
> - form requests → shared validators in `src/lib/additional-details/`
> - Blade views → React pages
>
> No column was dropped or renamed, no data was deleted, no earlier migration was edited, and nothing was run against production.

---

## 1. Step 1 review: what already existed

| § | Section | Status before | Existing table / column reused | Change made |
|---|---|---|---|---|
| 1 | Insurance | missing | — | `member_insurances` (rows) + help fields on `member_additional_details` |
| 2 | Family doctor | missing | — | columns on `member_additional_details` |
| 3 | Investment adviser | missing | — | columns on `member_additional_details` |
| 4 | Vehicles & servicing | missing | (`assets` is bookable community property, so it was not used) | `member_vehicles` |
| 5 | Banking & loans | missing | (`income_ranges` covers income, not loans) | `member_loan_needs` + existing-loans/other-needs columns |
| 6 | Farm holding | missing | `areas` location master (DISTRICT areas added) | `member_farm_holdings` (district → `areas.id`) |
| 7 | House | partial | `addresses` CURRENT row, shown read-only (not duplicated) | ownership / type / wants-to-buy columns |
| 8 | Education & support | partial | **`education_records`** — `qualification`, `institution`, and `yearCompleted` as the passing year | **extended** with `marksType`, `marksValue`, `marksScale`, `boardUniversity`, `marksheetFileId`; support columns |
| 9 | Sports | missing | (`skills` holds professional skills) | `member_sports` + `member_sport_achievements`; sports live in the hobby master |
| 10 | Hobbies & interests | missing | — | `interests` master + `member_hobbies` |
| 11 | Career & work | partial | `employment_records`, `members.occupationCategory` (feeds profession groups) | looking-for / can-offer / support columns |
| 12 | Business listing | partial | **`businesses`** (name, type → category, description, city, website) | **extended** with `contact`, `showInDirectory`, `supportNeeds` |
| 13 | Skills I can share | partial | **`members.bloodGroup`** | teach, guidance, volunteer, willing-to-donate and last-donated columns |
| 14 | Health & fitness | partial | (`members.physicalDisability` exists and is **not** used or collected here) | activity / wants columns |
| 15 | Senior citizen needs | missing | DOB-derived age; family members for the emergency link | columns |
| 16 | Children & students | partial | (`member_profile_details.currentCourse` belongs to the Unmarried toggle flow and is cleared by it, so it was not reused) | columns |
| 17 | Women's support | missing | `members.gender` | columns |
| 18 | Government documents | missing | — | tick-list column (no numbers, no copies) |
| 19 | Housing & relocation | missing | — | columns |
| 20 | Travel & events | missing | — | columns |
| 21 | Language & culture | partial | **`members.languages`** for languages spoken | mother tongue (the marriage-flow column is cleared by its toggles), interests, open-to columns |
| 22 | Marriage support | missing | existing `isEligibleForMatrimony()` (bureau rules unchanged) | tick-list column |
| 23 | Emergency readiness | missing | family members (`family_members`) | columns |
| — | Per-section yes/no, visibility, who entered it | missing | — | `member_section_settings` |
| — | Consent | partial | **`consent_records`** | + nullable `memberId` (consent given for a child or elder) |
| — | Audit | exists | `audit_logs` | reused as is |
| — | Private uploads | exists | `src/lib/storage.ts` (outside the web root) | `member_files` + `/api/member-files/[id]` |
| — | Groups | partial | **`community_groups` / `community_group_members`** | `groupType = 'INTEREST'` + nullable columns (`groupKey`, `autoKey`, `interestId`, `parentGroupId`, `district`, `isChildSafe`, `rules`; `autoJoined`, `notifyMode`, `isMuted`, `rulesAcceptedAt`, `lastDigestAt`) |
| — | Posts, comments, notifications, moderation | exists | `posts`, `comments`, `reactions`, `photos`, `notifications`, `reports`, `/api/posts/[id]/moderate` | `posts` gets nullable `groupId`, `groupPostKind`, `linkUrl`, `isSolved`, `solvedAt`, `solvedCommentId`; new `post_poll_options`, `post_poll_votes`, `post_rsvps` |
| — | District / State / National teams | missing | `roles` + `user_roles.areaId` (already used for scoped Operators) | roles `DISTRICT_TEAM`, `STATE_TEAM`, `NATIONAL_TEAM` (seeded) |
| — | Support requests | missing | — | `support_requests` |
| — | Dropdown master | missing | — | `option_masters`, with defaults in code |

Nothing required dropping or renaming a column or deleting data, so the work went straight on to Step 2.

## 2. Final status of each section

All 23 sections are **built**: saved, edited and deleted through the API, and covered by `TC-AD-SEC 1…23`. Every section:

- opens with Yes / No / Prefer not to say;
- shows its detail fields only on Yes;
- has its own visibility setting;
- is optional;
- can be deleted, which removes the data rather than hiding it.

| § | Rows? | Default visibility | Notes |
|---|---|---|---|
| 1 Insurance | many | Only me, **max My Karta** | No policy numbers. "Needs help" is also asked on No. |
| 2 Family doctor | single | Only me, **max My Karta** | No illness or treatment data. |
| 3 Investment adviser | single | Only me, **max My Karta** | No portfolio values or account numbers. |
| 4 Vehicles | many | Only me | Registration number is optional and shown to others as `••••1234`. |
| 5 Banking & loans | many | Only me, **max My Karta** | Amounts are bands only. No account or card numbers, CIBIL or PAN. |
| 6 Farm | many | Only me | District comes from the area master. No 7/12 or survey numbers. |
| 7 House | single | Only me | Uses the existing current address. "Wants to buy" appears only for renters. |
| 8 Education | many (existing rows) | Only me | Marks with scale, board, passing year, marksheet (PDF/JPG/PNG, 5 MB), support band. |
| 9 Sports | many + medals | Community | Certificate upload; coaching support. |
| 10 Hobbies | many | Community | Grouped master list. "Other" goes to Admin. Level, can teach, needs support. |
| 11 Career | single | Only me | |
| 12 Business | many (existing rows) | Community | Directory flag; support needs. |
| 13 Skills to share | single | Community | Blood group, willing-to-donate and last donated are never shown in the section view. They are used only by the donor finder. |
| 14 Wellness | single | Only me | Wellness only. |
| 15 Senior | single | Only me | Shown only at age 60 or over. |
| 16 Students | single | Only me | Shown when under 25 or employment status is Student. |
| 17 Women | single | Only me | Shown to women aged 18 or over. |
| 18 Government documents | single | Only me | Tick-list only. |
| 19 Housing | single | Only me | |
| 20 Travel | single | Community | |
| 21 Culture | single | Community | |
| 22 Marriage support | single | Only me | Shown only when matrimony-eligible (existing rule) and 18 or over. |
| 23 Emergency | single | Only me | |

### Interest groups (Step 3)

| Rule | Status | Where |
|---|---|---|
| 1 Group master: every hobby and sport, plus Career, Business owners, Exam (5+), Farmers, Fitness & yoga, Senior, Women's wing, Youth wing, Travel & yatra, Volunteers, Blood donors, Profession (5+) | done | `desiredGroups()` in `src/lib/interest-groups.ts` |
| 2 Auto-create; "Other" waits for Admin; merge duplicates | done | `/admin/interests` |
| 3 Auto-join on save with a "You have been added" list and Leave; removal only after confirmation | done | wizard plus `leave-unmatched` |
| 4 Leave or mute; never re-added after leaving; "Do not auto-add me" setting | done | |
| 5 District sub-group at 10+ members in the same district | done | `ensureDistrictSubGroup()` |
| 6 Posts, Problems (solve), Knowledge, events with RSVP, polls, mentors list — all on the existing `posts`/`comments` | done | `/interest-groups/[id]` |
| 7 Group shows only name, photo, city and hobby level | done | members API returns exactly these keys |
| 8 Sensitive topics never create or join groups | done | those sections are never read by the group code |
| 9 Minors: child-safe groups only, after parent/Karta consent, no contact from outside adults, hidden in district lists | done | |
| 10 Moderators (Admin / District team; most active expert suggested); report → existing moderation queue; rules on first entry | done | |
| 11 Daily digest by default; per-group "every post" or mute | done | needs a cron job (see deployment) |
| 12 Dashboard suggestions using only what both people share | done | `src/lib/community-connect.ts` |

## 3. Files added or changed

### Database (run order)

1. `prisma/migrations/20261009100000_member_additional_details/migration.sql`: new tables, plus nullable columns on `education_records`, `businesses` and `consent_records`. Rollback is `down.sql` in the same folder.
2. `prisma/migrations/20261009110000_interest_groups/migration.sql`: nullable columns on `community_groups`, `community_group_members` and `posts`, plus poll and RSVP tables. Rollback is its own `down.sql`. When rolling back, run this one **first**.
3. `database/phpmyadmin/add_additional_details_and_interest_groups.sql`: both migrations plus reference data, for phpMyAdmin.
4. `database/phpmyadmin/rollback_additional_details_and_interest_groups.sql`: the phpMyAdmin rollback.

Both `down.sql` scripts were checked: applying up → down → up gives a schema identical to `schema.prisma`, and up → down gives a schema identical to the pre-change schema.

Changed:
- `prisma/schema.prisma`: models for the above.
- `prisma/seeds/seed.ts`: team roles, district areas, hobby master and group post types (idempotent upserts).

### New library code
| File | Purpose |
|---|---|
| `src/lib/additional-details/sections.ts` | The 23 section definitions, conditional rules, visibility ladder, caps and applicability. Shared by client and server. |
| `src/lib/additional-details/options.ts` | Default dropdown lists (bands, never figures). |
| `src/lib/additional-details/parse.ts` | Validates and normalises a section submission; drops hidden fields. |
| `src/lib/additional-details/access.ts` | Who may edit and who may see; team scope. |
| `src/lib/additional-details/server.ts` | Load, save (replace-all rows), delete, support-request sync, consent text and version, option master. |
| `src/lib/additional-details/http.ts` | Actor and request metadata; view audit. |
| `src/lib/additional-details/core-selects.ts` | Pre-existing education and business columns, so older screens never expose the new ones. |
| `src/lib/interest-master.ts` | Default hobby and sport master list. |
| `src/lib/interest-groups.ts` | Group derivation, auto-create and auto-join, leave, sub-groups, minors, digest, moderator suggestion. |
| `src/lib/community-connect.ts` | Matching, blood donor finder, contact rules, reports. |

### New API routes
| Route | Purpose |
|---|---|
| `api/members/[id]/additional-details` (GET) | Overview: the editor gets everything; others get only visible sections, and the view is audited. |
| `api/members/[id]/additional-details/[section]` (GET/PUT/DELETE) | One section. |
| `api/members/[id]/additional-details/consent` (GET/POST) | Consent notice; parent/Karta consent for minor groups. |
| `api/members/[id]/additional-details/files` (POST) | Marksheet or certificate upload (type, size and magic-byte checks). |
| `api/member-files/[fileId]` (GET) | Serves a file after a visibility check. |
| `api/members/[id]/support-requests` (GET/PATCH) | The member's own requests; withdraw. |
| `api/support-requests` (GET/PATCH) | Team list: names for the district team, counts for State and National. |
| `api/members/[id]/group-settings` (GET/PATCH) | "Do not auto-add me". |
| `api/interests` | Hobby and sport pickers. |
| `api/admin/interests`, `api/admin/interests/[id]` | Approve, merge, reject or edit the master; set child-safe. |
| `api/admin/options` | Edit dropdown lists. |
| `api/interest-groups` | My groups and the directory. |
| `api/interest-groups/[id]` | Group detail. |
| `api/interest-groups/[id]/membership` | Join, leave and settings. |
| `api/interest-groups/[id]/members` | Members list. |
| `api/interest-groups/[id]/members/[memberId]` | Moderator removes a member. |
| `api/interest-groups/[id]/moderators` | Assign a moderator; get the suggestion. |
| `api/interest-groups/[id]/posts` | Group posts. |
| `api/interest-groups/leave-unmatched` | Confirmed removal after a hobby is removed. |
| `api/posts/[id]/solve`, `vote`, `rsvp`, `report`, `photos` | Group post actions. |
| `api/matches` | Dashboard suggestions. |
| `api/blood-donors` | Donor finder. |
| `api/contact-requests`, `api/contact-requests/[id]` | Request contact; accept or decline. |
| `api/reports/community-support` | Dashboard counts, scoped by role. |
| `api/cron/group-digest` | Daily digest; requires `CRON_SECRET`. |

### New pages and components
| File | Purpose |
|---|---|
| `(dashboard)/members/[id]/additional-details/page.tsx` | Wizard page. |
| `components/additional-details/DetailsWizard.tsx` | Wizard with consent, progress bar, skip, share prompt, groups notice and auto-add setting. |
| `components/additional-details/FieldInput.tsx` | One input per field type. |
| `components/additional-details/DetailsSummary.tsx` | Read-only sections on the profile page; visibility checked and audited on the server. |
| `(dashboard)/interest-groups/page.tsx` | My groups (notify mode, mute, leave) and Browse. |
| `(dashboard)/interest-groups/[id]/page.tsx` | Group page. |
| `components/interest-groups/GroupView.tsx` | Group page body: rules, tabs, posts, polls, RSVP, solve, report, members and mentors, moderation. |
| `(dashboard)/blood-donors/page.tsx` | Donor finder. |
| `components/connect/ContactRequests.tsx` | Incoming and outgoing contact requests. |
| `components/connect/MatchSuggestions.tsx` | The four dashboard suggestion lists. |
| `(dashboard)/community-support/page.tsx` | Team page. |
| `components/connect/CommunitySupportView.tsx` | Team page body, plus the count widgets reused on the admin dashboard. |
| `admin/interests/page.tsx` | Hobby master admin page. |
| `components/admin/InterestsAdmin.tsx` | Hobby master admin body. |
| `admin/config/options/page.tsx` | Dropdown editor page. |
| `components/admin/OptionsAdmin.tsx` | Dropdown editor body. |
| `components/admin/TeamRolesPanel.tsx` | Assign District/State/National team roles with an area. |

### Existing files changed (minimal, one reason each)
| File | Reason |
|---|---|
| `src/app/(dashboard)/members/[id]/page.tsx` | Show the Additional Details summary; core columns only for education and business. |
| `src/app/(dashboard)/profile/page.tsx` | "Additional Details" shortcut; core education columns. |
| `src/app/(dashboard)/dashboard/page.tsx` | Suggestions and contact requests; group posts kept out of "Community Updates". |
| `src/app/(dashboard)/community/page.tsx`, `community/[id]/page.tsx` | Keep group posts and GROUP_* post types out of the community feed. |
| `src/app/(dashboard)/family/page.tsx`, `family/[id]/page.tsx`, `members/page.tsx`, `matrimony/page.tsx`, `matrimony/[id]/page.tsx` | Select only core education columns (no marks leak). |
| `src/app/api/search/route.ts`, `api/members/route.ts`, `api/members/[id]/route.ts`, `api/matrimony/profiles/route.ts`, `api/matrimony/profiles/[id]/route.ts` | Same, for search, exports-style lists and the marriage bureau (rule 8). |
| `src/app/api/posts/[id]/comments/route.ts`, `reactions/route.ts`, `api/photos/[photoId]/file/route.ts` | Group posts, comments and photos readable only inside the group. |
| `src/app/api/posts/[id]/moderate/route.ts` | Group moderators can moderate their own group's posts; resolve reports on decision. |
| `src/app/admin/moderation/page.tsx` | The queue also shows reported (FLAGGED) posts. |
| `src/app/api/post-types/route.ts` | GROUP_* types are not offered for community posts. |
| `src/app/api/groups/route.ts` | The mandal directory excludes INTEREST groups, which have their own directory. |
| `src/app/api/admin/users/[id]/route.ts`, `src/app/admin/users/[id]/page.tsx` | Team roles scoped to a district or state; role changes audited. |
| `src/app/admin/page.tsx` | Support-request counts by type and district, plus group statistics. |
| `src/components/layout/Sidebar.tsx` | Interest Groups, Blood Donors, Community Support links. |
| `src/middleware.ts` | Allow `/api/cron/*` through without a session (the route checks `CRON_SECRET`). |
| `.env.example` | `CRON_SECRET`. |

### Tests
| File | Covers |
|---|---|
| `tests/additional-details-rules.test.ts` | 12 pure rule tests: catalogue, privacy defaults, caps, forbidden identifiers, applicability, parsing. |
| `tests/uat/additional-details.test.ts` | 51 API tests. |
| `tests/uat/interest-groups.test.ts` | 29 API tests. |
| `tests/uat/extended-fixtures.ts` | Throw-away people, families and teams; full cleanup. |

No existing test was edited.

## 4. Test results

The suites run against MySQL 8.0, as in CI.

| | Test files | Tests | Result |
|---|---|---|---|
| Baseline (before any change) | 15 | 204 | all passed; `tsc --noEmit` clean |
| Final | 18 | 296 | all passed (the 204 baseline tests unchanged); `tsc --noEmit` clean; `next build` succeeds |

The brief's requested test areas map to these test IDs:

| Requested coverage | Test IDs |
|---|---|
| Each section save / edit / delete | TC-AD-SEC 1–23 |
| Conditional fields | TC-AD-010, 011, 012 |
| Visibility at every level | TC-AD-030 × 5 levels × 6 viewers |
| Capped sections | TC-AD-031 |
| Masking and finder-only fields | TC-AD-032 |
| Search, member API and bureau leaks | TC-AD-033 |
| Support opt-in, district scope, State/National counts, withdrawal | TC-AD-040–044 |
| Karta and parent entry for a minor; minor can't self-edit; Karta can't edit an adult with a login | TC-AD-020–023 |
| Consent stored with version, time and IP | TC-AD-001/002 |
| Audit entries without values | TC-AD-052 |
| Uploads | TC-AD-051 |
| Dropdown master | TC-AD-060 |
| Team scoping | TC-AD-070 |
| Group auto-creation and auto-join | TC-IG-001/002 |
| "Other" approval and merge | TC-IG-003/004 |
| Leave and not re-added | TC-IG-010 |
| Removal after confirmation | TC-IG-011 |
| "Do not auto-add" | TC-IG-012 |
| Sensitive topics create no groups | TC-IG-020 |
| Minors | TC-IG-030–032, 100 |
| District sub-group threshold | TC-IG-040 |
| Group reveals only allowed fields; members can't see other sections | TC-IG-050–052 |
| Group features and moderation | TC-IG-060–064 |
| Digest | TC-IG-065 |
| Exam and profession thresholds | TC-IG-070/071 |
| Donor finder and contact | TC-IG-080 |
| Matching | TC-IG-090/091 |

The wizard, auto-join notice, group page and dashboard were also walked through in a real browser (Chromium, 390 px wide) against the production build.

## 5. Deploying on the shared host

These steps are for the person who deploys. Nothing here was run against production.

1. **Back up the database** (hPanel → Databases → phpMyAdmin → Export) and keep the current app folder.
2. Deploy the code as you do today (`git pull` on the host, or upload the build).
3. Run `npm ci`, then `npx prisma migrate deploy`. This applies exactly the two new migrations, which are additive only.
   - If you manage the schema through phpMyAdmin instead, import `database/phpmyadmin/add_additional_details_and_interest_groups.sql` **once**.
   - Then run `npx prisma migrate resolve --applied 20261009100000_member_additional_details` and `npx prisma migrate resolve --applied 20261009110000_interest_groups`.
4. Run `npm run db:seed` to add the team roles, district areas, hobby master and group post types. It is idempotent and creates no test accounts unless `SEED_TEST_ACCOUNTS=true`. The phpMyAdmin file already contains the same reference data.
5. Add `CRON_SECRET=<long random string>` to the app's environment variables.
6. Run `npm run build`, then restart the Node.js app from hPanel.
7. Create the daily digest cron job (hPanel → Advanced → Cron Jobs, once a day, e.g. 07:00):
   `curl -s -X POST -H "x-cron-secret: <CRON_SECRET>" https://<your-site>/api/cron/group-digest`
8. Sign in as Admin:
   - Assign **Community teams** on each person's user page (Admin → Users → user → Community teams): a district for District team, a state for State team.
   - Review the **Hobby master** (Admin → Hobby Master & Approvals) and the child-safe flags.
   - Adjust **Additional Details Dropdowns** if needed.
9. Uploads use the existing `UPLOAD_DIR`. Keep it outside `public_html`, as it is for photos today.

**Rollback:**
1. Restore the previous app build.
2. Run `prisma/migrations/20261009110000_interest_groups/down.sql`, then `prisma/migrations/20261009100000_member_additional_details/down.sql`. The phpMyAdmin rollback file does both.
3. Delete the two rows from `_prisma_migrations`, as the scripts' headers describe.

Rollback removes all data entered in these sections.

## 6. Assumptions and decisions

These are worth confirming.

1. **Stack.** The work is in Next.js + Prisma + MySQL, because that is what this repository is (see the note at the top). The brief's "bkesari.com/ladwani" host was not touched.
2. **Visibility levels.** Rule 2 lists four levels but gives "Community" as a default. Five levels were implemented, ordered narrowest to widest:
   - Only me
   - My Karta
   - My family
   - Community bodies (Admin, Operators, and the District team for the member's district)
   - Community (all signed-in members)
3. **Staff don't bypass this area.** Unlike the core profile, Admins and Operators can neither edit nor see these sections unless the member's visibility includes Community bodies. Capped sections are never visible to them.
4. **Editing.**
   - Under 18 (by date of birth): only a parent (father/mother relationship) or the Karta can edit, even if the child has a login.
   - Adult with a login: only that adult.
   - Adult without a login: the Karta.
   - A member with no date of birth is treated as an adult.
5. **Help on No.** "Needs help" questions in Insurance, Doctor, Adviser, Banking (existing loans and other needs) and Education are also shown when the gate answer is **No**. People without insurance or a doctor are exactly the ones who may need help.
6. **Support-request names.** Names are shown only to the **District team of the request's district**. A district team is a `DISTRICT_TEAM` role, or an `OPERATOR` scoped to a DISTRICT area. State and National teams, Admin and unscoped Operators see counts only. The district comes from the member's current address.
7. **Groups and section visibility.** Auto-join uses the member's answers even when the section is set to Only me. This applies to Farmers, Women's wing, Senior citizens and Exam groups. The member is notified straight away, can leave in one tap, and can switch auto-add off. Hobby levels and mentor badges inside a group are shown only if the member shares Hobbies/Sports with the Community.
8. **Fitness & yoga.** Section 14 (health) is a sensitive topic, so it never auto-joins anyone.
   - The **Fitness and yoga** group is fed by the Wellness hobbies (yoga, meditation, gym).
   - Ticking "Wants: fitness/yoga group" in section 14 only *suggests* that group with a Join button.
9. **Child-safe posting.** Posts are held for a moderator only in child-safe groups that currently have an under-18 member. Other groups publish immediately and rely on reports: three reports flag a post into the existing moderation queue.
10. **Direct messages.** The codebase has no DM feature. The minors rule is enforced on the "request contact" flow (donor finder and suggestions), which is the only member-to-member contact channel.
11. **Deleting a section.**
    - Education and Business rows belong to the existing profile screens. Deleting those sections clears only the columns this feature added (marks, marksheet, contact, directory flag, support needs) and their uploaded files. The degree or business record itself stays.
    - Blood group and languages are existing profile fields and are also kept.
    - Everything else, including support requests, is hard-deleted.
12. **Audit.** Audit entries record the section, the answer, the visibility, field *names* and row counts, never the values. That way a deleted section really is gone.
13. **Districts.** District areas for 10 Maharashtra districts are seeded. More can be added in the `areas` table, and farm-holding district pickers read from it.
14. **Profession groups** use the existing `members.occupationCategory` field, normalised.
15. **Dropdown values** fall back to the built-in defaults until an Admin edits a list. Removed options become inactive rows, so stored answers keep their labels.
