-- Creates the miladwani MySQL database and a dedicated, least-privilege app
-- user. NOT usable on Hostinger shared hosting — your hosting account's
-- MySQL user doesn't have CREATE USER / GRANT privileges there, so database
-- creation on shared hosting has to go through hPanel's Databases wizard
-- instead (see DEPLOYMENT.md Part 1).
--
-- This script is for anywhere you DO have a privileged MySQL connection —
-- a VPS, a managed MySQL instance (PlanetScale, Aiven, etc.), or local dev.
-- Run it as an admin/root user:
--   mysql -u root -p < scripts/mysql/create-database.sql
--
-- Replace CHANGE_ME_STRONG_PASSWORD before running this anywhere but a
-- throwaway local database.

CREATE DATABASE IF NOT EXISTS miladwani
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

CREATE USER IF NOT EXISTS 'miladwani_app'@'localhost'
  IDENTIFIED BY 'CHANGE_ME_STRONG_PASSWORD';

GRANT ALL PRIVILEGES ON miladwani.* TO 'miladwani_app'@'localhost';

FLUSH PRIVILEGES;

-- Table creation itself is NOT done here — it's handled by Prisma from the
-- schema already committed to this repo:
--   npx prisma migrate deploy
--
-- Resulting connection string for DATABASE_URL:
--   mysql://miladwani_app:CHANGE_ME_STRONG_PASSWORD@localhost:3306/miladwani
