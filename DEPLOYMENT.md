# Deploying LadWani

> **Dev is now automated.** Pushing to the `dev` branch deploys this app to
> `devladwani.bkesari.com` through `.github/workflows/deploy-dev.yml`. The
> one-time secret setup is in `DEPLOY.md` Part 6 of the `bkesari-platform`
> repository. The workflow refuses to deploy anywhere but that dev host —
> `agtci.com` included, so the old site below cannot be overwritten by it.
>
> Everything after this note is the original manual procedure for
> `devmiladwani.agtci.com`, kept because test and production are still promoted
> by hand and the hPanel and database steps are the same wherever it is hosted.

# Deploying to devmiladwani.agtci.com

Updated 10 Sep 2026. This codebase now targets **MySQL** (ported from
PostgreSQL specifically for this deployment — see "What changed" below) and
this plan assumes shared hosting through Hostinger's **hPanel**, replacing
whatever is currently live at the domain. No production data needs to be
preserved.

---

## What changed to make MySQL possible

The app was originally built against PostgreSQL. Two things depended on
Postgres-only features and needed a real rewrite, not just a config change:

- **Double-booking prevention** no longer relies on a database exclusion
  constraint (MySQL has no equivalent). It's now enforced in application code:
  the booking transaction runs `SELECT ... FOR UPDATE` on the asset's own row
  first, which serializes concurrent booking attempts for that asset, then
  checks for overlapping active bookings before inserting. See
  [src/app/api/assets/[id]/bookings/route.ts](src/app/api/assets/%5Bid%5D/bookings/route.ts).
  The full booking + concurrency test suite (including a genuine simultaneous
  double-booking attempt) passes against MySQL.
- **Array columns** (matrimony languages/preferred-locations, asset
  facilities) are now JSON columns instead of Postgres native arrays.
- All Prisma migrations were regenerated from scratch as MySQL DDL — the old
  Postgres migration history doesn't apply and isn't needed since we're not
  carrying data forward.

Nothing else in the schema or application logic needed to change. The full
test suite (143 tests) passes against a local MySQL 8.4 instance.

`MIGRATION.md` (the earlier live-MySQL → Postgres data migration runbook) no
longer applies now that the target is MySQL and there's no data to carry
over — ignore it for this deployment.

---

# Part 1 — Create the MySQL database on Hostinger

On shared hosting, **database + user creation has to happen through hPanel**
— your hosting account's MySQL user doesn't have the `CREATE USER`/`GRANT`
privilege needed to script this part, so there is no SQL file that can do it
for you. Everything *after* the database exists (creating tables, seeding
reference data) is scripted — that part is in Part 3.

1. Log in to **hPanel** → your hosting plan → **Databases → MySQL Databases**.
2. Under **Create a New MySQL Database**, enter a database name, e.g.
   `miladwani` (Hostinger will prefix it with your account id, giving
   something like `u123456789_miladwani` — that's normal, use the full
   prefixed name everywhere below).
3. Under **Create a New MySQL User**, enter a username, e.g. `miladwani_app`
   (again prefixed automatically) and generate a strong password — save it
   somewhere safe, you'll need it for the env vars in Part 2.
4. Under **Add User to Database**, attach that user to that database with
   **ALL PRIVILEGES**.
5. Note the **database host** shown in hPanel — on shared hosting this is
   almost always `localhost`, because the Node app and MySQL server run on
   the same box. Confirm it in hPanel rather than assuming.
6. Optional but recommended: open **phpMyAdmin** (linked from the same
   Databases page) once, just to confirm you can log into the new database
   with the new user/password before moving on.

You now have everything for the connection string:

```
mysql://<db-user>:<db-password>@localhost:3306/<db-name>
```

### Then create the tables — two options

You can build the schema **either** through phpMyAdmin **or** over SSH. Both
produce an identical database; do one, not both.

**Option A — phpMyAdmin (no command line needed).** Import two ready-made SQL
files from [scripts/mysql/](scripts/mysql/):

1. Open phpMyAdmin from the same hPanel Databases page.
2. **Select your database in the left sidebar first.** Both files deliberately
   omit `CREATE DATABASE`/`USE`, so they import into whichever database is
   selected — that's what makes them work with Hostinger's prefixed names.
3. Import [`scripts/mysql/01-schema.sql`](scripts/mysql/01-schema.sql) — 53
   tables, 81 foreign keys, no rows.
4. Import [`scripts/mysql/02-reference-data.sql`](scripts/mysql/02-reference-data.sql) —
   roles, permissions, relationship types, approval rules, post types, areas,
   the ₹2,000 fee, and one admin login.

Then skip step 3's `migrate deploy` and step 4's `db:seed` in Part 3 — the
import already did both. Full detail: [scripts/mysql/README.md](scripts/mysql/README.md).

**Option B — SSH.** Leave the database empty here and let
`npx prisma migrate deploy` + `npm run db:seed` create everything in Part 3.

Either order stays safe: the SQL files record the migration as applied in
`_prisma_migrations`, so a later `migrate deploy` is a no-op rather than an
error.

> A database built from those two SQL files was verified by running the app's
> full 143-test suite against it — the schema they produce is not
> hand-maintained, it's dumped from the same Prisma migration the CLI uses.

> If you ever deploy this somewhere with real root/admin MySQL access instead
> (a VPS, a managed MySQL provider) rather than Hostinger shared hosting,
> [scripts/mysql/create-database.sql](scripts/mysql/create-database.sql) does
> the equivalent of steps 2–4 above as a runnable script. It does **not**
> work on Hostinger shared hosting itself — your hosting account's MySQL user
> lacks the `CREATE USER`/`GRANT` privilege the script needs, which is
> exactly why the panel wizard exists.

---

# Part 2 — Environment variables

Set these in hPanel's **Node.js app → Environment Variables** screen (not in
a committed file). [.env.example](.env.example) documents every key; the
block below is what to actually set for this deployment.

```bash
# Database — from Part 1
DATABASE_URL="mysql://<db-user>:<db-password>@localhost:3306/<db-name>"

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
git push -u origin master:mysql-deploy
```

Open a PR from `mysql-deploy` into `main` on GitHub, review it, and merge —
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

`migrate deploy` applies the single MySQL baseline migration
(`prisma/migrations/20260910163143_init/`) and any later ones, without
prompting. It's the only `migrate` command safe to run against a server —
never `migrate dev` or `db push` in production.

## 4. Seed reference data (first deploy only — skip if you used phpMyAdmin)

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
- [ ] Back up the database on a schedule (hPanel has a MySQL backup/export
      tool), and separately back up `UPLOAD_DIR` — photos live on disk, not
      in the database.
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
