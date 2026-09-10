> **Superseded 10 Sep 2026.** The deployment target changed back to MySQL
> (this app was ported — see `DEPLOYMENT.md`), and the user confirmed there's
> no real production data to carry over for the `devmiladwani.agtci.com`
> deploy. This runbook (written for the opposite direction, MySQL → Postgres)
> no longer applies to that deploy. It's left here only because it documents
> real credentials (`ladwani/env1`, `env2`) that once pointed at a live
> MySQL database with real community data — if that database still exists
> and still matters, say so before it's ever overwritten or decommissioned.

# MySQL → PostgreSQL Migration Runbook

## Why this exists

`schema.prisma` targets PostgreSQL, but the only real credentials found in this
repo (`ladwani/env1`, `ladwani/env2`, both untracked) point at a live MySQL
database on Hostinger shared hosting (`u879099820_miladwani`, host
`localhost` — reachable only from inside Hostinger's own network). That
database was confirmed to hold real community data. This app cannot connect
to it as currently configured (a Postgres-targeted Prisma client cannot speak
to MySQL), so real data has to be moved across once, deliberately.

**This runbook and `scripts/migrate-mysql-to-postgres.ts` were written but
never executed against the real database** — there is no network path from
the environment this was built in to the Hostinger MySQL host. Run every step
below yourself, in order, from a machine that *can* reach it (the Hostinger
server itself, or your machine via an SSH tunnel to it).

## Before you start

- [ ] **Back up the MySQL database first**, independent of anything below:
  ```bash
  mysqldump -h <host> -u u879099820_miladwani -p u879099820_miladwani > backup-$(date +%Y%m%d).sql
  ```
  Store this somewhere outside the Hostinger account (download it locally).
- [ ] Provision the destination PostgreSQL database (managed Postgres, or
  install it on the new host) and confirm you can connect with `psql`.
- [ ] Apply the Prisma migration history to create the schema:
  ```bash
  DATABASE_URL="postgresql://..." npx prisma migrate deploy
  ```
- [ ] Confirm nobody is actively writing to the MySQL database during the
  migration window (put the live site in maintenance mode if it's serving
  traffic) — this script does a point-in-time copy, not ongoing sync.

## Step 1 — Inspect what's actually there

Before trusting the mapping this script assumes, check the live schema
against `prisma/schema.prisma`:

```bash
mysql -h <host> -u u879099820_miladwani -p -e "SHOW TABLES;" u879099820_miladwani
mysql -h <host> -u u879099820_miladwani -p -e "DESCRIBE users;" u879099820_miladwani
```

The script assumes MySQL column names match the Prisma field names exactly
(camelCase — e.g. `firstName`, `passwordHash`), because `schema.prisma` has
no per-field `@map()` and the legacy `ladwani/create_tables.sql` was
generated from a MySQL-targeted version of this same schema. If the live
table shape has drifted (added columns, renamed columns, a different casing
convention), **note the differences before running anything** — the script
will report failed batches per table rather than silently dropping data, but
you should know what to expect.

## Step 2 — Identify duplicates in the source data

Before migrating, check for the failure modes this rebuild's root-cause
analysis found in the *application* (duplicate Member records, orphaned
Family rows with no Karta, users with no matching Member):

```sql
-- Members that share mobile or email (should be unique but weren't enforced
-- everywhere in the old app)
SELECT mobilePrimary, COUNT(*) FROM members WHERE mobilePrimary IS NOT NULL
  GROUP BY mobilePrimary HAVING COUNT(*) > 1;
SELECT email, COUNT(*) FROM members WHERE email IS NOT NULL
  GROUP BY email HAVING COUNT(*) > 1;

-- Families with no Karta set
SELECT id, name FROM families WHERE kartaMemberId IS NULL;

-- Users with no Member row (would break login's session.memberId assumption)
SELECT u.id, u.email FROM users u LEFT JOIN members m ON m.userId = u.id
  WHERE m.id IS NULL;
```

Decide how to handle what you find (merge duplicate members, assign a Karta
manually, create missing Member rows) **before** migrating — it's much easier
to fix in MySQL, where you still have the full original context, than after.

## Step 3 — Dry run

```bash
cd app
MYSQL_URL="mysql://u879099820_miladwani:<password>@<host>:3306/u879099820_miladwani" \
  npm run migrate:mysql-to-postgres -- --dry-run
```

This connects, counts rows per table, and writes nothing. Review the console
output — row counts per table should roughly match what you saw in Step 1.

## Step 4 — Migrate

```bash
MYSQL_URL="mysql://u879099820_miladwani:<password>@<host>:3306/u879099820_miladwani" \
  DATABASE_URL="postgresql://..." \
  npm run migrate:mysql-to-postgres
```

Tables are migrated in FK-safe order (parents before children — see the
`TABLES` array in the script). It's safe to re-run: existing rows are
skipped by primary key (`skipDuplicates: true`), so a failed run can be
re-run after fixing the underlying issue rather than needing a full reset.

If a table needs a data type that isn't a plain string/number/date, the
script hand-cases known booleans (MySQL `TINYINT(1)` → Postgres boolean),
`BigInt` fields (`Photo.fileSizeBytes`, `IncomeRange.min/maxValue`), and JSON
columns (`Approval.oldValue/newValue`, `Setting.value`, etc.) — see the
`booleanFields`/`bigIntFields`/`jsonFields` lists per table in the script. If
Step 1 found extra/different columns, extend those lists before running.

A JSON report (`migration-report-<timestamp>.json`) is written at the end
with per-table row counts and any batch failures with a sample failing row —
**read this before declaring the migration done**, especially the
`failedBatches` field for each table.

## Step 5 — Validate relationships

```sql
-- Every Karta-flagged FamilyMember should match Family.kartaMemberId
SELECT fm."familyId", fm."memberId", f."kartaMemberId"
FROM family_members fm JOIN families f ON f.id = fm."familyId"
WHERE fm."isKarta" = true AND f."kartaMemberId" != fm."memberId";

-- Every UserRole with code KARTA should have a matching family
SELECT ur.id FROM user_roles ur JOIN roles r ON r.id = ur."roleId"
WHERE r.code = 'KARTA' AND ur."familyId" IS NULL;

-- Row counts should match the MySQL source (from Step 1) minus any rows
-- you deliberately excluded in Step 2
SELECT 'users' AS t, COUNT(*) FROM users
UNION ALL SELECT 'members', COUNT(*) FROM members
UNION ALL SELECT 'families', COUNT(*) FROM families;
```

## Step 6 — Test login, family ownership, and permissions

Using a handful of real (migrated) accounts:

- [ ] Log in as a regular member — lands on `/dashboard`, sees their own
  family if they had one in MySQL.
- [ ] Log in as a Karta — `/family` shows their family with the Karta badge,
  "Add Member" is visible.
- [ ] Log in as an Operator/Admin — `/admin` and `/admin/approvals` are
  reachable and show migrated data.
- [ ] Spot-check a few member profiles for education/employment/skills
  records against what was in MySQL.

## Step 7 — Cut over

Once satisfied:
1. Point the production `DATABASE_URL` at the new Postgres instance.
2. Deploy.
3. Keep the MySQL database (and the Step 0 backup) read-only and available
   for at least one full backup cycle in case anything surfaces post-cutover.
4. Update `ladwani/env1`/`env2` (or wherever production secrets live) to
   remove the now-stale MySQL credentials once you're confident you won't
   need to re-run any part of this.
