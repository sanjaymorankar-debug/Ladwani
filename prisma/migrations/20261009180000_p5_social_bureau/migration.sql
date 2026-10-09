-- P5 social and marriage bureau (F34–F38). Additive only:
--   * friendships, friend_lists, friend_list_members (F35).
--   * photos.audienceListId (F34 "friends list" visibility).
--   * posts.audienceType / audienceId (F36) — every existing post becomes
--     audience COMMUNITY, which is exactly how the feed shows it today.
--   * matrimonial_profiles: expectations, horoscope, contactPreference (F37);
--     matrimonial_interests.respondedBy (F38: the person or their Karta).
--   * reports index (abuse reports, F34 / F36).
--   * Settings: moderation.report_threshold = 3; bureau.workbook_rules =
--     false (the F37/F38 eligibility and browse rules stay off until the
--     owner decides — they change behaviour existing tests rely on).
-- Rollback: down.sql in this folder.

-- AlterTable
ALTER TABLE `matrimonial_interests` ADD COLUMN `respondedBy` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `matrimonial_profiles` ADD COLUMN `contactPreference` VARCHAR(191) NULL,
    ADD COLUMN `expectations` TEXT NULL,
    ADD COLUMN `horoscope` TEXT NULL;

-- AlterTable
ALTER TABLE `photos` ADD COLUMN `audienceListId` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `posts` ADD COLUMN `audienceId` VARCHAR(191) NULL,
    ADD COLUMN `audienceType` VARCHAR(191) NOT NULL DEFAULT 'COMMUNITY';

-- CreateTable
CREATE TABLE `friendships` (
    `id` VARCHAR(191) NOT NULL,
    `requesterMemberId` VARCHAR(191) NOT NULL,
    `addresseeMemberId` VARCHAR(191) NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'PENDING',
    `respondedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `friendships_addresseeMemberId_status_idx`(`addresseeMemberId`, `status`),
    UNIQUE INDEX `friendships_requesterMemberId_addresseeMemberId_key`(`requesterMemberId`, `addresseeMemberId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `friend_lists` (
    `id` VARCHAR(191) NOT NULL,
    `ownerMemberId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `friend_lists_ownerMemberId_name_key`(`ownerMemberId`, `name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `friend_list_members` (
    `id` VARCHAR(191) NOT NULL,
    `listId` VARCHAR(191) NOT NULL,
    `friendMemberId` VARCHAR(191) NOT NULL,
    `addedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `friend_list_members_friendMemberId_idx`(`friendMemberId`),
    UNIQUE INDEX `friend_list_members_listId_friendMemberId_key`(`listId`, `friendMemberId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `posts_audienceType_audienceId_idx` ON `posts`(`audienceType`, `audienceId`);

-- CreateIndex
CREATE INDEX `reports_reportableType_reportableId_idx` ON `reports`(`reportableType`, `reportableId`);


INSERT IGNORE INTO `settings` (`id`, `key`, `value`, `description`, `updatedAt`) VALUES
  ('setting-moderation-report-threshold', 'moderation.report_threshold', '3', 'Abuse reports from different people that hide a post, comment or photo until reviewed (F34, F36)', CURRENT_TIMESTAMP(3)),
  ('setting-bureau-workbook-rules', 'bureau.workbook_rules', 'false', 'Marriage bureau: only Unmarried + earning may list, only listed users and their Karta may browse (F37, F38). Off = previous behaviour.', CURRENT_TIMESTAMP(3));
