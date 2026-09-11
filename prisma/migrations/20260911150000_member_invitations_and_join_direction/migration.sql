-- AlterTable: which way a family join request points (see schema comment).
ALTER TABLE `family_join_requests` ADD COLUMN `direction` VARCHAR(191) NOT NULL DEFAULT 'MEMBER_REQUEST';

-- Order matters on MySQL: the old unique index is the supporting index for
-- the familyId foreign key, so it cannot be dropped while it's the only one
-- covering that column. Create the replacement first — it also leads with
-- familyId, so it takes over as the FK's supporting index — then drop the old.
-- CreateIndex
CREATE UNIQUE INDEX `family_join_requests_familyId_memberId_status_direction_key` ON `family_join_requests`(`familyId`, `memberId`, `status`, `direction`);

-- DropIndex
DROP INDEX `family_join_requests_familyId_memberId_status_key` ON `family_join_requests`;

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

-- AddForeignKey
ALTER TABLE `member_invitations` ADD CONSTRAINT `member_invitations_memberId_fkey` FOREIGN KEY (`memberId`) REFERENCES `members`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
