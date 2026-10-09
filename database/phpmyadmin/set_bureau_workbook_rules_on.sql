-- Marriage bureau: switch on the workbook rules (prisma migration 20261009200000_bureau_workbook_rules_on).
-- One setting; no member data changes. Import after add_p6_data_rights.sql.
-- Rollback: prisma/migrations/20261009200000_bureau_workbook_rules_on/down.sql.

-- Owner's decision (P5 follow-up): switch the marriage bureau to the
-- workbook rules — only Unmarried AND earning members (legal age 18 F / 21 M)
-- may list, and only listed members and their Karta may browse and send
-- interests (F37, F38). Changes one setting; no member data is touched.
-- Listings that no longer qualify stay switched on but are hidden from search
-- until the member qualifies (or the setting is switched back).
-- Rollback: down.sql in this folder.
INSERT IGNORE INTO `settings` (`id`, `key`, `value`, `description`, `updatedAt`) VALUES
  ('setting-bureau-workbook-rules', 'bureau.workbook_rules', 'true', 'Marriage bureau: only Unmarried + earning may list, only listed users and their Karta may browse (F37, F38). Off = previous behaviour.', CURRENT_TIMESTAMP(3));
UPDATE `settings` SET `value` = 'true', `updatedAt` = CURRENT_TIMESTAMP(3) WHERE `key` = 'bureau.workbook_rules';

-- Record the migration as applied, so a later `prisma migrate deploy` skips it.
INSERT IGNORE INTO `_prisma_migrations` (`id`, `checksum`, `finished_at`, `migration_name`, `logs`, `rolled_back_at`, `started_at`, `applied_steps_count`) VALUES
  ('20261009-p5b-0000-0000-000000000000', '6f674f770e2791c2ad4a527ffb7c3c386d3cf3de2a7ad3a0d2058546757c38af', CURRENT_TIMESTAMP(3), '20261009200000_bureau_workbook_rules_on', NULL, NULL, CURRENT_TIMESTAMP(3), 1);
