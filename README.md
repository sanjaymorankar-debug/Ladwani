# Mi Samaj — Community Platform

Fresh-build community platform (family registry, family tree, matrimony, community feed, services & booking, financial management) for an Indian community, architected to eventually support multiple communities. See `docs/` for the full Phase 1 (requirements & architecture) and Phase 2 (detailed architecture) deliverables, and the published Phase 3 wireframe canvas linked from the project notes.

## Stack

- **Frontend:** Next.js 14 + TypeScript (`apps/web`)
- **Backend:** NestJS + TypeScript (`apps/api`)
- **Database:** MySQL 8 via Prisma (`apps/api/prisma`)
- **Shared:** `packages/shared-types` — DTOs, roles/permissions, enums used by both apps

## Getting Started (local dev)

### 1. Install dependencies

```bash
npm install
```

### 2. Set up the database

You need a local MySQL 8 instance. Set `DATABASE_URL` in `apps/api/.env` (copy `apps/api/.env.example`), then:

```bash
npm run db:generate --workspace=apps/api
npm run db:migrate --workspace=apps/api
npm run db:seed --workspace=apps/api
```

### 3. Run the apps

```bash
npm run dev:api   # NestJS on :4000
npm run dev:web   # Next.js on :3000
```

### 4. Verify

```bash
npm run typecheck
npm run lint
npm run test
npm run build
```

## Project Structure

```
apps/
  api/    NestJS backend — all 22 modules from docs/02-feature-map.md
  web/    Next.js frontend
packages/
  shared-types/   Roles, permissions, visibility levels, shared DTOs
docs/     Phase 1 & 2 architecture deliverables
design/   Phase 3 UI/UX wireframe canvas source
```

## Milestones

See `docs/13-development-roadmap.md` for the full M0–M5 plan. Current milestone: **M0 — Foundations**.
