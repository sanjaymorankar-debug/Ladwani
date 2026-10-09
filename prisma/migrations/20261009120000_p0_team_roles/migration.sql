-- P0 role and scope engine (F32, F33). Data only: no table or column is
-- created, altered or dropped, so this is safe on a database holding real data.
--
-- Adds the body-team roles from the workbook's "Roles & Access" sheet plus the
-- Admin-granted export permission. Scoped roles reuse the existing
-- `user_roles.areaId` column: STATE_TEAM -> a STATE area, DISTRICT_TEAM and
-- OPERATOR -> a DISTRICT area. INSERT IGNORE keeps rows that `npm run db:seed`
-- may already have created (roles.code is unique).
--
-- Rollback: see down.sql in this folder (Prisma Migrate has no down step).
INSERT IGNORE INTO `roles` (`id`, `code`, `label`, `description`, `isSystem`, `createdAt`) VALUES
  ('role-national-team', 'NATIONAL_TEAM', 'National team', 'View all member data, read only (F33)', true, CURRENT_TIMESTAMP(3)),
  ('role-state-team', 'STATE_TEAM', 'State team', 'View members of the mapped state, with approval status (F33)', true, CURRENT_TIMESTAMP(3)),
  ('role-district-team', 'DISTRICT_TEAM', 'District team', 'View members of the mapped district (F33)', true, CURRENT_TIMESTAMP(3)),
  ('role-data-export', 'DATA_EXPORT', 'Data export permission', 'Admin-granted permission to export the scoped directory (F33)', true, CURRENT_TIMESTAMP(3));
