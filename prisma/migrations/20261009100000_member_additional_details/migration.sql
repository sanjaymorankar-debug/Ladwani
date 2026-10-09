-- Additional Details (23 optional profile sections). Additive only: new tables,
-- and nullable columns on education_records, businesses and consent_records.
-- Nothing existing is renamed or dropped. Rollback: down.sql in this folder.

-- AlterTable
ALTER TABLE `businesses` ADD COLUMN `contact` VARCHAR(191) NULL,
    ADD COLUMN `showInDirectory` BOOLEAN NULL DEFAULT false,
    ADD COLUMN `supportNeeds` JSON NULL;


-- AlterTable
ALTER TABLE `consent_records` ADD COLUMN `memberId` VARCHAR(191) NULL;


-- AlterTable
ALTER TABLE `education_records` ADD COLUMN `boardUniversity` VARCHAR(191) NULL,
    ADD COLUMN `marksScale` INTEGER NULL,
    ADD COLUMN `marksType` VARCHAR(191) NULL,
    ADD COLUMN `marksValue` VARCHAR(191) NULL,
    ADD COLUMN `marksheetFileId` VARCHAR(191) NULL;


-- CreateTable
CREATE TABLE `member_section_settings` (
    `id` VARCHAR(191) NOT NULL,
    `memberId` VARCHAR(191) NOT NULL,
    `sectionKey` VARCHAR(191) NOT NULL,
    `answer` VARCHAR(191) NULL,
    `visibility` VARCHAR(191) NULL,
    `enteredByUserId` VARCHAR(191) NULL,
    `entryNote` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `member_section_settings_memberId_sectionKey_key`(`memberId`, `sectionKey`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;


-- CreateTable
CREATE TABLE `member_additional_details` (
    `id` VARCHAR(191) NOT NULL,
    `memberId` VARCHAR(191) NOT NULL,
    `insuranceNeedsHelp` BOOLEAN NULL,
    `insuranceHelpNote` TEXT NULL,
    `doctorName` VARCHAR(191) NULL,
    `doctorSpeciality` VARCHAR(191) NULL,
    `doctorClinic` VARCHAR(191) NULL,
    `doctorCity` VARCHAR(191) NULL,
    `doctorContact` VARCHAR(191) NULL,
    `doctorNeedsHelp` BOOLEAN NULL,
    `adviserName` VARCHAR(191) NULL,
    `adviserType` VARCHAR(191) NULL,
    `adviserContact` VARCHAR(191) NULL,
    `adviserNeedsGuidance` BOOLEAN NULL,
    `hasExistingLoans` BOOLEAN NULL,
    `existingLoanTypes` JSON NULL,
    `otherBankingNeeds` JSON NULL,
    `houseOwnership` VARCHAR(191) NULL,
    `houseType` VARCHAR(191) NULL,
    `houseWantsToBuy` BOOLEAN NULL,
    `eduNeedsSupport` BOOLEAN NULL,
    `eduSupportTypes` JSON NULL,
    `eduSupportAmountBand` VARCHAR(191) NULL,
    `eduSupportNote` TEXT NULL,
    `careerLookingFor` JSON NULL,
    `careerSkills` JSON NULL,
    `careerPreferredCity` VARCHAR(191) NULL,
    `careerExperienceBand` VARCHAR(191) NULL,
    `careerCanOffer` JSON NULL,
    `careerOfferField` VARCHAR(191) NULL,
    `careerSupportNeeds` JSON NULL,
    `teachSubjects` VARCHAR(191) NULL,
    `teachMode` VARCHAR(191) NULL,
    `teachFeeMode` VARCHAR(191) NULL,
    `guidanceFields` JSON NULL,
    `volunteerReady` BOOLEAN NULL,
    `volunteerHoursBand` VARCHAR(191) NULL,
    `willingToDonateBlood` BOOLEAN NULL,
    `lastDonatedMonth` VARCHAR(191) NULL,
    `wellnessActivities` JSON NULL,
    `wellnessWants` JSON NULL,
    `seniorLivesWith` VARCHAR(191) NULL,
    `seniorNeeds` JSON NULL,
    `seniorEmergencyMemberId` VARCHAR(191) NULL,
    `studentClassCourse` VARCHAR(191) NULL,
    `studentCareerInterest` VARCHAR(191) NULL,
    `studentNeeds` JSON NULL,
    `studentExamName` VARCHAR(191) NULL,
    `womenInterests` JSON NULL,
    `womenNeeds` JSON NULL,
    `govDocNeeds` JSON NULL,
    `housingLookingTo` JSON NULL,
    `housingCity` VARCHAR(191) NULL,
    `housingBudgetBand` VARCHAR(191) NULL,
    `relocatingCity` VARCHAR(191) NULL,
    `relocatingWantsContacts` BOOLEAN NULL,
    `travelInterests` JSON NULL,
    `travelCanHost` BOOLEAN NULL,
    `motherTongue` VARCHAR(191) NULL,
    `cultureInterests` JSON NULL,
    `openToCityFriends` BOOLEAN NULL,
    `openToMulGaon` BOOLEAN NULL,
    `openToProfession` BOOLEAN NULL,
    `marriageSupportNeeds` JSON NULL,
    `emergencyContactMemberId` VARCHAR(191) NULL,
    `canHelpEmergency` BOOLEAN NULL,
    `emergencyHelpTypes` JSON NULL,
    `autoAddToGroups` BOOLEAN NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `member_additional_details_memberId_key`(`memberId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;


-- CreateTable
CREATE TABLE `member_insurances` (
    `id` VARCHAR(191) NOT NULL,
    `memberId` VARCHAR(191) NOT NULL,
    `insuranceType` VARCHAR(191) NULL,
    `insurerName` VARCHAR(191) NULL,
    `sumInsuredBand` VARCHAR(191) NULL,
    `renewalMonth` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `member_insurances_memberId_idx`(`memberId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;


-- CreateTable
CREATE TABLE `member_vehicles` (
    `id` VARCHAR(191) NOT NULL,
    `memberId` VARCHAR(191) NOT NULL,
    `vehicleType` VARCHAR(191) NULL,
    `make` VARCHAR(191) NULL,
    `model` VARCHAR(191) NULL,
    `year` INTEGER NULL,
    `fuelType` VARCHAR(191) NULL,
    `lastServiceMonth` VARCHAR(191) NULL,
    `nextServiceDueMonth` VARCHAR(191) NULL,
    `preferredGarage` VARCHAR(191) NULL,
    `needsServicingSupport` BOOLEAN NULL,
    `servicingSupportNote` TEXT NULL,
    `registrationNumber` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `member_vehicles_memberId_idx`(`memberId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;


-- CreateTable
CREATE TABLE `member_loan_needs` (
    `id` VARCHAR(191) NOT NULL,
    `memberId` VARCHAR(191) NOT NULL,
    `loanType` VARCHAR(191) NULL,
    `amountBand` VARCHAR(191) NULL,
    `purpose` VARCHAR(191) NULL,
    `neededByMonth` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `member_loan_needs_memberId_idx`(`memberId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;


-- CreateTable
CREATE TABLE `member_farm_holdings` (
    `id` VARCHAR(191) NOT NULL,
    `memberId` VARCHAR(191) NOT NULL,
    `districtAreaId` VARCHAR(191) NULL,
    `district` VARCHAR(191) NULL,
    `taluka` VARCHAR(191) NULL,
    `village` VARCHAR(191) NULL,
    `areaValue` DOUBLE NULL,
    `areaUnit` VARCHAR(191) NULL,
    `ownership` VARCHAR(191) NULL,
    `irrigated` BOOLEAN NULL,
    `mainCrops` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `member_farm_holdings_memberId_idx`(`memberId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;


-- CreateTable
CREATE TABLE `member_sports` (
    `id` VARCHAR(191) NOT NULL,
    `memberId` VARCHAR(191) NOT NULL,
    `interestId` VARCHAR(191) NULL,
    `level` VARCHAR(191) NULL,
    `needsCoachingSupport` BOOLEAN NULL,
    `supportTypes` JSON NULL,
    `supportNote` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `member_sports_memberId_idx`(`memberId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;


-- CreateTable
CREATE TABLE `member_sport_achievements` (
    `id` VARCHAR(191) NOT NULL,
    `sportId` VARCHAR(191) NOT NULL,
    `eventName` VARCHAR(191) NULL,
    `year` INTEGER NULL,
    `medal` VARCHAR(191) NULL,
    `certificateFileId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;


-- CreateTable
CREATE TABLE `member_hobbies` (
    `id` VARCHAR(191) NOT NULL,
    `memberId` VARCHAR(191) NOT NULL,
    `interestId` VARCHAR(191) NOT NULL,
    `level` VARCHAR(191) NULL,
    `detail` VARCHAR(191) NULL,
    `canTeach` BOOLEAN NULL,
    `needsSupport` BOOLEAN NULL,
    `supportTypes` JSON NULL,
    `supportNote` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `member_hobbies_memberId_interestId_key`(`memberId`, `interestId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;


-- CreateTable
CREATE TABLE `interests` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `slug` VARCHAR(191) NOT NULL,
    `category` VARCHAR(191) NULL,
    `isSport` BOOLEAN NULL DEFAULT false,
    `isChildSafe` BOOLEAN NULL DEFAULT false,
    `status` VARCHAR(191) NULL DEFAULT 'APPROVED',
    `mergedIntoId` VARCHAR(191) NULL,
    `suggestedByMemberId` VARCHAR(191) NULL,
    `reviewedBy` VARCHAR(191) NULL,
    `reviewedAt` DATETIME(3) NULL,
    `sortOrder` INTEGER NULL DEFAULT 0,
    `isActive` BOOLEAN NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `interests_slug_key`(`slug`),
    INDEX `interests_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;


-- CreateTable
CREATE TABLE `option_masters` (
    `id` VARCHAR(191) NOT NULL,
    `listKey` VARCHAR(191) NOT NULL,
    `value` VARCHAR(191) NOT NULL,
    `label` VARCHAR(191) NOT NULL,
    `sortOrder` INTEGER NULL DEFAULT 0,
    `isActive` BOOLEAN NULL DEFAULT true,
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `option_masters_listKey_value_key`(`listKey`, `value`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;


-- CreateTable
CREATE TABLE `support_requests` (
    `id` VARCHAR(191) NOT NULL,
    `memberId` VARCHAR(191) NOT NULL,
    `sourceKey` VARCHAR(191) NOT NULL,
    `category` VARCHAR(191) NOT NULL,
    `district` VARCHAR(191) NULL,
    `note` TEXT NULL,
    `status` VARCHAR(191) NULL DEFAULT 'OPEN',
    `createdByUserId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `withdrawnAt` DATETIME(3) NULL,
    `closedAt` DATETIME(3) NULL,
    `closedBy` VARCHAR(191) NULL,

    INDEX `support_requests_memberId_sourceKey_status_idx`(`memberId`, `sourceKey`, `status`),
    INDEX `support_requests_category_status_idx`(`category`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;


-- CreateTable
CREATE TABLE `member_files` (
    `id` VARCHAR(191) NOT NULL,
    `memberId` VARCHAR(191) NOT NULL,
    `purpose` VARCHAR(191) NOT NULL,
    `storageKey` VARCHAR(191) NOT NULL,
    `originalFilename` VARCHAR(191) NULL,
    `mimeType` VARCHAR(191) NULL,
    `sizeBytes` INTEGER NULL,
    `uploadedBy` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `member_files_memberId_idx`(`memberId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;


-- CreateTable
CREATE TABLE `contact_requests` (
    `id` VARCHAR(191) NOT NULL,
    `purpose` VARCHAR(191) NOT NULL,
    `fromMemberId` VARCHAR(191) NOT NULL,
    `toMemberId` VARCHAR(191) NOT NULL,
    `message` TEXT NULL,
    `status` VARCHAR(191) NULL DEFAULT 'PENDING',
    `respondedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `contact_requests_toMemberId_status_idx`(`toMemberId`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;


-- CreateIndex
CREATE INDEX `consent_records_memberId_consentType_idx` ON `consent_records`(`memberId`, `consentType`);


-- AddForeignKey
ALTER TABLE `member_section_settings` ADD CONSTRAINT `member_section_settings_memberId_fkey` FOREIGN KEY (`memberId`) REFERENCES `members`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;


-- AddForeignKey
ALTER TABLE `member_additional_details` ADD CONSTRAINT `member_additional_details_memberId_fkey` FOREIGN KEY (`memberId`) REFERENCES `members`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;


-- AddForeignKey
ALTER TABLE `member_insurances` ADD CONSTRAINT `member_insurances_memberId_fkey` FOREIGN KEY (`memberId`) REFERENCES `members`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;


-- AddForeignKey
ALTER TABLE `member_vehicles` ADD CONSTRAINT `member_vehicles_memberId_fkey` FOREIGN KEY (`memberId`) REFERENCES `members`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;


-- AddForeignKey
ALTER TABLE `member_loan_needs` ADD CONSTRAINT `member_loan_needs_memberId_fkey` FOREIGN KEY (`memberId`) REFERENCES `members`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;


-- AddForeignKey
ALTER TABLE `member_farm_holdings` ADD CONSTRAINT `member_farm_holdings_memberId_fkey` FOREIGN KEY (`memberId`) REFERENCES `members`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;


-- AddForeignKey
ALTER TABLE `member_sports` ADD CONSTRAINT `member_sports_memberId_fkey` FOREIGN KEY (`memberId`) REFERENCES `members`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;


-- AddForeignKey
ALTER TABLE `member_sports` ADD CONSTRAINT `member_sports_interestId_fkey` FOREIGN KEY (`interestId`) REFERENCES `interests`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;


-- AddForeignKey
ALTER TABLE `member_sport_achievements` ADD CONSTRAINT `member_sport_achievements_sportId_fkey` FOREIGN KEY (`sportId`) REFERENCES `member_sports`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;


-- AddForeignKey
ALTER TABLE `member_hobbies` ADD CONSTRAINT `member_hobbies_memberId_fkey` FOREIGN KEY (`memberId`) REFERENCES `members`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;


-- AddForeignKey
ALTER TABLE `member_hobbies` ADD CONSTRAINT `member_hobbies_interestId_fkey` FOREIGN KEY (`interestId`) REFERENCES `interests`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;


-- AddForeignKey
ALTER TABLE `support_requests` ADD CONSTRAINT `support_requests_memberId_fkey` FOREIGN KEY (`memberId`) REFERENCES `members`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;


-- AddForeignKey
ALTER TABLE `member_files` ADD CONSTRAINT `member_files_memberId_fkey` FOREIGN KEY (`memberId`) REFERENCES `members`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;


-- AddForeignKey
ALTER TABLE `contact_requests` ADD CONSTRAINT `contact_requests_fromMemberId_fkey` FOREIGN KEY (`fromMemberId`) REFERENCES `members`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;


-- AddForeignKey
ALTER TABLE `contact_requests` ADD CONSTRAINT `contact_requests_toMemberId_fkey` FOREIGN KEY (`toMemberId`) REFERENCES `members`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

