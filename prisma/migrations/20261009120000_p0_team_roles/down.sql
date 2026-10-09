-- Manual rollback for 20261009120000_p0_team_roles. Prisma Migrate does not
-- run down steps; execute this in phpMyAdmin / mysql, then delete the
-- migration's row from `_prisma_migrations`:
--   DELETE FROM `_prisma_migrations` WHERE `migration_name` = '20261009120000_p0_team_roles';
--
-- Removes every assignment of these four roles first (that is the only data
-- the rollback loses), then their permission links, then the roles.
DELETE ur FROM `user_roles` ur JOIN `roles` r ON r.`id` = ur.`roleId`
  WHERE r.`code` IN ('NATIONAL_TEAM', 'STATE_TEAM', 'DISTRICT_TEAM', 'DATA_EXPORT');
DELETE rp FROM `role_permissions` rp JOIN `roles` r ON r.`id` = rp.`roleId`
  WHERE r.`code` IN ('NATIONAL_TEAM', 'STATE_TEAM', 'DISTRICT_TEAM', 'DATA_EXPORT');
DELETE FROM `roles` WHERE `code` IN ('NATIONAL_TEAM', 'STATE_TEAM', 'DISTRICT_TEAM', 'DATA_EXPORT');
