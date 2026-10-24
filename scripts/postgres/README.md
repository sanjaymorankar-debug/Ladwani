# PostgreSQL setup for Mi Ladwani

PostgreSQL is the app's final database (it ran on MySQL from Sep to Oct 2026,
and on PostgreSQL before that). Two ways to create the schema on an **empty**
database. **Pick one, not both.**

| | Use when | How |
|---|---|---|
| **A. Prisma CLI** (recommended) | You can run `npx` on a machine that reaches the database | `npx prisma migrate deploy`, then `npm run db:seed` |
| **B. SQL files** (this folder) | You'd rather use `psql` or a SQL console (pgAdmin, DBeaver, a provider's web console) | Run `01-schema.sql`, then `02-reference-data.sql` |

Both produce the same database. A database built from the SQL files here
passed the app's full test suite (300 tests) and showed no drift against
`prisma/schema.prisma` (`prisma migrate diff` reports no difference).

> **Moving the old live MySQL data?** Build the empty PostgreSQL database with
> one of the options below first, then follow [`../../MIGRATION.md`](../../MIGRATION.md).

---

## 1. Create the database and its owner

- **Neon** (every tier): the role `bk_ladwani_app` and the database `bk_ladwani`
  are made in the Neon console, on each branch. Skip `create-database.sql`.
  `../../DEPLOYMENT.md` Part 1 has the steps and the two connection strings.
- **Your own server or a VPS:** run [`create-database.sql`](create-database.sql)
  with `psql` as a superuser:
  ```bash
  psql -h <host> -U postgres -d postgres \
    -v app_password='a-strong-password' \
    -f scripts/postgres/create-database.sql
  ```
  It creates the role `miladwani_app` and the database `miladwani` owned by
  it (`-v app_role=bk_ladwani_app -v db_name=ladwani` for the names Neon uses).
  Re-running it is harmless.

The schema needs two extensions, `citext` and `btree_gist`. Both are
"trusted" (PostgreSQL 13+), so the database owner creates them itself during
step 2 without superuser rights. Most managed providers allow both; check
yours before the first deploy. PostgreSQL 13 or newer is required; CI tests
against PostgreSQL 16.

Then set the URLs in the app's `.env`. On Neon, `DATABASE_URL` is the pooled
string and `DATABASE_URL_UNPOOLED` the direct one; Prisma's CLI (step 2A)
uses the direct one. With a single database both are the same:

```
DATABASE_URL="postgresql://miladwani_app:<password>@<host>:5432/miladwani?schema=public"
DATABASE_URL_UNPOOLED="${DATABASE_URL}"
```

Neon requires TLS: keep its `?sslmode=require&channel_binding=require`.

---

## 2A. Prisma CLI

From the app directory:

```bash
npx prisma migrate deploy   # creates every table, enum, index and constraint
npm run db:seed             # reference data + the admin login
```

`migrate deploy` never resets data and never prompts. It's the only `migrate`
command safe to run against a live database. Don't use `migrate dev`,
`migrate reset` or `db push` there.

## 2B. SQL files

Use the **direct** URL (on Neon, "Connection pooling" off). `psql` doesn't
accept Prisma's `?schema=public` suffix, so leave it off here:

```bash
psql "postgresql://miladwani_app:<password>@<host>:5432/miladwani" -v ON_ERROR_STOP=1 -f scripts/postgres/01-schema.sql
psql "postgresql://miladwani_app:<password>@<host>:5432/miladwani" -v ON_ERROR_STOP=1 -f scripts/postgres/02-reference-data.sql
```

In a GUI console, open each file and run it, `01` first. Both files are plain
SQL wrapped in one transaction, so a failure leaves nothing half-created.

## 3. Change the admin password

`02-reference-data.sql` (and `npm run db:seed` with the example `.env`)
creates exactly one login:

```
admin@miladwani.com  /  ChangeThisInProduction123!
```

This password is public because it's in this repo. **Log in and change it
before you do anything else.** Until you do, anyone who has read this file
can sign in as admin.

---

## Files

| File | What it is |
|---|---|
| `create-database.sql` | A psql script that creates the app role and the database. For a server you administer; managed providers do this for you. |
| `01-schema.sql` | Structure only: 71 tables, 105 foreign keys, the `bookings_no_overlap` exclusion constraint, the two extensions, plus Prisma's `_prisma_migrations` table with the migration recorded as applied. No other rows. |
| `02-reference-data.sql` | Data only: the rows `npm run db:seed` creates for production (roles, permission matrix, relationship types, approval rules, post types, areas and districts, income ranges, settings, the ₹2,000 family registration fee, the interest catalogue) and one admin login. No test accounts, families or members. Every `INSERT` is `ON CONFLICT DO NOTHING`. |
| `regenerate.sh` | Rebuilds the two files above from `prisma/migrations` and the seed. |

### Why `01-schema.sql` records the migration

It inserts a `_prisma_migrations` row for each migration folder, using the
checksum `prisma migrate deploy` would store. If you build the database from
the SQL files and later run `npx prisma migrate deploy`, Prisma sees the
migration is already applied and does nothing. Without that row it would
try to create tables that already exist, and fail. So the two options stay
compatible in either order, and any later migration applies normally.

---

## Regenerating these files

After any schema change (a new folder under `prisma/migrations`), regenerate
both files so the SQL doesn't drift from the schema:

```bash
npm ci
SQLGEN_ADMIN_URL=postgresql://postgres:<password>@127.0.0.1:5432/postgres \
  bash scripts/postgres/regenerate.sh
```

It creates a scratch database (`miladwani_sqlgen`, or `$SQLGEN_DB`), runs
`migrate deploy` and the production seed with `SEED_TEST_ACCOUNTS` unset,
writes both files, refuses to keep a `02` file that contains any test
account, and drops the scratch database. It needs `psql` and `pg_dump` on
PATH. Review the diff before you commit: the ids and timestamps in `02`
change on every run, but nothing else should change unless the seed did.
