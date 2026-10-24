-- Owner's P4 decisions (follow-up):
--   * a local organisation sits at taluka level and records its start date
--     and town (organisations.areaId now holds the taluka for LOCAL);
--   * the three office roles at every level are President, Secretary and
--     Chairman: Chairman replaces Treasurer.
-- Additive columns, plus a rename of the designation value in the
-- organisation tables added by this same PR (organisation_members only;
-- community groups are not touched). Rollback: down.sql in this folder.
ALTER TABLE `organisations`
    ADD COLUMN `startedOn` DATETIME(3) NULL,
    ADD COLUMN `town` VARCHAR(191) NULL;

UPDATE `organisation_members` SET `designation` = 'CHAIRMAN' WHERE `designation` = 'TREASURER';
UPDATE `organisation_members` SET `pendingDesignation` = 'CHAIRMAN' WHERE `pendingDesignation` = 'TREASURER';
