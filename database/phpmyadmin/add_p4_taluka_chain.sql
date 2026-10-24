-- P4 follow-up: taluka organisations, start date and town; Chairman replaces Treasurer
-- (prisma migration 20261024100000_p4_taluka_chain). Import after set_address_changes_instant.sql.
-- Rollback: prisma/migrations/20261024100000_p4_taluka_chain/down.sql.

-- Owner's P4 decisions (follow-up):
--   * a local organisation sits at taluka level and records its start date
--     and town (organisations.areaId now holds the taluka for LOCAL);
--   * the three office roles at every level are President, Secretary and
--     Chairman: Chairman replaces Treasurer.
-- Additive columns, plus a rename of the designation value in the
-- organisation tables added by this same PR (organisation_members only;
-- community groups are not touched). Rollback: down.sql in this folder.
ALTER TABLE `organisations`
    ADD COLUMN `startedOn` DATETIME(3) NULL,
    ADD COLUMN `town` VARCHAR(191) NULL;

UPDATE `organisation_members` SET `designation` = 'CHAIRMAN' WHERE `designation` = 'TREASURER';
UPDATE `organisation_members` SET `pendingDesignation` = 'CHAIRMAN' WHERE `pendingDesignation` = 'TREASURER';

-- Record the migration as applied, so a later `prisma migrate deploy` skips it.
INSERT IGNORE INTO `_prisma_migrations` (`id`, `checksum`, `finished_at`, `migration_name`, `logs`, `rolled_back_at`, `started_at`, `applied_steps_count`) VALUES
  ('20261024-p4b-0000-0000-000000000000', '833a334793ec9b79e4ef504ededad7d9fa89580574f7409b6cb6eb49a03faa89', CURRENT_TIMESTAMP(3), '20261024100000_p4_taluka_chain', NULL, NULL, CURRENT_TIMESTAMP(3), 1);
