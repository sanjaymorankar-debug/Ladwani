-- P3 family tree and cross-family links (F19–F25). Additive only:
--   * family_join_requests.origin — MEMBER (default, every existing row) or
--     MARRIAGE (F23: created automatically when a spouse is linked).
--   * tree_link_requests (F22) — "this person in our tree is that person in
--     yours"; merged into one record on acceptance.
--   * Setting tree.ancestor_levels = 3 (OP-02: the brief says "2 levels up"
--     but lists great-grandparents; change the setting if OP-02 says 2).
-- No backfill. Rollback: down.sql in this folder.

-- AlterTable
ALTER TABLE `family_join_requests` ADD COLUMN `origin` VARCHAR(191) NOT NULL DEFAULT 'MEMBER';

-- CreateTable
CREATE TABLE `tree_link_requests` (
    `id` VARCHAR(191) NOT NULL,
    `fromFamilyId` VARCHAR(191) NOT NULL,
    `fromMemberId` VARCHAR(191) NOT NULL,
    `toFamilyId` VARCHAR(191) NOT NULL,
    `toMemberId` VARCHAR(191) NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'PENDING',
    `conflicts` JSON NULL,
    `proposedResolution` JSON NULL,
    `resolution` JSON NULL,
    `note` TEXT NULL,
    `reason` TEXT NULL,
    `requestedBy` VARCHAR(191) NOT NULL,
    `decidedBy` VARCHAR(191) NULL,
    `decidedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `tree_link_requests_toFamilyId_status_idx`(`toFamilyId`, `status`),
    INDEX `tree_link_requests_fromFamilyId_status_idx`(`fromFamilyId`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;


-- OP-02 tree depth (generations above the Karta), configurable by Admin.
INSERT IGNORE INTO `settings` (`id`, `key`, `value`, `description`, `updatedAt`) VALUES
  ('setting-tree-ancestor-levels', 'tree.ancestor_levels', '3', 'Generations of ancestors above the Karta the tree builder allows (F19, OP-02)', CURRENT_TIMESTAMP(3));
