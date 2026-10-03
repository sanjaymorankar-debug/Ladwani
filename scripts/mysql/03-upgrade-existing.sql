-- =====================================================================
-- Mi Ladwani — 03-upgrade-existing.sql
-- For a database that is ALREADY LIVE and was built from the older
-- phpMyAdmin scripts in database/phpmyadmin/ (create_tables.sql +
-- seed_reference_data.sql + add_family_join_requests.sql
-- [+ add_member_profile_details.sql]). Brings it to main @ f12780f
-- WITHOUT touching existing rows.
--
-- Why it's needed: those older scripts were missing 9 tables (assets,
-- bookings, asset_blackouts, payments, fee_invoices, fee_types,
-- member_invitations, community_groups, community_group_members) and 15
-- columns (e.g. users.joinIntent, members.languages/heightCm/weightKg,
-- photos.visibility, posts.reviewedAt, family_join_requests.direction),
-- plus the permission matrix, approval rules, areas, income ranges and the
-- registration fee.
--
-- Generated with `prisma migrate diff` from a database built exactly
-- that way, then tested: after this script the diff to
-- prisma/schema.prisma is EMPTY.
--
-- If add_member_profile_details.sql was NOT yet imported, import it
-- FIRST, then this file. Fresh, empty database? Use 01 + 02 instead.
-- BACK UP FIRST (phpMyAdmin → Export) — DDL can't be rolled back.
-- =====================================================================

SET NAMES utf8mb4;

-- ---------------------------------------------------------------------
-- Part 1: schema
-- ---------------------------------------------------------------------

-- AlterTable
ALTER TABLE `family_join_requests` ADD COLUMN `direction` VARCHAR(191) NOT NULL DEFAULT 'MEMBER_REQUEST',
    ADD COLUMN `respondedBy` VARCHAR(191) NULL,
    ADD COLUMN `responseNote` VARCHAR(191) NULL,
    MODIFY `relationshipTypeCode` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `members` ADD COLUMN `bodyType` VARCHAR(191) NULL,
    ADD COLUMN `heightCm` INTEGER NULL,
    ADD COLUMN `languages` JSON NULL,
    ADD COLUMN `physicalDisability` VARCHAR(191) NULL,
    ADD COLUMN `weightKg` INTEGER NULL;

-- AlterTable
ALTER TABLE `photos` ADD COLUMN `assetId` VARCHAR(191) NULL,
    ADD COLUMN `visibility` VARCHAR(191) NOT NULL DEFAULT 'PRIVATE';

-- AlterTable
ALTER TABLE `posts` ADD COLUMN `reviewNote` TEXT NULL,
    ADD COLUMN `reviewedAt` DATETIME(3) NULL,
    ADD COLUMN `reviewedBy` VARCHAR(191) NULL,
    MODIFY `status` ENUM('DRAFT', 'PENDING_APPROVAL', 'PUBLISHED', 'REJECTED', 'HIDDEN', 'REMOVED', 'FLAGGED') NOT NULL DEFAULT 'PENDING_APPROVAL';

-- AlterTable
ALTER TABLE `users` ADD COLUMN `joinIntent` VARCHAR(191) NULL;

-- CreateTable
CREATE TABLE `member_invitations` (
    `id` VARCHAR(191) NOT NULL,
    `memberId` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NULL,
    `mobile` VARCHAR(191) NULL,
    `tokenHash` VARCHAR(191) NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'PENDING',
    `invitedBy` VARCHAR(191) NOT NULL,
    `expiresAt` DATETIME(3) NOT NULL,
    `acceptedAt` DATETIME(3) NULL,
    `acceptedBy` VARCHAR(191) NULL,
    `revokedAt` DATETIME(3) NULL,
    `revokedBy` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `member_invitations_tokenHash_key`(`tokenHash`),
    INDEX `member_invitations_memberId_status_idx`(`memberId`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `community_groups` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NULL,
    `groupType` VARCHAR(191) NOT NULL DEFAULT 'MANDAL',
    `description` TEXT NULL,
    `areaId` VARCHAR(191) NULL,
    `convenerMemberId` VARCHAR(191) NULL,
    `meetingSchedule` VARCHAR(191) NULL,
    `maxMembers` INTEGER NULL DEFAULT 25,
    `status` ENUM('DRAFT', 'PENDING_APPROVAL', 'ACTIVE', 'REJECTED', 'INACTIVE') NOT NULL DEFAULT 'PENDING_APPROVAL',
    `reviewedBy` VARCHAR(191) NULL,
    `reviewedAt` DATETIME(3) NULL,
    `reviewNote` TEXT NULL,
    `lastRosterReviewAt` DATETIME(3) NULL,
    `lastRosterReviewBy` VARCHAR(191) NULL,
    `rosterReviewIntervalDays` INTEGER NOT NULL DEFAULT 180,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `createdBy` VARCHAR(191) NULL,
    `deletedAt` DATETIME(3) NULL,

    UNIQUE INDEX `community_groups_code_key`(`code`),
    INDEX `community_groups_status_isActive_idx`(`status`, `isActive`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `community_group_members` (
    `id` VARCHAR(191) NOT NULL,
    `groupId` VARCHAR(191) NOT NULL,
    `memberId` VARCHAR(191) NOT NULL,
    `roleInGroup` VARCHAR(191) NOT NULL DEFAULT 'MEMBER',
    `joinedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `addedBy` VARCHAR(191) NULL,
    `leftAt` DATETIME(3) NULL,
    `leftReason` VARCHAR(191) NULL,

    INDEX `community_group_members_memberId_idx`(`memberId`),
    UNIQUE INDEX `community_group_members_groupId_memberId_key`(`groupId`, `memberId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `assets` (
    `id` VARCHAR(191) NOT NULL,
    `ownerMemberId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `assetType` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `addressLine` VARCHAR(191) NULL,
    `city` VARCHAR(191) NULL,
    `district` VARCHAR(191) NULL,
    `state` VARCHAR(191) NULL,
    `pincode` VARCHAR(191) NULL,
    `capacity` INTEGER NULL,
    `facilities` JSON NULL,
    `bookingMode` VARCHAR(191) NOT NULL DEFAULT 'DAILY',
    `ratePerDay` INTEGER NULL,
    `ratePerHour` INTEGER NULL,
    `status` ENUM('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'SUSPENDED') NOT NULL DEFAULT 'DRAFT',
    `reviewedBy` VARCHAR(191) NULL,
    `reviewedAt` DATETIME(3) NULL,
    `reviewNote` TEXT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,

    INDEX `assets_status_isActive_idx`(`status`, `isActive`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `asset_blackouts` (
    `id` VARCHAR(191) NOT NULL,
    `assetId` VARCHAR(191) NOT NULL,
    `startAt` DATETIME(3) NOT NULL,
    `endAt` DATETIME(3) NOT NULL,
    `reason` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `asset_blackouts_assetId_startAt_endAt_idx`(`assetId`, `startAt`, `endAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `bookings` (
    `id` VARCHAR(191) NOT NULL,
    `reference` VARCHAR(191) NOT NULL,
    `assetId` VARCHAR(191) NOT NULL,
    `memberId` VARCHAR(191) NOT NULL,
    `bookedByUserId` VARCHAR(191) NOT NULL,
    `startAt` DATETIME(3) NOT NULL,
    `endAt` DATETIME(3) NOT NULL,
    `status` ENUM('PENDING_PAYMENT', 'CONFIRMED', 'CANCELLED', 'COMPLETED', 'REJECTED', 'EXPIRED') NOT NULL DEFAULT 'PENDING_PAYMENT',
    `amountPaise` INTEGER NOT NULL,
    `guestCount` INTEGER NULL,
    `notes` TEXT NULL,
    `cancelledAt` DATETIME(3) NULL,
    `cancelReason` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `bookings_reference_key`(`reference`),
    INDEX `bookings_assetId_startAt_endAt_idx`(`assetId`, `startAt`, `endAt`),
    INDEX `bookings_memberId_idx`(`memberId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `payments` (
    `id` VARCHAR(191) NOT NULL,
    `reference` VARCHAR(191) NOT NULL,
    `purpose` VARCHAR(191) NOT NULL,
    `bookingId` VARCHAR(191) NULL,
    `feeInvoiceId` VARCHAR(191) NULL,
    `memberId` VARCHAR(191) NOT NULL,
    `paidByUserId` VARCHAR(191) NOT NULL,
    `amountPaise` INTEGER NOT NULL,
    `currency` VARCHAR(191) NOT NULL DEFAULT 'INR',
    `status` ENUM('CREATED', 'PENDING', 'PAID', 'FAILED', 'CANCELLED', 'REFUNDED') NOT NULL DEFAULT 'CREATED',
    `gateway` VARCHAR(191) NOT NULL DEFAULT 'MOCK',
    `gatewayOrderId` VARCHAR(191) NULL,
    `gatewayPaymentId` VARCHAR(191) NULL,
    `failureReason` VARCHAR(191) NULL,
    `paidAt` DATETIME(3) NULL,
    `refundedPaise` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `payments_reference_key`(`reference`),
    INDEX `payments_memberId_idx`(`memberId`),
    INDEX `payments_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `fee_types` (
    `id` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `label` VARCHAR(191) NOT NULL,
    `description` VARCHAR(191) NULL,
    `amountPaise` INTEGER NOT NULL,
    `appliesTo` VARCHAR(191) NOT NULL DEFAULT 'FAMILY_KARTA',
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `fee_types_code_key`(`code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `fee_invoices` (
    `id` VARCHAR(191) NOT NULL,
    `reference` VARCHAR(191) NOT NULL,
    `feeTypeId` VARCHAR(191) NOT NULL,
    `familyId` VARCHAR(191) NULL,
    `memberId` VARCHAR(191) NOT NULL,
    `amountPaise` INTEGER NOT NULL,
    `status` ENUM('PENDING', 'PAID', 'WAIVED', 'CANCELLED') NOT NULL DEFAULT 'PENDING',
    `dueDate` DATETIME(3) NULL,
    `paidAt` DATETIME(3) NULL,
    `waivedBy` VARCHAR(191) NULL,
    `waiverReason` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `fee_invoices_reference_key`(`reference`),
    INDEX `fee_invoices_memberId_status_idx`(`memberId`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE UNIQUE INDEX `family_join_requests_familyId_memberId_status_direction_key` ON `family_join_requests`(`familyId`, `memberId`, `status`, `direction`);

-- DropIndex (after the replacement index exists: MySQL needs an index on familyId for its foreign key)
-- DropIndex
DROP INDEX `family_join_requests_familyId_memberId_status_key` ON `family_join_requests`;

-- AddForeignKey
ALTER TABLE `member_invitations` ADD CONSTRAINT `member_invitations_memberId_fkey` FOREIGN KEY (`memberId`) REFERENCES `members`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `community_groups` ADD CONSTRAINT `community_groups_areaId_fkey` FOREIGN KEY (`areaId`) REFERENCES `areas`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `community_groups` ADD CONSTRAINT `community_groups_convenerMemberId_fkey` FOREIGN KEY (`convenerMemberId`) REFERENCES `members`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `community_group_members` ADD CONSTRAINT `community_group_members_groupId_fkey` FOREIGN KEY (`groupId`) REFERENCES `community_groups`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `community_group_members` ADD CONSTRAINT `community_group_members_memberId_fkey` FOREIGN KEY (`memberId`) REFERENCES `members`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `assets` ADD CONSTRAINT `assets_ownerMemberId_fkey` FOREIGN KEY (`ownerMemberId`) REFERENCES `members`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `asset_blackouts` ADD CONSTRAINT `asset_blackouts_assetId_fkey` FOREIGN KEY (`assetId`) REFERENCES `assets`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `bookings` ADD CONSTRAINT `bookings_assetId_fkey` FOREIGN KEY (`assetId`) REFERENCES `assets`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `bookings` ADD CONSTRAINT `bookings_memberId_fkey` FOREIGN KEY (`memberId`) REFERENCES `members`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payments` ADD CONSTRAINT `payments_bookingId_fkey` FOREIGN KEY (`bookingId`) REFERENCES `bookings`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payments` ADD CONSTRAINT `payments_feeInvoiceId_fkey` FOREIGN KEY (`feeInvoiceId`) REFERENCES `fee_invoices`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payments` ADD CONSTRAINT `payments_memberId_fkey` FOREIGN KEY (`memberId`) REFERENCES `members`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `fee_invoices` ADD CONSTRAINT `fee_invoices_feeTypeId_fkey` FOREIGN KEY (`feeTypeId`) REFERENCES `fee_types`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `fee_invoices` ADD CONSTRAINT `fee_invoices_familyId_fkey` FOREIGN KEY (`familyId`) REFERENCES `families`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `fee_invoices` ADD CONSTRAINT `fee_invoices_memberId_fkey` FOREIGN KEY (`memberId`) REFERENCES `members`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `photos` ADD CONSTRAINT `photos_assetId_fkey` FOREIGN KEY (`assetId`) REFERENCES `assets`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;


-- ---------------------------------------------------------------------
-- Part 2: reference data (INSERT IGNORE — existing rows are kept)
-- ---------------------------------------------------------------------
INSERT IGNORE INTO `roles` (`id`, `code`, `label`, `description`, `isSystem`, `createdAt`) VALUES ('cmusg9yj80000r7ekes8lumrx','MEMBER','Member',NULL,1,'2026-10-03 13:51:11.636'),
('cmusg9yja0001r7ekj6w5s40i','ADMIN','Administrator',NULL,1,'2026-10-03 13:51:11.637'),
('cmusg9yja0002r7ek5xo8ogyq','KARTA','Family Head (Karta)',NULL,1,'2026-10-03 13:51:11.636'),
('cmusg9yjb0003r7ekwvuyl11u','ASSET_OWNER','Asset Owner',NULL,1,'2026-10-03 13:51:11.637'),
('cmusg9yjb0004r7ekvhq25v2b','OPERATOR','Operator',NULL,1,'2026-10-03 13:51:11.637');
INSERT IGNORE INTO `permissions` (`id`, `code`, `label`, `module`) VALUES ('cmusg9yje0005r7eke4k43pg8','family:create','Register a new family','family'),
('cmusg9yjf0006r7ek74wd447q','family:edit_own','Edit own family','family'),
('cmusg9yjh0007r7ekst2vuqv2','family:edit_any','Edit any family','family'),
('cmusg9yji0008r7ekj7kvszvo','family:member_add','Add members to own family','family'),
('cmusg9yjk0009r7eke6kpn40j','family:view_tree','View own family tree','family'),
('cmusg9yjl000ar7ekbuj6ocmz','family:approve','Verify/approve families','family'),
('cmusg9yjm000br7ek55bbn8ki','member:edit_own','Edit own member profile','member'),
('cmusg9yjn000cr7ekd4zi2ypt','member:edit_any','Edit any member profile','member'),
('cmusg9yjo000dr7ekydwhgfx3','member:mark_deceased','Mark a member deceased','member'),
('cmusg9yjp000er7ek2a3bklpy','matrimony:manage_own','Manage own matrimonial profile','matrimony'),
('cmusg9yjr000fr7ek54mzap42','approval:review','Review approval requests','approval'),
('cmusg9yjs000gr7ekb9fyjutd','admin:users','Manage users and roles','admin'),
('cmusg9yjs000hr7eknn65quge','admin:settings','Manage platform settings','admin'),
('cmusg9yju000ir7ek23u6vzye','admin:audit','View audit logs','admin'),
('cmusg9yjv000jr7ek33tpwinw','asset:manage_own','Manage own assets','asset'),
('cmusg9yjw000kr7ekg2eqxpzh','group:manage_own','Register and convene community groups','group'),
('cmusg9yjx000lr7ekxrwwf3it','group:approve','Approve community groups','group');
INSERT IGNORE INTO `approval_rules` (`id`, `actionCode`, `requiresApproval`, `approverRole`, `autoApproveRole`, `isActive`, `updatedAt`) VALUES ('cmusg9yvn001jr7ekpiobx7i3','family.create',1,'OPERATOR',NULL,1,'2026-10-03 13:51:12.084'),
('cmusg9yvp001kr7eklogmv5h8','family.member.add',1,'OPERATOR',NULL,1,'2026-10-03 13:51:12.085'),
('cmusg9yvr001lr7ekvfxuxm8x','member.marital_status.change',1,'OPERATOR',NULL,1,'2026-10-03 13:51:12.087'),
('cmusg9yvs001mr7ek4g1hezfy','member.mark_deceased',1,'OPERATOR',NULL,1,'2026-10-03 13:51:12.088'),
('cmusg9yvt001nr7ekyhjobznx','member.relationship.change',1,'OPERATOR',NULL,1,'2026-10-03 13:51:12.090'),
('cmusg9yvv001or7ek494bmkck','member.address.change',1,'OPERATOR',NULL,1,'2026-10-03 13:51:12.091'),
('cmusg9yvw001pr7ekvi2buy4o','family.karta.change',1,'ADMIN',NULL,1,'2026-10-03 13:51:12.092'),
('cmusg9yvx001qr7ek32bkymbb','family.merge',1,'ADMIN',NULL,1,'2026-10-03 13:51:12.094'),
('cmusg9yvz001rr7ekenk4qcar','member.edit_own',0,NULL,'MEMBER',1,'2026-10-03 13:51:12.095'),
('cmusg9yw0001sr7eku0xjyzc2','member.education.edit_own',0,NULL,'MEMBER',1,'2026-10-03 13:51:12.096'),
('cmusg9yw1001tr7ekeh0rpahb','member.employment.edit_own',0,NULL,'MEMBER',1,'2026-10-03 13:51:12.097'),
('cmusg9ywq001yr7ekwzworpfq','asset.create',1,'OPERATOR',NULL,1,'2026-10-03 13:51:12.122'),
('cmusg9ywr001zr7ek3b8g3xxb','group.create',1,'OPERATOR',NULL,1,'2026-10-03 13:51:12.124');
INSERT IGNORE INTO `areas` (`id`, `parentId`, `name`, `type`, `code`, `isActive`, `sortOrder`) VALUES ('area-india',NULL,'India','COUNTRY','IN',1,0),
('area-mh','area-india','Maharashtra','STATE','MH',1,0),
('area-mumbai','area-mh','Mumbai','CITY',NULL,1,0),
('area-nagpur','area-mh','Nagpur','CITY',NULL,1,0),
('area-pune','area-mh','Pune','CITY',NULL,1,0);
INSERT IGNORE INTO `income_ranges` (`id`, `label`, `minValue`, `maxValue`, `sortOrder`, `isActive`) VALUES ('income-1','Below ₹2 lakh',0,200000,1,1),
('income-2','₹2–5 lakh',200000,500000,2,1),
('income-3','₹5–10 lakh',500000,1000000,3,1),
('income-4','₹10–20 lakh',1000000,2000000,4,1),
('income-5','₹20–50 lakh',2000000,5000000,5,1),
('income-6','Above ₹50 lakh',5000000,NULL,6,1);
INSERT IGNORE INTO `settings` (`id`, `key`, `value`, `description`, `updatedBy`, `updatedAt`) VALUES ('cmusg9ywj001ur7ekil9v2q0a','community.name','\"\\\"Ladwani Samaj\\\"\"','Community display name',NULL,'2026-10-03 13:51:12.116'),
('cmusg9ywl001vr7ekpiv338nc','community.tagline','\"\\\"Our Community, Our Heritage, Our Future\\\"\"','Community tagline',NULL,'2026-10-03 13:51:12.117'),
('cmusg9ywm001wr7ek68audvdv','matrimony.contact_exchange','\"\\\"ACCEPT_FIRST\\\"\"','When to reveal contact: ACCEPT_FIRST or FAMILY_APPROVAL',NULL,'2026-10-03 13:51:12.119');
INSERT IGNORE INTO `fee_types` (`id`, `code`, `label`, `description`, `amountPaise`, `appliesTo`, `isActive`, `updatedAt`) VALUES ('cmusg9ywo001xr7ekl1rvry0y','FAMILY_REGISTRATION','Family Registration Fee','One-time fee payable by the Karta when a new family is registered. Other family members join free.',200000,'FAMILY_KARTA',1,'2026-10-03 13:51:12.120');

-- Permission matrix, matched by role/permission CODE (role ids differ per database)
INSERT IGNORE INTO `role_permissions` (`roleId`, `permissionId`) SELECT r.id, p.id FROM `roles` r, `permissions` p WHERE r.code = 'ADMIN' AND p.code = 'admin:audit';
INSERT IGNORE INTO `role_permissions` (`roleId`, `permissionId`) SELECT r.id, p.id FROM `roles` r, `permissions` p WHERE r.code = 'ADMIN' AND p.code = 'admin:settings';
INSERT IGNORE INTO `role_permissions` (`roleId`, `permissionId`) SELECT r.id, p.id FROM `roles` r, `permissions` p WHERE r.code = 'ADMIN' AND p.code = 'admin:users';
INSERT IGNORE INTO `role_permissions` (`roleId`, `permissionId`) SELECT r.id, p.id FROM `roles` r, `permissions` p WHERE r.code = 'ADMIN' AND p.code = 'approval:review';
INSERT IGNORE INTO `role_permissions` (`roleId`, `permissionId`) SELECT r.id, p.id FROM `roles` r, `permissions` p WHERE r.code = 'ADMIN' AND p.code = 'asset:manage_own';
INSERT IGNORE INTO `role_permissions` (`roleId`, `permissionId`) SELECT r.id, p.id FROM `roles` r, `permissions` p WHERE r.code = 'ADMIN' AND p.code = 'family:approve';
INSERT IGNORE INTO `role_permissions` (`roleId`, `permissionId`) SELECT r.id, p.id FROM `roles` r, `permissions` p WHERE r.code = 'ADMIN' AND p.code = 'family:create';
INSERT IGNORE INTO `role_permissions` (`roleId`, `permissionId`) SELECT r.id, p.id FROM `roles` r, `permissions` p WHERE r.code = 'ADMIN' AND p.code = 'family:edit_any';
INSERT IGNORE INTO `role_permissions` (`roleId`, `permissionId`) SELECT r.id, p.id FROM `roles` r, `permissions` p WHERE r.code = 'ADMIN' AND p.code = 'family:edit_own';
INSERT IGNORE INTO `role_permissions` (`roleId`, `permissionId`) SELECT r.id, p.id FROM `roles` r, `permissions` p WHERE r.code = 'ADMIN' AND p.code = 'family:member_add';
INSERT IGNORE INTO `role_permissions` (`roleId`, `permissionId`) SELECT r.id, p.id FROM `roles` r, `permissions` p WHERE r.code = 'ADMIN' AND p.code = 'family:view_tree';
INSERT IGNORE INTO `role_permissions` (`roleId`, `permissionId`) SELECT r.id, p.id FROM `roles` r, `permissions` p WHERE r.code = 'ADMIN' AND p.code = 'group:approve';
INSERT IGNORE INTO `role_permissions` (`roleId`, `permissionId`) SELECT r.id, p.id FROM `roles` r, `permissions` p WHERE r.code = 'ADMIN' AND p.code = 'group:manage_own';
INSERT IGNORE INTO `role_permissions` (`roleId`, `permissionId`) SELECT r.id, p.id FROM `roles` r, `permissions` p WHERE r.code = 'ADMIN' AND p.code = 'matrimony:manage_own';
INSERT IGNORE INTO `role_permissions` (`roleId`, `permissionId`) SELECT r.id, p.id FROM `roles` r, `permissions` p WHERE r.code = 'ADMIN' AND p.code = 'member:edit_any';
INSERT IGNORE INTO `role_permissions` (`roleId`, `permissionId`) SELECT r.id, p.id FROM `roles` r, `permissions` p WHERE r.code = 'ADMIN' AND p.code = 'member:edit_own';
INSERT IGNORE INTO `role_permissions` (`roleId`, `permissionId`) SELECT r.id, p.id FROM `roles` r, `permissions` p WHERE r.code = 'ADMIN' AND p.code = 'member:mark_deceased';
INSERT IGNORE INTO `role_permissions` (`roleId`, `permissionId`) SELECT r.id, p.id FROM `roles` r, `permissions` p WHERE r.code = 'ASSET_OWNER' AND p.code = 'asset:manage_own';
INSERT IGNORE INTO `role_permissions` (`roleId`, `permissionId`) SELECT r.id, p.id FROM `roles` r, `permissions` p WHERE r.code = 'ASSET_OWNER' AND p.code = 'family:view_tree';
INSERT IGNORE INTO `role_permissions` (`roleId`, `permissionId`) SELECT r.id, p.id FROM `roles` r, `permissions` p WHERE r.code = 'ASSET_OWNER' AND p.code = 'group:manage_own';
INSERT IGNORE INTO `role_permissions` (`roleId`, `permissionId`) SELECT r.id, p.id FROM `roles` r, `permissions` p WHERE r.code = 'ASSET_OWNER' AND p.code = 'matrimony:manage_own';
INSERT IGNORE INTO `role_permissions` (`roleId`, `permissionId`) SELECT r.id, p.id FROM `roles` r, `permissions` p WHERE r.code = 'ASSET_OWNER' AND p.code = 'member:edit_own';
INSERT IGNORE INTO `role_permissions` (`roleId`, `permissionId`) SELECT r.id, p.id FROM `roles` r, `permissions` p WHERE r.code = 'KARTA' AND p.code = 'family:create';
INSERT IGNORE INTO `role_permissions` (`roleId`, `permissionId`) SELECT r.id, p.id FROM `roles` r, `permissions` p WHERE r.code = 'KARTA' AND p.code = 'family:edit_own';
INSERT IGNORE INTO `role_permissions` (`roleId`, `permissionId`) SELECT r.id, p.id FROM `roles` r, `permissions` p WHERE r.code = 'KARTA' AND p.code = 'family:member_add';
INSERT IGNORE INTO `role_permissions` (`roleId`, `permissionId`) SELECT r.id, p.id FROM `roles` r, `permissions` p WHERE r.code = 'KARTA' AND p.code = 'family:view_tree';
INSERT IGNORE INTO `role_permissions` (`roleId`, `permissionId`) SELECT r.id, p.id FROM `roles` r, `permissions` p WHERE r.code = 'KARTA' AND p.code = 'group:manage_own';
INSERT IGNORE INTO `role_permissions` (`roleId`, `permissionId`) SELECT r.id, p.id FROM `roles` r, `permissions` p WHERE r.code = 'KARTA' AND p.code = 'matrimony:manage_own';
INSERT IGNORE INTO `role_permissions` (`roleId`, `permissionId`) SELECT r.id, p.id FROM `roles` r, `permissions` p WHERE r.code = 'KARTA' AND p.code = 'member:edit_own';
INSERT IGNORE INTO `role_permissions` (`roleId`, `permissionId`) SELECT r.id, p.id FROM `roles` r, `permissions` p WHERE r.code = 'MEMBER' AND p.code = 'family:view_tree';
INSERT IGNORE INTO `role_permissions` (`roleId`, `permissionId`) SELECT r.id, p.id FROM `roles` r, `permissions` p WHERE r.code = 'MEMBER' AND p.code = 'group:manage_own';
INSERT IGNORE INTO `role_permissions` (`roleId`, `permissionId`) SELECT r.id, p.id FROM `roles` r, `permissions` p WHERE r.code = 'MEMBER' AND p.code = 'matrimony:manage_own';
INSERT IGNORE INTO `role_permissions` (`roleId`, `permissionId`) SELECT r.id, p.id FROM `roles` r, `permissions` p WHERE r.code = 'MEMBER' AND p.code = 'member:edit_own';
INSERT IGNORE INTO `role_permissions` (`roleId`, `permissionId`) SELECT r.id, p.id FROM `roles` r, `permissions` p WHERE r.code = 'OPERATOR' AND p.code = 'approval:review';
INSERT IGNORE INTO `role_permissions` (`roleId`, `permissionId`) SELECT r.id, p.id FROM `roles` r, `permissions` p WHERE r.code = 'OPERATOR' AND p.code = 'family:approve';
INSERT IGNORE INTO `role_permissions` (`roleId`, `permissionId`) SELECT r.id, p.id FROM `roles` r, `permissions` p WHERE r.code = 'OPERATOR' AND p.code = 'family:edit_any';
INSERT IGNORE INTO `role_permissions` (`roleId`, `permissionId`) SELECT r.id, p.id FROM `roles` r, `permissions` p WHERE r.code = 'OPERATOR' AND p.code = 'family:member_add';
INSERT IGNORE INTO `role_permissions` (`roleId`, `permissionId`) SELECT r.id, p.id FROM `roles` r, `permissions` p WHERE r.code = 'OPERATOR' AND p.code = 'family:view_tree';
INSERT IGNORE INTO `role_permissions` (`roleId`, `permissionId`) SELECT r.id, p.id FROM `roles` r, `permissions` p WHERE r.code = 'OPERATOR' AND p.code = 'group:approve';
INSERT IGNORE INTO `role_permissions` (`roleId`, `permissionId`) SELECT r.id, p.id FROM `roles` r, `permissions` p WHERE r.code = 'OPERATOR' AND p.code = 'group:manage_own';
INSERT IGNORE INTO `role_permissions` (`roleId`, `permissionId`) SELECT r.id, p.id FROM `roles` r, `permissions` p WHERE r.code = 'OPERATOR' AND p.code = 'matrimony:manage_own';
INSERT IGNORE INTO `role_permissions` (`roleId`, `permissionId`) SELECT r.id, p.id FROM `roles` r, `permissions` p WHERE r.code = 'OPERATOR' AND p.code = 'member:edit_any';
INSERT IGNORE INTO `role_permissions` (`roleId`, `permissionId`) SELECT r.id, p.id FROM `roles` r, `permissions` p WHERE r.code = 'OPERATOR' AND p.code = 'member:edit_own';
INSERT IGNORE INTO `role_permissions` (`roleId`, `permissionId`) SELECT r.id, p.id FROM `roles` r, `permissions` p WHERE r.code = 'OPERATOR' AND p.code = 'member:mark_deceased';

-- Admin login admin@miladwani.com / ChangeThisInProduction123! — only if
-- that email doesn't exist yet. CHANGE THE PASSWORD right after login.
INSERT IGNORE INTO `users` (`id`, `email`, `mobile`, `passwordHash`, `emailVerified`, `mobileVerified`, `status`, `joinIntent`, `lastLoginAt`, `lastLoginIp`, `failedAttempts`, `lockedUntil`, `createdAt`, `updatedAt`, `deletedAt`) VALUES ('cmusg9yua000mr7ekhpzcdejy','admin@miladwani.com','9000000000','$2a$12$wtk3zvIvTsEWfuAIH005IOesG3nT4Dt13jrd5lXa0DKvcKMYlKS4y',1,1,'ACTIVE',NULL,NULL,NULL,0,NULL,'2026-10-03 13:51:12.034','2026-10-03 13:51:12.034',NULL);
INSERT IGNORE INTO `members` (`id`, `memberNumber`, `userId`, `firstName`, `middleName`, `lastName`, `gender`, `dateOfBirth`, `dateOfBirthApprox`, `bloodGroup`, `heightCm`, `weightKg`, `bodyType`, `physicalDisability`, `mobilePrimary`, `mobileAlternate`, `email`, `profilePhotoId`, `biography`, `currentCity`, `currentState`, `currentCountry`, `nativeVillage`, `nativeDistrict`, `nativeState`, `nationality`, `maritalStatus`, `employmentStatus`, `occupationCategory`, `status`, `deceasedAt`, `deceasedPlace`, `deceasedNotes`, `verificationStatus`, `createdAt`, `updatedAt`, `createdBy`, `updatedBy`, `deletedAt`, `languages`) VALUES ('cmusg9yug000or7eka248sai8','MEM-ADMIN-001','cmusg9yua000mr7ekhpzcdejy','Admin',NULL,'Ladwani','MALE',NULL,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'Indian','UNMARRIED',NULL,NULL,'ACTIVE',NULL,NULL,NULL,'UNVERIFIED','2026-10-03 13:51:12.040','2026-10-03 13:51:12.040',NULL,NULL,NULL,NULL);
INSERT IGNORE INTO `user_roles` (`id`, `userId`, `roleId`, `grantedAt`)
  SELECT CONCAT('admin-role-', u.id), u.id, r.id, CURRENT_TIMESTAMP(3)
  FROM `users` u, `roles` r WHERE u.email = 'admin@miladwani.com' AND r.code = 'ADMIN';

-- ---------------------------------------------------------------------
-- Part 3: Prisma's migration ledger, so `prisma migrate deploy` is a no-op
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `_prisma_migrations` (
  `id` varchar(36) NOT NULL,
  `checksum` varchar(64) NOT NULL,
  `finished_at` datetime(3) DEFAULT NULL,
  `migration_name` varchar(255) NOT NULL,
  `logs` text DEFAULT NULL,
  `rolled_back_at` datetime(3) DEFAULT NULL,
  `started_at` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `applied_steps_count` int(10) unsigned NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
INSERT IGNORE INTO `_prisma_migrations` (`id`, `checksum`, `finished_at`, `migration_name`, `logs`, `rolled_back_at`, `started_at`, `applied_steps_count`) VALUES ('19ada72f-12c2-4a02-a0ab-494dcd048cca','fffd6c37b011057af75ad5b74eeb71457870ed5fea7095a1529a53972fbb1b2a','2026-10-03 13:50:59.670','20260922120000_member_languages',NULL,NULL,'2026-10-03 13:50:59.666',1),
('3dda1024-4244-4af4-b1c9-8368a9fe33fa','c82675ee4126d590035b047acd84502263f41828cbe5b8711bc3436e1e302f9b','2026-10-03 13:50:59.666','20260911150000_member_invitations_and_join_direction',NULL,NULL,'2026-10-03 13:50:59.653',1),
('ae9d992a-acc4-46f2-b9a2-ce654a254855','3393bb854009c34425203e8ddfed958a61e07e0ac2003610ff5514535dd68991','2026-10-03 13:50:59.701','20261003120000_member_profile_details',NULL,NULL,'2026-10-03 13:50:59.670',1),
('c97ca3d7-d250-4e82-be65-cbaf0cbd1547','584c8fab176b065f3aedbdf8d0012d17cbc1ab48026c15c30caeaf85f667372d','2026-10-03 13:50:59.653','20260910163143_init',NULL,NULL,'2026-10-03 13:50:59.239',1);

