# LadWani — test specification

LadWani (Mi Ladwani) is the Ladwani Samaj community platform: family
registry, member directory, matrimony, community groups, assets, bookings and
fees. It is one Next.js 14.2 app (App Router, NextAuth v4, Prisma 5 on
PostgreSQL) at the root of this repository's `main` branch. On bkesari.com it
is served at **`/ladwani`** (`BASE_PATH=/ladwani`; the hub forwards the prefix
without stripping it), with its database on **Neon** in every tier. Its dev
site is `devladwani.bkesari.com` (`.github/workflows/deploy-dev.yml`). This
spec covers everything in this repository that can be tested on a developer's
Mac or in CI without reaching a hosted service. How to deploy is in
`DEPLOYMENT.md`; the historical UAT runs are in `UAT-RESULTS.md`; the schema's
SQL path is in `scripts/postgres/README.md`.

Testing agent: `.claude/agents/ladwani-tester.md`. It runs automatically after
every code change (the test gate, `.claude/hooks/test_gate.py`); run it by
hand by asking Claude to "run the ladwani-tester agent".

## 1. Scope

| Component | Path | Language / framework |
|---|---|---|
| Web app: pages, API routes (98 `route.ts`), middleware | `src/` | TypeScript, Next.js 14.2 App Router, NextAuth 4.24 |
| Database schema and migrations | `prisma/schema.prisma`, `prisma/migrations/` | Prisma 5.22, PostgreSQL 13+ (`citext`, `btree_gist`) |
| Seeds | `prisma/seeds/seed.ts` (reference data), `prisma/seeds/uat-seed.ts` (UAT accounts) | TypeScript via ts-node |
| Schema as plain SQL | `scripts/postgres/` (`01-schema.sql`, `02-reference-data.sql`, `create-database.sql`, `regenerate.sh`) | SQL, bash |
| Test and smoke tooling | `tests/`, `scripts/with-env.js`, `scripts/check-base-path.sh`, `scripts/smoke-base-path.sh`, `scripts/neon-parity-pool.js` | vitest 4, Node, bash |
| Deploy guard | `.github/deploy/guard.sh`, `guard.test.sh` | bash |
| Workflows | `.github/workflows/ci.yml`, `deploy-dev.yml` | GitHub Actions (parsed, and their commands mirrored here; not executed locally) |

Out of scope:
- **The `rebuild` branch** (NestJS API + Next.js web in npm workspaces,
  `apps/api`, `apps/web`, `packages/shared-types`; unrelated history; see
  bkesari-platform's `DEPLOY.md` Part 5). Nothing here applies to it. If
  `rebuild` replaces `main`, this spec has to be rewritten, not patched: the
  components become two apps and a shared package, the commands become the
  workspace scripts (`npm test` / `npm run test:integration` in `apps/api`,
  `typecheck` and `lint` per workspace), the schema, migrations and seeds
  move under `apps/api`, base-path serving has to be re-proved for both the
  web app and the API, and every critical-regression row below has to be
  re-derived from that code.
- Neon itself, the bkesari.com hub, SMTP, S3 and a real payment gateway:
  never contacted. The Neon parity level (S7) reproduces Neon's behaviour
  locally instead.
- `scripts/migrate-mysql-to-postgres.ts`: a one-off data copy, verified by
  the PR that wrote it (see Known gaps).
- Other bkesari projects and their repositories.

## 2. Environment

**Tools.** CI: Ubuntu, Node 22, npm 10, PostgreSQL 16 service container
(`postgres:16`). On the Mac:

```bash
brew install node@22 postgresql@16 pgbouncer   # pgbouncer only for S7
brew services start postgresql@16
```

PostgreSQL 13+ works; it must ship the `citext` and `btree_gist` contrib
extensions (Homebrew's does). S7 also needs TLS on PostgreSQL and a PgBouncer
1.21+ in front of it (see S7).

**Scratch databases.** Local PostgreSQL only, owned by a non-superuser role
that is a member of a `neon_superuser` stand-in, as on Neon. The names below
are the Mac defaults; any names work if `.env.test` and `.env.parity.local`
say so (this container used role and databases `t_ladwani`,
`t_ladwani_app`, `t_ladwani_shadow`; CI uses `miladwani_test` as `postgres`).

| Database | Used by |
|---|---|
| `ladwani_scratch` | `npm test` (S3, R1) |
| `ladwani_scratch_app` | the smoke runs (S5, S7) |
| `ladwani_scratch_shadow` | the SQL-file and migration checks (S7) |

Create them once, with the repo's own script, as a superuser:

```bash
psql -d postgres -v ON_ERROR_STOP=1 -c "DO \$\$BEGIN IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname='neon_superuser') THEN CREATE ROLE neon_superuser NOLOGIN CREATEDB CREATEROLE; END IF; END\$\$;"
for db in ladwani_scratch ladwani_scratch_app ladwani_scratch_shadow; do
  psql -d postgres -v app_role=ladwani_scratch -v app_password='scratch-only' \
    -v db_name=$db -f scripts/postgres/create-database.sql
done
psql -d postgres -c "GRANT neon_superuser TO ladwani_scratch"
```

**The suite writes to and deletes from these databases, and S7 empties
`ladwani_scratch_shadow` (drops its `public` schema).** They are disposable.
Never point any of this at `ladwani` / `miladwani` or a hosted database.

**`.env.test`** (git-ignored; `npm test` and `npm run test:migrate` read it
through `scripts/with-env.js`). Create it if it is missing; these are CI's
values with the local database:

```
DATABASE_URL=postgresql://ladwani_scratch:scratch-only@127.0.0.1:5432/ladwani_scratch?schema=public
NEXTAUTH_SECRET=local-test-only-secret
NEXTAUTH_URL=http://localhost:3000
NEXT_PUBLIC_APP_URL=http://localhost:3000
ADMIN_EMAIL=admin@miladwani.com
ADMIN_PASSWORD=CiOnlyAdmin123!
SEED_TEST_ACCOUNTS=true
STORAGE_DRIVER=LOCAL
UPLOAD_DIR=./uploads-test
PAYMENT_GATEWAY=MOCK
PAYMENT_SIGNING_SECRET=ci-only-signing-secret
```

- `DATABASE_URL_UNPOOLED`: blank is fine; `with-env.js` copies
  `DATABASE_URL` into it (the schema's `directUrl` needs it for
  `prisma validate`/`migrate`).
- `NEXT_PUBLIC_AUTH_REQUIRE_VERIFICATION`, `BASE_PATH`, `CRON_SECRET`,
  `SMTP_*`, `S3_*`: blank is fine. The tests set what they need.
- `UPLOAD_DIR=./uploads-test` is git-ignored; photo tests write there.

**`.env.parity.local`** (git-ignored by `.env*.local`; only for S7). URLs of
the Neon-like test bed, all on this machine:

```
PARITY_DIRECT_URL='postgresql://ladwani_scratch:scratch-only@127.0.0.1:5432/ladwani_scratch_app?sslmode=require&channel_binding=require'
PARITY_POOLED_URL='postgresql://ladwani_scratch:scratch-only@127.0.0.1:6432/ladwani_scratch_app?sslmode=require'
PARITY_SHADOW_URL='postgresql://ladwani_scratch:scratch-only@127.0.0.1:5432/ladwani_scratch_shadow?sslmode=require&channel_binding=require'
PARITY_ROLE=ladwani_scratch
```

Keep the single quotes: S7 sources this file in the shell, where an unquoted
`&` would end the line. Add `&channel_binding=require` to `PARITY_POOLED_URL` only if the local
PgBouncer supports SCRAM channel binding (PgBouncer 1.22 does not: both psql
and Prisma then refuse to connect, correctly). Node's `pg`-style CA settings
do not apply: Prisma's engine does not verify the certificate on
`sslmode=require`, so no CA file is needed.

**Ports.** 3103 for the smoke server (any free port on the Mac); 5432
PostgreSQL; 6432 PgBouncer (S7).

**One-time setup.**

```bash
npm ci                                   # postinstall runs prisma generate
npm run test:migrate                     # migrate deploy on DATABASE_URL from .env.test
node scripts/with-env.js .env.test npm run db:seed
node scripts/with-env.js .env.test npm run db:seed:uat
```

Re-run `npm run db:generate` whenever `prisma/schema.prisma` changes, and the
two seeds after any seed change. Both seeds are idempotent.

## 3. Standard suite

Run in order, from the repository root. Record exit code, counts and
duration for each.

| # | Level | Command | Passes when |
|---|---|---|---|
| S1.1 | static: syntax | `for f in scripts/*.js next.config.js; do node --check "$f"; done; for f in scripts/*.sh scripts/postgres/*.sh .github/deploy/*.sh; do bash -n "$f"; done` | no output, exit 0 |
| S1.2 | static: workflows parse | `node -e "const y=require('js-yaml'),fs=require('fs');for(const f of ['.github/workflows/ci.yml','.github/workflows/deploy-dev.yml'])y.load(fs.readFileSync(f,'utf8'))"` | exit 0 |
| S1.3 | static: typecheck | `npm run typecheck` | exit 0, no output from `tsc` |
| S1.4 | static: schema valid | `node scripts/with-env.js .env.test npx prisma validate` | "The schema at prisma/schema.prisma is valid" |
| S1.5 | static: still PostgreSQL | `grep -qE '^\s*provider\s*=\s*"postgresql"' prisma/schema.prisma && grep -qE '^provider\s*=\s*"postgresql"' prisma/migrations/migration_lock.toml && grep -qE '^\s*directUrl\s*=\s*env\("DATABASE_URL_UNPOOLED"\)' prisma/schema.prisma` | exit 0 |
| S1.6 | static: API URLs carry BASE_PATH | `bash scripts/check-base-path.sh` | "All of this app's API URLs carry BASE_PATH." |
| S1.7 | static: lint | not run: see Known gaps | — |
| S2 | unit | `node scripts/with-env.js .env.test npx vitest run tests/additional-details-rules.test.ts tests/profile-details.test.ts tests/db-url.test.ts tests/next-config.test.ts tests/base-path-redirects.test.ts` | all pass, counts per Baseline |
| S3.1 | integration: migrate | `npm run test:migrate` | "All migrations have been successfully applied" or "No pending migrations to apply" |
| S3.2 | integration: seeds | `node scripts/with-env.js .env.test npm run db:seed && node scripts/with-env.js .env.test npm run db:seed:uat` | both exit 0 |
| S3.3 | integration: migrations = schema | `node scripts/with-env.js .env.test sh -c 'npx prisma migrate diff --from-url "$DATABASE_URL" --to-schema-datamodel prisma/schema.prisma --exit-code'` | "No difference detected.", exit 0 |
| S3.4 | integration: full suite | `npm test` | 0 failed, 0 skipped, counts per Baseline |
| S4 | build | `env DATABASE_URL=postgresql://build:build@127.0.0.1:5432/build NEXTAUTH_SECRET=build-only BASE_PATH=/ladwani NEXT_TELEMETRY_DISABLED=1 npm run build` then `node -e "process.exit(require('./.next/routes-manifest.json').basePath==='/ladwani'?0:1)"` | build exit 0 ("Compiled successfully"), basePath check exit 0. Prisma "Authentication failed" errors logged while prerendering `/groups/new` are expected (the build has no database; the page is dynamic) |
| S5 | smoke | below | `scripts/smoke-base-path.sh` prints "<n> passed, 0 failed" |
| S6 | security & hygiene | below (S6.1–S6.5) | each check as stated |
| S7 | Neon parity | below (S7.1–S7.6) | each check as stated, or the level not run with a stated reason |

**S5 smoke.** Prepare the app database, start the S4 build on the direct
local URL, probe it through `/ladwani`, then stop it:

```bash
export DATABASE_URL='postgresql://ladwani_scratch:scratch-only@127.0.0.1:5432/ladwani_scratch_app?schema=public'
export DATABASE_URL_UNPOOLED="$DATABASE_URL"
npx prisma migrate deploy
ADMIN_PASSWORD='SmokeAdmin123!' SEED_TEST_ACCOUNTS=true npm run db:seed
npm run db:seed:uat
BASE_PATH=/ladwani NEXTAUTH_SECRET=smoke-only NEXTAUTH_URL=http://127.0.0.1:3103/ladwani/api/auth \
  NEXT_PUBLIC_APP_URL=http://127.0.0.1:3103/ladwani STORAGE_DRIVER=LOCAL UPLOAD_DIR=/tmp/ladwani-smoke-uploads \
  PAYMENT_GATEWAY=MOCK PAYMENT_SIGNING_SECRET=smoke CRON_SECRET=smoke AUTH_ADMIN_2FA=false \
  node node_modules/next/dist/bin/next start -p 3103 &   # no -H, as `npm start`
echo $! > /tmp/ladwani-smoke.pid
until curl -sf -o /dev/null http://127.0.0.1:3103/ladwani/login; do sleep 1; done
bash scripts/smoke-base-path.sh http://127.0.0.1:3103/ladwani
```

Leave this server running for S7.6, then stop it:
`kill "$(cat /tmp/ladwani-smoke.pid)"`.
The probes cover the public pages and a `/ladwani/_next/static` chunk, the
404 at the root, anonymous redirects to `/ladwani/login` with a prefixed
`callbackUrl`, sign-in of the member, operator and admin UAT accounts through
`/ladwani/api/auth`, role checks on pages and APIs, the middleware redirect
and a server-side `redirect()` both staying under `/ladwani`, and, signed
in (anonymous requests get the login redirect first), 404s for `/.env`,
`/prisma/schema.prisma` and `/package.json`. `AUTH_ADMIN_2FA=false` is for
this local smoke only: since the workbook PR (#10) an Admin also needs an
emailed sign-in code (F32), which the script cannot read. Never set it on a
deployed tier. Start without `-H`: with `-H`, Next 14
builds middleware redirects from its own hostname (`http://localhost:3103/...`);
`npm start` on the servers runs without it and sends relative Locations.

**S6 security & hygiene.**

S6.1 No tracked env file or secret. Both commands print nothing:

```bash
git ls-files | grep -E '(^|/)\.env' | grep -vx '.env.example'
git grep -nIE 'npg_[A-Za-z0-9]{8,}|BEGIN [A-Z ]*PRIVATE KEY' -- . ':!TEST_SPEC.md'
```

S6.2 Protected routes refuse anonymous callers:
`tests/uat/permissions.test.ts` ("every protected endpoint refuses an
anonymous caller") and `tests/authorization.test.ts` ("Unauthenticated") pass
in S3.4, and S5's anonymous probes pass.

S6.3 Nothing private is served: S5's signed-in `/.env`,
`/prisma/schema.prisma` and `/package.json` probes return 404; `tests/uat/photos.test.ts` TC-PHOTO-006, -014 and -015
pass.

S6.4 Route protection cannot be configured away: `tests/next-config.test.ts`
passes (it refuses `NEXTAUTH_URL=https://bkesari.com/ladwani`).

S6.5 Dependency audit, report-only: `npm audit --omit=dev`. List findings
that are not in the Baseline. Fix one only when `npm update <package>
--dry-run` shows a change to that package alone; anything that adds or
upgrades other packages goes to Open items.

**S7 Neon parity.** Proves the app behaves the way it will on Neon. Needs
PostgreSQL with TLS (`ssl = on`, any certificate) and SCRAM passwords, and a
PgBouncer 1.21+ on 6432 with `pool_mode = transaction`,
`max_prepared_statements` > 0 (Neon uses 1000), `client_tls_sslmode =
require` and SCRAM auth for the scratch role. Load the URLs first:

```bash
set -a; . ./.env.parity.local; set +a
```

If that test bed is not available, mark S7 "NOT RUN: <reason>" (see Pass
criteria). Each check:

S7.1 The role is no superuser, owns its database, and is in
`neon_superuser`. Prints `f`, `t`, `t`:

```bash
psql "$PARITY_DIRECT_URL" -Atc "select rolsuper from pg_roles where rolname = current_user" \
  -c "select pg_get_userbyid(datdba) = current_user from pg_database where datname = current_database()" \
  -c "select pg_has_role(current_user, 'neon_superuser', 'member')"
```

S7.2 Migrations over the direct URL, with TLS and channel binding, create
the extensions without superuser. All migrations apply, then it prints
`btree_gist:<role>,citext:<role>`:

```bash
psql "$PARITY_SHADOW_URL" -qc 'DROP SCHEMA public CASCADE' -c 'CREATE SCHEMA public'
DATABASE_URL="$PARITY_SHADOW_URL" DATABASE_URL_UNPOOLED="$PARITY_SHADOW_URL" npx prisma migrate deploy
psql "$PARITY_SHADOW_URL" -Atc "select string_agg(extname || ':' || pg_get_userbyid(extowner), ',' order by extname) from pg_extension where extname in ('citext', 'btree_gist')"
```

S7.3 The SQL-file path builds the same database. Every `psql` exits 0
(`02` runs twice: it must be re-runnable), then "No pending migrations to
apply." and "No difference detected.":

```bash
psql "$PARITY_SHADOW_URL" -qc 'DROP SCHEMA public CASCADE' -c 'CREATE SCHEMA public'
psql "$PARITY_SHADOW_URL" -v ON_ERROR_STOP=1 -qf scripts/postgres/01-schema.sql
psql "$PARITY_SHADOW_URL" -v ON_ERROR_STOP=1 -qf scripts/postgres/02-reference-data.sql
psql "$PARITY_SHADOW_URL" -v ON_ERROR_STOP=1 -qf scripts/postgres/02-reference-data.sql
DATABASE_URL="$PARITY_SHADOW_URL" DATABASE_URL_UNPOOLED="$PARITY_SHADOW_URL" npx prisma migrate deploy
DATABASE_URL="$PARITY_SHADOW_URL" DATABASE_URL_UNPOOLED="$PARITY_SHADOW_URL" \
  npx prisma migrate diff --from-url "$PARITY_SHADOW_URL" --to-schema-datamodel prisma/schema.prisma --exit-code
```

S7.4 Prisma's prepared statements through the transaction pooler, without
`pgbouncer=true`. Prints "2250 queries ok, 0 failed":

```bash
DATABASE_URL="$PARITY_POOLED_URL" node scripts/neon-parity-pool.js
```

S7.5 The app on the pooled URL with TLS: start the S4 build exactly as in
S5 but with `DATABASE_URL="$PARITY_POOLED_URL"` and
`DATABASE_URL_UNPOOLED="$PARITY_DIRECT_URL"`, then
`bash scripts/smoke-base-path.sh http://127.0.0.1:3103/ladwani` shows 0
failed.

S7.6 The app survives the server dropping its idle connections, as a Neon
suspend does. On each smoke server (S5's on the direct URL, S7.5's on the
pooled URL), after it has served the smoke run:

```bash
sleep 35   # longer than the app's 30 s idle-connection lifetime (src/lib/db-url.ts)
psql "$PARITY_DIRECT_URL" -Atc "SELECT count(pg_terminate_backend(pid)) FROM pg_stat_activity WHERE usename = '$PARITY_ROLE' AND pid <> pg_backend_pid()"
kill -0 "$(cat /tmp/ladwani-smoke.pid)" && echo alive
bash scripts/smoke-base-path.sh http://127.0.0.1:3103/ladwani
```

Passes when the count is 1 or more, it prints `alive`, and the smoke run
shows 0 failed. The direct-URL case is the strict one: on Neon a suspend also
drops the app's connections to the pooler, which a local PgBouncer does not
reproduce.

## 4. Regression suite

**R1 — the full suite.** `npm test` again, straight after S3.4 and S5, on the
same database and without re-seeding. It proves the suite cleans up after
itself and does not depend on order. Same counts as S3.4.

**R2 — critical regressions.** Every row must pass in every run.

| ID | Behaviour that must never break | How it is checked |
|---|---|---|
| LW-CR-01 | Sign-in works with email or mobile; a wrong password or an unknown account gets the same generic error | `tests/uat/auth.test.ts` TC-LOGIN-001, -002, -002b, -003 |
| LW-CR-02 | 5 failed attempts lock the account; suspended/pending status is revealed only after a correct password | `tests/uat/auth.test.ts` TC-LOGIN-012, -004, -004b; `tests/verification-mode.test.ts` |
| LW-CR-03 | Passwords are bcrypt-hashed; email is one account whatever its letter case (CITEXT) | `tests/uat/auth.test.ts` TC-LOGIN-013, TC-AUTH-003b, TC-LOGIN-001b; `tests/uat/family.test.ts` TC-FAM-007b |
| LW-CR-04 | Anonymous callers are refused by every protected page and API | `tests/uat/permissions.test.ts` "every protected endpoint refuses an anonymous caller"; `tests/authorization.test.ts` "Unauthenticated"; S5 anonymous probes |
| LW-CR-05 | Role and family isolation: members, Kartas and non-admins cannot reach each other's data or the admin API | `tests/uat/permissions.test.ts` TC-PERM-001/-001b/-002/-002b/-003/-003b, TC-KARTA2-001..004, TC-OP-ISOLATION; `tests/authorization.test.ts` |
| LW-CR-06 | A Karta cannot override an adult account-holder, but can maintain account-less members of their own family only | `tests/uat/permissions.test.ts` TC-PERM-004, -004b, -004c |
| LW-CR-07 | A partial update never wipes fields it did not send (past CRITICAL defect) | `tests/uat/marital-karta.test.ts` TC-KARTA-009, -010 |
| LW-CR-08 | An asset can never be double-booked, even by simultaneous requests or a direct insert (`bookings_no_overlap`) | `tests/uat/assets-fees-posts.test.ts` TC-BOOK-002, -002b, -002c, -003 |
| LW-CR-09 | A booking or fee is paid only by a server-verified signed callback; forged and replayed callbacks change nothing | `tests/uat/assets-fees-posts.test.ts` TC-PAY-001, -002, -003 |
| LW-CR-10 | Registering a family raises the ₹2,000 invoice on the Karta; joiners are never billed; nobody pays another's invoice | `tests/uat/assets-fees-posts.test.ts` TC-FEE-001, -002, -003; `tests/registration-intent.test.ts` |
| LW-CR-11 | Invitation tokens are single-use, expire, can be revoked, and reveal only a minimal identity | `tests/uat/invitations-and-family-invites.test.ts` TC-INVITE-005, -006, -009, -010, -011, TC-FAMINV-003, -004 |
| LW-CR-12 | Private photos are not served to others; storage keys cannot escape `UPLOAD_DIR` | `tests/uat/photos.test.ts` TC-PHOTO-006, -014, -015 |
| LW-CR-13 | Members' posts and community groups wait for moderation | `tests/uat/assets-fees-posts.test.ts` TC-POST-001, -002; `tests/uat/community-groups.test.ts` |
| LW-CR-14 | Under `/ladwani` every redirect and API URL keeps the prefix (middleware, next-auth pages, the login page's callbackUrl, server `redirect()`) | `tests/base-path-redirects.test.ts` (all); `bash scripts/check-base-path.sh`; S5 redirect probes |
| LW-CR-15 | A `NEXTAUTH_URL` that would switch off the middleware, or a malformed `BASE_PATH`, stops the app at build/start | `tests/next-config.test.ts` (all) |
| LW-CR-16 | The migrations build exactly `schema.prisma`, the provider stays PostgreSQL, and the CLI uses the direct URL | S1.4, S1.5, S3.3 |
| LW-CR-17 | Migrations and the SQL files work for a non-superuser database owner over TLS (Neon's roles) | S7.1, S7.2, S7.3 |
| LW-CR-18 | Prisma works through a transaction-mode pooler without `pgbouncer=true` | S7.4, S7.5 |
| LW-CR-19 | The app keeps serving after the server drops its idle connections; cold starts get ≥ 10 s to connect | S7.6; `tests/db-url.test.ts` |
| LW-CR-20 | The dev deploy refuses test, production, agtci.com and gokesari.com | `bash .github/deploy/guard.test.sh` ("33 passed, 0 failed") |

**R3 — change-area map.** For the files that changed, look hardest at:

| Path | Emphasise |
|---|---|
| `src/middleware.ts`, `src/lib/auth.ts`, `src/lib/auth-config.ts`, `src/app/(auth)/**`, `src/app/api/auth/**` | LW-CR-01..04, -14, -15; S5 |
| `src/lib/member-auth.ts`, `src/lib/family-auth.ts`, `src/lib/visibility.ts`, `src/app/api/members/**`, `src/app/api/families/**` | LW-CR-05..07, -11 |
| `src/app/api/assets/**`, `src/lib/payments.ts`, `src/lib/fees.ts`, `src/app/api/payments/**`, `src/app/api/fees/**` | LW-CR-08..10 |
| `src/lib/storage.ts`, `src/app/api/**/photos/**`, `src/app/api/member-files/**` | LW-CR-12 |
| `src/lib/api-path.ts`, `next.config.js`, any new `fetch(` / `redirect(` / `router.push(` | LW-CR-14, -15; S1.6; S4 basePath check; S5 |
| `prisma/schema.prisma`, `prisma/migrations/**`, `scripts/postgres/**` | LW-CR-16, -17; S1.4, S1.5, S3.3, S7.2, S7.3 (regenerate the SQL files with `scripts/postgres/regenerate.sh`) |
| `src/lib/prisma.ts`, `src/lib/db-url.ts`, `scripts/with-env.js`, `package.json` (prisma, @prisma/client, next, next-auth) | the connection layer: LW-CR-16..19; all of S7 |
| `prisma/seeds/**` | S3.2, then the whole of S3.4 (the tests depend on the seeded fixtures) |
| `.github/workflows/**`, `.github/deploy/**` | S1.2, LW-CR-20; check by reading that the workflow steps still match S1–S4 |
| `tests/**` | the changed files alone first, then the full suite; counts against Baseline |

**R4 — baseline comparison.** Compare every level with §5. Fewer tests,
files or probes than the baseline, or any new skipped/todo test, is a failure
even when nothing is red, unless the change deliberately removed a test and
the report says why. New tests raise the baseline for the next run.

## 5. Baseline

Measured 2026-10-24 on branch `claude/fervent-bell-wcmmdu` (base commit
`b1acc62` plus this spec's working-tree changes), Linux container, Node
22.22, PostgreSQL 16.15, PgBouncer 1.22.0, 4 shared CPUs.

| Level | Count | Time |
|---|---|---|
| S1.1–S1.6 static (syntax, workflows, typecheck, `prisma validate`, provider + `directUrl`, BASE_PATH) | all pass | ~11 s |
| S1.7 lint | does not run (Known gaps) | — |
| S2 unit | 5 files, 59 passed | 4.6 s |
| S3.1–S3.3 migrate, both seeds, `migrate diff` | pass: no pending migrations, no difference | ~22 s |
| S3.4 `npm test` | **21 files, 332 passed, 0 failed, 0 skipped** | 55 s |
| S4 build, `BASE_PATH=/ladwani` | pass | 83 s |
| S5 smoke, direct URL | 24 passed | 4 s |
| S6.5 `npm audit --omit=dev` | 6 findings, report-only | — |
| S7.2 migrations over direct TLS + `channel_binding=require` | pass | — |
| S7.3 SQL files as the owner role | pass: 71 tables, 105 foreign keys | — |
| S7.4 pooler stress (`scripts/neon-parity-pool.js`) | 2,250 queries, 0 failed | — |
| S7.5 smoke, pooled TLS URL | 24 passed | — |
| S7.6 terminate idle backends, re-smoke | 24/24 direct and pooled; no P1017 | — |
| R2 critical rows LW-CR-01..20 | all pass | — |
| LW-CR-20 `guard.test.sh` | 33 passed | — |

Before this run the suite was 302 tests on PostgreSQL (296 on MySQL before
the move). The 30 added tests cover D1–D5. Expected skips: none.

**After the workbook PR (#10) was ported onto this branch (2026-10-25):** S3.4
`npm test` is **42 files, 560 passed, 0 failed, 0 skipped** (twice in a row on
a fresh database); S2 unchanged (5 files, 59 passed); S5 smoke 24 passed (with
`AUTH_ADMIN_2FA=false`, above); `01-schema.sql` now has 85 tables. See
`docs/POSTGRESQL-PORT.md`.

**After PR #17 (Approval Rules page, dashboard links; 2026-10-25):** S3.4
`npm test` is **43 files, 569 passed, 0 failed, 0 skipped**; S5 smoke is
**27 passed** (S7.5 and S7.6 re-smoke likewise), the 3 added being the `links`
probes in `scripts/smoke-base-path.sh` that fail on any page link without the
prefix.

## 6. Pass criteria

- **PASS**: S1–S6 and R1–R4 all ran and are green; counts at or above
  Baseline; no new skips; S6.5 shows nothing new that has a non-breaking fix;
  nothing open above S4. S7 ran and is green, or did not run with a stated
  reason **and** the change touches none of the connection-layer paths in R3
  (`prisma/**`, `src/lib/prisma.ts`, `src/lib/db-url.ts`,
  `scripts/with-env.js`, `scripts/postgres/**`, Prisma/Next versions in
  `package.json`).
- **FAIL**: any test, probe or check failed and is still failing after the
  fix loop, or a count went down.
- **BLOCKED**: a level could not run: no local PostgreSQL, `npm ci` failed,
  `.env.test` points anywhere but a local scratch database (`127.0.0.1`,
  `localhost` or a socket, a database other than `ladwani`/`miladwani`), or
  S7 could not run while the change touches the connection layer.

## 7. Defect handling

| Severity | Meaning | Example in this project |
|---|---|---|
| S1 | data loss, security hole, or the app does not start | a partial PATCH wiping a member's surname (TC-KARTA-009); `NEXTAUTH_URL=.../ladwani` silently switching off route protection |
| S2 | a feature broken | signed-in members sent to the hub's `/dashboard` instead of `/ladwani/dashboard`; first requests after a Neon suspend failing with P1017 |
| S3 | degraded, with a workaround | an anonymous visitor bounced through `/ladwani/api/auth/signin` before reaching the login page |
| S4 | cosmetic | an unescaped `"` in JSX (`react/no-unescaped-entities`) |

The agent may fix on its own: product code in `src/`, `prisma/` (new
migrations only; never edit an applied one), `scripts/`, `tests/` (to add
tests, or to correct a test the code's documented behaviour proves wrong),
`next.config.js`, docs. It must add a test that fails without the fix
whenever the suite did not catch the defect.

It must report instead of fixing: anything needing a new dependency or a
major-version upgrade (S6.5 findings), changes to the ESLint toolchain, CI
or deploy workflow behaviour, `.claude/` hook and gate files, `CLAUDE.md`,
`AGENTS.md`, `.gitignore`, and anything needing a hosted service.

Never: skip, disable, `.only`, delete or weaken a test or an assertion;
change an expected value to match wrong output; point anything at a hosted
or real database (Neon, Hostinger, `ladwani`, `miladwani`, anything not on
this machine); edit `.env*` files other than creating a missing `.env.test`
or `.env.parity.local` from §2; commit, push or deploy; leave a server
running.

## 8. Report format

Written to `.claude/test-runs/<UTC yyyymmdd-hhmmss>-ladwani-tester.md` and
copied to `.claude/test-runs/latest-ladwani-tester.md`:

```markdown
# ladwani-tester report — <UTC date time>

- Commit: <short sha> on <branch>, plus uncommitted changes: <yes/no>
- Changed files (vs origin/main and uncommitted): <list, each with its R3 area>
- Environment: Node <v>, PostgreSQL <v>, PgBouncer <v or "none">, <OS>
- Databases: <tests db>, <smoke db>, <shadow db> on <host>; role <role> (superuser: no)

## Results

| Level | Command | Result | Counts (pass/fail/skip) | Duration | vs baseline |
|---|---|---|---|---|---|
| S1.1 syntax | ... | PASS | — | 1 s | = |
| ... one row per S1.x, S2, S3.x, S4, S5, S6.x, S7.x, R1, R2, R4 ... |

### R2 critical regressions

| ID | Result | Evidence |
|---|---|---|
| LW-CR-01 | PASS | tests/uat/auth.test.ts TC-LOGIN-001/-002/-002b/-003 |
| ... all 20 rows ... |

## Defects

| ID | Severity | Area | Symptom | Root cause | Fix | Files | Test added | Status |
|---|---|---|---|---|---|---|---|---|
| D1 | S2 | ... | ... | ... | ... | ... | ... | fixed / open / pre-existing |

## Re-test

<the failing tests first, then the complete run: the same results table, final counts>

## Open items

<anything not fixed, with a proposed patch or the reason; S6.5 findings; skipped levels with reasons>

TESTER: ladwani-tester
VERDICT: PASS | FAIL | BLOCKED
```

## 9. Known gaps

- **Lint does not run.** Verified: `npx eslint` (ESLint 8.57.1) fails on
  `eslint.config.mjs` importing `eslint/config`, which only ESLint 9 exports,
  and the config spreads eslint-config-next 15+'s flat exports;
  `npm run lint` (`next lint`, Next 14.2) finds no `.eslintrc` and stops at an
  interactive prompt. Proposed fix, not applied: delete `eslint.config.mjs`
  and add `.eslintrc.json` containing `{ "extends": "next/core-web-vitals" }`
  (Next 14's own format). A trial run with exactly that config found 9 errors,
  all `react/no-unescaped-entities`, and 13 warnings (10
  `react-hooks/exhaustive-deps`); fix those, then add `npm run lint` to S1.7
  and to CI.
- **No browser end-to-end tests.** Client-only behaviour (the login page's
  `router.push`, the SessionProvider's `basePath`, forms) is covered through
  the pure helpers it uses and the HTTP-level smoke run, not a browser.
- **The hub is not in the loop.** Smoke requests go straight to the app with
  the prefix, the way the hub forwards them; the hub's own proxying, its
  Location handling and cookie scope on bkesari.com are untested. The
  next-auth session cookie is set for path `/` on the hub's host.
- **Channel binding through the pooler** is not testable with PgBouncer 1.22
  (no SCRAM-SHA-256-PLUS); it is proved on the direct endpoint (S7.2) and in
  `tests/db-url.test.ts` (the parameter reaches Prisma untouched).
- **A connection dropped within 30 s of its last use** still fails one query
  with P1017 the next time it is used. Neon only suspends after minutes
  idle, so a suspend cannot cause this; a compute restart under load could.
- **External services**: SMTP (`npm run test:smtp` needs a real mailbox), S3,
  a real payment gateway (only `PAYMENT_GATEWAY=MOCK` is tested), Neon.
- **`scripts/migrate-mysql-to-postgres.ts`** (the MySQL→PostgreSQL copy) is
  not exercised; its commit records a one-off verification against MySQL 8.0
  and MariaDB 10.11.
- **CI runs S1–S4 and the guard, not S5–S7.**
- **No load or performance tests**, and no accessibility or mobile-viewport
  checks (`SPEC-STATUS.md` §42).
- **Dependency audit** findings are report-only (S6.5).
