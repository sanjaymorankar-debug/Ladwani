-- Rollback of add_additional_details_and_interest_groups.sql (both migrations).
-- DESTROYS all Additional Details data, interest-group settings, polls and RSVPs.
-- Take a database backup first. Interest groups are rows in community_groups
-- (groupType = 'INTEREST'); delete them first if wanted:
--   DELETE FROM community_groups WHERE groupType = 'INTEREST';
-- Afterwards remove the two rows from _prisma_migrations:
--   DELETE FROM `_prisma_migrations` WHERE migration_name IN ('20261009110000_interest_groups', '20261009100000_member_additional_details');

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

-- DropForeignKey
ALTER TABLE `member_section_settings` DROP FOREIGN KEY `member_section_settings_memberId_fkey`;


-- DropForeignKey
ALTER TABLE `member_additional_details` DROP FOREIGN KEY `member_additional_details_memberId_fkey`;


-- DropForeignKey
ALTER TABLE `member_insurances` DROP FOREIGN KEY `member_insurances_memberId_fkey`;


-- DropForeignKey
ALTER TABLE `member_vehicles` DROP FOREIGN KEY `member_vehicles_memberId_fkey`;


-- DropForeignKey
ALTER TABLE `member_loan_needs` DROP FOREIGN KEY `member_loan_needs_memberId_fkey`;


-- DropForeignKey
ALTER TABLE `member_farm_holdings` DROP FOREIGN KEY `member_farm_holdings_memberId_fkey`;


-- DropForeignKey
ALTER TABLE `member_sports` DROP FOREIGN KEY `member_sports_memberId_fkey`;


-- DropForeignKey
ALTER TABLE `member_sports` DROP FOREIGN KEY `member_sports_interestId_fkey`;


-- DropForeignKey
ALTER TABLE `member_sport_achievements` DROP FOREIGN KEY `member_sport_achievements_sportId_fkey`;


-- DropForeignKey
ALTER TABLE `member_hobbies` DROP FOREIGN KEY `member_hobbies_memberId_fkey`;


-- DropForeignKey
ALTER TABLE `member_hobbies` DROP FOREIGN KEY `member_hobbies_interestId_fkey`;


-- DropForeignKey
ALTER TABLE `support_requests` DROP FOREIGN KEY `support_requests_memberId_fkey`;


-- DropForeignKey
ALTER TABLE `member_files` DROP FOREIGN KEY `member_files_memberId_fkey`;


-- DropForeignKey
ALTER TABLE `contact_requests` DROP FOREIGN KEY `contact_requests_fromMemberId_fkey`;


-- DropForeignKey
ALTER TABLE `contact_requests` DROP FOREIGN KEY `contact_requests_toMemberId_fkey`;


-- DropIndex
DROP INDEX `consent_records_memberId_consentType_idx` ON `consent_records`;


-- AlterTable
ALTER TABLE `consent_records` DROP COLUMN `memberId`;


-- AlterTable
ALTER TABLE `education_records` DROP COLUMN `boardUniversity`,
    DROP COLUMN `marksScale`,
    DROP COLUMN `marksType`,
    DROP COLUMN `marksValue`,
    DROP COLUMN `marksheetFileId`;


-- AlterTable
ALTER TABLE `businesses` DROP COLUMN `contact`,
    DROP COLUMN `showInDirectory`,
    DROP COLUMN `supportNeeds`;


-- DropTable
DROP TABLE `member_section_settings`;


-- DropTable
DROP TABLE `member_additional_details`;


-- DropTable
DROP TABLE `member_insurances`;


-- DropTable
DROP TABLE `member_vehicles`;


-- DropTable
DROP TABLE `member_loan_needs`;


-- DropTable
DROP TABLE `member_farm_holdings`;


-- DropTable
DROP TABLE `member_sports`;


-- DropTable
DROP TABLE `member_sport_achievements`;


-- DropTable
DROP TABLE `member_hobbies`;


-- DropTable
DROP TABLE `interests`;


-- DropTable
DROP TABLE `option_masters`;


-- DropTable
DROP TABLE `support_requests`;


-- DropTable
DROP TABLE `member_files`;


-- DropTable
DROP TABLE `contact_requests`;
