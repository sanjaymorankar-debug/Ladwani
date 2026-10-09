-- P6: data rights (prisma migration 20261009190000_p6_data_rights). Additive: one new table.
-- Import ONCE in phpMyAdmin after add_p5_social_bureau.sql; back up first.
-- Rollback: prisma/migrations/20261009190000_p6_data_rights/down.sql.

-- P6 data rights (F40). Additive only: account-deletion requests, processed
-- by an Admin (anonymise, never break the family tree).
-- Rollback: down.sql in this folder.

-- CreateTable
CREATE TABLE `data_deletion_requests` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `memberId` VARCHAR(191) NULL,
    `reason` TEXT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'PENDING',
    `processedBy` VARCHAR(191) NULL,
    `processedAt` DATETIME(3) NULL,
    `note` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `data_deletion_requests_status_createdAt_idx`(`status`, `createdAt`),
    INDEX `data_deletion_requests_userId_idx`(`userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;


-- Record the migration as applied, so a later `prisma migrate deploy` skips it.
INSERT IGNORE INTO `_prisma_migrations` (`id`, `checksum`, `finished_at`, `migration_name`, `logs`, `rolled_back_at`, `started_at`, `applied_steps_count`) VALUES
  ('20261009-p6-0000-0000-000000000000', '65ae50685bf53afcea3c7b73134062a5b71d2fc27bb1694f372f58c500ca05a2', CURRENT_TIMESTAMP(3), '20261009190000_p6_data_rights', NULL, NULL, CURRENT_TIMESTAMP(3), 1);
