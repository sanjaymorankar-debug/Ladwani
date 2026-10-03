# Personal information form — extension

Extends the member **Edit Profile** form (`/members/[id]/edit`). Everything that
was already there (fields, physical-field config, spouse linking, the separate
photo/education/employment/business/skills editors) still works as before.

## New fields

| Section | Field | Stored in | Notes |
|---|---|---|---|
| Personal | Marital status (radio: Unmarried / Married / Other status) | `members.maritalStatus` (existing) | Required. "Married" still goes through *Link Spouse* (approval-gated), as before. "Other status" reveals Widowed / Divorced / Separated / Not stated so existing records keep loading. |
| Personal | Age | — | Calculated from date of birth, shown next to it. |
| Address | House/street, area/locality, city/village, **taluka**, district, state, PIN, country | `addresses` (CURRENT row) — `line1`, `line2`, `city`, **`taluka`**, `district`, `state`, `pincode`, `country` | Same record the address editor manages; changing an address already on record is queued for review (§28) exactly like before. |
| Address | **Latitude / longitude** | `addresses.latitude`, `addresses.longitude` (DOUBLE) | "Use my current location" + draggable/tappable map pin (Leaflet + OpenStreetMap). Optional — denial falls back to typed address. |
| Education | Level (dropdown), Other (text), stream/specialisation, institution | `member_profile_details` | "Other" text only kept when Other is selected. |
| Employment & Income | Annual income range (optional) | `member_profile_details.annualIncomeRange` | Below 2 LPA … Above 50 LPA, Prefer not to say. |
| Unmarried only | Toggles *Pursuing education*, *Earning* | `member_profile_details` | Card shown only when status is Unmarried. |
| ↳ Pursuing education | Current course (required), institution, expected completion year | `member_profile_details` | |
| ↳ Earning | Type: Job / Business (required) | `earningType` | |
| ↳↳ Job | Company name (required), designation, sector (Government / Private / Other) | `companyName`, `designation`, `jobSector` | |
| ↳↳ Business | Business name (required), type of business | `businessName`, `businessType` | |
| ↳ Earning | Toggle *Ready for marriage* | `readyForMarriage` | |
| ↳↳ Ready | Toggle *Looking for marriage* | `lookingForMarriage` | |
| ↳↳↳ Looking | Height, mother tongue, native place, partner expectations | `marriageHeightCm`, `motherTongue`, `nativePlace`, `partnerExpectations` | Height pre-fills from the profile height. |

**Clearing rule.** Switching a toggle off clears everything under it (including
nested toggles); picking Job ↔ Business clears the other type's fields; leaving
Unmarried clears the whole Unmarried flow. This happens in the form as you click
*and* again on the server (`applyToggleRules` in `src/lib/profile-details.ts`),
so a hidden or stale value can never be stored. Becoming Married through the
spouse flow also clears it.

## Validation (client and server share `src/lib/profile-details.ts`)

- First name required (≥ 2 chars); marital status must be a known value.
- Mobile: 10-digit Indian number (`+91`, `91`, `0` prefixes and spaces accepted, stored as 10 digits). Only checked when changed, so legacy values still save.
- Email format; date of birth not in the future.
- PIN code: 6 digits, not starting with 0 (Indian addresses only).
- Latitude −90…90, longitude −180…180, both or neither.
- Conditional required fields above; option lists; completion year (last year … +15); marriage height 100–250 cm.

## Database

Migration `prisma/migrations/20261003120000_member_profile_details` (also as
`database/phpmyadmin/add_member_profile_details.sql` for phpMyAdmin). Additive
only: three nullable columns on `addresses`, and a new 1:1 table
`member_profile_details`. Existing members have no row and load with every new
field empty.

## Test cases

Automated: `tests/profile-details.test.ts` (rules, no DB) and
`tests/uat/personal-info-form.test.ts` (API, TC-PIF-001…017). Manual checks:

| # | Scenario | Steps | Expected |
|---|---|---|---|
| 1 | Existing record | Open Edit Profile for a member saved before this change | Loads; all new fields empty; saving without touching them works |
| 2 | Married | Member already Married: set education Professional, income 10–20 LPA, save | Saved; "Current Situation" card not shown |
| 3 | Married radio | Unmarried member clicks Married | Disabled with hint "Use Link Spouse below" (unchanged rule) |
| 4 | Unmarried + studying | Unmarried → Pursuing education on → course, institution, year → save | Saved; reload shows values |
| 5 | Unmarried + job | Earning on → Job → company, designation, sector → save | Saved; business fields empty |
| 6 | Unmarried + business | Earning on → Business → business name, type → save | Saved; job fields empty |
| 7 | Marriage chain | Earning on → Ready on → Looking on → height, mother tongue, native place, expectations → save | All saved |
| 8 | Required in sections | Turn a toggle on, leave its required field blank, save | Inline error, scrolled into view; server returns 400 too |
| 9 | Pursuing education off | After #4, switch it off → save | Course/institution/year cleared in form and DB |
| 10 | Earning off | After #7, switch Earning off | Job/business, Ready, Looking and marriage details hidden and cleared; turning Earning back on shows them empty |
| 11 | Ready for marriage off | After #7, switch Ready off | Looking + marriage details cleared; job kept |
| 12 | Looking off | After #7, switch Looking off | Only marriage details cleared |
| 13 | Job → Business | After #5, choose Business | Company/designation/sector cleared |
| 14 | Status change | After #7, choose Other status → Widowed → save | Unmarried flow cleared in DB |
| 15 | Spouse linked | Unmarried member with details gets married via Link Spouse (approved) | Unmarried flow cleared |
| 16 | Location allowed | Click "Use my current location", allow | Pin placed, coordinates shown; drag pin to adjust; save stores lat/lng |
| 17 | Location denied | Click it and deny | Notice shown; map still usable for a manual pin; form saves with typed address only |
| 18 | Address change review | Change a saved address (or move the pin) as a member | Profile saves; toast says address change sent for review |
| 19 | Format errors | PIN `12345`, mobile `12345`, invalid email | Inline errors; server rejects the same |
| 20 | Mobile layout | 390 px wide | Single-column fields, toggles and radios full-width, sections animate open/closed |
