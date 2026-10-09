-- Manual rollback for 20261009170000_p4_organisations (then delete its
-- _prisma_migrations row). Loses: organisations, their members and body
-- seats, and the data-view roles granted by seats (removed first).
DELETE FROM `user_roles` WHERE `bodySeatId` IS NOT NULL;
DELETE FROM `approval_tasks` WHERE `organisationId` IS NOT NULL;
DROP TABLE IF EXISTS `body_seats`;
DROP TABLE IF EXISTS `organisation_members`;
DROP TABLE IF EXISTS `organisations`;
ALTER TABLE `user_roles` DROP COLUMN `bodySeatId`;
ALTER TABLE `approval_tasks` DROP COLUMN `organisationId`;
