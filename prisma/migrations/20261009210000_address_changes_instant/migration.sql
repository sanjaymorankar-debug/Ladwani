-- Owner's decision (P1 follow-up, F08): address changes by verified members
-- save instantly, as the workbook says, instead of going to a reviewer (§28).
-- Changes one approval rule; no member data is touched. Address requests
-- already waiting stay in the queue and can still be decided; a member's
-- next direct change to that address closes their own waiting request.
-- Rollback: down.sql in this folder.
INSERT IGNORE INTO `approval_rules` (`id`, `actionCode`, `requiresApproval`, `approverRole`, `isActive`, `updatedAt`) VALUES
  ('rule-member-address-change', 'member.address.change', false, 'OPERATOR', true, CURRENT_TIMESTAMP(3));
UPDATE `approval_rules` SET `requiresApproval` = false, `updatedAt` = CURRENT_TIMESTAMP(3) WHERE `actionCode` = 'member.address.change';
