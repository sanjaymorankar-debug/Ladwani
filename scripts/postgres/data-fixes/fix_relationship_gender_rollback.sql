-- P3 data fix (PostgreSQL), ROLLBACK: puts every row the apply script changed
-- back to its old type and active flag, from zz_fix_relationship_gender_backup,
-- then drops that table. One transaction. Once you are happy with the fix,
-- you may instead just drop the table:
--   DROP TABLE "zz_fix_relationship_gender_backup";
BEGIN;

UPDATE "member_relationships" mr
   SET "relationshipTypeId" = b."oldTypeId", "isActive" = b."oldIsActive", "updatedAt" = CURRENT_TIMESTAMP
  FROM "zz_fix_relationship_gender_backup" b
 WHERE b."relationshipId" = mr."id";

DROP TABLE "zz_fix_relationship_gender_backup";

COMMIT;
