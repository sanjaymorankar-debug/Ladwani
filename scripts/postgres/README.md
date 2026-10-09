# PostgreSQL setup for Mi Ladwani

PostgreSQL is the app's only database (Prisma `provider = "postgresql"`).
PostgreSQL 14 or newer; CI and the local `docker-compose.yml` use 16.

Two ways to create the database schema. **Pick one — don't do both.**

| | Use when | How |
|---|---|---|
| **A. SQL import** (this folder) | You'd rather run SQL files than the Prisma CLI — `psql`, pgAdmin, or a hosted provider's SQL editor | Run `01-schema.sql` then `02-reference-data.sql` |
| **B. Prisma CLI** | You have a terminal on a machine that can reach the database | `npx prisma migrate deploy` then `npm run db:seed` |

Both produce an identical database. A database built from the SQL files in
this folder was verified by running the app's full test suite against it, and
`prisma migrate diff` reports no difference between it and `schema.prisma`.

---

## 1. Create the database and a user

- **Managed PostgreSQL** (Supabase, Neon, AWS RDS, DigitalOcean, Render, ...):
  create the database and user in the provider's dashboard and copy the
  connection string it gives you.
- **Your own server or local dev:** run [`create-database.sql`](create-database.sql)
  as a superuser. It creates a `miladwani` database owned by a
  `miladwani_app` role. Change its password first.

```bash
psql -U postgres -v ON_ERROR_STOP=1 -f scripts/postgres/create-database.sql
```

Local dev can instead use `docker compose up postgres -d` (user `postgres`,
password `password`, database `miladwani`).

The connection string goes in `DATABASE_URL`:

```
postgresql://<user>:<password>@<host>:5432/<database>?schema=public
```

Managed providers usually require TLS — append `&sslmode=require` if theirs
does and the string they give you doesn't already say so.

## 2a. Option A — import the SQL files

Connect to the **empty** database and run the two files in order:

```bash
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f scripts/postgres/01-schema.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f scripts/postgres/02-reference-data.sql
```

(`psql` doesn't understand Prisma's `?schema=public` suffix — drop it from the
URL you pass to `psql`.)

In **pgAdmin**: right-click the database → **Query Tool** → open
`01-schema.sql` → Execute (F5); then the same for `02-reference-data.sql`.
A hosted provider's SQL editor works the same way: paste each file and run it.

- `01-schema.sql` — 13 enum types, 71 tables plus `_prisma_migrations`, 105
  foreign keys. No rows.
- `02-reference-data.sql` — roles, the permission matrix, relationship types,
  approval rules, post types, areas, income ranges, interests, settings, the
  ₹2,000 family registration fee, and one admin login.

Neither file has a `CREATE DATABASE` statement, so they build into whichever
database you are connected to.

## 2b. Option B — Prisma CLI

```bash
npx prisma migrate deploy   # creates every table
npm run db:seed             # inserts the same reference data
```

`migrate deploy` never resets data and never prompts — it's the only
`migrate` command safe to run against a live database. Don't use
`migrate dev` or `db push` there.

## 3. Change the admin password

`02-reference-data.sql` creates exactly one login:

```
admin@miladwani.com  /  ChangeThisInProduction123!
```

(`npm run db:seed` uses `ADMIN_EMAIL` / `ADMIN_PASSWORD` from the
environment, and falls back to `Admin@123456` when no password is set.)

This password is public — it's in this repo. **Log in and change it before
anything else**, or the site is open to anyone who has read this file.

---

## Files

| File | What it is |
|---|---|
| `01-schema.sql` | Structure only. Includes the `_prisma_migrations` table. |
| `02-reference-data.sql` | Data only — reference/config rows plus the `_prisma_migrations` row and one admin login. No test accounts, no families, no member data. |
| `create-database.sql` | Creates the database + a dedicated owner role. Needs superuser; not for managed providers, whose dashboards do this. |

### Why the `_prisma_migrations` row matters

The data file inserts a row recording migration `20261009120000_init` as
already applied. So if you import the SQL files now and later run
`npx prisma migrate deploy`, Prisma sees the migration is done and does
nothing — instead of trying to re-create tables that already exist and
failing. The two options stay compatible in either order.

### Coming from the old MySQL database

These files build an empty database. To carry rows over from the earlier
MySQL database, build the schema here first, then follow
[`../../MIGRATION.md`](../../MIGRATION.md).

---

## Regenerating these files

After any future schema change (a new Prisma migration), regenerate so the
SQL doesn't drift from the schema:

```bash
# 1. Build a clean database with the current schema + production seed.
#    SEED_TEST_ACCOUNTS must be unset so no test accounts leak in, and
#    ADMIN_PASSWORD must be the published default above.
createdb -U postgres miladwani_sqlgen
cat > .env.sqlgen <<'ENV'
DATABASE_URL=postgresql://postgres@localhost:5432/miladwani_sqlgen
ADMIN_EMAIL=admin@miladwani.com
ADMIN_PASSWORD=ChangeThisInProduction123!
ENV
node scripts/with-env.js .env.sqlgen npx prisma migrate deploy
node scripts/with-env.js .env.sqlgen npm run db:seed

# 2. Dump structure and data separately.
pg_dump -U postgres --schema-only --no-owner --no-privileges miladwani_sqlgen > schema.sql
pg_dump -U postgres --data-only --column-inserts --rows-per-insert=100 \
  --no-owner --no-privileges miladwani_sqlgen > data.sql
```

Then, for each file:

- delete the `\restrict ...` and `\unrestrict ...` lines that recent
  `pg_dump` releases add — they are `psql`-only commands, and pgAdmin and
  hosted SQL editors reject them;
- put the header comment block from the current file back on top, updating
  the counts;
- confirm `grep -c example.test 02-reference-data.sql` returns **0** before
  committing — that check is what catches test accounts leaking into a
  production file.

Finally, import both into a fresh database and run the test suite against
it (`npm run db:seed:uat`, then `npm test` with `DATABASE_URL` pointing at it).
