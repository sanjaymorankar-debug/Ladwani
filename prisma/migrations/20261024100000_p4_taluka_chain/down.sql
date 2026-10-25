-- Manual rollback for 20261024100000_p4_taluka_chain (then delete its
-- _prisma_migrations row): Chairman back to Treasurer, drop the new columns.
UPDATE `organisation_members` SET `pendingDesignation` = 'TREASURER' WHERE `pendingDesignation` = 'CHAIRMAN';
UPDATE `organisation_members` SET `designation` = 'TREASURER' WHERE `designation` = 'CHAIRMAN';
ALTER TABLE `organisations` DROP COLUMN `town`, DROP COLUMN `startedOn`;
