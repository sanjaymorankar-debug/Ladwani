-- P3 data fix, PREVIEW ONLY (changes nothing). Owner's decision: correct
-- existing relationship rows whose type does not fit the person's gender.
-- Cause: before P3 the inverse link was always the master's single inverse,
-- so a daughter added relative to her mother stored "mother is FATHER of".
-- A row reads "fromMember is <type> of toMember"; the type must fit fromMember.
-- Run on TEST first. Then fix_relationship_gender_apply.sql; undo with
-- fix_relationship_gender_rollback.sql.

-- 1. Rows the apply script will correct (RETYPE), or switch off because the
--    correct row already exists (DEACTIVATE).
SELECT mr.id, CONCAT(fm.firstName, ' ', COALESCE(fm.lastName, '')) AS person, fm.gender,
       rt.code AS recorded_as, nt.code AS corrected_to,
       CONCAT(tm.firstName, ' ', COALESCE(tm.lastName, '')) AS of_person,
       CASE WHEN EXISTS (SELECT 1 FROM member_relationships x WHERE x.fromMemberId = mr.fromMemberId AND x.toMemberId = mr.toMemberId AND x.relationshipTypeId = nt.id) THEN 'DEACTIVATE' ELSE 'RETYPE' END AS action
  FROM member_relationships mr
  JOIN relationship_types rt ON rt.id = mr.relationshipTypeId
  JOIN members fm ON fm.id = mr.fromMemberId
  JOIN members tm ON tm.id = mr.toMemberId
  JOIN (SELECT 'father' AS male_code, 'mother' AS female_code UNION ALL SELECT 'son', 'daughter' UNION ALL SELECT 'brother', 'sister' UNION ALL SELECT 'husband', 'wife'
    UNION ALL SELECT 'grandfather_p', 'grandmother_p' UNION ALL SELECT 'grandfather_m', 'grandmother_m'
    UNION ALL SELECT 'great_grandfather_p', 'great_grandmother_p' UNION ALL SELECT 'great_grandfather_m', 'great_grandmother_m'
    UNION ALL SELECT 'grandson', 'granddaughter' UNION ALL SELECT 'grandson_sons_son', 'granddaughter_sons_daughter'
    UNION ALL SELECT 'grandson_daughters_son', 'granddaughter_daughters_daughter'
    UNION ALL SELECT 'uncle', 'aunt' UNION ALL SELECT 'nephew', 'niece' UNION ALL SELECT 'nephew_brothers', 'niece_brothers' UNION ALL SELECT 'nephew_sisters', 'niece_sisters'
    UNION ALL SELECT 'father_in_law', 'mother_in_law' UNION ALL SELECT 'son_in_law', 'daughter_in_law'
    UNION ALL SELECT 'husbands_brother', 'husbands_sister' UNION ALL SELECT 'wifes_brother', 'wifes_sister') p ON (rt.code = p.male_code AND fm.gender = 'FEMALE') OR (rt.code = p.female_code AND fm.gender = 'MALE')
  JOIN relationship_types nt ON nt.code = CASE WHEN fm.gender = 'FEMALE' THEN p.female_code ELSE p.male_code END
 ORDER BY person;

-- 2. Mismatches the scripts do NOT change (no gender counterpart in the
--    master, e.g. "father's elder brother"): a person decides each one.
SELECT mr.id, CONCAT(fm.firstName, ' ', COALESCE(fm.lastName, '')) AS person, fm.gender, rt.code AS recorded_as
  FROM member_relationships mr
  JOIN relationship_types rt ON rt.id = mr.relationshipTypeId
  JOIN members fm ON fm.id = mr.fromMemberId
 WHERE ((rt.genderApplicable = 'MALE' AND fm.gender = 'FEMALE') OR (rt.genderApplicable = 'FEMALE' AND fm.gender = 'MALE'))
   AND rt.code NOT IN (SELECT male_code FROM (SELECT 'father' AS male_code, 'mother' AS female_code UNION ALL SELECT 'son', 'daughter' UNION ALL SELECT 'brother', 'sister' UNION ALL SELECT 'husband', 'wife'
    UNION ALL SELECT 'grandfather_p', 'grandmother_p' UNION ALL SELECT 'grandfather_m', 'grandmother_m'
    UNION ALL SELECT 'great_grandfather_p', 'great_grandmother_p' UNION ALL SELECT 'great_grandfather_m', 'great_grandmother_m'
    UNION ALL SELECT 'grandson', 'granddaughter' UNION ALL SELECT 'grandson_sons_son', 'granddaughter_sons_daughter'
    UNION ALL SELECT 'grandson_daughters_son', 'granddaughter_daughters_daughter'
    UNION ALL SELECT 'uncle', 'aunt' UNION ALL SELECT 'nephew', 'niece' UNION ALL SELECT 'nephew_brothers', 'niece_brothers' UNION ALL SELECT 'nephew_sisters', 'niece_sisters'
    UNION ALL SELECT 'father_in_law', 'mother_in_law' UNION ALL SELECT 'son_in_law', 'daughter_in_law'
    UNION ALL SELECT 'husbands_brother', 'husbands_sister' UNION ALL SELECT 'wifes_brother', 'wifes_sister') p1 UNION SELECT female_code FROM (SELECT 'father' AS male_code, 'mother' AS female_code UNION ALL SELECT 'son', 'daughter' UNION ALL SELECT 'brother', 'sister' UNION ALL SELECT 'husband', 'wife'
    UNION ALL SELECT 'grandfather_p', 'grandmother_p' UNION ALL SELECT 'grandfather_m', 'grandmother_m'
    UNION ALL SELECT 'great_grandfather_p', 'great_grandmother_p' UNION ALL SELECT 'great_grandfather_m', 'great_grandmother_m'
    UNION ALL SELECT 'grandson', 'granddaughter' UNION ALL SELECT 'grandson_sons_son', 'granddaughter_sons_daughter'
    UNION ALL SELECT 'grandson_daughters_son', 'granddaughter_daughters_daughter'
    UNION ALL SELECT 'uncle', 'aunt' UNION ALL SELECT 'nephew', 'niece' UNION ALL SELECT 'nephew_brothers', 'niece_brothers' UNION ALL SELECT 'nephew_sisters', 'niece_sisters'
    UNION ALL SELECT 'father_in_law', 'mother_in_law' UNION ALL SELECT 'son_in_law', 'daughter_in_law'
    UNION ALL SELECT 'husbands_brother', 'husbands_sister' UNION ALL SELECT 'wifes_brother', 'wifes_sister') p2);

-- 3. Family roles (family_members.relationshipRole) that do not fit the
--    person's gender. Not changed by these scripts; listed for the Karta / an Operator (F18).
SELECT fmb.id, f.name AS family, CONCAT(m.firstName, ' ', COALESCE(m.lastName, '')) AS person, m.gender, fmb.relationshipRole
  FROM family_members fmb
  JOIN families f ON f.id = fmb.familyId
  JOIN members m ON m.id = fmb.memberId
  JOIN relationship_types rt ON rt.code = fmb.relationshipRole
 WHERE fmb.leftAt IS NULL
   AND ((rt.genderApplicable = 'MALE' AND m.gender = 'FEMALE') OR (rt.genderApplicable = 'FEMALE' AND m.gender = 'MALE'));
