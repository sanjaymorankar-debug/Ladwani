# MySQL → PostgreSQL Data Migration Runbook

## Why this exists

PostgreSQL is the app's final database (9 Oct 2026). Before that the app ran
on MySQL — first a legacy Hostinger database, then the MySQL port used for
`devmiladwani.agtci.com` and the dev site. Any of those databases that holds
rows worth keeping has to be copied across once, deliberately; a
PostgreSQL-targeted Prisma client cannot read MySQL.

If a database holds nothing worth keeping (test data only), skip all of this:
build a fresh PostgreSQL database with `scripts/postgres/` and seed it.

> The only real credentials ever found for this project (`ladwani/env1`,
> `ladwani/env2`, both untracked) pointed at a live MySQL database on
> Hostinger shared hosting (`u879099820_miladwani`, host `localhost` —
> reachable only from inside Hostinger's network) that was confirmed to hold
> real community data. If that database still exists and still matters,
> migrate it with this runbook before it is ever overwritten or
> decommissioned.

**`scripts/migrate-mysql-to-postgres.ts` has been tested end to end** against
a MariaDB database built from this app's last MySQL migrations and filled with
its seed and test data: every row arrived, timestamps, JSON, BigInt and
boolean values matched, all foreign keys re-validated, a re-run inserted
nothing, and the full test suite passed against the result. It has **not**
been run against the live Hostinger database — there is no network path to
it from where it was built. Run every step below yourself, in order, from a
machine that can reach both databases (the Hostinger server itself, or your
machine through an SSH tunnel).

## Before you start

- [ ] **Back up the MySQL database first**, independent of anything below:
  ```bash
  mysqldump -h <host> -u <user> -p <database> > backup-$(date +%Y%m%d).sql
  ```
  Store this somewhere outside the Hostinger account (download it locally).
- [ ] Provision the destination PostgreSQL database — see
  [scripts/postgres/README.md](scripts/postgres/README.md) — and confirm you
  can connect with `psql`.
- [ ] Create the schema **only** — no reference data yet:
  ```bash
  DATABASE_URL="postgresql://..." npx prisma migrate deploy
  ```
  (or run `scripts/postgres/01-schema.sql` alone). Do **not** run
  `02-reference-data.sql` or `npm run db:seed` before the copy: they create
  roles, permissions and an admin with new ids, and the MySQL rows that refer
  to the old ids would then point at nothing. Seeding comes after, in Step 5.
- [ ] Confirm nobody is writing to the MySQL database during the migration
  window (put the live site in maintenance mode if it's serving traffic) —
  this script does a point-in-time copy, not ongoing sync.

## Step 1 — Inspect what's actually there

```bash
mysql -h <host> -u <user> -p -e "SHOW TABLES;" <database>
mysql -h <host> -u <user> -p -e "DESCRIBE users;" <database>
```

The script reads its table and column list from `prisma/schema.prisma`, and
assumes the MySQL table and column names match it (camelCase columns, e.g.
`firstName`, `passwordHash`) — which they do for any database built from this
app's MySQL migrations. The dry run in Step 3 tells you exactly where the live
database differs: a MySQL table the schema doesn't have is ignored, a schema
table MySQL doesn't have is reported and skipped, and a MySQL column the
schema doesn't know is listed per table and **not copied**. Decide whether
anything listed matters before going further.

## Step 2 — Identify duplicates in the source data

Check for the failure modes this rebuild's root-cause analysis found in the
old application (duplicate Member records, families with no Karta, users with
no matching Member):

```sql
-- Members that share mobile or email
SELECT mobilePrimary, COUNT(*) FROM members WHERE mobilePrimary IS NOT NULL
  GROUP BY mobilePrimary HAVING COUNT(*) > 1;
SELECT email, COUNT(*) FROM members WHERE email IS NOT NULL
  GROUP BY email HAVING COUNT(*) > 1;

-- Users whose emails differ only in letter case. MySQL treated these as the
-- same address; PostgreSQL's unique index does not, and login matches either.
SELECT LOWER(email), COUNT(*) FROM users WHERE email IS NOT NULL
  GROUP BY LOWER(email) HAVING COUNT(*) > 1;

-- Families with no Karta set
SELECT id, name FROM families WHERE kartaMemberId IS NULL;

-- Users with no Member row (would break login's session.memberId assumption)
SELECT u.id, u.email FROM users u LEFT JOIN members m ON m.userId = u.id
  WHERE m.id IS NULL;
```

Decide how to handle what you find (merge duplicate members, assign a Karta
manually, create missing Member rows) **before** migrating — it's much easier
to fix in MySQL, where you still have the full original context.

## Step 3 — Dry run

```bash
MYSQL_URL="mysql://<user>:<password>@<host>:3306/<database>" \
  npm run migrate:mysql-to-postgres -- --dry-run
```

This connects to MySQL only, counts rows and compares columns per table, and
writes nothing to either database. Review the console output and the
`migration-report-<timestamp>.json` it writes.

## Step 4 — Migrate

```bash
MYSQL_URL="mysql://<user>:<password>@<host>:3306/<database>" \
  DATABASE_URL="postgresql://..." \
  npm run migrate:mysql-to-postgres
```

What it does:

1. Saves the definitions of every PostgreSQL foreign key to
   `fk-backup-<timestamp>.sql`, then drops them. The schema has cycles
   (`families` ↔ `members`, and self-references such as `areas.parentId`), so
   no table order would satisfy every constraint during the copy.
2. Copies every table in batches of 500, converting MySQL's 0/1 booleans,
   BIGINT, JSON and UTC timestamps to their PostgreSQL types.
3. Re-creates every foreign key — which re-checks every copied row — even if
   the copy failed part-way. If all succeed the backup file is deleted; if one
   can't be re-created, the copied data has rows pointing at missing parents:
   fix or delete them, then run the matching line of the backup file.

`DATABASE_URL` must be the role that owns the tables (the one that ran
`prisma migrate deploy`), since dropping and re-creating foreign keys needs
ownership. If the process is killed before step 3 finishes, run the
`fk-backup-*.sql` file with `psql` to put the constraints back.

It's safe to re-run: rows whose primary key (or another unique column)
already exists are skipped, so a failed run can be repeated after fixing the
cause. `--only=users,members` limits a run to the named tables.

Read the `migration-report-<timestamp>.json` before declaring the migration
done — especially each table's `failedBatches` and `unknownColumns`, and the
top-level `foreignKeyFailures`. The report and backup files can contain member
data; they are gitignored, and should be deleted once you're done.

## Step 5 — Add reference data that is newer than the MySQL copy

```bash
DATABASE_URL="postgresql://..." npm run db:seed
```

The seed is idempotent and keyed by codes, so it leaves the copied roles,
permissions and settings alone and only adds what the MySQL database predates
(newer permissions, interests, post types and so on). Make sure `ADMIN_EMAIL`
is the existing admin's address, or it will create a second admin.

## Step 6 — Validate relationships

```sql
-- Every Karta-flagged FamilyMember should match Family.kartaMemberId
SELECT fm."familyId", fm."memberId", f."kartaMemberId"
FROM family_members fm JOIN families f ON f.id = fm."familyId"
WHERE fm."isKarta" = true AND f."kartaMemberId" != fm."memberId";

-- Every UserRole with code KARTA should have a matching family
SELECT ur.id FROM user_roles ur JOIN roles r ON r.id = ur."roleId"
WHERE r.code = 'KARTA' AND ur."familyId" IS NULL;

-- Row counts should match the MySQL source (from Step 3) minus any rows
-- you deliberately excluded in Step 2
SELECT 'users' AS t, COUNT(*) FROM users
UNION ALL SELECT 'members', COUNT(*) FROM members
UNION ALL SELECT 'families', COUNT(*) FROM families;
```

## Step 7 — Test login, family ownership, and permissions

Using a handful of real (migrated) accounts:

- [ ] Log in as a regular member — lands on `/dashboard`, sees their own
  family if they had one in MySQL.
- [ ] Log in as a Karta — `/family` shows their family with the Karta badge,
  "Add Member" is visible.
- [ ] Log in as an Operator/Admin — `/admin` and `/admin/approvals` are
  reachable and show migrated data.
- [ ] Spot-check a few member profiles for education/employment/skills
  records, and photos, against what was in MySQL.

## Step 8 — Cut over

Once satisfied:
1. Point the production `DATABASE_URL` at the new PostgreSQL database.
2. Deploy.
3. Keep the MySQL database (and the backup from "Before you start")
   read-only and available for at least one full backup cycle in case
   anything surfaces post-cutover.
4. Remove the now-stale MySQL credentials from `ladwani/env1`/`env2` (or
   wherever production secrets live) once you're confident you won't need to
   re-run any part of this.
