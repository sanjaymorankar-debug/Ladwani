-- P2: family and Karta (prisma migration 20261009150000_p2_family_karta).
-- Additive, with a backfill of the new family_members columns from existing
-- data (no existing value is changed or removed). Import ONCE in phpMyAdmin
-- after add_p1_registration_approval.sql; back up first (DDL cannot be rolled back).
-- Rollback: prisma/migrations/20261009150000_p2_family_karta/down.sql.
-- Needs MySQL 5.7+ / MariaDB 10.2+ (stored generated column).
--
-- PRE-CHECK (run first; both must return no rows, otherwise stop and report):
--   -- a family with more than one active Karta (the new unique index would fail)
--   SELECT familyId, COUNT(*) FROM family_members WHERE isKarta = 1 AND leftAt IS NULL GROUP BY familyId HAVING COUNT(*) > 1;
--   -- a person who is active Karta of more than one family (rule F09; not blocked by the DB, fix by hand)
--   SELECT memberId, COUNT(*) FROM family_members WHERE isKarta = 1 AND leftAt IS NULL GROUP BY memberId HAVING COUNT(*) > 1;

-- P2 family and Karta (F09–F18). Additive; one index swap; backfill below.
--
-- 1. family_members becomes the full membership record of rule 1:
--    relationship role, relative-to person, status (ACTIVE / REMOVED / ENDED).
-- 2. Rule 2 in the database: a STORED generated column that is 1 only on an
--    active Karta row, under unique(familyId, kartaGuard) — at most one
--    active Karta per family. (F09's "Karta of only one family" is enforced
--    in code: MySQL forbids a generated column over memberId, whose foreign
--    key cascades.) If existing data already has two active Kartas in one
--    family, the unique index stops this migration; fix those rows and rerun.
-- 3. families.status gains KARTA_VACANT (F16).
-- 4. family_join_requests: the unique(familyId, memberId, status, direction)
--    index also refused a second REJECTED row; it becomes a plain index and
--    "one open request per person per family" is enforced in code (F14).
-- 5. relationship_types gains the workbook columns and the missing entries
--    of the Relationships sheet (existing codes kept; nothing duplicated).
-- 6. New tables karta_transfers (F16) and profile_claims (F17).
-- Rollback: down.sql in this folder.

-- 1 + 2
ALTER TABLE `family_members`
    ADD COLUMN `relationshipRole` VARCHAR(191) NULL,
    ADD COLUMN `relativeToMemberId` VARCHAR(191) NULL,
    ADD COLUMN `status` VARCHAR(191) NOT NULL DEFAULT 'ACTIVE',
    ADD COLUMN `kartaGuard` INTEGER GENERATED ALWAYS AS (IF(`isKarta` = 1 AND `leftAt` IS NULL, 1, NULL)) STORED;

-- Backfill: memberships that already ended keep their history under the new status.
UPDATE `family_members` SET `status` = IF(`leftReason` = 'ERROR', 'REMOVED', 'ENDED') WHERE `leftAt` IS NOT NULL;
-- Backfill: the role each member already has in that family's relationship rows.
UPDATE `family_members` SET `relationshipRole` = 'karta' WHERE `isKarta` = 1 AND `relationshipRole` IS NULL;
UPDATE `family_members` fm
  JOIN `member_relationships` mr ON mr.`fromMemberId` = fm.`memberId` AND mr.`familyId` = fm.`familyId` AND mr.`isActive` = 1
  JOIN `relationship_types` rt ON rt.`id` = mr.`relationshipTypeId`
  SET fm.`relationshipRole` = rt.`code`, fm.`relativeToMemberId` = mr.`toMemberId`
  WHERE fm.`relationshipRole` IS NULL;

CREATE UNIQUE INDEX `family_members_familyId_kartaGuard_key` ON `family_members`(`familyId`, `kartaGuard`);

-- 3
ALTER TABLE `families` MODIFY `status` ENUM('PENDING', 'ACTIVE', 'INACTIVE', 'MERGED', 'ARCHIVED', 'KARTA_VACANT') NOT NULL DEFAULT 'PENDING';

-- 4 (new index first: the old one also serves the familyId foreign key)
CREATE INDEX `family_join_requests_familyId_memberId_status_idx` ON `family_join_requests`(`familyId`, `memberId`, `status`);
DROP INDEX `family_join_requests_familyId_memberId_status_direction_key` ON `family_join_requests`;

-- 5
ALTER TABLE `relationship_types` ADD COLUMN `generation` INTEGER NULL,
    ADD COLUMN `linkType` VARCHAR(191) NULL,
    ADD COLUMN `localName` VARCHAR(191) NULL,
    ADD COLUMN `side` VARCHAR(191) NULL;
INSERT IGNORE INTO `relationship_types` (`id`, `code`, `label`, `inverseCode`, `genderApplicable`, `isSpouse`, `isActive`, `sortOrder`, `localName`, `generation`, `side`, `linkType`) VALUES
  ('rel-father', 'father', 'Father', 'son', 'MALE', 0, true, 100, 'Pita', 1, 'PATERNAL', 'BIRTH'),
  ('rel-mother', 'mother', 'Mother', 'son', 'FEMALE', 0, true, 101, 'Mata', 1, 'MATERNAL', 'BIRTH'),
  ('rel-grandfather_p', 'grandfather_p', 'Paternal grandfather', 'grandson', 'MALE', 0, true, 102, 'Dada / Ajoba', 2, 'PATERNAL', 'BIRTH'),
  ('rel-grandmother_p', 'grandmother_p', 'Paternal grandmother', 'grandson', 'FEMALE', 0, true, 103, 'Dadi / Aaji', 2, 'PATERNAL', 'BIRTH'),
  ('rel-grandfather_m', 'grandfather_m', 'Maternal grandfather', 'grandson_daughters_son', 'MALE', 0, true, 104, 'Nana', 2, 'MATERNAL', 'BIRTH'),
  ('rel-grandmother_m', 'grandmother_m', 'Maternal grandmother', 'grandson_daughters_son', 'FEMALE', 0, true, 105, 'Nani', 2, 'MATERNAL', 'BIRTH'),
  ('rel-great_grandfather_p', 'great_grandfather_p', 'Paternal great-grandfather', NULL, 'MALE', 0, true, 106, 'Par-dada / Panjoba', 3, 'PATERNAL', 'BIRTH'),
  ('rel-great_grandmother_p', 'great_grandmother_p', 'Paternal great-grandmother', NULL, 'FEMALE', 0, true, 107, 'Par-dadi / Panji', 3, 'PATERNAL', 'BIRTH'),
  ('rel-great_grandfather_m', 'great_grandfather_m', 'Maternal great-grandfather', NULL, 'MALE', 0, true, 108, 'Par-nana', 3, 'MATERNAL', 'BIRTH'),
  ('rel-great_grandmother_m', 'great_grandmother_m', 'Maternal great-grandmother', NULL, 'FEMALE', 0, true, 109, 'Par-nani', 3, 'MATERNAL', 'BIRTH'),
  ('rel-husband', 'husband', 'Husband', 'wife', 'MALE', 1, true, 110, 'Pati', 0, NULL, 'MARRIAGE'),
  ('rel-wife', 'wife', 'Wife', 'husband', 'FEMALE', 1, true, 111, 'Patni', 0, NULL, 'MARRIAGE'),
  ('rel-brother', 'brother', 'Brother', 'brother', 'MALE', 0, true, 112, 'Bhai', 0, NULL, 'BIRTH'),
  ('rel-sister', 'sister', 'Sister', 'brother', 'FEMALE', 0, true, 113, 'Behen', 0, NULL, 'BIRTH'),
  ('rel-brothers_wife', 'brothers_wife', 'Brother''s wife', 'husbands_brother', 'FEMALE', 0, true, 114, 'Bhabhi', 0, NULL, 'MARRIAGE'),
  ('rel-sisters_husband', 'sisters_husband', 'Sister''s husband', 'wifes_brother', 'MALE', 0, true, 115, 'Jija / Behnoi', 0, NULL, 'MARRIAGE'),
  ('rel-husbands_brother', 'husbands_brother', 'Husband''s brother', 'brothers_wife', 'MALE', 0, true, 116, 'Jeth / Devar', 0, 'HUSBAND_SIDE', 'MARRIAGE'),
  ('rel-husbands_sister', 'husbands_sister', 'Husband''s sister', 'brothers_wife', 'FEMALE', 0, true, 117, 'Nanad', 0, 'HUSBAND_SIDE', 'MARRIAGE'),
  ('rel-wifes_brother', 'wifes_brother', 'Wife''s brother', 'sisters_husband', 'MALE', 0, true, 118, 'Saala', 0, 'WIFE_SIDE', 'MARRIAGE'),
  ('rel-wifes_sister', 'wifes_sister', 'Wife''s sister', 'sisters_husband', 'FEMALE', 0, true, 119, 'Saali', 0, 'WIFE_SIDE', 'MARRIAGE'),
  ('rel-fathers_elder_brother', 'fathers_elder_brother', 'Father''s elder brother', 'nephew_brothers', 'MALE', 0, true, 120, 'Tau', 1, 'PATERNAL', 'BIRTH'),
  ('rel-fathers_elder_brothers_wife', 'fathers_elder_brothers_wife', 'Father''s elder brother''s wife', 'nephew', 'FEMALE', 0, true, 121, 'Tai', 1, 'PATERNAL', 'MARRIAGE'),
  ('rel-fathers_younger_brother', 'fathers_younger_brother', 'Father''s younger brother', 'nephew_brothers', 'MALE', 0, true, 122, 'Chacha / Kaka', 1, 'PATERNAL', 'BIRTH'),
  ('rel-fathers_younger_brothers_wife', 'fathers_younger_brothers_wife', 'Father''s younger brother''s wife', 'nephew', 'FEMALE', 0, true, 123, 'Chachi / Kaku', 1, 'PATERNAL', 'MARRIAGE'),
  ('rel-fathers_sister', 'fathers_sister', 'Father''s sister', 'nephew_brothers', 'FEMALE', 0, true, 124, 'Bua / Atya', 1, 'PATERNAL', 'BIRTH'),
  ('rel-fathers_sisters_husband', 'fathers_sisters_husband', 'Father''s sister''s husband', 'nephew', 'MALE', 0, true, 125, 'Phupha', 1, 'PATERNAL', 'MARRIAGE'),
  ('rel-mothers_brother', 'mothers_brother', 'Mother''s brother', 'nephew_sisters', 'MALE', 0, true, 126, 'Mama', 1, 'MATERNAL', 'BIRTH'),
  ('rel-mothers_brothers_wife', 'mothers_brothers_wife', 'Mother''s brother''s wife', 'nephew', 'FEMALE', 0, true, 127, 'Mami', 1, 'MATERNAL', 'MARRIAGE'),
  ('rel-mothers_sister', 'mothers_sister', 'Mother''s sister', 'nephew_sisters', 'FEMALE', 0, true, 128, 'Mausi / Mavshi', 1, 'MATERNAL', 'BIRTH'),
  ('rel-mothers_sisters_husband', 'mothers_sisters_husband', 'Mother''s sister''s husband', 'nephew', 'MALE', 0, true, 129, 'Mausa', 1, 'MATERNAL', 'MARRIAGE'),
  ('rel-father_in_law', 'father_in_law', 'Father-in-law', 'son_in_law', 'MALE', 0, true, 130, 'Sasur', 1, 'SPOUSE_SIDE', 'MARRIAGE'),
  ('rel-mother_in_law', 'mother_in_law', 'Mother-in-law', 'son_in_law', 'FEMALE', 0, true, 131, 'Saas', 1, 'SPOUSE_SIDE', 'MARRIAGE'),
  ('rel-son_in_law', 'son_in_law', 'Son-in-law', 'father_in_law', 'MALE', 0, true, 132, 'Damad / Jamai', -1, NULL, 'MARRIAGE'),
  ('rel-daughter_in_law', 'daughter_in_law', 'Daughter-in-law', 'father_in_law', 'FEMALE', 0, true, 133, 'Bahu / Sun', -1, NULL, 'MARRIAGE'),
  ('rel-son', 'son', 'Son', 'father', 'MALE', 0, true, 134, 'Beta / Putra', -1, NULL, 'BIRTH_OR_ADOPTION'),
  ('rel-daughter', 'daughter', 'Daughter', 'father', 'FEMALE', 0, true, 135, 'Beti / Putri', -1, NULL, 'BIRTH_OR_ADOPTION'),
  ('rel-grandson_sons_son', 'grandson_sons_son', 'Grandson (son''s son)', 'grandfather_p', 'MALE', 0, true, 136, 'Pota', -2, 'PATERNAL', 'BIRTH'),
  ('rel-granddaughter_sons_daughter', 'granddaughter_sons_daughter', 'Granddaughter (son''s daughter)', 'grandfather_p', 'FEMALE', 0, true, 137, 'Poti', -2, 'PATERNAL', 'BIRTH'),
  ('rel-grandson_daughters_son', 'grandson_daughters_son', 'Grandson (daughter''s son)', 'grandfather_m', 'MALE', 0, true, 138, 'Nati / Dohta', -2, 'MATERNAL', 'BIRTH'),
  ('rel-granddaughter_daughters_daughter', 'granddaughter_daughters_daughter', 'Granddaughter (daughter''s daughter)', 'grandfather_m', 'FEMALE', 0, true, 139, 'Natin / Dohti', -2, 'MATERNAL', 'BIRTH'),
  ('rel-nephew_brothers', 'nephew_brothers', 'Nephew (brother''s son)', 'fathers_younger_brother', 'MALE', 0, true, 140, 'Bhatija', -1, NULL, 'BIRTH'),
  ('rel-niece_brothers', 'niece_brothers', 'Niece (brother''s daughter)', 'fathers_younger_brother', 'FEMALE', 0, true, 141, 'Bhatiji', -1, NULL, 'BIRTH'),
  ('rel-nephew_sisters', 'nephew_sisters', 'Nephew (sister''s son)', 'mothers_brother', 'MALE', 0, true, 142, 'Bhanja', -1, NULL, 'BIRTH'),
  ('rel-niece_sisters', 'niece_sisters', 'Niece (sister''s daughter)', 'mothers_brother', 'FEMALE', 0, true, 143, 'Bhanji', -1, NULL, 'BIRTH');
UPDATE `relationship_types` SET `localName` = 'Pita', `generation` = 1, `side` = 'PATERNAL', `linkType` = 'BIRTH' WHERE `code` = 'father' AND `localName` IS NULL;
UPDATE `relationship_types` SET `localName` = 'Mata', `generation` = 1, `side` = 'MATERNAL', `linkType` = 'BIRTH' WHERE `code` = 'mother' AND `localName` IS NULL;
UPDATE `relationship_types` SET `localName` = 'Dada / Ajoba', `generation` = 2, `side` = 'PATERNAL', `linkType` = 'BIRTH' WHERE `code` = 'grandfather_p' AND `localName` IS NULL;
UPDATE `relationship_types` SET `localName` = 'Dadi / Aaji', `generation` = 2, `side` = 'PATERNAL', `linkType` = 'BIRTH' WHERE `code` = 'grandmother_p' AND `localName` IS NULL;
UPDATE `relationship_types` SET `localName` = 'Nana', `generation` = 2, `side` = 'MATERNAL', `linkType` = 'BIRTH' WHERE `code` = 'grandfather_m' AND `localName` IS NULL;
UPDATE `relationship_types` SET `localName` = 'Nani', `generation` = 2, `side` = 'MATERNAL', `linkType` = 'BIRTH' WHERE `code` = 'grandmother_m' AND `localName` IS NULL;
UPDATE `relationship_types` SET `localName` = 'Par-dada / Panjoba', `generation` = 3, `side` = 'PATERNAL', `linkType` = 'BIRTH' WHERE `code` = 'great_grandfather_p' AND `localName` IS NULL;
UPDATE `relationship_types` SET `localName` = 'Par-dadi / Panji', `generation` = 3, `side` = 'PATERNAL', `linkType` = 'BIRTH' WHERE `code` = 'great_grandmother_p' AND `localName` IS NULL;
UPDATE `relationship_types` SET `localName` = 'Par-nana', `generation` = 3, `side` = 'MATERNAL', `linkType` = 'BIRTH' WHERE `code` = 'great_grandfather_m' AND `localName` IS NULL;
UPDATE `relationship_types` SET `localName` = 'Par-nani', `generation` = 3, `side` = 'MATERNAL', `linkType` = 'BIRTH' WHERE `code` = 'great_grandmother_m' AND `localName` IS NULL;
UPDATE `relationship_types` SET `localName` = 'Pati', `generation` = 0, `side` = NULL, `linkType` = 'MARRIAGE' WHERE `code` = 'husband' AND `localName` IS NULL;
UPDATE `relationship_types` SET `localName` = 'Patni', `generation` = 0, `side` = NULL, `linkType` = 'MARRIAGE' WHERE `code` = 'wife' AND `localName` IS NULL;
UPDATE `relationship_types` SET `localName` = 'Bhai', `generation` = 0, `side` = NULL, `linkType` = 'BIRTH' WHERE `code` = 'brother' AND `localName` IS NULL;
UPDATE `relationship_types` SET `localName` = 'Behen', `generation` = 0, `side` = NULL, `linkType` = 'BIRTH' WHERE `code` = 'sister' AND `localName` IS NULL;
UPDATE `relationship_types` SET `localName` = 'Bhabhi', `generation` = 0, `side` = NULL, `linkType` = 'MARRIAGE' WHERE `code` = 'brothers_wife' AND `localName` IS NULL;
UPDATE `relationship_types` SET `localName` = 'Jija / Behnoi', `generation` = 0, `side` = NULL, `linkType` = 'MARRIAGE' WHERE `code` = 'sisters_husband' AND `localName` IS NULL;
UPDATE `relationship_types` SET `localName` = 'Jeth / Devar', `generation` = 0, `side` = 'HUSBAND_SIDE', `linkType` = 'MARRIAGE' WHERE `code` = 'husbands_brother' AND `localName` IS NULL;
UPDATE `relationship_types` SET `localName` = 'Nanad', `generation` = 0, `side` = 'HUSBAND_SIDE', `linkType` = 'MARRIAGE' WHERE `code` = 'husbands_sister' AND `localName` IS NULL;
UPDATE `relationship_types` SET `localName` = 'Saala', `generation` = 0, `side` = 'WIFE_SIDE', `linkType` = 'MARRIAGE' WHERE `code` = 'wifes_brother' AND `localName` IS NULL;
UPDATE `relationship_types` SET `localName` = 'Saali', `generation` = 0, `side` = 'WIFE_SIDE', `linkType` = 'MARRIAGE' WHERE `code` = 'wifes_sister' AND `localName` IS NULL;
UPDATE `relationship_types` SET `localName` = 'Tau', `generation` = 1, `side` = 'PATERNAL', `linkType` = 'BIRTH' WHERE `code` = 'fathers_elder_brother' AND `localName` IS NULL;
UPDATE `relationship_types` SET `localName` = 'Tai', `generation` = 1, `side` = 'PATERNAL', `linkType` = 'MARRIAGE' WHERE `code` = 'fathers_elder_brothers_wife' AND `localName` IS NULL;
UPDATE `relationship_types` SET `localName` = 'Chacha / Kaka', `generation` = 1, `side` = 'PATERNAL', `linkType` = 'BIRTH' WHERE `code` = 'fathers_younger_brother' AND `localName` IS NULL;
UPDATE `relationship_types` SET `localName` = 'Chachi / Kaku', `generation` = 1, `side` = 'PATERNAL', `linkType` = 'MARRIAGE' WHERE `code` = 'fathers_younger_brothers_wife' AND `localName` IS NULL;
UPDATE `relationship_types` SET `localName` = 'Bua / Atya', `generation` = 1, `side` = 'PATERNAL', `linkType` = 'BIRTH' WHERE `code` = 'fathers_sister' AND `localName` IS NULL;
UPDATE `relationship_types` SET `localName` = 'Phupha', `generation` = 1, `side` = 'PATERNAL', `linkType` = 'MARRIAGE' WHERE `code` = 'fathers_sisters_husband' AND `localName` IS NULL;
UPDATE `relationship_types` SET `localName` = 'Mama', `generation` = 1, `side` = 'MATERNAL', `linkType` = 'BIRTH' WHERE `code` = 'mothers_brother' AND `localName` IS NULL;
UPDATE `relationship_types` SET `localName` = 'Mami', `generation` = 1, `side` = 'MATERNAL', `linkType` = 'MARRIAGE' WHERE `code` = 'mothers_brothers_wife' AND `localName` IS NULL;
UPDATE `relationship_types` SET `localName` = 'Mausi / Mavshi', `generation` = 1, `side` = 'MATERNAL', `linkType` = 'BIRTH' WHERE `code` = 'mothers_sister' AND `localName` IS NULL;
UPDATE `relationship_types` SET `localName` = 'Mausa', `generation` = 1, `side` = 'MATERNAL', `linkType` = 'MARRIAGE' WHERE `code` = 'mothers_sisters_husband' AND `localName` IS NULL;
UPDATE `relationship_types` SET `localName` = 'Sasur', `generation` = 1, `side` = 'SPOUSE_SIDE', `linkType` = 'MARRIAGE' WHERE `code` = 'father_in_law' AND `localName` IS NULL;
UPDATE `relationship_types` SET `localName` = 'Saas', `generation` = 1, `side` = 'SPOUSE_SIDE', `linkType` = 'MARRIAGE' WHERE `code` = 'mother_in_law' AND `localName` IS NULL;
UPDATE `relationship_types` SET `localName` = 'Damad / Jamai', `generation` = -1, `side` = NULL, `linkType` = 'MARRIAGE' WHERE `code` = 'son_in_law' AND `localName` IS NULL;
UPDATE `relationship_types` SET `localName` = 'Bahu / Sun', `generation` = -1, `side` = NULL, `linkType` = 'MARRIAGE' WHERE `code` = 'daughter_in_law' AND `localName` IS NULL;
UPDATE `relationship_types` SET `localName` = 'Beta / Putra', `generation` = -1, `side` = NULL, `linkType` = 'BIRTH_OR_ADOPTION' WHERE `code` = 'son' AND `localName` IS NULL;
UPDATE `relationship_types` SET `localName` = 'Beti / Putri', `generation` = -1, `side` = NULL, `linkType` = 'BIRTH_OR_ADOPTION' WHERE `code` = 'daughter' AND `localName` IS NULL;
UPDATE `relationship_types` SET `localName` = 'Pota', `generation` = -2, `side` = 'PATERNAL', `linkType` = 'BIRTH' WHERE `code` = 'grandson_sons_son' AND `localName` IS NULL;
UPDATE `relationship_types` SET `localName` = 'Poti', `generation` = -2, `side` = 'PATERNAL', `linkType` = 'BIRTH' WHERE `code` = 'granddaughter_sons_daughter' AND `localName` IS NULL;
UPDATE `relationship_types` SET `localName` = 'Nati / Dohta', `generation` = -2, `side` = 'MATERNAL', `linkType` = 'BIRTH' WHERE `code` = 'grandson_daughters_son' AND `localName` IS NULL;
UPDATE `relationship_types` SET `localName` = 'Natin / Dohti', `generation` = -2, `side` = 'MATERNAL', `linkType` = 'BIRTH' WHERE `code` = 'granddaughter_daughters_daughter' AND `localName` IS NULL;
UPDATE `relationship_types` SET `localName` = 'Bhatija', `generation` = -1, `side` = NULL, `linkType` = 'BIRTH' WHERE `code` = 'nephew_brothers' AND `localName` IS NULL;
UPDATE `relationship_types` SET `localName` = 'Bhatiji', `generation` = -1, `side` = NULL, `linkType` = 'BIRTH' WHERE `code` = 'niece_brothers' AND `localName` IS NULL;
UPDATE `relationship_types` SET `localName` = 'Bhanja', `generation` = -1, `side` = NULL, `linkType` = 'BIRTH' WHERE `code` = 'nephew_sisters' AND `localName` IS NULL;
UPDATE `relationship_types` SET `localName` = 'Bhanji', `generation` = -1, `side` = NULL, `linkType` = 'BIRTH' WHERE `code` = 'niece_sisters' AND `localName` IS NULL;

-- 6
CREATE TABLE `karta_transfers` (
    `id` VARCHAR(191) NOT NULL,
    `familyId` VARCHAR(191) NOT NULL,
    `kind` VARCHAR(191) NOT NULL,
    `fromMemberId` VARCHAR(191) NULL,
    `toMemberId` VARCHAR(191) NULL,
    `suggestedMemberId` VARCHAR(191) NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'PENDING',
    `requestedBy` VARCHAR(191) NULL,
    `respondedAt` DATETIME(3) NULL,
    `confirmedBy` VARCHAR(191) NULL,
    `confirmedAt` DATETIME(3) NULL,
    `slaAlertedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `karta_transfers_familyId_status_idx`(`familyId`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `profile_claims` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `claimantMemberId` VARCHAR(191) NOT NULL,
    `targetMemberId` VARCHAR(191) NOT NULL,
    `familyId` VARCHAR(191) NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'PENDING',
    `decidedBy` VARCHAR(191) NULL,
    `decidedAt` DATETIME(3) NULL,
    `note` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `profile_claims_targetMemberId_status_idx`(`targetMemberId`, `status`),
    INDEX `profile_claims_userId_status_idx`(`userId`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- F15 join-request expiry (days), configurable.
INSERT IGNORE INTO `settings` (`id`, `key`, `value`, `description`, `updatedAt`) VALUES
  ('setting-join-request-expiry-days', 'family.join_request_expiry_days', '30', 'Days before an unanswered family join request expires (F15)', CURRENT_TIMESTAMP(3));

-- Record the migration as applied, so a later `prisma migrate deploy` skips it.
INSERT IGNORE INTO `_prisma_migrations` (`id`, `checksum`, `finished_at`, `migration_name`, `logs`, `rolled_back_at`, `started_at`, `applied_steps_count`) VALUES
  ('20261009-p2-0000-0000-000000000000', 'a78329db5d863d6d2b3439052d7213a60a511c140e752b5d07e68993087bccc3', CURRENT_TIMESTAMP(3), '20261009150000_p2_family_karta', NULL, NULL, CURRENT_TIMESTAMP(3), 1);
