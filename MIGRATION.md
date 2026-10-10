> **PostgreSQL is the final database (Oct 2026). This runbook applies again.**
> It was marked superseded on 10 Sep 2026, when the app was ported to MySQL
> for Hostinger shared hosting. That port has been reversed: the schema,
> migrations and SQL scripts now target PostgreSQL only (see `DEPLOYMENT.md`
> and `scripts/postgres/`). Any MySQL database this app has used, including
> the live Hostinger one referenced by `ladwani/env1` and `env2`, which held
> real community data, can no longer be read by the app. If that data still
> matters, it has to be copied across once with this runbook **before** the
> MySQL database is overwritten or decommissioned.

# MySQL → PostgreSQL Migration Runbook

## Why this exists

`prisma/schema.prisma` targets PostgreSQL. The only real credentials found in
this repo (`ladwani/env1`, `ladwani/env2`, both untracked) point at a live
MySQL database on Hostinger shared hosting (`u879099820_miladwani`, host
`localhost`, so it's reachable only from inside Hostinger's own network). That
database was confirmed to hold real community data. A PostgreSQL-targeted
Prisma client cannot read MySQL, so the real data has to be moved across
once, deliberately. The same applies to any other database built by this
repo's former MySQL migrations, such as the dev site's.

**This runbook and `scripts/migrate-mysql-to-postgres.ts` have never been
run against the real database.** The environment they were written in has no
network path to the Hostinger MySQL host. The script has been tested end to
end against MySQL 8.0 and MariaDB 10.11 databases built by this repo's
former MySQL migrations and filled with rows in all 71 tables. After the
copy, every row read back through Prisma matched the source exactly (687
and 587 rows). Run every step below yourself, in order, from a machine that
*can* reach the database: the Hostinger server itself, or your own machine
through an SSH tunnel to it, e.g.

```bash
# Forward local port 3307 to the MySQL server as Hostinger's host sees it.
# 65002 is Hostinger's SSH port; use the user and host from hPanel → SSH Access.
ssh -p 65002 -N -L 3307:localhost:3306 <ssh-user>@<ssh-host>
# then use MYSQL_URL=mysql://<db-user>:<password>@127.0.0.1:3307/<db-name>
```

The script needs the `mysql2` and `ts-node` devDependencies, so run it from
a full `npm ci` checkout of this repo. The server's `npm ci --omit=dev`
install doesn't include them. `mysql2` stays in `devDependencies` for this
script only; the app itself never talks to MySQL.

## Before you start

- [ ] **Back up the MySQL database first**, independent of anything below:
  ```bash
  mysqldump -h <host> -u u879099820_miladwani -p u879099820_miladwani > backup-$(date +%Y%m%d).sql
  ```
  (Or hPanel → Databases → phpMyAdmin → Export.) Store this somewhere
  outside the Hostinger account, for example download it to your own machine.
- [ ] Provision the destination PostgreSQL (13 or newer). Hostinger's
  shared/cloud web hosting does not offer PostgreSQL, so this is a managed
  PostgreSQL service or a VPS. See `DEPLOYMENT.md` Part 1. Confirm you can
  connect to it with `psql`.
- [ ] Create the schema on the **empty** destination, and **do not seed it**.
  The reference rows (roles, permissions, areas, ...) come across from MySQL
  with the ids the migrated data points at. A seeded database would hold the
  same codes under different ids, and the copy would fail on unique keys.
  ```bash
  DATABASE_URL="postgresql://...?schema=public" npx prisma migrate deploy
  ```
  (`scripts/postgres/01-schema.sql` is equivalent. Skip `02-reference-data.sql`.)
- [ ] Confirm nobody is writing to the MySQL database during the migration
  window. Put the live site in maintenance mode if it's serving traffic. This
  script makes a point-in-time copy, not an ongoing sync.

## Step 1 — Dry run: inspect what's actually there

```bash
MYSQL_URL="mysql://u879099820_miladwani:<password>@<host>:3306/u879099820_miladwani" \
  DATABASE_URL="postgresql://...?schema=public" \
  npm run migrate:mysql-to-postgres -- --dry-run
```

This connects, counts rows per table, compares every MySQL table's columns
with `prisma/schema.prisma`, and writes nothing. It reports:

- **MySQL tables with no model in the schema**: these are *not* copied.
- **Columns only in MySQL**: dropped during the copy.
- **Required columns missing in MySQL**: every row of that table will fail.

The script reads the table list, column types and relations from the Prisma
schema itself, so it covers every model the current schema has. It assumes
MySQL column names match the Prisma field names (camelCase, e.g.
`firstName`, `passwordHash`), which is how this repo's MySQL migrations
created them. If the live database is older or was edited by hand, the dry
run shows exactly where it differs. Decide how to handle each difference
**before** the real run. It exits with code 1 if it found any. A
`migration-report-<timestamp>.json` is written too (gitignored).

## Step 2 — Fix problem data in MySQL first

Check for the failure modes found in the old application (duplicate Member
records, Families with no Karta, users with no Member), and for rows
PostgreSQL will refuse that MySQL accepted:

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

-- Overlapping active bookings of one asset. MySQL relied on a row lock in the
-- app; PostgreSQL's bookings_no_overlap constraint refuses the second one.
SELECT a.id, b.id, a.assetId FROM bookings a JOIN bookings b
  ON a.assetId = b.assetId AND a.id < b.id
  AND a.startAt < b.endAt AND b.startAt < a.endAt
  WHERE a.status IN ('PENDING_PAYMENT','CONFIRMED') AND b.status IN ('PENDING_PAYMENT','CONFIRMED');

-- Bookings whose end is not after their start (PostgreSQL's range check rejects them)
SELECT id FROM bookings WHERE endAt < startAt;
```

Decide how to handle what you find (merge duplicate members, assign a Karta,
create missing Member rows, cancel one of each overlapping pair) **before**
migrating. It's much easier to fix in MySQL, where you still have the full
original context, than afterwards.

Email addresses need no clean-up. `users.email` and `members.email` are
case-insensitive in both databases (MySQL by collation, PostgreSQL as
`CITEXT`). The unique index on `users.email` therefore can't reject anything
MySQL accepted. `members.email` has no unique constraint at all; the
duplicate-members query above already compares it case-insensitively on
MySQL.

## Step 3 — Migrate

```bash
MYSQL_URL="mysql://u879099820_miladwani:<password>@<host>:3306/u879099820_miladwani" \
  DATABASE_URL="postgresql://...?schema=public" \
  npm run migrate:mysql-to-postgres
```

What it does:

- Copies tables parents first. Foreign keys that form a cycle (members ↔
  photos, families → members) or point at their own table (areas, comments,
  community groups, interests) are inserted as NULL, then filled in once
  every table is copied.
- Converts types: `TINYINT(1)`/`BIT` → boolean, JSON (MySQL `JSON` or
  MariaDB `LONGTEXT`) → `jsonb`, keeping JSON `null` distinct from SQL `NULL`,
  `BIGINT` → bigint, and `DATETIME(3)` read as UTC (Prisma writes UTC), so no
  timestamps shift.
- **Safe to re-run.** Rows whose primary key already exists in PostgreSQL are
  skipped, so after fixing a problem you run the same command again.
  Nothing needs resetting.
- Every row that didn't arrive is retried on its own and reported by primary
  key with the database's reason (an enum value the schema no longer has, a
  unique clash, an overlapping booking). The rest of its table still goes
  through. Rows that depend on it (e.g. the payments of a refused booking)
  then fail too and are reported as well.

At the end it writes `migration-report-<timestamp>.json` with, per table:
MySQL rows, inserted, already present, PostgreSQL rows afterwards, and
failed rows. The report lists primary keys and errors only, never row
contents, but treat it as internal anyway. The command **exits with code 1
if any row failed or any table has fewer rows in PostgreSQL than in MySQL**.
Read the report before you declare the migration done.

`--only=users,members` limits a run to the named tables, and
`--batch-size=<n>` changes the batch size (default 500).

## Step 4 — Validate relationships

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

Then confirm the schema still matches exactly:

```bash
npx prisma migrate status                      # "Database schema is up to date!"
npx prisma migrate diff --from-url "$DATABASE_URL" \
  --to-schema-datamodel prisma/schema.prisma   # "No difference detected."
```

## Step 5 — Bring the reference data up to date

The copied reference data is whatever the live MySQL database held. If it
predates newer features (team roles, district areas, the interest
catalogue, group post types), add the missing rows. `npm run db:seed` only
upserts by code or id and creates no test accounts unless
`SEED_TEST_ACCOUNTS=true`:

```bash
DATABASE_URL="postgresql://...?schema=public" npm run db:seed
```

It also creates the admin login from `ADMIN_EMAIL`/`ADMIN_PASSWORD` if that
email doesn't exist yet. Set both to what you want, or remove that account
afterwards.

## Step 6 — Test login, family ownership, and permissions

Using a handful of real (migrated) accounts:

- [ ] Log in as a regular member. You land on `/dashboard` and see your own
  family if you had one in MySQL.
- [ ] Log in as a Karta. `/family` shows your family with the Karta badge,
  and "Add Member" is visible.
- [ ] Log in as an Operator/Admin. `/admin` and `/admin/approvals` are
  reachable and show migrated data.
- [ ] Spot-check a few member profiles for education/employment/skills
  records against what was in MySQL.
- [ ] Search for a member with a lower-case name. PostgreSQL search is
  case-insensitive like MySQL's was.

## Step 7 — Cut over

Once satisfied:
1. Point the production `DATABASE_URL` at the new PostgreSQL database.
2. Deploy.
3. Keep the MySQL database (and the backup from "Before you start")
   read-only and available for at least one full backup cycle, in case
   anything surfaces after cutover.
4. Update `ladwani/env1`/`env2` (or wherever production secrets live) to
   remove the now-stale MySQL credentials once you're confident you won't
   need to re-run any part of this.
