-- F12 death certificate on Expired requests (prisma migration 20261024110000_death_certificate).
-- Adds two nullable columns to members and one setting (off). No member data changes.
-- Import after add_p4_taluka_chain.sql.
-- Rollback: prisma/migrations/20261024110000_death_certificate/down.sql.

-- Where an approved request's certificate is kept (an encrypted file key and its type).
ALTER TABLE `members` ADD COLUMN `deathCertKey` VARCHAR(191) NULL, ADD COLUMN `deathCertMime` VARCHAR(191) NULL;
-- Off until go-live; switch to true then (see the P6 runbook) and every Expired request needs a certificate.
INSERT IGNORE INTO `settings` (`id`,`key`,`value`,`description`,`updatedAt`) VALUES ('setting-deceased-certificate-required','deceased.certificate_required','false','F12: a death certificate must be attached when marking a member Expired. Switch to true at go-live.', CURRENT_TIMESTAMP(3));

-- Record the migration as applied, so a later `prisma migrate deploy` skips it.
INSERT IGNORE INTO `_prisma_migrations` (`id`, `checksum`, `finished_at`, `migration_name`, `logs`, `rolled_back_at`, `started_at`, `applied_steps_count`) VALUES
  ('20261024-p2c-0000-0000-000000000000', '0afd6af3633809c96c1784ac1728e0b0c39be8fad1aed6d91c433370ef0d1cd3', CURRENT_TIMESTAMP(3), '20261024110000_death_certificate', NULL, NULL, CURRENT_TIMESTAMP(3), 1);
