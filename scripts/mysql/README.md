# MySQL setup for Mi Ladwani

Two ways to create the database schema. **Pick one — don't do both.**

| | Use when | How |
|---|---|---|
| **A. phpMyAdmin import** (this folder) | Hostinger shared hosting, or anywhere you'd rather not use a command line | Import `01-schema.sql` then `02-reference-data.sql` |
| **B. Prisma CLI** | You have SSH/terminal access to the server | `npx prisma migrate deploy` then `npm run db:seed` |

Both produce an identical database. A database built from the SQL files in
this folder was verified by running the app's full 143-test suite against it.

---

## Option A — phpMyAdmin (recommended for Hostinger shared hosting)

### 1. Create the database and user in hPanel

This part **cannot** be scripted on shared hosting — your hosting account's
MySQL user doesn't have the `CREATE USER`/`GRANT` privilege. Do it in the
panel: **hPanel → Databases → MySQL Databases**, create a database and a
user, attach the user to the database with ALL PRIVILEGES. Hostinger prefixes
both with your account id (e.g. `u123456789_miladwani`) — that's normal, use
the full prefixed names.

Full walkthrough with screenshots' worth of detail: [`../../DEPLOYMENT.md`](../../DEPLOYMENT.md) Part 1.

### 2. Import the schema

1. Open **phpMyAdmin** from the same Databases page.
2. **Select your database in the left sidebar first.** This matters — both
   SQL files deliberately contain no `CREATE DATABASE`/`USE` statement, so
   they import into whatever database is currently selected. That's what lets
   them work with Hostinger's prefixed database names.
3. **Import** tab → Choose File → `01-schema.sql` → **Go**.
   Creates 53 tables and 81 foreign keys. No rows.
4. **Import** tab again → `02-reference-data.sql` → **Go**.
   Inserts roles, the permission matrix, relationship types, approval rules,
   post types, areas, income ranges, settings, the ₹2,000 family registration
   fee, and one admin login.

### 3. Change the admin password

`02-reference-data.sql` creates exactly one login:

```
admin@miladwani.com  /  ChangeThisInProduction123!
```

This password is public — it's in this repo. **Log in and change it before
anything else**, or the site is open to anyone who has read this file.

### If an import times out

Large imports can hit shared hosting's upload/execution limits. `01-schema.sql`
is ~70KB and `02-reference-data.sql` ~25KB, so this is unlikely — but if it
happens, gzip the file first (phpMyAdmin accepts `.sql.gz`) or use the
**Partial import** checkbox on the Import tab.

---

## Option B — Prisma CLI

From the app directory on a machine that can reach the database:

```bash
npx prisma migrate deploy   # creates all 53 tables
npm run db:seed             # inserts the same reference data
```

`migrate deploy` never resets data and never prompts — it's the only
`migrate` command safe to run against a live database. Don't use
`migrate dev` or `db push` there.

---

## Files

| File | What it is |
|---|---|
| `01-schema.sql` | Structure only — 53 tables, 81 foreign keys, no rows. Includes the `_prisma_migrations` table. |
| `02-reference-data.sql` | Data only — reference/config rows plus the `_prisma_migrations` row and one admin login. No test accounts, no families, no member data. |
| `create-database.sql` | Creates the database + a dedicated user. **Does not work on Hostinger shared hosting** (needs `CREATE USER`/`GRANT` privileges you don't have there) — it's for a VPS or managed MySQL instead. |

### Why the `_prisma_migrations` row matters

The data file inserts a row recording migration `20260910163143_init` as
already applied. So if you import via phpMyAdmin now and later run
`npx prisma migrate deploy` on the server, Prisma sees the migration is done
and does nothing — instead of trying to re-create tables that already exist
and failing. The two options stay compatible in either order.

---

## Regenerating these files

After any future schema change (a new Prisma migration), regenerate so the
SQL doesn't drift from the schema:

```bash
# 1. Build a clean database with the current schema + production seed
#    (SEED_TEST_ACCOUNTS must be false/unset so no test accounts leak in)
mysql -u root -p -e "DROP DATABASE IF EXISTS miladwani_sqlgen; CREATE DATABASE miladwani_sqlgen CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
node scripts/with-env.js .env.sqlgen npx prisma migrate deploy
node scripts/with-env.js .env.sqlgen npm run db:seed

# 2. Dump structure and data separately
mysqldump -u root -p --no-data --no-tablespaces --skip-add-drop-table \
  --default-character-set=utf8mb4 miladwani_sqlgen > scripts/mysql/01-schema.sql
mysqldump -u root -p --no-create-info --no-tablespaces --complete-insert \
  --default-character-set=utf8mb4 miladwani_sqlgen > scripts/mysql/02-reference-data.sql
```

Then re-add the header comment blocks, strip any UTF-8 BOM (PowerShell's
`Out-File` adds one and it breaks the `mysql` CLI), and confirm
`grep -c example.test 02-reference-data.sql` returns **0** before committing —
that check is what catches test accounts leaking into a production file.
