-- P4 organisations and LadWani bodies (F26–F31). Additive only:
--   * organisations — social organisations and the LadWani District / State /
--     National bodies (one body per area: unique bodyKey).
--   * organisation_members — designation per person; the STORED generated
--     column officeGuard + unique(organisationId, officeGuard) lets the
--     database allow only one active President, Secretary and Treasurer.
--   * body_seats — nominations up the chain (2 per unit, enforced in code).
--   * approval_tasks.organisationId — F26 uses the P1 two-operator round.
--   * user_roles.bodySeatId — a data-view role granted by a body seat (F30),
--     removed with the seat (F31).
-- The existing community_groups (mandals) are not touched.
-- Rollback: down.sql in this folder.

-- AlterTable
ALTER TABLE `approval_tasks` ADD COLUMN `organisationId` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `user_roles` ADD COLUMN `bodySeatId` VARCHAR(191) NULL;

-- CreateTable
CREATE TABLE `organisations` (
    `id` VARCHAR(191) NOT NULL,
    `kind` VARCHAR(191) NOT NULL DEFAULT 'LOCAL',
    `name` VARCHAR(191) NOT NULL,
    `registrationNumber` VARCHAR(191) NULL,
    `addressLine` TEXT NULL,
    `areaId` VARCHAR(191) NULL,
    `purpose` TEXT NULL,
    `certificateKey` VARCHAR(191) NULL,
    `certificateMime` VARCHAR(191) NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'PENDING_APPROVAL',
    `approvedAt` DATETIME(3) NULL,
    `decisionNote` TEXT NULL,
    `applicantUserId` VARCHAR(191) NULL,
    `bodyKey` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `organisations_bodyKey_key`(`bodyKey`),
    INDEX `organisations_kind_status_idx`(`kind`, `status`),
    INDEX `organisations_areaId_idx`(`areaId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `organisation_members` (
    `id` VARCHAR(191) NOT NULL,
    `organisationId` VARCHAR(191) NOT NULL,
    `memberId` VARCHAR(191) NOT NULL,
    `designation` VARCHAR(191) NOT NULL DEFAULT 'MEMBER',
    `pendingDesignation` VARCHAR(191) NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'ACTIVE',
    `termStart` DATETIME(3) NULL,
    `termEnd` DATETIME(3) NULL,
    `seatId` VARCHAR(191) NULL,
    `invitedBy` VARCHAR(191) NULL,
    `joinedAt` DATETIME(3) NULL,
    `endedAt` DATETIME(3) NULL,
    `endReason` VARCHAR(191) NULL,
    `officeGuard` VARCHAR(191) GENERATED ALWAYS AS (IF(`status` = 'ACTIVE' AND `designation` <> 'MEMBER', `designation`, NULL)) STORED,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `organisation_members_memberId_status_idx`(`memberId`, `status`),
    UNIQUE INDEX `organisation_members_organisationId_memberId_key`(`organisationId`, `memberId`),
    UNIQUE INDEX `organisation_members_organisationId_officeGuard_key`(`organisationId`, `officeGuard`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `body_seats` (
    `id` VARCHAR(191) NOT NULL,
    `fromOrganisationId` VARCHAR(191) NOT NULL,
    `toOrganisationId` VARCHAR(191) NOT NULL,
    `memberId` VARCHAR(191) NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'NOMINATED',
    `nominatedBy` VARCHAR(191) NOT NULL,
    `acceptedAt` DATETIME(3) NULL,
    `confirmedBy` VARCHAR(191) NULL,
    `confirmedAt` DATETIME(3) NULL,
    `endedAt` DATETIME(3) NULL,
    `endReason` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `body_seats_fromOrganisationId_status_idx`(`fromOrganisationId`, `status`),
    INDEX `body_seats_toOrganisationId_status_idx`(`toOrganisationId`, `status`),
    INDEX `body_seats_memberId_status_idx`(`memberId`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

