-- P4 follow-up: community groups can be copied into local organisations.
-- The link back to the group makes the copy idempotent and undoable.
ALTER TABLE `organisations` ADD COLUMN `sourceGroupId` VARCHAR(191) NULL;
CREATE UNIQUE INDEX `organisations_sourceGroupId_key` ON `organisations`(`sourceGroupId`);
