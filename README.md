# Mi Ladwani — Community Platform

Official digital platform for Ladwani Samaj: Family Registry, Member Directory & Matrimony.

**Live URL:** https://agtci.com/ladwani

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

Visit: http://localhost:3000/ladwani

## Project Structure

```
miladwani/
├── apps/
│   └── web/               # Next.js 14 application
│       ├── src/
│       │   ├── app/       # App Router pages + API routes
│       │   ├── components/# React components
│       │   └── lib/       # Auth, Prisma, utils, validators
│       ├── next.config.js # basePath: /ladwani
│       └── Dockerfile
├── prisma/
│   ├── schema.prisma      # Complete database schema (40+ models)
│   └── seeds/             # Seed data
├── docker-compose.yml
└── .env.example
```

## Deployment (agtci.com/ladwani)

### Nginx Configuration (add to your server block)

```nginx
location /ladwani {
    proxy_pass http://localhost:3000;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection 'upgrade';
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_cache_bypass $http_upgrade;
}
```

### Production Build

```bash
npm run db:generate
npm run build
npm run start
```

### Environment Variables for Production

```
DATABASE_URL=postgresql://...
NEXTAUTH_SECRET=<strong-random-secret>
NEXTAUTH_URL=https://agtci.com/ladwani
NEXT_PUBLIC_APP_URL=https://agtci.com/ladwani
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
