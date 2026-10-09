-- Manual rollback for 20261009200000_bureau_workbook_rules_on (then delete
-- its _prisma_migrations row): back to the earlier bureau rules.
UPDATE `settings` SET `value` = 'false', `updatedAt` = CURRENT_TIMESTAMP(3) WHERE `key` = 'bureau.workbook_rules';
