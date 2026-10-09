-- P1: Admin 2FA attempt counter + registration and dual blind approval
-- (prisma migrations 20261009130000_otp_attempts and 20261009140000_p1_registration_approval).
-- Additive. Import ONCE in phpMyAdmin after add_p0_team_roles.sql; back up first (DDL cannot be rolled back).
-- Rollback: the down.sql file in each migration folder, newest first.

-- ── 20261009130000_otp_attempts ──
-- Admin 2-factor login and OTP brute-force guard: count wrong guesses per
-- code so a code is burned after 5 attempts. Additive; existing rows get 0.
ALTER TABLE `verification_tokens` ADD COLUMN `attempts` INTEGER NOT NULL DEFAULT 0;

-- ── 20261009140000_p1_registration_approval ──
-- P1 registration and dual blind approval (F01–F08). Additive only:
--   * users.status gains DRAFT, PENDING_APPROVAL, CORRECTION_REQUIRED and
--     REJECTED (existing values untouched; existing rows keep their status),
--     plus three nullable registration-outcome columns.
--   * consent_records gains the declaration text and OTP reference (F03).
--   * addresses gains a location-master link and the "same as current" flag.
--   * education_records gains university and grade; member_profile_details
--     gains the F02 occupation fields. All nullable / defaulted.
--   * New tables: id_proofs, approval_tasks, profile_change_requests.
-- No backfill is needed. Rollback: down.sql in this folder.

-- AlterTable
ALTER TABLE `addresses` ADD COLUMN `areaId` VARCHAR(191) NULL,
    ADD COLUMN `sameAsCurrent` BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE `consent_records` ADD COLUMN `declarationText` TEXT NULL,
    ADD COLUMN `otpReference` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `education_records` ADD COLUMN `grade` VARCHAR(191) NULL,
    ADD COLUMN `university` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `member_profile_details` ADD COLUMN `employerName` VARCHAR(191) NULL,
    ADD COLUMN `incomeSource` VARCHAR(191) NULL,
    ADD COLUMN `occBusinessName` VARCHAR(191) NULL,
    ADD COLUMN `occBusinessType` VARCHAR(191) NULL,
    ADD COLUMN `profession` VARCHAR(191) NULL,
    ADD COLUMN `professionOther` VARCHAR(191) NULL,
    ADD COLUMN `serviceType` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `users` ADD COLUMN `registrationDecidedAt` DATETIME(3) NULL,
    ADD COLUMN `registrationNote` TEXT NULL,
    ADD COLUMN `registrationSubmittedAt` DATETIME(3) NULL,
    MODIFY `status` ENUM('PENDING', 'ACTIVE', 'SUSPENDED', 'BLOCKED', 'DEACTIVATED', 'DRAFT', 'PENDING_APPROVAL', 'CORRECTION_REQUIRED', 'REJECTED') NOT NULL DEFAULT 'PENDING';

-- CreateTable
CREATE TABLE `id_proofs` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `memberId` VARCHAR(191) NOT NULL,
    `idType` VARCHAR(191) NOT NULL,
    `idNumberEnc` TEXT NULL,
    `idLast4` VARCHAR(191) NOT NULL,
    `proofKey` VARCHAR(191) NOT NULL,
    `proofMime` VARCHAR(191) NOT NULL,
    `selfSignedKey` VARCHAR(191) NOT NULL,
    `selfSignedMime` VARCHAR(191) NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'ACTIVE',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `supersededAt` DATETIME(3) NULL,

    INDEX `id_proofs_memberId_status_idx`(`memberId`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `approval_tasks` (
    `id` VARCHAR(191) NOT NULL,
    `kind` VARCHAR(191) NOT NULL,
    `subjectUserId` VARCHAR(191) NOT NULL,
    `subjectMemberId` VARCHAR(191) NOT NULL,
    `changeRequestId` VARCHAR(191) NULL,
    `round` INTEGER NOT NULL DEFAULT 1,
    `slot` INTEGER NOT NULL,
    `operatorUserId` VARCHAR(191) NULL,
    `districtAreaId` VARCHAR(191) NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'OPEN',
    `checklist` JSON NULL,
    `remarks` TEXT NULL,
    `decidedAt` DATETIME(3) NULL,
    `dueAt` DATETIME(3) NOT NULL,
    `supersededAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `approval_tasks_operatorUserId_status_idx`(`operatorUserId`, `status`),
    INDEX `approval_tasks_subjectUserId_kind_round_idx`(`subjectUserId`, `kind`, `round`),
    INDEX `approval_tasks_status_dueAt_idx`(`status`, `dueAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `profile_change_requests` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `memberId` VARCHAR(191) NOT NULL,
    `changes` JSON NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'PENDING',
    `reason` TEXT NULL,
    `decidedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `profile_change_requests_memberId_status_idx`(`memberId`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `addresses` ADD CONSTRAINT `addresses_areaId_fkey` FOREIGN KEY (`areaId`) REFERENCES `areas`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `id_proofs` ADD CONSTRAINT `id_proofs_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `id_proofs` ADD CONSTRAINT `id_proofs_memberId_fkey` FOREIGN KEY (`memberId`) REFERENCES `members`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `approval_tasks` ADD CONSTRAINT `approval_tasks_subjectUserId_fkey` FOREIGN KEY (`subjectUserId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `approval_tasks` ADD CONSTRAINT `approval_tasks_operatorUserId_fkey` FOREIGN KEY (`operatorUserId`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `approval_tasks` ADD CONSTRAINT `approval_tasks_changeRequestId_fkey` FOREIGN KEY (`changeRequestId`) REFERENCES `profile_change_requests`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `profile_change_requests` ADD CONSTRAINT `profile_change_requests_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- Record both migrations as applied, so a later `prisma migrate deploy` skips them.
INSERT IGNORE INTO `_prisma_migrations` (`id`, `checksum`, `finished_at`, `migration_name`, `logs`, `rolled_back_at`, `started_at`, `applied_steps_count`) VALUES
  ('20261009-p1-0000-0000-000000000000', 'a3d02edd745b7cecf70af5f6ff5a5c48143538d5b75d803712f7fe42d5aed798', CURRENT_TIMESTAMP(3), '20261009130000_otp_attempts', NULL, NULL, CURRENT_TIMESTAMP(3), 1),
  ('20261009-p1-0001-0000-000000000000', '3ef0ef3f8ba189f5552a18002758056e6af74445875257770eeecb303328030e', CURRENT_TIMESTAMP(3), '20261009140000_p1_registration_approval', NULL, NULL, CURRENT_TIMESTAMP(3), 1);

-- F06 approval SLA (days); Admin can change it later.
INSERT IGNORE INTO `settings` (`id`, `key`, `value`, `description`, `updatedAt`) VALUES ('setting-approval-sla-days', 'approval.sla_days', '7', 'Days an Operator has to decide a verification task before it is escalated (F06)', CURRENT_TIMESTAMP(3));
