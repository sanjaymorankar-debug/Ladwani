# Phase 5 — Deployment Guide

## 1. Target Environment

Deploys onto the existing Hostinger account already running `devmiladwani.agtci.com` — same MySQL 8 instance, same domain, per the migration decisions in `13-development-roadmap.md` §1. Node 20+ runtime, npm workspaces monorepo (`apps/api`, `apps/web`, `packages/shared-types`).

## 2. Required Environment Variables

### `apps/api`

| Variable | Required | Notes |
|---|---|---|
| `DATABASE_URL` | Yes | MySQL connection string, e.g. `mysql://user:pass@host:3306/db` |
| `JWT_SECRET` | Yes in production | Bootstrap now refuses to start in production without it (`main.ts`) — no fallback is used outside dev |
| `WEB_ORIGIN` | Yes | Exact origin the API's CORS policy allows, e.g. `https://devmiladwani.agtci.com` |
| `PORT` | No | Defaults to 4000 |
| `NODE_ENV` | Yes | Must be `production` — gates the JWT secret check, secure cookie flag, and hides dev-only response fields (e.g. `devOtp`) |
| `PAYMENT_GATEWAY_PROVIDER` | Yes for real payments | `RAZORPAY` to activate the live gateway; unset/`DEV` keeps the simulated one |
| `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` / `RAZORPAY_WEBHOOK_SECRET` | Yes if `PAYMENT_GATEWAY_PROVIDER=RAZORPAY` | Read lazily — the app won't crash at boot if these are missing, only when a real gateway call is actually made |
| `DEV_GATEWAY_SECRET` / `DEV_GATEWAY_WEBHOOK_SECRET` | No | Dev-only defaults exist; irrelevant once `PAYMENT_GATEWAY_PROVIDER=RAZORPAY` |
| `DEV_UPLOAD_SIGNING_SECRET` | No | Dev-only local-disk upload signing secret (see `18-file-storage-design.md`); irrelevant once a real `FILE_STORAGE` provider replaces `DevFileStorageService` |

### `apps/web`

| Variable | Required | Notes |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | Yes | Origin the Next.js rewrite proxies `/api/v1/*` to (see `next.config.js`) |

## 3. Build & Start

```bash
npm install
npm run build --workspace=packages/shared-types
npm run build --workspace=apps/api
npm run build --workspace=apps/web
npx prisma migrate deploy --schema apps/api/prisma/schema.prisma
node apps/api/dist/src/main.js &
npm run start --workspace=apps/web
```

`prisma migrate deploy` (not `migrate dev`) is the production command — it applies pending migrations without generating new ones or touching a shadow database, and fails closed on drift rather than trying to resolve it interactively.

## 4. CI/CD

`.github/workflows/ci.yml` already runs on every push: lint, typecheck, unit tests, a real MySQL-backed integration test (booking concurrency), `prisma migrate deploy` against a service container, and a production build of both apps. A green run on the `rebuild` branch is the gate for promoting to a deploy — there is no separate CD pipeline yet; deployment is the manual steps in §3 run against the target host.

## 5. Health & Observability

- No APM/error-tracking service is wired in yet. At minimum, tail `apps/api`'s stdout/stderr and monitor the process supervisor (pm2, systemd, or Hostinger's equivalent) for restarts.
- The audit log (`GET /audit-logs`, `audit:view` permission) and the reporting module (`GET /reports/*`, `report:view` permission) are the closest things to production visibility this build ships with — both are read via the Admin/Operator UI, not a separate ops dashboard.

## 6. Known Gaps to Carry Into Later Work

- **No job scheduler.** Late fees, booking-expiry, and payment reconciliation are all computed at read time or manually triggered rather than cron-driven (noted at each point in the M3/M4 code). A real deployment serving traffic around the clock will eventually want a scheduler (cron, BullMQ + Redis) for reconciliation especially, since docs/19 §4 specifies a 15-minute cadence this build only supports via manual trigger.
- **No real object storage or malware scanning.** `apps/api/src/uploads` implements the full validation/activation pipeline against a local-disk dev stand-in — see `18-file-storage-design.md` and the M5 checkpoint report for what's needed to switch on Cloudflare R2 + a real scanner.
