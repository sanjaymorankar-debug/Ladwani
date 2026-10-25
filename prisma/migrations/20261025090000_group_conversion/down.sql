-- Manual rollback for 20261025090000_group_conversion (then delete its
-- _prisma_migrations row). Undo the conversion first (Admin → Settings →
-- Convert groups → Undo), or the copied organisations stay without their link.
DROP INDEX `organisations_sourceGroupId_key` ON `organisations`;
ALTER TABLE `organisations` DROP COLUMN `sourceGroupId`;
