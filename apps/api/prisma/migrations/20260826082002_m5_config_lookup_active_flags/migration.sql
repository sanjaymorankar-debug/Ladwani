-- AlterTable
ALTER TABLE `areas` ADD COLUMN `is_active` BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE `asset_categories` ADD COLUMN `is_active` BOOLEAN NOT NULL DEFAULT true;
