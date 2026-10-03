-- Personal-information form extensions (prisma migration 20261003120000_member_profile_details).
-- Additive only: no existing column is altered or dropped. Import once in phpMyAdmin.

-- AlterTable: geo-tag and taluka for addresses (additive; existing rows stay NULL).
ALTER TABLE `addresses` ADD COLUMN `taluka` VARCHAR(191) NULL,
    ADD COLUMN `latitude` DOUBLE NULL,
    ADD COLUMN `longitude` DOUBLE NULL;

-- CreateTable: extra personal-information answers, one row per member.
CREATE TABLE `member_profile_details` (
    `id` VARCHAR(191) NOT NULL,
    `memberId` VARCHAR(191) NOT NULL,
    `educationLevel` VARCHAR(191) NULL,
    `educationOther` VARCHAR(191) NULL,
    `educationStream` VARCHAR(191) NULL,
    `educationInstitution` VARCHAR(191) NULL,
    `annualIncomeRange` VARCHAR(191) NULL,
    `isEarning` BOOLEAN NOT NULL DEFAULT false,
    `isPursuingEducation` BOOLEAN NOT NULL DEFAULT false,
    `currentCourse` VARCHAR(191) NULL,
    `currentInstitution` VARCHAR(191) NULL,
    `expectedCompletionYear` INTEGER NULL,
    `earningType` VARCHAR(191) NULL,
    `companyName` VARCHAR(191) NULL,
    `designation` VARCHAR(191) NULL,
    `jobSector` VARCHAR(191) NULL,
    `businessName` VARCHAR(191) NULL,
    `businessType` VARCHAR(191) NULL,
    `readyForMarriage` BOOLEAN NOT NULL DEFAULT false,
    `lookingForMarriage` BOOLEAN NOT NULL DEFAULT false,
    `marriageHeightCm` INTEGER NULL,
    `motherTongue` VARCHAR(191) NULL,
    `nativePlace` VARCHAR(191) NULL,
    `partnerExpectations` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `member_profile_details_memberId_key`(`memberId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `member_profile_details` ADD CONSTRAINT `member_profile_details_memberId_fkey` FOREIGN KEY (`memberId`) REFERENCES `members`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
