-- Creates the miladwani PostgreSQL database and a dedicated app role that
-- owns it. Run it as a superuser (or a role with CREATEROLE and CREATEDB) on
-- a server you administer — a VPS, or local dev:
--   psql -U postgres -v ON_ERROR_STOP=1 -f scripts/postgres/create-database.sql
--
-- On a managed PostgreSQL service (Supabase, Neon, AWS RDS, DigitalOcean,
-- Render, ...) the provider usually creates the database and user for you in
-- its dashboard — use those and skip this file.
--
-- Replace CHANGE_ME_STRONG_PASSWORD before running this anywhere but a
-- throwaway local database.
--
-- CREATE DATABASE cannot run inside a transaction block, so do not run this
-- file with `psql -1` / `--single-transaction`.

CREATE ROLE miladwani_app WITH LOGIN PASSWORD 'CHANGE_ME_STRONG_PASSWORD';

CREATE DATABASE miladwani
  OWNER miladwani_app
  ENCODING 'UTF8'
  TEMPLATE template0;

-- PostgreSQL 15+ no longer lets every role create objects in the `public`
-- schema. Give it to the app role so `prisma migrate deploy` can create tables.
\connect miladwani
ALTER SCHEMA public OWNER TO miladwani_app;

-- Table creation itself is NOT done here — either import 01-schema.sql and
-- 02-reference-data.sql from this folder, or let Prisma do it:
--   npx prisma migrate deploy && npm run db:seed
--
-- Resulting connection string for DATABASE_URL:
--   postgresql://miladwani_app:CHANGE_ME_STRONG_PASSWORD@localhost:5432/miladwani?schema=public
