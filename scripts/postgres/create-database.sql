-- Creates the miladwani PostgreSQL database and a dedicated, least-privilege
-- app role that owns it. It is a psql script (it uses \if, \gexec and
-- \connect), so run it with psql, as a superuser or a role with CREATEROLE
-- and CREATEDB, connected to any existing database (e.g. "postgres"):
--
--   psql -h <host> -U postgres -d postgres \
--     -v app_password='CHANGE_ME_STRONG_PASSWORD' \
--     -f scripts/postgres/create-database.sql
--
-- Optional: -v db_name=... and -v app_role=... (defaults: miladwani and
-- miladwani_app). Without -v app_password the placeholder below is used;
-- never leave it on anything but a throwaway local database.
--
-- Managed PostgreSQL (Neon, Supabase, AWS RDS, DigitalOcean, Aiven, ...)
-- usually creates the database and its owner for you from the provider's
-- dashboard. Then skip this file and use the connection string the provider
-- gives you as DATABASE_URL.
--
-- Table creation is NOT done here. Either run Prisma from the app directory
--   npx prisma migrate deploy && npm run db:seed
-- or load 01-schema.sql and 02-reference-data.sql (see README.md).

\set ON_ERROR_STOP on

\if :{?db_name}
\else
  \set db_name miladwani
\endif
\if :{?app_role}
\else
  \set app_role miladwani_app
\endif
\if :{?app_password}
\else
  \set app_password CHANGE_ME_STRONG_PASSWORD
\endif

-- CREATE ROLE and CREATE DATABASE have no IF NOT EXISTS; \gexec runs the
-- generated statement only when the SELECT returns a row, so re-running this
-- file is harmless.
SELECT format('CREATE ROLE %I LOGIN PASSWORD %L', :'app_role', :'app_password')
WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = :'app_role')
\gexec

SELECT format('CREATE DATABASE %I OWNER %I ENCODING %L TEMPLATE template0', :'db_name', :'app_role', 'UTF8')
WHERE NOT EXISTS (SELECT 1 FROM pg_database WHERE datname = :'db_name')
\gexec

-- The owner of a database can create everything the app needs inside it,
-- including the citext and btree_gist extensions (both "trusted" since
-- PostgreSQL 13). Since PostgreSQL 15 the public schema is no longer
-- writable by every role, so hand it to the app role explicitly.
\connect :"db_name"
SELECT format('ALTER SCHEMA public OWNER TO %I', :'app_role')
\gexec
REVOKE CREATE ON SCHEMA public FROM PUBLIC;

-- Resulting connection string for DATABASE_URL:
--   postgresql://miladwani_app:<app_password>@<host>:5432/miladwani?schema=public
