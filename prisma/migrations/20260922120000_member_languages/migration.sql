-- AlterTable: languages a member speaks (JSON array of strings), spec section 15.
ALTER TABLE `members` ADD COLUMN `languages` JSON NULL;
