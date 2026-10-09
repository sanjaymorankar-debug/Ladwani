-- P0 role and scope engine (prisma migration 20261009120000_p0_team_roles).
-- Data only. Import once in phpMyAdmin; safe to re-run (INSERT IGNORE).

INSERT IGNORE INTO `roles` (`id`, `code`, `label`, `description`, `isSystem`, `createdAt`) VALUES
  ('role-national-team', 'NATIONAL_TEAM', 'National team', 'View all member data, read only (F33)', true, CURRENT_TIMESTAMP(3)),
  ('role-state-team', 'STATE_TEAM', 'State team', 'View members of the mapped state, with approval status (F33)', true, CURRENT_TIMESTAMP(3)),
  ('role-district-team', 'DISTRICT_TEAM', 'District team', 'View members of the mapped district (F33)', true, CURRENT_TIMESTAMP(3)),
  ('role-data-export', 'DATA_EXPORT', 'Data export permission', 'Admin-granted permission to export the scoped directory (F33)', true, CURRENT_TIMESTAMP(3));
