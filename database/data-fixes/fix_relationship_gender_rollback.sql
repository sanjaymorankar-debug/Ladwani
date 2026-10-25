-- P3 data fix, ROLLBACK: puts every row the apply script changed back to its
-- old type and active flag, from zz_fix_relationship_gender_backup, then drops
-- that table. Once you are happy with the fix, you may instead just drop the
-- table:  DROP TABLE `zz_fix_relationship_gender_backup`;
UPDATE member_relationships mr
  JOIN `zz_fix_relationship_gender_backup` b ON b.relationshipId = mr.id
   SET mr.relationshipTypeId = b.oldTypeId, mr.isActive = b.oldIsActive, mr.updatedAt = CURRENT_TIMESTAMP(3);

DROP TABLE `zz_fix_relationship_gender_backup`;
