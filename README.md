> ## ⚠️ Two unrelated apps live in this repository — check your branch
>
> This repository was renamed from `miladwani` to **`Ladwani`**, and it holds **two
> different applications on unrelated histories**. `git merge-base main rebuild`
> finds no common ancestor, so these are not a fork and a mainline — they are two
> codebases sharing one repo.
>
> | Branch | App | Schema | Deploys to |
> |---|---|---|---|
> | **`main`** (you are reading its README) | one Next.js app, single process | 53 Prisma models | `devmiladwani.agtci.com` |
> | **`rebuild`** | NestJS API **+** Next.js web — two processes, so two Hostinger sites | **73** Prisma models | `(dev/test)ladwani.bkesari.com` |
>
> `rebuild` covers Family Registry, Matrimony, Community Social, Bookings/Assets,
> Payments/Fees/Ledger and Admin/Reporting (M0–M6). This branch covers Family
> Registry, Directory and Matrimony only. On the Mac the rebuild is checked out at
> `/Users/agtci/Documents/Project_Documents/Projects/community-platform`.
>
> **So:** everything below describes the `main` app and `devmiladwani.agtci.com`.
> For the bkesari tiers, use `rebuild` and `bkesari-platform/DEPLOY.md` part 5.
> The platform's `database/ladwani/*.sql` scripts are generated from **`rebuild`**'s
> schema (73 tables), not this branch's — do not import them into a database for
> this app.

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
git clone https://github.com/sanjaymorankar-debug/Ladwani.git
cd Ladwani
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
git remote add origin https://github.com/sanjaymorankar-debug/Ladwani.git
git push -u origin main
```

## License

Private — Ladwani Samaj. All rights reserved.
