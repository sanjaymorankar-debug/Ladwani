-- P0 role and scope engine (prisma migration 20261009120000_p0_team_roles).
-- Data only. Import once in phpMyAdmin; safe to re-run (INSERT IGNORE).

INSERT IGNORE INTO `roles` (`id`, `code`, `label`, `description`, `isSystem`, `createdAt`) VALUES
  ('role-national-team', 'NATIONAL_TEAM', 'National team', 'View all member data, read only (F33)', true, CURRENT_TIMESTAMP(3)),
  ('role-state-team', 'STATE_TEAM', 'State team', 'View members of the mapped state, with approval status (F33)', true, CURRENT_TIMESTAMP(3)),
  ('role-district-team', 'DISTRICT_TEAM', 'District team', 'View members of the mapped district (F33)', true, CURRENT_TIMESTAMP(3)),
  ('role-data-export', 'DATA_EXPORT', 'Data export permission', 'Admin-granted permission to export the scoped directory (F33)', true, CURRENT_TIMESTAMP(3));

-- Record the migration as applied, so a later `npx prisma migrate deploy`
-- skips it (checksum = SHA-256 of migration.sql, as Prisma computes it).
INSERT IGNORE INTO `_prisma_migrations` (`id`, `checksum`, `finished_at`, `migration_name`, `logs`, `rolled_back_at`, `started_at`, `applied_steps_count`) VALUES
  ('5f0c2a7e-p0-team-roles-0000000000000', 'c4525ae86846b1f8485c89f7dcf3c23d3141f8e570672bb94d5342cee4c44b44', CURRENT_TIMESTAMP(3), '20261009120000_p0_team_roles', NULL, NULL, CURRENT_TIMESTAMP(3), 1);
