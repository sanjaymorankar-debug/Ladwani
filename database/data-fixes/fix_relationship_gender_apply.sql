-- P3 data fix, APPLY. Run fix_relationship_gender_preview.sql first, and on TEST first.
-- Every row changed is first copied to zz_fix_relationship_gender_backup
-- (its old type and active flag), so fix_relationship_gender_rollback.sql can
-- put it back exactly. Safe to run twice: a row already fixed is skipped.
-- Nothing is deleted. A wrong row whose correct twin already exists is
-- switched off (isActive = false) instead of retyped.

CREATE TABLE IF NOT EXISTS `zz_fix_relationship_gender_backup` (
  `relationshipId` VARCHAR(191) NOT NULL PRIMARY KEY,
  `fromMemberId` VARCHAR(191) NOT NULL,
  `toMemberId` VARCHAR(191) NOT NULL,
  `oldTypeId` VARCHAR(191) NOT NULL,
  `newTypeId` VARCHAR(191) NOT NULL,
  `oldIsActive` BOOLEAN NOT NULL,
  `action` VARCHAR(16) NOT NULL,
  `fixedAt` DATETIME(3) NOT NULL
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

INSERT INTO `zz_fix_relationship_gender_backup` (`relationshipId`, `fromMemberId`, `toMemberId`, `oldTypeId`, `newTypeId`, `oldIsActive`, `action`, `fixedAt`)
SELECT mr.id, mr.fromMemberId, mr.toMemberId, mr.relationshipTypeId, nt.id, mr.isActive,
       CASE WHEN EXISTS (SELECT 1 FROM member_relationships x WHERE x.fromMemberId = mr.fromMemberId AND x.toMemberId = mr.toMemberId AND x.relationshipTypeId = nt.id) THEN 'DEACTIVATE' ELSE 'RETYPE' END,
       CURRENT_TIMESTAMP(3)
  FROM member_relationships mr
  JOIN relationship_types rt ON rt.id = mr.relationshipTypeId
  JOIN members fm ON fm.id = mr.fromMemberId
  JOIN (SELECT 'father' AS male_code, 'mother' AS female_code UNION ALL SELECT 'son', 'daughter' UNION ALL SELECT 'brother', 'sister' UNION ALL SELECT 'husband', 'wife'
    UNION ALL SELECT 'grandfather_p', 'grandmother_p' UNION ALL SELECT 'grandfather_m', 'grandmother_m'
    UNION ALL SELECT 'great_grandfather_p', 'great_grandmother_p' UNION ALL SELECT 'great_grandfather_m', 'great_grandmother_m'
    UNION ALL SELECT 'grandson', 'granddaughter' UNION ALL SELECT 'grandson_sons_son', 'granddaughter_sons_daughter'
    UNION ALL SELECT 'grandson_daughters_son', 'granddaughter_daughters_daughter'
    UNION ALL SELECT 'uncle', 'aunt' UNION ALL SELECT 'nephew', 'niece' UNION ALL SELECT 'nephew_brothers', 'niece_brothers' UNION ALL SELECT 'nephew_sisters', 'niece_sisters'
    UNION ALL SELECT 'father_in_law', 'mother_in_law' UNION ALL SELECT 'son_in_law', 'daughter_in_law'
    UNION ALL SELECT 'husbands_brother', 'husbands_sister' UNION ALL SELECT 'wifes_brother', 'wifes_sister') p ON (rt.code = p.male_code AND fm.gender = 'FEMALE') OR (rt.code = p.female_code AND fm.gender = 'MALE')
  JOIN relationship_types nt ON nt.code = CASE WHEN fm.gender = 'FEMALE' THEN p.female_code ELSE p.male_code END
 WHERE mr.id NOT IN (SELECT b.relationshipId FROM `zz_fix_relationship_gender_backup` b);

UPDATE member_relationships mr
  JOIN `zz_fix_relationship_gender_backup` b ON b.relationshipId = mr.id
   SET mr.relationshipTypeId = b.newTypeId, mr.updatedAt = CURRENT_TIMESTAMP(3)
 WHERE b.action = 'RETYPE' AND mr.relationshipTypeId = b.oldTypeId;

UPDATE member_relationships mr
  JOIN `zz_fix_relationship_gender_backup` b ON b.relationshipId = mr.id
   SET mr.isActive = false, mr.updatedAt = CURRENT_TIMESTAMP(3)
 WHERE b.action = 'DEACTIVATE' AND mr.isActive = true;

-- What was done:
SELECT action, COUNT(*) AS `rows` FROM `zz_fix_relationship_gender_backup` GROUP BY action;
