-- Manual rollback for 20261009150000_p2_family_karta (then delete its
-- _prisma_migrations row). Loses: membership roles / statuses, Karta
-- transfers, profile claims, the added relationship types (only those not
-- referenced by a relationship row), and KARTA_VACANT (parked as ACTIVE).
DELETE FROM `settings` WHERE `key` = 'family.join_request_expiry_days';
DROP TABLE IF EXISTS `profile_claims`;
DROP TABLE IF EXISTS `karta_transfers`;
DELETE rt FROM `relationship_types` rt LEFT JOIN `member_relationships` mr ON mr.`relationshipTypeId` = rt.`id`
  WHERE rt.`id` LIKE 'rel-%' AND mr.`id` IS NULL;
ALTER TABLE `relationship_types` DROP COLUMN `generation`, DROP COLUMN `linkType`, DROP COLUMN `localName`, DROP COLUMN `side`;
-- The old unique index cannot be restored while two requests share
-- (familyId, memberId, status, direction) — e.g. a person rejected twice. Find them with
--   SELECT familyId, memberId, status, direction, COUNT(*) FROM family_join_requests
--   GROUP BY familyId, memberId, status, direction HAVING COUNT(*) > 1;
-- and decide (with the owner) which older rows to remove before running the next line.
CREATE UNIQUE INDEX `family_join_requests_familyId_memberId_status_direction_key` ON `family_join_requests`(`familyId`, `memberId`, `status`, `direction`);
DROP INDEX `family_join_requests_familyId_memberId_status_idx` ON `family_join_requests`;
UPDATE `families` SET `status` = 'ACTIVE' WHERE `status` = 'KARTA_VACANT';
ALTER TABLE `families` MODIFY `status` ENUM('PENDING', 'ACTIVE', 'INACTIVE', 'MERGED', 'ARCHIVED') NOT NULL DEFAULT 'PENDING';
DROP INDEX `family_members_familyId_kartaGuard_key` ON `family_members`;
ALTER TABLE `family_members` DROP COLUMN `kartaGuard`,
  DROP COLUMN `relationshipRole`, DROP COLUMN `relativeToMemberId`, DROP COLUMN `status`;
