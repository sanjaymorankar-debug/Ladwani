-- Rollback of 20261009100000_member_additional_details. Run AFTER the
-- interest_groups rollback (that one references `interests`). Destroys the data
-- in these tables/columns. Then delete this migration's row from
-- `_prisma_migrations`:
--   DELETE FROM `_prisma_migrations` WHERE migration_name = '20261009100000_member_additional_details';

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
