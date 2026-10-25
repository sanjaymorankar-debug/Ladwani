-- P4 follow-up: community groups can be copied into local organisations
-- (prisma migration 20261025090000_group_conversion). Adds one nullable column
-- with a unique index; no data changes. Import after add_death_certificate.sql.
-- The copying itself is done afterwards by an Admin: Settings → Convert Groups to Organisations.
-- Rollback: prisma/migrations/20261025090000_group_conversion/down.sql.

ALTER TABLE `organisations` ADD COLUMN `sourceGroupId` VARCHAR(191) NULL;
CREATE UNIQUE INDEX `organisations_sourceGroupId_key` ON `organisations`(`sourceGroupId`);

-- Record the migration as applied, so a later `prisma migrate deploy` skips it.
INSERT IGNORE INTO `_prisma_migrations` (`id`, `checksum`, `finished_at`, `migration_name`, `logs`, `rolled_back_at`, `started_at`, `applied_steps_count`) VALUES
  ('20261025-p4g-0000-0000-000000000000', '8f81af4b3da7754ea6c9288e01250d53b3c1f15ddc0fe2974a3f334326c17faf', CURRENT_TIMESTAMP(3), '20261025090000_group_conversion', NULL, NULL, CURRENT_TIMESTAMP(3), 1);
