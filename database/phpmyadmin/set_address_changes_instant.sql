-- Address changes by verified members save instantly (prisma migration 20261009210000_address_changes_instant).
-- One approval rule; no member data changes. Import after set_bureau_workbook_rules_on.sql.
-- Rollback: prisma/migrations/20261009210000_address_changes_instant/down.sql.

-- Owner's decision (P1 follow-up, F08): address changes by verified members
-- save instantly, as the workbook says, instead of going to a reviewer (§28).
-- Changes one approval rule; no member data is touched. Address requests
-- already waiting stay in the queue and can still be decided; a member's
-- next direct change to that address closes their own waiting request.
-- Rollback: down.sql in this folder.
INSERT IGNORE INTO `approval_rules` (`id`, `actionCode`, `requiresApproval`, `approverRole`, `isActive`, `updatedAt`) VALUES
  ('rule-member-address-change', 'member.address.change', false, 'OPERATOR', true, CURRENT_TIMESTAMP(3));
UPDATE `approval_rules` SET `requiresApproval` = false, `updatedAt` = CURRENT_TIMESTAMP(3) WHERE `actionCode` = 'member.address.change';

-- Record the migration as applied, so a later `prisma migrate deploy` skips it.
INSERT IGNORE INTO `_prisma_migrations` (`id`, `checksum`, `finished_at`, `migration_name`, `logs`, `rolled_back_at`, `started_at`, `applied_steps_count`) VALUES
  ('20261009-p1b-0000-0000-000000000000', '475f4f4c81369e707fcca3201f277e800e6f7d52da948eebf7accfe0c2a539da', CURRENT_TIMESTAMP(3), '20261009210000_address_changes_instant', NULL, NULL, CURRENT_TIMESTAMP(3), 1);
