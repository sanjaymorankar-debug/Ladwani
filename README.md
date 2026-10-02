> ## ⚠️ Which Ladwani app is this?
>
> This repo is the **single Next.js app** (53 Prisma models, one process). It is
> what `devmiladwani.agtci.com` runs, per `DEPLOYMENT.md`.
>
> It is **not** what serves `ladwani.bkesari.com`. `bkesari-platform/DEPLOY.md`
> part 5 says that is the **full rebuild** — a NestJS API plus a Next.js web app,
> two separate processes and so two Hostinger sites — in
> `/Users/agtci/Documents/Project_Documents/Projects/community-platform`
> (github.com/sanjaymorankar-debug/miladwani, branch `rebuild`). The platform's
> `database/ladwani/*.sql` scripts were regenerated from **that** schema: 69
> tables, against this app's 53 models.
>
> | | this repo | the rebuild |
> |---|---|---|
> | Shape | one Next.js app | NestJS API + Next.js web |
> | Schema | 53 Prisma models | 69 tables |
> | Covers | Family Registry, Directory, Matrimony | + Community Social, Bookings/Assets, Payments/Fees/Ledger, Admin/Reporting (M0–M5) |
> | Deploys to | `devmiladwani.agtci.com` | `(dev/test)ladwani.bkesari.com` |
>
> So: **don't deploy this one to the bkesari tiers**, and don't assume the
> platform's Ladwani SQL matches this app's schema — it does not.

# Mi Ladwani — Community Platform

Official digital platform for Ladwani Samaj: Family Registry, Member Directory & Matrimony.

**Live URL:** https://devmiladwani.agtci.com

## Tech Stack

- **Frontend/Backend:** Next.js 14 (App Router + Server Actions + API Routes)
- **Database:** PostgreSQL 16 + Prisma ORM
- **Auth:** NextAuth.js v4 (JWT strategy)
- **Styling:** Tailwind CSS
- **File Storage:** S3-compatible (MinIO for dev, AWS S3 or Cloudflare R2 for prod)
- **Cache:** Redis (optional, for rate limiting)

## Getting Started

### 1. Prerequisites

- Node.js 20+
- Docker & Docker Compose

### 2. Clone & Install

```bash
git clone https://github.com/sanjaymorankar-debug/miladwani.git
cd miladwani
npm install
```

### 3. Environment Setup

```bash
cp .env.example .env
# Edit .env with your values
```

### 4. Start Database (Docker)

```bash
docker compose up postgres redis minio -d
```

### 5. Database Setup

```bash
npm run db:generate    # Generate Prisma client
npm run db:migrate     # Run migrations
npm run db:seed        # Seed initial data
```

### 6. Start Development Server

```bash
cd apps/web
npm run dev
```

Visit: http://localhost:3000

## Project Structure

```
miladwani/
├── apps/
│   └── web/               # Next.js 14 application
│       ├── src/
│       │   ├── app/       # App Router pages + API routes
│       │   ├── components/# React components
│       │   └── lib/       # Auth, Prisma, utils, validators
│       ├── next.config.js
│       └── Dockerfile
├── prisma/
│   ├── schema.prisma      # Complete database schema (40+ models)
│   └── seeds/             # Seed data
├── docker-compose.yml
└── .env.example
```

## Deployment (devmiladwani.agtci.com)

App is served at the root of the `devmiladwani.agtci.com` subdomain (no basePath / sub-path). If the host's reverse proxy needs an explicit vhost config, point it at the Node process root — no `location /ladwani` block is needed.

### Production Build

```bash
npm install
npm run build   # runs "prisma generate" then "next build" (see package.json)
npm run start
```

### Environment Variables for Production

```
DATABASE_URL=postgresql://...
NEXTAUTH_SECRET=<strong-random-secret>
NEXTAUTH_URL=https://devmiladwani.agtci.com
NEXT_PUBLIC_APP_URL=https://devmiladwani.agtci.com
```

## Default Roles

| Role | Description |
|------|-------------|
| MEMBER | Basic community member |
| KARTA | Family head (manages family) |
| OPERATOR | Community data manager |
| ADMIN | Full platform access |

## GitHub Push

```bash
git init
git add .
git commit -m "feat: initial Mi Ladwani platform"
git remote add origin https://github.com/sanjaymorankar-debug/miladwani.git
git push -u origin main
```

## License

Private — Ladwani Samaj. All rights reserved.
