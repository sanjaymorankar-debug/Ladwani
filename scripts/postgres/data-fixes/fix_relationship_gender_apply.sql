-- P3 data fix (PostgreSQL), APPLY. Run fix_relationship_gender_preview.sql
-- first, and on the TEST branch first. One transaction: all or nothing.
-- Every row changed is first copied to zz_fix_relationship_gender_backup
-- (its old type and active flag), so fix_relationship_gender_rollback.sql can
-- put it back exactly. Safe to run twice: a row already fixed is skipped.
-- Nothing is deleted. A wrong row whose correct twin already exists is
-- switched off ("isActive" = false) instead of retyped.
BEGIN;

CREATE TABLE IF NOT EXISTS "zz_fix_relationship_gender_backup" (
  "relationshipId" TEXT PRIMARY KEY,
  "fromMemberId"   TEXT NOT NULL,
  "toMemberId"     TEXT NOT NULL,
  "oldTypeId"      TEXT NOT NULL,
  "newTypeId"      TEXT NOT NULL,
  "oldIsActive"    BOOLEAN NOT NULL,
  "action"         TEXT NOT NULL,
  "fixedAt"        TIMESTAMP(3) NOT NULL
);

WITH pairs(male_code, female_code) AS (VALUES ('father', 'mother'), ('son', 'daughter'), ('brother', 'sister'), ('husband', 'wife'),
    ('grandfather_p', 'grandmother_p'), ('grandfather_m', 'grandmother_m'),
    ('great_grandfather_p', 'great_grandmother_p'), ('great_grandfather_m', 'great_grandmother_m'),
    ('grandson', 'granddaughter'), ('grandson_sons_son', 'granddaughter_sons_daughter'),
    ('grandson_daughters_son', 'granddaughter_daughters_daughter'),
    ('uncle', 'aunt'), ('nephew', 'niece'), ('nephew_brothers', 'niece_brothers'), ('nephew_sisters', 'niece_sisters'),
    ('father_in_law', 'mother_in_law'), ('son_in_law', 'daughter_in_law'),
    ('husbands_brother', 'husbands_sister'), ('wifes_brother', 'wifes_sister'))
INSERT INTO "zz_fix_relationship_gender_backup" ("relationshipId", "fromMemberId", "toMemberId", "oldTypeId", "newTypeId", "oldIsActive", "action", "fixedAt")
SELECT mr."id", mr."fromMemberId", mr."toMemberId", mr."relationshipTypeId", nt."id", mr."isActive",
       CASE WHEN EXISTS (SELECT 1 FROM "member_relationships" x WHERE x."fromMemberId" = mr."fromMemberId" AND x."toMemberId" = mr."toMemberId" AND x."relationshipTypeId" = nt."id") THEN 'DEACTIVATE' ELSE 'RETYPE' END,
       CURRENT_TIMESTAMP
  FROM "member_relationships" mr
  JOIN "relationship_types" rt ON rt."id" = mr."relationshipTypeId"
  JOIN "members" fm ON fm."id" = mr."fromMemberId"
  JOIN pairs p ON (rt."code" = p.male_code AND fm."gender" = 'FEMALE') OR (rt."code" = p.female_code AND fm."gender" = 'MALE')
  JOIN "relationship_types" nt ON nt."code" = CASE WHEN fm."gender" = 'FEMALE' THEN p.female_code ELSE p.male_code END
ON CONFLICT ("relationshipId") DO NOTHING;

UPDATE "member_relationships" mr
   SET "relationshipTypeId" = b."newTypeId", "updatedAt" = CURRENT_TIMESTAMP
  FROM "zz_fix_relationship_gender_backup" b
 WHERE b."relationshipId" = mr."id" AND b."action" = 'RETYPE' AND mr."relationshipTypeId" = b."oldTypeId";

UPDATE "member_relationships" mr
   SET "isActive" = false, "updatedAt" = CURRENT_TIMESTAMP
  FROM "zz_fix_relationship_gender_backup" b
 WHERE b."relationshipId" = mr."id" AND b."action" = 'DEACTIVATE' AND mr."isActive";

COMMIT;

-- What was done:
SELECT "action", COUNT(*) AS rows FROM "zz_fix_relationship_gender_backup" GROUP BY "action";
