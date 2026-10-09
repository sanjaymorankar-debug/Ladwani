-- Manual rollback for 20261009140000_p1_registration_approval (then delete
-- its _prisma_migrations row). Users in a P1-only status are first parked as
-- PENDING so the enum can shrink; that, and the dropped tables' rows (ID
-- proofs, approval tasks, change requests), is the data a rollback loses.
-- Encrypted proof files under UPLOAD_DIR/id-proofs are left on disk.
DROP TABLE IF EXISTS `approval_tasks`;
DROP TABLE IF EXISTS `profile_change_requests`;
DROP TABLE IF EXISTS `id_proofs`;
ALTER TABLE `addresses` DROP FOREIGN KEY `addresses_areaId_fkey`;
ALTER TABLE `addresses` DROP COLUMN `areaId`, DROP COLUMN `sameAsCurrent`;
ALTER TABLE `education_records` DROP COLUMN `university`, DROP COLUMN `grade`;
ALTER TABLE `member_profile_details` DROP COLUMN `incomeSource`, DROP COLUMN `serviceType`, DROP COLUMN `employerName`,
  DROP COLUMN `occBusinessType`, DROP COLUMN `occBusinessName`, DROP COLUMN `profession`, DROP COLUMN `professionOther`;
ALTER TABLE `consent_records` DROP COLUMN `declarationText`, DROP COLUMN `otpReference`;
UPDATE `users` SET `status` = 'PENDING' WHERE `status` IN ('DRAFT', 'PENDING_APPROVAL', 'CORRECTION_REQUIRED', 'REJECTED');
ALTER TABLE `users` DROP COLUMN `registrationSubmittedAt`, DROP COLUMN `registrationDecidedAt`, DROP COLUMN `registrationNote`,
  MODIFY `status` ENUM('PENDING', 'ACTIVE', 'SUSPENDED', 'BLOCKED', 'DEACTIVATED') NOT NULL DEFAULT 'PENDING';
