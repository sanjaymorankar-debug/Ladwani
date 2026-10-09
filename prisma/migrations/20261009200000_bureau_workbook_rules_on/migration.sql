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
