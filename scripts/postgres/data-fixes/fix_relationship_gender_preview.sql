-- P3 data fix (PostgreSQL), PREVIEW ONLY: changes nothing. Owner's decision:
-- correct existing relationship rows whose type does not fit the person's gender.
-- Cause: before P3 the inverse link was always the master's single inverse,
-- so a daughter added relative to her mother stored "mother is FATHER of".
-- A row reads "fromMember is <type> of toMember"; the type must fit fromMember.
-- Run on the TEST branch first (psql or the Neon SQL editor). Then
-- fix_relationship_gender_apply.sql; undo with fix_relationship_gender_rollback.sql.

-- 1. Rows the apply script will correct (RETYPE), or switch off because the
--    correct row already exists (DEACTIVATE).
WITH pairs(male_code, female_code) AS (VALUES ('father', 'mother'), ('son', 'daughter'), ('brother', 'sister'), ('husband', 'wife'),
    ('grandfather_p', 'grandmother_p'), ('grandfather_m', 'grandmother_m'),
    ('great_grandfather_p', 'great_grandmother_p'), ('great_grandfather_m', 'great_grandmother_m'),
    ('grandson', 'granddaughter'), ('grandson_sons_son', 'granddaughter_sons_daughter'),
    ('grandson_daughters_son', 'granddaughter_daughters_daughter'),
    ('uncle', 'aunt'), ('nephew', 'niece'), ('nephew_brothers', 'niece_brothers'), ('nephew_sisters', 'niece_sisters'),
    ('father_in_law', 'mother_in_law'), ('son_in_law', 'daughter_in_law'),
    ('husbands_brother', 'husbands_sister'), ('wifes_brother', 'wifes_sister'))
SELECT mr."id", concat_ws(' ', fm."firstName", fm."lastName") AS person, fm."gender",
       rt."code" AS recorded_as, nt."code" AS corrected_to,
       concat_ws(' ', tm."firstName", tm."lastName") AS of_person,
       CASE WHEN EXISTS (SELECT 1 FROM "member_relationships" x WHERE x."fromMemberId" = mr."fromMemberId" AND x."toMemberId" = mr."toMemberId" AND x."relationshipTypeId" = nt."id") THEN 'DEACTIVATE' ELSE 'RETYPE' END AS action
  FROM "member_relationships" mr
  JOIN "relationship_types" rt ON rt."id" = mr."relationshipTypeId"
  JOIN "members" fm ON fm."id" = mr."fromMemberId"
  JOIN "members" tm ON tm."id" = mr."toMemberId"
  JOIN pairs p ON (rt."code" = p.male_code AND fm."gender" = 'FEMALE') OR (rt."code" = p.female_code AND fm."gender" = 'MALE')
  JOIN "relationship_types" nt ON nt."code" = CASE WHEN fm."gender" = 'FEMALE' THEN p.female_code ELSE p.male_code END
 ORDER BY person;

-- 2. Mismatches the scripts do NOT change (no gender counterpart in the
--    master, e.g. "father's elder brother"): a person decides each one.
WITH pairs(male_code, female_code) AS (VALUES ('father', 'mother'), ('son', 'daughter'), ('brother', 'sister'), ('husband', 'wife'),
    ('grandfather_p', 'grandmother_p'), ('grandfather_m', 'grandmother_m'),
    ('great_grandfather_p', 'great_grandmother_p'), ('great_grandfather_m', 'great_grandmother_m'),
    ('grandson', 'granddaughter'), ('grandson_sons_son', 'granddaughter_sons_daughter'),
    ('grandson_daughters_son', 'granddaughter_daughters_daughter'),
    ('uncle', 'aunt'), ('nephew', 'niece'), ('nephew_brothers', 'niece_brothers'), ('nephew_sisters', 'niece_sisters'),
    ('father_in_law', 'mother_in_law'), ('son_in_law', 'daughter_in_law'),
    ('husbands_brother', 'husbands_sister'), ('wifes_brother', 'wifes_sister'))
SELECT mr."id", concat_ws(' ', fm."firstName", fm."lastName") AS person, fm."gender", rt."code" AS recorded_as
  FROM "member_relationships" mr
  JOIN "relationship_types" rt ON rt."id" = mr."relationshipTypeId"
  JOIN "members" fm ON fm."id" = mr."fromMemberId"
 WHERE ((rt."genderApplicable" = 'MALE' AND fm."gender" = 'FEMALE') OR (rt."genderApplicable" = 'FEMALE' AND fm."gender" = 'MALE'))
   AND rt."code" NOT IN (SELECT male_code FROM pairs UNION SELECT female_code FROM pairs);

-- 3. Family roles (family_members.relationshipRole) that do not fit the
--    person's gender. Not changed by these scripts; listed for the Karta / an Operator (F18).
SELECT fmb."id", f."name" AS family, concat_ws(' ', m."firstName", m."lastName") AS person, m."gender", fmb."relationshipRole"
  FROM "family_members" fmb
  JOIN "families" f ON f."id" = fmb."familyId"
  JOIN "members" m ON m."id" = fmb."memberId"
  JOIN "relationship_types" rt ON rt."code" = fmb."relationshipRole"
 WHERE fmb."leftAt" IS NULL
   AND ((rt."genderApplicable" = 'MALE' AND m."gender" = 'FEMALE') OR (rt."genderApplicable" = 'FEMALE' AND m."gender" = 'MALE'));
