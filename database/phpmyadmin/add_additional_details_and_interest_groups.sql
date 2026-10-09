-- Additional Details + interest groups (prisma migrations 20261009100000_member_additional_details
-- and 20261009110000_interest_groups), plus the reference data seed.ts adds for them.
-- Additive only: new tables and nullable columns; nothing existing is altered, renamed or dropped. Import once.
--
-- Prefer `npx prisma migrate deploy` + `npm run db:seed` (see DEPLOYMENT.md). Use this file only
-- if you apply schema changes through phpMyAdmin; afterwards tell Prisma they are applied:
--   npx prisma migrate resolve --applied 20261009100000_member_additional_details
--   npx prisma migrate resolve --applied 20261009110000_interest_groups
-- Rollback: rollback_additional_details_and_interest_groups.sql

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

-- ── Reference data (idempotent) ──────────────────────────────────
INSERT IGNORE INTO roles (id, code, label, isSystem, createdAt) VALUES
(UUID(), 'DISTRICT_TEAM', 'District team', 1, NOW(3)),
(UUID(), 'STATE_TEAM', 'State team', 1, NOW(3)),
(UUID(), 'NATIONAL_TEAM', 'National team', 1, NOW(3));

INSERT IGNORE INTO post_types (id, code, label, icon, requiresApproval, isActive) VALUES
(UUID(), 'GROUP_POST', 'Group post', '💬', 0, 1),
(UUID(), 'GROUP_QUESTION', 'Problem / need help', '🙋', 0, 1),
(UUID(), 'GROUP_KNOWLEDGE', 'Knowledge', '📘', 0, 1),
(UUID(), 'GROUP_EVENT', 'Event / meet-up', '📅', 0, 1),
(UUID(), 'GROUP_POLL', 'Poll', '📊', 0, 1);

-- District areas (same ids seed.ts uses), under India > Maharashtra.
INSERT IGNORE INTO areas (id, parentId, name, type, code, isActive, sortOrder) VALUES
('area-india', NULL, 'India', 'COUNTRY', 'IN', 1, 0),
('area-mh', 'area-india', 'Maharashtra', 'STATE', 'MH', 1, 0);
INSERT IGNORE INTO areas (id, parentId, name, type, isActive, sortOrder) VALUES
('area-dist-pune', 'area-mh', 'Pune', 'DISTRICT', 1, 0),
('area-dist-mumbai', 'area-mh', 'Mumbai', 'DISTRICT', 1, 0),
('area-dist-nagpur', 'area-mh', 'Nagpur', 'DISTRICT', 1, 0),
('area-dist-satara', 'area-mh', 'Satara', 'DISTRICT', 1, 0),
('area-dist-kolhapur', 'area-mh', 'Kolhapur', 'DISTRICT', 1, 0),
('area-dist-nashik', 'area-mh', 'Nashik', 'DISTRICT', 1, 0),
('area-dist-aurangabad', 'area-mh', 'Aurangabad', 'DISTRICT', 1, 0),
('area-dist-solapur', 'area-mh', 'Solapur', 'DISTRICT', 1, 0),
('area-dist-sangli', 'area-mh', 'Sangli', 'DISTRICT', 1, 0),
('area-dist-ahmednagar', 'area-mh', 'Ahmednagar', 'DISTRICT', 1, 0);

INSERT IGNORE INTO interests (id, name, slug, category, isSport, isChildSafe, status, sortOrder, isActive, createdAt) VALUES
(UUID(), 'Drawing and painting', 'drawing-painting', 'Arts', 0, 1, 'APPROVED', 0, 1, NOW(3)),
(UUID(), 'Rangoli', 'rangoli', 'Arts', 0, 1, 'APPROVED', 1, 1, NOW(3)),
(UUID(), 'Mehndi', 'mehndi', 'Arts', 0, 1, 'APPROVED', 2, 1, NOW(3)),
(UUID(), 'Craft', 'craft', 'Arts', 0, 1, 'APPROVED', 3, 1, NOW(3)),
(UUID(), 'Photography', 'photography', 'Arts', 0, 1, 'APPROVED', 4, 1, NOW(3)),
(UUID(), 'Videography', 'videography', 'Arts', 0, 1, 'APPROVED', 5, 1, NOW(3)),
(UUID(), 'Singing', 'singing', 'Music and stage', 0, 1, 'APPROVED', 6, 1, NOW(3)),
(UUID(), 'Bhajan / kirtan', 'bhajan-kirtan', 'Music and stage', 0, 1, 'APPROVED', 7, 1, NOW(3)),
(UUID(), 'Musical instrument', 'instrument', 'Music and stage', 0, 1, 'APPROVED', 8, 1, NOW(3)),
(UUID(), 'Dance', 'dance', 'Music and stage', 0, 1, 'APPROVED', 9, 1, NOW(3)),
(UUID(), 'Drama', 'drama', 'Music and stage', 0, 1, 'APPROVED', 10, 1, NOW(3)),
(UUID(), 'Anchoring', 'anchoring', 'Music and stage', 0, 1, 'APPROVED', 11, 1, NOW(3)),
(UUID(), 'Reading', 'reading', 'Reading and writing', 0, 1, 'APPROVED', 12, 1, NOW(3)),
(UUID(), 'Poetry', 'poetry', 'Reading and writing', 0, 1, 'APPROVED', 13, 1, NOW(3)),
(UUID(), 'Story and blog writing', 'story-blog-writing', 'Reading and writing', 0, 1, 'APPROVED', 14, 1, NOW(3)),
(UUID(), 'Public speaking', 'public-speaking', 'Reading and writing', 0, 1, 'APPROVED', 15, 1, NOW(3)),
(UUID(), 'Cooking', 'cooking', 'Food', 0, 0, 'APPROVED', 16, 1, NOW(3)),
(UUID(), 'Baking', 'baking', 'Food', 0, 0, 'APPROVED', 17, 1, NOW(3)),
(UUID(), 'Traditional recipes', 'traditional-recipes', 'Food', 0, 0, 'APPROVED', 18, 1, NOW(3)),
(UUID(), 'Trekking', 'trekking', 'Outdoors', 0, 0, 'APPROVED', 19, 1, NOW(3)),
(UUID(), 'Cycling', 'cycling', 'Outdoors', 0, 0, 'APPROVED', 20, 1, NOW(3)),
(UUID(), 'Running', 'running', 'Outdoors', 0, 0, 'APPROVED', 21, 1, NOW(3)),
(UUID(), 'Travel', 'travel', 'Outdoors', 0, 0, 'APPROVED', 22, 1, NOW(3)),
(UUID(), 'Pilgrimage (yatra)', 'pilgrimage', 'Outdoors', 0, 0, 'APPROVED', 23, 1, NOW(3)),
(UUID(), 'Gardening', 'gardening', 'Outdoors', 0, 0, 'APPROVED', 24, 1, NOW(3)),
(UUID(), 'Farming methods', 'farming-methods', 'Outdoors', 0, 0, 'APPROVED', 25, 1, NOW(3)),
(UUID(), 'Bird watching', 'bird-watching', 'Outdoors', 0, 0, 'APPROVED', 26, 1, NOW(3)),
(UUID(), 'Cricket', 'cricket', 'Games', 1, 1, 'APPROVED', 27, 1, NOW(3)),
(UUID(), 'Badminton', 'badminton', 'Games', 1, 1, 'APPROVED', 28, 1, NOW(3)),
(UUID(), 'Chess', 'chess', 'Games', 1, 1, 'APPROVED', 29, 1, NOW(3)),
(UUID(), 'Carrom', 'carrom', 'Games', 1, 1, 'APPROVED', 30, 1, NOW(3)),
(UUID(), 'Kabaddi', 'kabaddi', 'Games', 1, 1, 'APPROVED', 31, 1, NOW(3)),
(UUID(), 'Kho-kho', 'kho-kho', 'Games', 1, 1, 'APPROVED', 32, 1, NOW(3)),
(UUID(), 'Football', 'football', 'Games', 1, 1, 'APPROVED', 33, 1, NOW(3)),
(UUID(), 'Volleyball', 'volleyball', 'Games', 1, 1, 'APPROVED', 34, 1, NOW(3)),
(UUID(), 'Table tennis', 'table-tennis', 'Games', 1, 1, 'APPROVED', 35, 1, NOW(3)),
(UUID(), 'Athletics', 'athletics', 'Games', 1, 1, 'APPROVED', 36, 1, NOW(3)),
(UUID(), 'Swimming', 'swimming', 'Games', 1, 1, 'APPROVED', 37, 1, NOW(3)),
(UUID(), 'Wrestling', 'wrestling', 'Games', 1, 1, 'APPROVED', 38, 1, NOW(3)),
(UUID(), 'Other sports', 'other-sports', 'Games', 1, 1, 'APPROVED', 39, 1, NOW(3)),
(UUID(), 'Yoga', 'yoga', 'Wellness', 0, 0, 'APPROVED', 40, 1, NOW(3)),
(UUID(), 'Meditation', 'meditation', 'Wellness', 0, 0, 'APPROVED', 41, 1, NOW(3)),
(UUID(), 'Gym and fitness', 'gym-fitness', 'Wellness', 0, 0, 'APPROVED', 42, 1, NOW(3)),
(UUID(), 'Coding', 'coding', 'Technology', 0, 0, 'APPROVED', 43, 1, NOW(3)),
(UUID(), 'Gadgets', 'gadgets', 'Technology', 0, 0, 'APPROVED', 44, 1, NOW(3)),
(UUID(), 'AI', 'ai', 'Technology', 0, 0, 'APPROVED', 45, 1, NOW(3)),
(UUID(), 'Video editing', 'video-editing', 'Technology', 0, 0, 'APPROVED', 46, 1, NOW(3)),
(UUID(), 'Gaming', 'gaming', 'Technology', 0, 0, 'APPROVED', 47, 1, NOW(3)),
(UUID(), 'Share market', 'share-market', 'Money and business', 0, 0, 'APPROVED', 48, 1, NOW(3)),
(UUID(), 'Personal finance', 'personal-finance', 'Money and business', 0, 0, 'APPROVED', 49, 1, NOW(3)),
(UUID(), 'Start-ups', 'start-ups', 'Money and business', 0, 0, 'APPROVED', 50, 1, NOW(3)),
(UUID(), 'Interior decoration', 'interior-decoration', 'Home', 0, 0, 'APPROVED', 51, 1, NOW(3)),
(UUID(), 'Tailoring and embroidery', 'tailoring-embroidery', 'Home', 0, 0, 'APPROVED', 52, 1, NOW(3)),
(UUID(), 'Pets', 'pets', 'Home', 0, 0, 'APPROVED', 53, 1, NOW(3)),
(UUID(), 'Social work', 'social-work', 'Service', 0, 0, 'APPROVED', 54, 1, NOW(3)),
(UUID(), 'Teaching', 'teaching', 'Service', 0, 0, 'APPROVED', 55, 1, NOW(3)),
(UUID(), 'Blood donation', 'blood-donation', 'Service', 0, 0, 'APPROVED', 56, 1, NOW(3)),
(UUID(), 'Environment', 'environment', 'Service', 0, 0, 'APPROVED', 57, 1, NOW(3));
