# Deploying LadWani

> **Dev is now automated.** Pushing to the `dev` branch deploys this app to
> `devladwani.bkesari.com` through `.github/workflows/deploy-dev.yml`. The
> one-time secret setup is in `DEPLOY.md` Part 6 of the `bkesari-platform`
> repository. The workflow refuses to deploy anywhere but that dev host —
> `agtci.com` included, so the old site below cannot be overwritten by it.
>
> Everything after this note is the original manual procedure for
> `devmiladwani.agtci.com`, kept because test and production are still promoted
> by hand and the database steps are the same wherever it is hosted.

# Deploying to devmiladwani.agtci.com

Updated 9 Oct 2026. This codebase targets **PostgreSQL** — the final database
choice for every tier (see "Database" below). The Node.js app itself can still
run on Hostinger's **hPanel** shared hosting, but **hPanel offers only MySQL**,
so the PostgreSQL database has to live somewhere else and the app reaches it
over the network.

---

## Database: PostgreSQL

The app was first built on PostgreSQL, ported to MySQL on 10 Sep 2026 for
Hostinger shared hosting, and moved back to PostgreSQL on 9 Oct 2026 as the
final schema. What that means in practice:

- **Migration history was reset.** The MySQL migrations cannot be applied to
  PostgreSQL, so `prisma/migrations/` now holds one PostgreSQL baseline,
  `20261009120000_init`, containing the whole schema (including everything
  from the 9 Oct Additional Details and interest-group migrations). A
  database that was built from the old MySQL migrations is not upgraded in
  place — build a new PostgreSQL database and, if its rows matter, copy them
  across with [MIGRATION.md](MIGRATION.md).
- **Double-booking prevention** stays in application code: the booking
  transaction runs `SELECT ... FOR UPDATE` on the asset's own row, which
  serializes concurrent bookings for that asset, then checks for overlaps
  before inserting. See
  [src/app/api/assets/[id]/bookings/route.ts](src/app/api/assets/%5Bid%5D/bookings/route.ts).
  The concurrency test (a genuine simultaneous double-booking attempt) passes
  on PostgreSQL.
- **List-valued columns** (matrimony languages/preferred locations, asset
  facilities, Additional Details multi-selects) stay as JSON columns, stored
  as `jsonb`.
- **Case-insensitive matching** is now explicit. MySQL's collation ignored
  letter case; PostgreSQL does not. Login and duplicate-email checks, and every
  name/city search, use Prisma's `mode: 'insensitive'`, pinned by
  `tests/uat/case-insensitive-matching.test.ts`.

The full test suite runs against PostgreSQL 16 in CI.

---

# Part 1 — Create the PostgreSQL database

Pick where the database lives:

- **A managed PostgreSQL service** (Supabase, Neon, AWS RDS, DigitalOcean,
  Render, ...) — the least work. Create a database and user in the provider's
  dashboard and copy the connection string it gives you. Choose a region close
  to the app server (India, for Hostinger's Indian data centres).
- **Your own server** (a VPS, including Hostinger's VPS plans) — install
  PostgreSQL 14 or newer, then run
  [scripts/postgres/create-database.sql](scripts/postgres/create-database.sql)
  as the `postgres` superuser. It creates a `miladwani` database owned by a
  `miladwani_app` role; change the password in it first.

Either way you end up with a connection string:

```
postgresql://<db-user>:<db-password>@<db-host>:5432/<db-name>?schema=public
```

Append `&sslmode=require` if the provider requires TLS and its string doesn't
already say so.

Before going further, **check the app server can reach the database.** From
hPanel's SSH terminal (or wherever the app runs):

```bash
node -e "require('net').connect(5432, '<db-host>').on('connect', () => { console.log('reachable'); process.exit(0) }).on('error', (e) => { console.log(e.message); process.exit(1) })"
```

If shared hosting blocks the outbound connection, ask the host to allow it,
use a provider that listens on an allowed port, or move the app to a VPS.
Also allow the app server's IP in the database's firewall/allow-list if the
provider has one.

### Then create the tables — two options

You can build the schema **either** by importing SQL files **or** with the
Prisma CLI. Both produce an identical database; do one, not both.

**Option A — SQL files (psql, pgAdmin, or the provider's SQL editor).** Run
two ready-made files from [scripts/postgres/](scripts/postgres/), in order,
against the empty database:

```bash
psql "<connection string without ?schema=public>" -v ON_ERROR_STOP=1 -f scripts/postgres/01-schema.sql
psql "<connection string without ?schema=public>" -v ON_ERROR_STOP=1 -f scripts/postgres/02-reference-data.sql
```

1. [`01-schema.sql`](scripts/postgres/01-schema.sql) — every table, enum and
   foreign key, no rows.
2. [`02-reference-data.sql`](scripts/postgres/02-reference-data.sql) —
   roles, permissions, relationship types, approval rules, post types, areas,
   interests, the ₹2,000 fee, and one admin login.

Then skip step 3's `migrate deploy` and step 4's `db:seed` in Part 3 — the
import already did both. Full detail: [scripts/postgres/README.md](scripts/postgres/README.md).

**Option B — Prisma CLI.** Leave the database empty here and let
`npx prisma migrate deploy` + `npm run db:seed` create everything in Part 3.

Either order stays safe: the SQL files record the migration as applied in
`_prisma_migrations`, so a later `migrate deploy` is a no-op rather than an
error.

> A database built from those two SQL files was verified by running the app's
> full test suite against it — the schema they produce is not
> hand-maintained, it's dumped from the same Prisma migration the CLI uses.

---

# Part 2 — Environment variables

Set these in hPanel's **Node.js app → Environment Variables** screen (not in
a committed file). [.env.example](.env.example) documents every key; the
block below is what to actually set for this deployment.

```bash
# Database — from Part 1
DATABASE_URL="postgresql://<db-user>:<db-password>@<db-host>:5432/<db-name>?schema=public"

# NextAuth — generate a FRESH secret, never reuse the dev one
NEXTAUTH_SECRET="<run: openssl rand -base64 32>"
NEXTAUTH_URL="https://devmiladwani.agtci.com"

# App
NEXT_PUBLIC_APP_URL="https://devmiladwani.agtci.com"
NEXT_PUBLIC_APP_NAME="Mi Ladwani"
NEXT_PUBLIC_COMMUNITY_NAME="Ladwani Samaj"

# Account verification — real OTP emails once SMTP below is confirmed working
NEXT_PUBLIC_AUTH_REQUIRE_VERIFICATION=true

# Email (SMTP) — already tested working from this account; see SMTP-SETUP.md
SMTP_HOST="smtp.hostinger.com"
SMTP_PORT=465
SMTP_USER="noreply@agtci.com"
SMTP_PASSWORD="<mailbox password — never commit this>"
SMTP_FROM="noreply@agtci.com"

# Photo storage — local disk, OUTSIDE the web-served directory so uploads are
# never directly fetchable by URL
STORAGE_DRIVER=LOCAL
UPLOAD_DIR="/home/<hpanel-username>/miladwani-uploads"

# Payments — MOCK until a real gateway is wired (see step 8 below)
PAYMENT_GATEWAY=MOCK
PAYMENT_SIGNING_SECRET="<run: openssl rand -base64 32>"

NODE_ENV=production
```

Don't have a way to run `openssl` handy? Any long random string works —
`node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`
does the same thing from a Node shell, which hPanel's SSH terminal already has.

---

# Part 3 — Deploy the code

hPanel's Node.js app terminal gives you SSH access as your hosting account
(not root) — enough to run all of this.

## 1. Get the code onto GitHub

**Don't force-push over the live `main` branch's history** — even though
we're replacing what's *deployed*, keeping the old commits reachable in git
costs nothing and means nothing is permanently lost if you want to look back.
Push this codebase as its own branch and merge it via PR instead:

```bash
cd D:\Claude_development\ladwani\app
git remote add origin https://github.com/sanjaymorankar-debug/miladwani.git
git fetch origin
git push -u origin master:postgres-deploy
```

Open a PR from `postgres-deploy` into `main` on GitHub, review it, and merge —
that becomes the new `main` without ever forcing anything.

## 2. Pull it onto the server and configure the Node.js app

In hPanel, create (or point your existing) **Node.js app** at this
repository — hPanel's Node.js manager can pull directly from a Git repo, or
you can `git clone`/`git pull` yourself over the SSH terminal it gives you:

```bash
ssh <hpanel-user>@<host>
cd ~/miladwani           # or wherever hPanel's Node app root is
git clone https://github.com/sanjaymorankar-debug/miladwani.git .
git checkout main        # after the PR above is merged
```

Set the **startup file** to `node_modules/.bin/next` isn't right for
Next.js — instead point hPanel's Node.js app at `npm start` (Next.js's own
`start` script), or use its "Run npm start" option if offered. If hPanel
only accepts a single JS entry file, check its Node.js docs for the exact
Next.js integration steps for your plan — this varies by hPanel version.

## 3. Install, migrate, build

```bash
npm ci                      # exact lockfile install, not npm install
npx prisma migrate deploy   # creates every table from the committed migration
npm run build                # runs `prisma generate` first, see package.json
```

`migrate deploy` applies the PostgreSQL baseline migration
(`prisma/migrations/20261009120000_init/`) and any later ones, without
prompting. It's the only `migrate` command safe to run against a server —
never `migrate dev` or `db push` in production.

## 4. Seed reference data (first deploy only — skip if you imported the SQL files)

```bash
npm run db:seed
```

This creates roles, the permission matrix, relationship types, approval
rules, post types, areas, the ₹2,000 family registration fee, and the
community-group approval rule. It's idempotent — safe to re-run. It also
creates one **admin** login:

```
Email:    admin@miladwani.com
Password: ChangeThisInProduction123!
```

**Change that password immediately after your first login** — it's published
in this repo, so until you change it the site is open to anyone who's read it.

The fake test accounts (`test.member@example.test` and friends, all sharing
the password `TestPass@123`) are gated behind `SEED_TEST_ACCOUNTS=true` and
will **not** be created unless you set that — leave it unset on production.
Also never run `npm run db:seed:uat` there; it creates a dozen more.

## 5. Start / restart the app

Use hPanel's Node.js app **Restart** button. If you're managing the process
yourself over SSH instead:

```bash
pm2 start npm --name miladwani -- start
pm2 save && pm2 startup      # survives reboot
```

## 6. Switch payments to a real gateway (when ready)

`PAYMENT_GATEWAY=MOCK` runs the full booking and fee flow with signed,
server-verified callbacks, but takes no real money — good for launch, not
for real bookings. When you're ready, implement `verifySignature` for your
provider in [src/lib/payments.ts](src/lib/payments.ts) (the flow itself
doesn't change) and set the provider's keys as env vars. Tell me which
gateway (Razorpay, Cashfree, etc.) and I'll wire it.

## 7. Smoke test on production

- [ ] `/login` — sign in as admin, land on `/admin`
- [ ] Register a throwaway account → verification email arrives from `noreply@agtci.com`
- [ ] Register a family → Karta role granted, ₹2,000 invoice raised
- [ ] Upload a profile photo → appears, and is not reachable when logged out
- [ ] Create a post as a member → held for moderation, not in the feed
- [ ] Register a community group → held for approval, not in the public list
- [ ] Book an asset → slot held → pay → confirmed
- [ ] Try the same slot twice, from two tabs at once → the second attempt is refused

## 8. Before real members arrive

- [ ] **Publish DKIM** for `agtci.com` (SPF, DMARC and MX are already
      correct). Without it, verification codes land in spam and members can't
      sign in.
- [ ] Back up the database on a schedule — turn on the managed provider's
      automated backups, or on your own server run
      `pg_dump -Fc "<connection string>" > miladwani-$(date +%F).dump` from
      cron and copy the file off the server — and separately back up
      `UPLOAD_DIR`: photos live on disk, not in the database.
- [ ] Delete `AGENTS.md` / `CLAUDE.md` — they instruct AI tools to read
      Next.js docs at a path that doesn't exist in the installed version.
- [ ] Rotate the admin password and any credential that has appeared in chat
      or in this repo's history.

---

## Rollback

```bash
git checkout <previous-commit>
npm ci && npm run build
pm2 restart miladwani   # or hPanel's Restart button
```

Prisma migrations do **not** auto-roll-back. If a migration must be undone,
restore from the scheduled database backup in step 8 above — there's no
production data yet to lose while you're setting that backup up, but there
will be as soon as real families start registering.

## Branches and promotion

| Branch | Environment |
|---|---|
| `staging` | A separate staging subdomain with its own database, connected in hPanel to the `staging` branch |
| `main` | `devmiladwani.agtci.com` (current live site) |

Work happens on feature branches. Open a PR into `staging`; CI (`.github/workflows/ci.yml`) must pass before merging. Test on staging, then promote with a PR from `staging` into `main`. Don't commit directly to `staging` or `main`.

---

## Update 9 Oct 2026 — Additional Details and interest groups

New tables and columns (originally the MySQL migrations
`20261009100000_member_additional_details` and `20261009110000_interest_groups`,
now part of the PostgreSQL baseline `20261009120000_init`), new reference data
in `npm run db:seed`, a new `CRON_SECRET` env var and a daily cron call for the
group digest. Full steps and assumptions: **`docs/ADDITIONAL-DETAILS.md` §5**.
