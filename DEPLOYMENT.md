# Deploying to devmiladwani.agtci.com

Written 6 Sep 2026. **Read the two blockers first — do not start at step 1.**

---

## ⛔ Blocker 1 — three unrelated codebases exist

`github.com/sanjaymorankar-debug/miladwani` contains two branches, and this
working copy is a third. **No two of them share any git history.**

| Codebase | Database | State |
|---|---|---|
| GitHub **`main`** (last push 26 Aug) | **MySQL** | Almost certainly what is live now. Already contains fixes for the same bugs fixed here — login, `/dashboard/` nav 404s, OTP skip, join requests, Karta member management |
| GitHub **`rebuild`** | unknown | A completely different monorepo (`apps/`, `packages/`) with milestones M1–M5 including *Community Services & Booking*, *Payments, Fees & Financial Ledger*, *Admin & Hardening*. **No common ancestor with `main`** |
| **This working copy** (local `master`, 16 commits) | **PostgreSQL** | Built from `miladwanisourcefixed.zip`, which was an older snapshot than either branch |

Consequences you need to weigh:

- **`git push --force` would destroy real work.** Our local history is unrelated
  to `main`, so git cannot merge them; a force-push replaces them.
- **The asset/booking/payment/fee modules I built already exist in some form on
  `rebuild`.** This is the "structural discrepancy" flagged in `SPEC-STATUS.md`:
  the spec assumed those modules existed, and they did — just not in the zip.
- The bug fixes here duplicate fixes already on `main`, made independently.

**Decide before deploying:** which codebase is the future. I can help compare
them feature by feature, or port specific work from here onto `main`. What I
should not do is overwrite anything.

## ⛔ Blocker 2 — this codebase needs PostgreSQL; production runs MySQL

`schema.prisma` here targets **PostgreSQL**; `main` targets **MySQL**. A Prisma
client is compiled for one engine and cannot talk to the other.

Two of the guarantees built here are **PostgreSQL-specific**:

- **Double-booking prevention** uses a GiST exclusion constraint
  (`bookings_no_overlap`) with the `btree_gist` extension. **MySQL has no
  equivalent.** Porting to MySQL means replacing it with explicit row locking
  (`SELECT … FOR UPDATE`) — which is doable but is a real re-implementation, not
  a config change.
- `String[]` array columns (matrimony languages, asset facilities) are Postgres
  types; MySQL needs JSON columns instead.

Your options:

| Option | Effort | Notes |
|---|---|---|
| **A. Managed PostgreSQL** (Neon, Supabase, Railway) | Low | Free tiers exist. Keep every guarantee. Migrate MySQL data with `MIGRATION.md`. **Recommended.** |
| **B. PostgreSQL on a Hostinger VPS** | Medium | Only if you have a VPS, not shared hosting |
| **C. Port this work back to MySQL** | High | Loses the database-level double-booking guarantee; needs the locking rewrite |

---

# Deployment steps

Everything below assumes Blockers 1 and 2 are resolved. The live site already
serves Next.js (`X-Powered-By: Next.js`), so Node hosting is working — this is
a redeploy of an existing setup, not a new one.

## 1. Get the code onto GitHub safely

**Never force-push over `main`.** Publish this work as its own branch and open
a PR so the diff is reviewable:

```bash
cd D:\Claude_development\ladwani\app
git remote add origin https://github.com/sanjaymorankar-debug/miladwani.git
git fetch origin
git push -u origin master:postgres-rebuild
```

Because the histories are unrelated, GitHub will show this as a branch with no
common ancestor — that is expected, and exactly why it must not be forced onto
`main`. Open the PR from `postgres-rebuild` and decide there.

## 2. Provision the database

Create a PostgreSQL 16 database (managed provider or VPS) and note the
connection string. Then enable the extension the booking constraint needs:

```sql
CREATE EXTENSION IF NOT EXISTS btree_gist;
```

Most managed providers allow this; if yours refuses, tell me before going
further — the double-booking guarantee depends on it.

## 3. Set environment variables on the server

Never commit these. Set them in hPanel's Node.js app config, or the VPS
process manager's env file:

```bash
DATABASE_URL="postgresql://user:pass@host:5432/miladwani?schema=public"
NEXTAUTH_SECRET="<openssl rand -base64 32>"     # NOT the dev value
NEXTAUTH_URL="https://devmiladwani.agtci.com"
NEXT_PUBLIC_APP_URL="https://devmiladwani.agtci.com"

# Email — already tested working
SMTP_HOST="smtp.hostinger.com"
SMTP_PORT=465
SMTP_USER="noreply@agtci.com"
SMTP_PASSWORD="<mailbox password>"
SMTP_FROM="noreply@agtci.com"
NEXT_PUBLIC_AUTH_REQUIRE_VERIFICATION=true

# Storage — local disk, OUTSIDE the web root so uploads are never
# directly fetchable
STORAGE_DRIVER=LOCAL
UPLOAD_DIR=/home/<user>/miladwani-uploads

# Payments — still MOCK. See step 8.
PAYMENT_GATEWAY=MOCK
PAYMENT_SIGNING_SECRET="<openssl rand -base64 32>"

NODE_ENV=production
```

Generate a **fresh** `NEXTAUTH_SECRET`: reusing the development one would let
anyone holding it forge session cookies.

## 4. Deploy the code

```bash
ssh <user>@<host>
cd /path/to/app
git fetch origin && git checkout postgres-rebuild && git pull

npm ci                      # exact lockfile install, not npm install
npx prisma migrate deploy   # applies migrations; never use `migrate dev` here
npm run build               # runs prisma generate first (see package.json)
```

`migrate deploy` applies pending migrations without prompting and never
resets data — it is the only migrate command safe against production.

## 5. Seed reference data (first deploy only)

```bash
npm run db:seed
```

This creates roles, the permission matrix, relationship types, approval
rules, post types, areas and the ₹2,000 family registration fee. It is
idempotent. **Do not run `db:seed:uat` on production** — that creates test
accounts with a published password.

Then immediately change the admin password created by the seed.

## 6. Migrate existing member data

If the live MySQL database holds real families, follow **`MIGRATION.md`** —
back up first, dry-run, check the report, then cut over. Run it from somewhere
that can reach the Hostinger MySQL host (its `localhost` binding is not
reachable from outside).

## 7. Start / restart the app

Node must keep running between requests. If hPanel manages the Node app, use
its restart button. On a VPS, use a process manager:

```bash
pm2 start npm --name miladwani -- start
pm2 save && pm2 startup      # survives reboot
```

Next.js listens on 3000 by default; the existing reverse proxy already fronts
it since the site is live.

## 8. Switch payments to a real gateway

`PAYMENT_GATEWAY=MOCK` runs the full booking and fee flow with signed,
server-verified callbacks, but **takes no money**. Before real bookings,
implement `verifySignature` for your provider in `src/lib/payments.ts` (the
flow itself does not change) and set the provider keys. Tell me which gateway
and I will wire it.

## 9. Smoke test on production

- [ ] `/login` — sign in as admin, land on `/admin`
- [ ] Register a throwaway account → verification email arrives from `noreply@agtci.com`
- [ ] Register a family → Karta role granted, ₹2,000 invoice raised
- [ ] Upload a profile photo → appears, and is not reachable when logged out
- [ ] Create a post as a member → held for moderation, not in the feed
- [ ] Book an asset → slot held → pay → confirmed
- [ ] Try the same slot twice → second attempt refused

## 10. Before real members arrive

- [ ] **Publish DKIM** for `agtci.com` (SPF, DMARC and MX are already correct).
      Without it, verification codes land in spam — and members cannot sign in
      without receiving them.
- [ ] Back up the database on a schedule, and include `UPLOAD_DIR` — photos
      live on disk, not in the database.
- [ ] Delete `AGENTS.md` / `CLAUDE.md`: they instruct AI tools to read Next.js
      docs at a path that does not exist in the installed version.
- [ ] Rotate the admin password and any credential that has appeared in chat.

---

## Rollback

```bash
git checkout <previous-commit>
npm ci && npm run build
pm2 restart miladwani
```

Prisma migrations do **not** auto-roll-back. If a migration must be undone,
restore the database from the backup taken in step 6 — which is why that
backup is not optional.
