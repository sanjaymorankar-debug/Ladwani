-- Interest groups built from Additional Details answers. Additive only: nullable
-- columns on community_groups, community_group_members and posts, plus poll and
-- RSVP tables. Requires 20261009100000_member_additional_details (interests).
-- Rollback: down.sql in this folder.

-- AlterTable
ALTER TABLE `community_group_members` ADD COLUMN `autoJoined` BOOLEAN NULL DEFAULT false,
    ADD COLUMN `isMuted` BOOLEAN NULL DEFAULT false,
    ADD COLUMN `lastDigestAt` DATETIME(3) NULL,
    ADD COLUMN `notifyMode` VARCHAR(191) NULL DEFAULT 'DAILY_DIGEST',
    ADD COLUMN `rulesAcceptedAt` DATETIME(3) NULL;


-- AlterTable
ALTER TABLE `community_groups` ADD COLUMN `autoKey` VARCHAR(191) NULL,
    ADD COLUMN `district` VARCHAR(191) NULL,
    ADD COLUMN `groupKey` VARCHAR(191) NULL,
    ADD COLUMN `interestId` VARCHAR(191) NULL,
    ADD COLUMN `isChildSafe` BOOLEAN NULL DEFAULT false,
    ADD COLUMN `parentGroupId` VARCHAR(191) NULL,
    ADD COLUMN `rules` TEXT NULL;


-- AlterTable
ALTER TABLE `posts` ADD COLUMN `groupId` VARCHAR(191) NULL,
    ADD COLUMN `groupPostKind` VARCHAR(191) NULL,
    ADD COLUMN `isSolved` BOOLEAN NULL DEFAULT false,
    ADD COLUMN `linkUrl` TEXT NULL,
    ADD COLUMN `solvedAt` DATETIME(3) NULL,
    ADD COLUMN `solvedCommentId` VARCHAR(191) NULL;


-- CreateTable
CREATE TABLE `post_poll_options` (
    `id` VARCHAR(191) NOT NULL,
    `postId` VARCHAR(191) NOT NULL,
    `label` VARCHAR(191) NOT NULL,
    `sortOrder` INTEGER NULL DEFAULT 0,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;


-- CreateTable
CREATE TABLE `post_poll_votes` (
    `id` VARCHAR(191) NOT NULL,
    `postId` VARCHAR(191) NOT NULL,
    `optionId` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `post_poll_votes_postId_userId_key`(`postId`, `userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;


-- CreateTable
CREATE TABLE `post_rsvps` (
    `postId` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `response` VARCHAR(191) NULL,
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`postId`, `userId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;


-- CreateIndex
CREATE UNIQUE INDEX `community_groups_autoKey_key` ON `community_groups`(`autoKey`);


-- CreateIndex
CREATE INDEX `community_groups_groupType_parentGroupId_idx` ON `community_groups`(`groupType`, `parentGroupId`);


-- CreateIndex
CREATE INDEX `posts_groupId_status_idx` ON `posts`(`groupId`, `status`);


-- AddForeignKey
ALTER TABLE `post_poll_options` ADD CONSTRAINT `post_poll_options_postId_fkey` FOREIGN KEY (`postId`) REFERENCES `posts`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;


-- AddForeignKey
ALTER TABLE `post_poll_votes` ADD CONSTRAINT `post_poll_votes_postId_fkey` FOREIGN KEY (`postId`) REFERENCES `posts`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;


-- AddForeignKey
ALTER TABLE `post_poll_votes` ADD CONSTRAINT `post_poll_votes_optionId_fkey` FOREIGN KEY (`optionId`) REFERENCES `post_poll_options`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;


-- AddForeignKey
ALTER TABLE `post_rsvps` ADD CONSTRAINT `post_rsvps_postId_fkey` FOREIGN KEY (`postId`) REFERENCES `posts`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;


-- AddForeignKey
ALTER TABLE `community_groups` ADD CONSTRAINT `community_groups_interestId_fkey` FOREIGN KEY (`interestId`) REFERENCES `interests`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;


-- AddForeignKey
ALTER TABLE `community_groups` ADD CONSTRAINT `community_groups_parentGroupId_fkey` FOREIGN KEY (`parentGroupId`) REFERENCES `community_groups`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;


-- AddForeignKey
ALTER TABLE `posts` ADD CONSTRAINT `posts_groupId_fkey` FOREIGN KEY (`groupId`) REFERENCES `community_groups`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
