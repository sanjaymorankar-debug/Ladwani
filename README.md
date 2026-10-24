# Mi Ladwani — Community Platform

Official digital platform for Ladwani Samaj: Family Registry, Member Directory & Matrimony.

**Served at:** https://bkesari.com/ladwani (production). The dev site is
`devladwani.bkesari.com`, deployed from the `dev` branch by
`.github/workflows/deploy-dev.yml`. The old `devmiladwani.agtci.com` site is
not ours to deploy to any more.

## Tech Stack

- **Frontend/Backend:** Next.js 14.2 (App Router + API Routes), one app at the repository root
- **Database:** PostgreSQL (Neon in every tier, PostgreSQL 16 locally and in CI) + Prisma 5
- **Auth:** NextAuth.js v4 (JWT strategy, email-or-mobile + password)
- **Styling:** Tailwind CSS
- **File Storage:** local disk (`STORAGE_DRIVER=LOCAL`, the default) or any S3-compatible bucket
- **Rate limiting:** in memory, per process (`src/lib/rate-limit.ts`); no Redis

## Getting Started

### 1. Prerequisites

- Node.js 20+ (CI uses 22)
- PostgreSQL 13+ with the `citext` and `btree_gist` extensions available
  (a local PostgreSQL 16, `docker compose up postgres -d`, or a Neon branch)

### 2. Clone & Install

```bash
git clone https://github.com/sanjaymorankar-debug/Ladwani.git
cd Ladwani
npm ci                 # postinstall runs `prisma generate`
```

### 3. Environment Setup

```bash
cp .env.example .env
# Edit .env with your values. With one local database, DATABASE_URL is
# enough: DATABASE_URL_UNPOOLED defaults to it.
```

### 4. Database Setup

```bash
npx prisma migrate deploy   # build the schema (npm run db:migrate for new migrations)
npm run db:seed             # reference data + the admin login
npm run db:seed:uat         # optional: the UAT accounts and families (never in production)
```

### 5. Start the Development Server

```bash
npm run dev
```

Visit: http://localhost:3000 (or http://localhost:3000/ladwani with
`BASE_PATH=/ladwani` in `.env`, which is how bkesari.com serves it).

## Testing

`TEST_SPEC.md` says what "tested" means here and how to run it: the static
checks, `npm test` against a scratch PostgreSQL, the production build, a
smoke run under `/ladwani`, and the Neon parity checks. CI
(`.github/workflows/ci.yml`) runs the same suite on every push to `main` and
`staging`.

## Project Structure

```
Ladwani/
├── src/
│   ├── app/              # App Router pages + API routes (src/app/api/**/route.ts)
│   ├── components/       # React components
│   ├── lib/              # Auth, Prisma client, validators, domain logic
│   └── middleware.ts     # route protection
├── prisma/
│   ├── schema.prisma     # the schema (PostgreSQL)
│   ├── migrations/       # PostgreSQL baseline + later migrations
│   └── seeds/            # seed.ts (reference data), uat-seed.ts (UAT accounts)
├── scripts/postgres/     # the schema and reference data as plain SQL
├── tests/                # vitest suites (unit + integration against PostgreSQL)
├── next.config.js        # basePath from BASE_PATH
└── .env.example
```

## Deployment

On bkesari.com the hub forwards `/ladwani/` to this app **without** stripping
the prefix, so the app owns it: set `BASE_PATH=/ladwani` both for the build
and in the server's `.env` (see `next.config.js` and `.env.example`). Full
steps, Neon included: [DEPLOYMENT.md](DEPLOYMENT.md).

```bash
npm ci
npm run build   # runs "prisma generate" then "next build" (see package.json)
npm run start
```

### Database

PostgreSQL on Neon, one Neon branch per tier (`production`, `test`, `dev`),
database `bk_ladwani` owned by role `bk_ladwani_app` on each. The app uses the
pooled connection string (`DATABASE_URL`) and Prisma's CLI the direct one
(`DATABASE_URL_UNPOOLED`). Details: [DEPLOYMENT.md](DEPLOYMENT.md) Part 1.
Schema without the CLI: [scripts/postgres/](scripts/postgres/). Moving data
from the old MySQL database: [MIGRATION.md](MIGRATION.md).

### Environment Variables for Production

```
DATABASE_URL=postgresql://bk_ladwani_app:<password>@<endpoint>-pooler.<region>.aws.neon.tech/bk_ladwani?sslmode=require&channel_binding=require
DATABASE_URL_UNPOOLED=postgresql://bk_ladwani_app:<password>@<endpoint>.<region>.aws.neon.tech/bk_ladwani?sslmode=require&channel_binding=require
BASE_PATH=/ladwani
NEXTAUTH_SECRET=<strong-random-secret>
NEXTAUTH_URL=https://bkesari.com/ladwani/api/auth
NEXT_PUBLIC_APP_URL=https://bkesari.com/ladwani
```

## Default Roles

| Role | Description |
|------|-------------|
| MEMBER | Basic community member |
| KARTA | Family head (manages family) |
| OPERATOR | Community data manager |
| ADMIN | Full platform access |
| ASSET_OWNER | Registers and manages bookable community assets |

## License

Private — Ladwani Samaj. All rights reserved.
