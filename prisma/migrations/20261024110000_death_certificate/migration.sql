-- Owner's P2 decision (F12): marking a member Expired keeps its review, and
-- a death certificate is attached. The certificate is stored encrypted (like
-- ID proofs) and referenced from the member. The setting
-- `deceased.certificate_required` makes it mandatory; it is OFF until
-- go-live (so existing data can be loaded) and switched ON at go-live.
-- Additive only. Rollback: down.sql in this folder.
ALTER TABLE `members`
    ADD COLUMN `deathCertKey` VARCHAR(191) NULL,
    ADD COLUMN `deathCertMime` VARCHAR(191) NULL;

INSERT IGNORE INTO `settings` (`id`, `key`, `value`, `description`, `updatedAt`) VALUES
  ('setting-deceased-certificate-required', 'deceased.certificate_required', 'false', 'F12: a death certificate must be attached when marking a member Expired. Switch to true at go-live.', CURRENT_TIMESTAMP(3));
