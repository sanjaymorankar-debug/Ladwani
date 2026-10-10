# Deploying LadWani

> **Dev is now automated.** Pushing to the `dev` branch deploys this app to
> `devladwani.bkesari.com` through `.github/workflows/deploy-dev.yml`. The
> one-time secret setup is in `DEPLOY.md` Part 6 of the `bkesari-platform`
> repository. The workflow refuses to deploy anywhere but that dev host,
> `agtci.com` included, so the old site below can't be overwritten by it.
> It never touches a database: the server's own `.env` holds `DATABASE_URL`,
> and migrations are applied by hand (Part 3 step 3).
>
> Everything after this note is the manual procedure, kept because test and
> production are still promoted by hand.

# Deploying the app

Updated Oct 2026. **PostgreSQL is the final database.** The app was built on
PostgreSQL, ported to MySQL in Sep 2026 so it could run on Hostinger shared
hosting, and moved back to PostgreSQL in Oct 2026. See "Database history"
below.

> **Hostinger shared and cloud web hosting do not provide PostgreSQL.**
> hPanel's database screens only create MySQL/MariaDB databases. Production
> therefore needs either:
> - a **managed PostgreSQL** service (e.g. Neon, Supabase, AWS RDS,
>   DigitalOcean, Aiven) that the app server connects to over the internet
>   with TLS, or
> - a **VPS** (Hostinger's VPS plans included) where you install
>   PostgreSQL yourself, usually next to the app.
>
> If the app itself stays on Hostinger shared hosting with a managed
> database, **confirm first that the hosting plan allows outbound
> connections to the database's host and port** (usually 5432). This repo
> hasn't verified that for any Hostinger plan. If it's blocked, the app has
> to move to a VPS or another Node.js host.

> **Existing MySQL data is not carried over automatically.** If the database
> currently behind the live site (or the old live Hostinger MySQL database
> referenced by `ladwani/env1`/`env2`) holds real data, copy it with
> [MIGRATION.md](MIGRATION.md) **before** that database is overwritten or
> decommissioned.

---

## Database history

The app was originally built against PostgreSQL. The MySQL port replaced two
PostgreSQL features. Moving back restored both, plus case-insensitive email:

- **Double-booking prevention** is again guaranteed by the database: the
  exclusion constraint `bookings_no_overlap` (GiST, via the `btree_gist`
  extension) makes overlapping active bookings of one asset impossible.
  The booking route also keeps the MySQL-era row lock and overlap check
  (`SELECT ... FOR UPDATE` on the asset), so the usual clash gets a clean
  "slot taken" answer. See
  [src/app/api/assets/[id]/bookings/route.ts](src/app/api/assets/%5Bid%5D/bookings/route.ts).
- **Case-insensitive search** (`mode: 'insensitive'`) is back on free-text
  filters. MySQL's collation had made that implicit.
- **`users.email` is `CITEXT`**, so login, registration and the unique index
  ignore letter case, as they did under MySQL. **`members.email`** is
  `CITEXT` too (migration `20261010090000_member_email_citext`), so the
  Karta's duplicate-member check matches an address in any case. It has no
  unique constraint.
- Array-valued columns (languages, preferred locations, facilities, the
  Additional Details multi-selects) stay JSON, now `jsonb`.
- The six MySQL migrations were replaced by one PostgreSQL baseline
  (`prisma/migrations/20261009200000_postgresql_baseline/`). A database built
  by the MySQL migrations can't be upgraded in place; its data is copied
  with `MIGRATION.md`.

---

# Part 1 — Create the PostgreSQL database

PostgreSQL 13 or newer (CI runs 16). The schema creates two extensions,
`citext` and `btree_gist`. Both are "trusted", so the database owner can
create them without superuser rights, but confirm your provider allows them.
Most managed providers do.

**Managed PostgreSQL:** create a database in the provider's dashboard and
copy its connection string. Most providers require TLS: keep or add
`sslmode=require`.

**VPS / your own server:** install PostgreSQL, then create the app role and
database with [scripts/postgres/create-database.sql](scripts/postgres/create-database.sql):

```bash
psql -h <host> -U postgres -d postgres \
  -v app_password='<strong password>' \
  -f scripts/postgres/create-database.sql
```

Either way you end up with a connection string:

```
postgresql://<db-user>:<db-password>@<host>:5432/<db-name>?schema=public
```

### Then create the tables — two options

Both produce an identical database. Do one, not both.

**Option A — Prisma CLI.** Leave the database empty here and let
`npx prisma migrate deploy` + `npm run db:seed` create everything in Part 3.

**Option B — SQL files.** From any machine with `psql` (or a SQL console such
as pgAdmin or the provider's web console), run the two files in
[scripts/postgres/](scripts/postgres/), in order:

1. [`01-schema.sql`](scripts/postgres/01-schema.sql): 71 tables, 105 foreign
   keys, the bookings exclusion constraint, and the migration recorded as
   applied. No rows.
2. [`02-reference-data.sql`](scripts/postgres/02-reference-data.sql): roles,
   permissions, relationship types, approval rules, post types, areas and
   districts, income ranges, the ₹2,000 fee, the interest catalogue, and one
   admin login.

Then skip step 3's `migrate deploy` and step 4's `db:seed` in Part 3, because
the files already did both. Full detail:
[scripts/postgres/README.md](scripts/postgres/README.md).

Either order stays safe. `01-schema.sql` records the migration as applied in
`_prisma_migrations`, so a later `migrate deploy` does nothing instead of
failing.

> **Migrating real data from MySQL?** Build the empty schema (option A's
> `migrate deploy` or `01-schema.sql`) but **do not seed** and don't run
> `02-reference-data.sql`. The reference rows come across with the data. Then
> follow [MIGRATION.md](MIGRATION.md).

---

# Part 2 — Environment variables

Set these where your host keeps them: hPanel's **Node.js app → Environment
Variables** screen, or the server's `.env` (never a committed file).
[.env.example](.env.example) documents every key. The block below is what
to set for a deployment.

```bash
# Database — from Part 1
DATABASE_URL="postgresql://<db-user>:<db-password>@<host>:5432/<db-name>?schema=public&sslmode=require"

# NextAuth — generate a FRESH secret, never reuse the dev one
NEXTAUTH_SECRET="<run: openssl rand -base64 32>"
NEXTAUTH_URL="https://<your-domain>"

# App
NEXT_PUBLIC_APP_URL="https://<your-domain>"
NEXT_PUBLIC_APP_NAME="Mi Ladwani"
NEXT_PUBLIC_COMMUNITY_NAME="Ladwani Samaj"

# Account verification — real OTP emails once SMTP below is confirmed working
NEXT_PUBLIC_AUTH_REQUIRE_VERIFICATION=true

# Email (SMTP) — see SMTP-SETUP.md
SMTP_HOST="smtp.hostinger.com"
SMTP_PORT=465
SMTP_USER="noreply@agtci.com"
SMTP_PASSWORD="<mailbox password — never commit this>"
SMTP_FROM="noreply@agtci.com"

# Photo storage — local disk, OUTSIDE the web-served directory so uploads are
# never directly fetchable by URL
STORAGE_DRIVER=LOCAL
UPLOAD_DIR="/home/<user>/miladwani-uploads"

# Payments — MOCK until a real gateway is wired (see step 6 below)
PAYMENT_GATEWAY=MOCK
PAYMENT_SIGNING_SECRET="<run: openssl rand -base64 32>"

NODE_ENV=production
```

Drop `&sslmode=require` only for a database on the same machine or private
network. Don't have `openssl` handy? Any long random string works:
`node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`
does the same thing from a Node shell.

---

# Part 3 — Deploy the code

You need a shell on the app server (hPanel's SSH access on Hostinger, or SSH
on a VPS) as the account that runs the app.

## 1. Get the code onto GitHub

**Don't force-push over the live `main` branch's history.** Push your work
as its own branch and merge it via a PR instead. Work happens on feature
branches. See "Branches and promotion" below.

## 2. Pull it onto the server and configure the Node.js app

Point your host's Node.js app at this repository, or `git clone`/`git pull`
it yourself over SSH:

```bash
ssh <user>@<host>
cd ~/miladwani           # or wherever the Node app root is
git clone https://github.com/sanjaymorankar-debug/miladwani.git .
git checkout main
```

Run the app with `npm start` (Next.js's own `start` script). If your host
only accepts a single JS entry file, check its Node.js docs for the exact
Next.js integration steps. This varies by host and plan.

## 3. Install, migrate, build

```bash
npm ci                      # exact lockfile install, not npm install
npx prisma migrate deploy   # creates every table from the committed migrations
npm run build               # runs `prisma generate` first, see package.json
```

`migrate deploy` applies the PostgreSQL baseline migration
(`prisma/migrations/20261009200000_postgresql_baseline/`) and any later ones,
without prompting. It's the only `migrate` command safe to run against a
server. Never use `migrate dev`, `migrate reset` or `db push` in production.
It must reach the database from wherever you run it. If the server can't,
run it from any machine that can, with the same `DATABASE_URL`.

## 4. Seed reference data (first deploy only — skip if you used the SQL files or migrated data)

```bash
npm run db:seed
```

This creates roles, the permission matrix, relationship types, approval
rules, post types, areas and districts, the ₹2,000 family registration fee,
the interest catalogue and the group post types. It's idempotent, so it's
safe to re-run. It also creates one **admin** login from `ADMIN_EMAIL` /
`ADMIN_PASSWORD` (defaults in `.env.example`):

```
Email:    admin@miladwani.com
Password: ChangeThisInProduction123!
```

**Change that password immediately after your first login.** It's published
in this repo, so until you change it anyone who has read it can sign in.

The fake test accounts (`test.member@example.test` and friends, all sharing
the password `TestPass@123`) are created only when `SEED_TEST_ACCOUNTS=true`,
so leave it unset on production. Also never run `npm run db:seed:uat` there;
it creates a dozen more.

## 5. Start / restart the app

Use your host's Node.js app **Restart** button (on Hostinger, deploy-dev.yml
touches `tmp/restart.txt` for Passenger). If you manage the process yourself:

```bash
pm2 start npm --name miladwani -- start
pm2 save && pm2 startup      # survives reboot
```

## 6. Switch payments to a real gateway (when ready)

`PAYMENT_GATEWAY=MOCK` runs the full booking and fee flow with signed,
server-verified callbacks, but takes no real money. That's fine for launch,
not for real bookings. When you're ready, implement `verifySignature` for
your provider in [src/lib/payments.ts](src/lib/payments.ts) (the flow itself
doesn't change) and set the provider's keys as env vars.

## 7. Smoke test on production

- [ ] `/login` — sign in as admin, land on `/admin`
- [ ] Sign in again with the email in different letter case: it still works
- [ ] Register a throwaway account → verification email arrives from `noreply@agtci.com`
- [ ] Register a family → Karta role granted, ₹2,000 invoice raised
- [ ] Upload a profile photo → appears, and is not reachable when logged out
- [ ] Create a post as a member → held for moderation, not in the feed
- [ ] Register a community group → held for approval, not in the public list
- [ ] Search members with a lower-case name → matches regardless of case
- [ ] Book an asset → slot held → pay → confirmed
- [ ] Try the same slot twice, from two tabs at once → the second attempt is refused

## 8. Before real members arrive

- [ ] **Publish DKIM** for `agtci.com` (SPF, DMARC and MX are already
      correct). Without it, verification codes land in spam and members can't
      sign in.
- [ ] Back up the database on a schedule: your managed provider's automated
      backups / point-in-time recovery, or `pg_dump -Fc` from cron on a VPS.
      Separately back up `UPLOAD_DIR`, because photos live on disk, not in the
      database.
- [ ] Delete `AGENTS.md` / `CLAUDE.md` — they instruct AI tools to read
      Next.js docs at a path that doesn't exist in the installed version.
- [ ] Rotate the admin password and any credential that has appeared in chat
      or in this repo's history.

---

## Rollback

```bash
git checkout <previous-commit>
npm ci && npm run build
pm2 restart miladwani   # or your host's Restart button
```

Prisma migrations do **not** roll back automatically. If a migration must be
undone, restore from the scheduled database backup in step 8 above.
Don't roll back across the MySQL → PostgreSQL switch: code from before it
can't talk to a PostgreSQL database.

## Branches and promotion

| Branch | Environment |
|---|---|
| `dev` | `devladwani.bkesari.com`, deployed automatically by `deploy-dev.yml` |
| `staging` | A separate staging site with its own database |
| `main` | Production |

Work happens on feature branches. Open a PR into `staging`. CI
(`.github/workflows/ci.yml`, which runs against PostgreSQL 16) must pass
before merging. Test on staging, then promote with a PR from `staging` into
`main`. Don't commit directly to `staging` or `main`.

---

## Additional Details and interest groups (Oct 2026)

These tables are part of the PostgreSQL baseline. The two MySQL migrations
that first added them were folded into it. They come with reference data in
`npm run db:seed`, a `CRON_SECRET` env var and a daily cron call for the
group digest. Details and assumptions: **`docs/ADDITIONAL-DETAILS.md` §5**.
