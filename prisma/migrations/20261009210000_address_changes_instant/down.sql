-- Manual rollback for 20261009210000_address_changes_instant (then delete
-- its _prisma_migrations row): address changes by verified members go to a
-- reviewer again (§28).
UPDATE `approval_rules` SET `requiresApproval` = true, `updatedAt` = CURRENT_TIMESTAMP(3) WHERE `actionCode` = 'member.address.change';
