-- Rollback of 20261009110000_interest_groups. Run this first when rolling back
-- both. Destroys group posts' poll/RSVP data and interest-group settings. Then:
--   DELETE FROM `_prisma_migrations` WHERE migration_name = '20261009110000_interest_groups';

-- DropForeignKey
ALTER TABLE `post_poll_options` DROP FOREIGN KEY `post_poll_options_postId_fkey`;


-- DropForeignKey
ALTER TABLE `post_poll_votes` DROP FOREIGN KEY `post_poll_votes_postId_fkey`;


-- DropForeignKey
ALTER TABLE `post_poll_votes` DROP FOREIGN KEY `post_poll_votes_optionId_fkey`;


-- DropForeignKey
ALTER TABLE `post_rsvps` DROP FOREIGN KEY `post_rsvps_postId_fkey`;


-- DropForeignKey
ALTER TABLE `community_groups` DROP FOREIGN KEY `community_groups_interestId_fkey`;


-- DropForeignKey
ALTER TABLE `community_groups` DROP FOREIGN KEY `community_groups_parentGroupId_fkey`;


-- DropForeignKey
ALTER TABLE `posts` DROP FOREIGN KEY `posts_groupId_fkey`;


-- DropIndex
DROP INDEX `community_groups_autoKey_key` ON `community_groups`;


-- DropIndex
DROP INDEX `community_groups_groupType_parentGroupId_idx` ON `community_groups`;


-- DropIndex
DROP INDEX `posts_groupId_status_idx` ON `posts`;


-- AlterTable
ALTER TABLE `community_groups` DROP COLUMN `autoKey`,
    DROP COLUMN `district`,
    DROP COLUMN `groupKey`,
    DROP COLUMN `interestId`,
    DROP COLUMN `isChildSafe`,
    DROP COLUMN `parentGroupId`,
    DROP COLUMN `rules`;


-- AlterTable
ALTER TABLE `community_group_members` DROP COLUMN `autoJoined`,
    DROP COLUMN `isMuted`,
    DROP COLUMN `lastDigestAt`,
    DROP COLUMN `notifyMode`,
    DROP COLUMN `rulesAcceptedAt`;


-- AlterTable
ALTER TABLE `posts` DROP COLUMN `groupId`,
    DROP COLUMN `groupPostKind`,
    DROP COLUMN `isSolved`,
    DROP COLUMN `linkUrl`,
    DROP COLUMN `solvedAt`,
    DROP COLUMN `solvedCommentId`;


-- DropTable
DROP TABLE `post_poll_options`;


-- DropTable
DROP TABLE `post_poll_votes`;


-- DropTable
DROP TABLE `post_rsvps`;
