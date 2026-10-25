-- Workbook phases P0–P6 (PR #10), ported from MySQL to PostgreSQL on top of
-- 20261009200000_postgresql_baseline and 20261010090000_member_email_citext.
-- One migration replaces PR #10's thirteen MySQL ones (p0_team_roles …
-- group_conversion). Additive except: one index swap on family_join_requests
-- (P2: a second rejected request per person was refused), and the backfills
-- at the end, which only fill new columns.
-- If existing data already has two active Kartas in one family, the unique
-- index on family_members(familyId, kartaGuard) stops this migration; fix those
-- rows and rerun.
-- Rollback: down.sql in this folder.

-- AlterEnum
ALTER TYPE "FamilyStatus" ADD VALUE IF NOT EXISTS 'KARTA_VACANT';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "UserStatus" ADD VALUE IF NOT EXISTS 'DRAFT';
ALTER TYPE "UserStatus" ADD VALUE IF NOT EXISTS 'PENDING_APPROVAL';
ALTER TYPE "UserStatus" ADD VALUE IF NOT EXISTS 'CORRECTION_REQUIRED';
ALTER TYPE "UserStatus" ADD VALUE IF NOT EXISTS 'REJECTED';

-- DropIndex
DROP INDEX "family_join_requests_familyId_memberId_status_direction_key";

-- AlterTable
ALTER TABLE "addresses" ADD COLUMN     "areaId" TEXT,
ADD COLUMN     "sameAsCurrent" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "consent_records" ADD COLUMN     "declarationText" TEXT,
ADD COLUMN     "otpReference" TEXT;

-- AlterTable
ALTER TABLE "education_records" ADD COLUMN     "grade" TEXT,
ADD COLUMN     "university" TEXT;

-- AlterTable
ALTER TABLE "family_join_requests" ADD COLUMN     "origin" TEXT NOT NULL DEFAULT 'MEMBER';

-- AlterTable
-- F09/F16: 1 only on an active Karta row; unique(familyId, kartaGuard) allows one per family.
ALTER TABLE "family_members" ADD COLUMN     "kartaGuard" INTEGER GENERATED ALWAYS AS (CASE WHEN "isKarta" AND "leftAt" IS NULL THEN 1 END) STORED,
ADD COLUMN     "relationshipRole" TEXT,
ADD COLUMN     "relativeToMemberId" TEXT,
ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'ACTIVE';

-- AlterTable
ALTER TABLE "matrimonial_interests" ADD COLUMN     "respondedBy" TEXT;

-- AlterTable
ALTER TABLE "matrimonial_profiles" ADD COLUMN     "contactPreference" TEXT,
ADD COLUMN     "expectations" TEXT,
ADD COLUMN     "horoscope" TEXT;

-- AlterTable
ALTER TABLE "member_profile_details" ADD COLUMN     "employerName" TEXT,
ADD COLUMN     "incomeSource" TEXT,
ADD COLUMN     "occBusinessName" TEXT,
ADD COLUMN     "occBusinessType" TEXT,
ADD COLUMN     "profession" TEXT,
ADD COLUMN     "professionOther" TEXT,
ADD COLUMN     "serviceType" TEXT;

-- AlterTable
ALTER TABLE "members" ADD COLUMN     "deathCertKey" TEXT,
ADD COLUMN     "deathCertMime" TEXT;

-- AlterTable
ALTER TABLE "photos" ADD COLUMN     "audienceListId" TEXT;

-- AlterTable
ALTER TABLE "posts" ADD COLUMN     "audienceId" TEXT,
ADD COLUMN     "audienceType" TEXT NOT NULL DEFAULT 'COMMUNITY';

-- AlterTable
ALTER TABLE "relationship_types" ADD COLUMN     "generation" INTEGER,
ADD COLUMN     "linkType" TEXT,
ADD COLUMN     "localName" TEXT,
ADD COLUMN     "side" TEXT;

-- AlterTable
ALTER TABLE "user_roles" ADD COLUMN     "bodySeatId" TEXT;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "registrationDecidedAt" TIMESTAMP(3),
ADD COLUMN     "registrationNote" TEXT,
ADD COLUMN     "registrationSubmittedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "verification_tokens" ADD COLUMN     "attempts" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "id_proofs" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "idType" TEXT NOT NULL,
    "idNumberEnc" TEXT,
    "idLast4" TEXT NOT NULL,
    "proofKey" TEXT NOT NULL,
    "proofMime" TEXT NOT NULL,
    "selfSignedKey" TEXT NOT NULL,
    "selfSignedMime" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "supersededAt" TIMESTAMP(3),

    CONSTRAINT "id_proofs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "approval_tasks" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "subjectUserId" TEXT NOT NULL,
    "subjectMemberId" TEXT NOT NULL,
    "changeRequestId" TEXT,
    "organisationId" TEXT,
    "round" INTEGER NOT NULL DEFAULT 1,
    "slot" INTEGER NOT NULL,
    "operatorUserId" TEXT,
    "districtAreaId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "checklist" JSONB,
    "remarks" TEXT,
    "decidedAt" TIMESTAMP(3),
    "dueAt" TIMESTAMP(3) NOT NULL,
    "supersededAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "approval_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "profile_change_requests" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "changes" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "reason" TEXT,
    "decidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "profile_change_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "karta_transfers" (
    "id" TEXT NOT NULL,
    "familyId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "fromMemberId" TEXT,
    "toMemberId" TEXT,
    "suggestedMemberId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "requestedBy" TEXT,
    "respondedAt" TIMESTAMP(3),
    "confirmedBy" TEXT,
    "confirmedAt" TIMESTAMP(3),
    "slaAlertedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "karta_transfers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "profile_claims" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "claimantMemberId" TEXT NOT NULL,
    "targetMemberId" TEXT NOT NULL,
    "familyId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "decidedBy" TEXT,
    "decidedAt" TIMESTAMP(3),
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "profile_claims_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tree_link_requests" (
    "id" TEXT NOT NULL,
    "fromFamilyId" TEXT NOT NULL,
    "fromMemberId" TEXT NOT NULL,
    "toFamilyId" TEXT NOT NULL,
    "toMemberId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "conflicts" JSONB,
    "proposedResolution" JSONB,
    "resolution" JSONB,
    "note" TEXT,
    "reason" TEXT,
    "requestedBy" TEXT NOT NULL,
    "decidedBy" TEXT,
    "decidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tree_link_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "organisations" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'LOCAL',
    "name" TEXT NOT NULL,
    "registrationNumber" TEXT,
    "addressLine" TEXT,
    "areaId" TEXT,
    "startedOn" TIMESTAMP(3),
    "town" TEXT,
    "purpose" TEXT,
    "certificateKey" TEXT,
    "certificateMime" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING_APPROVAL',
    "approvedAt" TIMESTAMP(3),
    "decisionNote" TEXT,
    "applicantUserId" TEXT,
    "bodyKey" TEXT,
    "sourceGroupId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "organisations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "organisation_members" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "designation" TEXT NOT NULL DEFAULT 'MEMBER',
    "pendingDesignation" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "termStart" TIMESTAMP(3),
    "termEnd" TIMESTAMP(3),
    "seatId" TEXT,
    "invitedBy" TEXT,
    "joinedAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),
    "endReason" TEXT,
    -- F26/F27: the designation while ACTIVE and not MEMBER; unique(organisationId, officeGuard) allows one of each post.
    "officeGuard" TEXT GENERATED ALWAYS AS (CASE WHEN "status" = 'ACTIVE' AND "designation" <> 'MEMBER' THEN "designation" END) STORED,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "organisation_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "body_seats" (
    "id" TEXT NOT NULL,
    "fromOrganisationId" TEXT NOT NULL,
    "toOrganisationId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'NOMINATED',
    "nominatedBy" TEXT NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "confirmedBy" TEXT,
    "confirmedAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),
    "endReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "body_seats_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "friendships" (
    "id" TEXT NOT NULL,
    "requesterMemberId" TEXT NOT NULL,
    "addresseeMemberId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "respondedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "friendships_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "friend_lists" (
    "id" TEXT NOT NULL,
    "ownerMemberId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "friend_lists_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "friend_list_members" (
    "id" TEXT NOT NULL,
    "listId" TEXT NOT NULL,
    "friendMemberId" TEXT NOT NULL,
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "friend_list_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "data_deletion_requests" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "memberId" TEXT,
    "reason" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "processedBy" TEXT,
    "processedAt" TIMESTAMP(3),
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "data_deletion_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "id_proofs_memberId_status_idx" ON "id_proofs"("memberId", "status");

-- CreateIndex
CREATE INDEX "approval_tasks_operatorUserId_status_idx" ON "approval_tasks"("operatorUserId", "status");

-- CreateIndex
CREATE INDEX "approval_tasks_subjectUserId_kind_round_idx" ON "approval_tasks"("subjectUserId", "kind", "round");

-- CreateIndex
CREATE INDEX "approval_tasks_status_dueAt_idx" ON "approval_tasks"("status", "dueAt");

-- CreateIndex
CREATE INDEX "profile_change_requests_memberId_status_idx" ON "profile_change_requests"("memberId", "status");

-- CreateIndex
CREATE INDEX "karta_transfers_familyId_status_idx" ON "karta_transfers"("familyId", "status");

-- CreateIndex
CREATE INDEX "profile_claims_targetMemberId_status_idx" ON "profile_claims"("targetMemberId", "status");

-- CreateIndex
CREATE INDEX "profile_claims_userId_status_idx" ON "profile_claims"("userId", "status");

-- CreateIndex
CREATE INDEX "tree_link_requests_toFamilyId_status_idx" ON "tree_link_requests"("toFamilyId", "status");

-- CreateIndex
CREATE INDEX "tree_link_requests_fromFamilyId_status_idx" ON "tree_link_requests"("fromFamilyId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "organisations_bodyKey_key" ON "organisations"("bodyKey");

-- CreateIndex
CREATE UNIQUE INDEX "organisations_sourceGroupId_key" ON "organisations"("sourceGroupId");

-- CreateIndex
CREATE INDEX "organisations_kind_status_idx" ON "organisations"("kind", "status");

-- CreateIndex
CREATE INDEX "organisations_areaId_idx" ON "organisations"("areaId");

-- CreateIndex
CREATE INDEX "organisation_members_memberId_status_idx" ON "organisation_members"("memberId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "organisation_members_organisationId_memberId_key" ON "organisation_members"("organisationId", "memberId");

-- CreateIndex
CREATE UNIQUE INDEX "organisation_members_organisationId_officeGuard_key" ON "organisation_members"("organisationId", "officeGuard");

-- CreateIndex
CREATE INDEX "body_seats_fromOrganisationId_status_idx" ON "body_seats"("fromOrganisationId", "status");

-- CreateIndex
CREATE INDEX "body_seats_toOrganisationId_status_idx" ON "body_seats"("toOrganisationId", "status");

-- CreateIndex
CREATE INDEX "body_seats_memberId_status_idx" ON "body_seats"("memberId", "status");

-- CreateIndex
CREATE INDEX "friendships_addresseeMemberId_status_idx" ON "friendships"("addresseeMemberId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "friendships_requesterMemberId_addresseeMemberId_key" ON "friendships"("requesterMemberId", "addresseeMemberId");

-- CreateIndex
CREATE UNIQUE INDEX "friend_lists_ownerMemberId_name_key" ON "friend_lists"("ownerMemberId", "name");

-- CreateIndex
CREATE INDEX "friend_list_members_friendMemberId_idx" ON "friend_list_members"("friendMemberId");

-- CreateIndex
CREATE UNIQUE INDEX "friend_list_members_listId_friendMemberId_key" ON "friend_list_members"("listId", "friendMemberId");

-- CreateIndex
CREATE INDEX "data_deletion_requests_status_createdAt_idx" ON "data_deletion_requests"("status", "createdAt");

-- CreateIndex
CREATE INDEX "data_deletion_requests_userId_idx" ON "data_deletion_requests"("userId");

-- CreateIndex
CREATE INDEX "family_join_requests_familyId_memberId_status_idx" ON "family_join_requests"("familyId", "memberId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "family_members_familyId_kartaGuard_key" ON "family_members"("familyId", "kartaGuard");

-- CreateIndex
CREATE INDEX "posts_audienceType_audienceId_idx" ON "posts"("audienceType", "audienceId");

-- CreateIndex
CREATE INDEX "reports_reportableType_reportableId_idx" ON "reports"("reportableType", "reportableId");

-- AddForeignKey
ALTER TABLE "addresses" ADD CONSTRAINT "addresses_areaId_fkey" FOREIGN KEY ("areaId") REFERENCES "areas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "id_proofs" ADD CONSTRAINT "id_proofs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "id_proofs" ADD CONSTRAINT "id_proofs_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "members"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_tasks" ADD CONSTRAINT "approval_tasks_subjectUserId_fkey" FOREIGN KEY ("subjectUserId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_tasks" ADD CONSTRAINT "approval_tasks_operatorUserId_fkey" FOREIGN KEY ("operatorUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_tasks" ADD CONSTRAINT "approval_tasks_changeRequestId_fkey" FOREIGN KEY ("changeRequestId") REFERENCES "profile_change_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "profile_change_requests" ADD CONSTRAINT "profile_change_requests_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ════════════════════════════════════════════════════════════════════
-- Data and backfills (from the P0–P6 MySQL migrations of PR #10).
-- ON CONFLICT DO NOTHING keeps rows `npm run db:seed` may already hold.
-- ════════════════════════════════════════════════════════════════════

-- P0 (F32, F33): body-team roles and the export permission.
INSERT INTO "roles" ("id", "code", "label", "description", "isSystem", "createdAt") VALUES
  ('role-national-team', 'NATIONAL_TEAM', 'National team', 'View all member data, read only (F33)', true, CURRENT_TIMESTAMP),
  ('role-state-team', 'STATE_TEAM', 'State team', 'View members of the mapped state, with approval status (F33)', true, CURRENT_TIMESTAMP),
  ('role-district-team', 'DISTRICT_TEAM', 'District team', 'View members of the mapped district (F33)', true, CURRENT_TIMESTAMP),
  ('role-data-export', 'DATA_EXPORT', 'Data export permission', 'Admin-granted permission to export the scoped directory (F33)', true, CURRENT_TIMESTAMP)
ON CONFLICT DO NOTHING;

-- P2 backfill: memberships that already ended keep their history under the new status,
-- and each member gets the role their relationship rows already give them.
UPDATE "family_members" SET "status" = CASE WHEN "leftReason" = 'ERROR' THEN 'REMOVED' ELSE 'ENDED' END WHERE "leftAt" IS NOT NULL;
UPDATE "family_members" SET "relationshipRole" = 'karta' WHERE "isKarta" AND "relationshipRole" IS NULL;
UPDATE "family_members" fm
   SET "relationshipRole" = rt."code", "relativeToMemberId" = mr."toMemberId"
  FROM "member_relationships" mr
  JOIN "relationship_types" rt ON rt."id" = mr."relationshipTypeId"
 WHERE mr."fromMemberId" = fm."memberId" AND mr."familyId" = fm."familyId" AND mr."isActive"
   AND fm."relationshipRole" IS NULL;

-- P2: the workbook's Relationships sheet (existing codes kept; nothing duplicated).
INSERT INTO "relationship_types" ("id", "code", "label", "inverseCode", "genderApplicable", "isSpouse", "isActive", "sortOrder", "localName", "generation", "side", "linkType") VALUES
  ('rel-father', 'father', 'Father', 'son', 'MALE', false, true, 100, 'Pita', 1, 'PATERNAL', 'BIRTH'),
  ('rel-mother', 'mother', 'Mother', 'son', 'FEMALE', false, true, 101, 'Mata', 1, 'MATERNAL', 'BIRTH'),
  ('rel-grandfather_p', 'grandfather_p', 'Paternal grandfather', 'grandson', 'MALE', false, true, 102, 'Dada / Ajoba', 2, 'PATERNAL', 'BIRTH'),
  ('rel-grandmother_p', 'grandmother_p', 'Paternal grandmother', 'grandson', 'FEMALE', false, true, 103, 'Dadi / Aaji', 2, 'PATERNAL', 'BIRTH'),
  ('rel-grandfather_m', 'grandfather_m', 'Maternal grandfather', 'grandson_daughters_son', 'MALE', false, true, 104, 'Nana', 2, 'MATERNAL', 'BIRTH'),
  ('rel-grandmother_m', 'grandmother_m', 'Maternal grandmother', 'grandson_daughters_son', 'FEMALE', false, true, 105, 'Nani', 2, 'MATERNAL', 'BIRTH'),
  ('rel-great_grandfather_p', 'great_grandfather_p', 'Paternal great-grandfather', NULL, 'MALE', false, true, 106, 'Par-dada / Panjoba', 3, 'PATERNAL', 'BIRTH'),
  ('rel-great_grandmother_p', 'great_grandmother_p', 'Paternal great-grandmother', NULL, 'FEMALE', false, true, 107, 'Par-dadi / Panji', 3, 'PATERNAL', 'BIRTH'),
  ('rel-great_grandfather_m', 'great_grandfather_m', 'Maternal great-grandfather', NULL, 'MALE', false, true, 108, 'Par-nana', 3, 'MATERNAL', 'BIRTH'),
  ('rel-great_grandmother_m', 'great_grandmother_m', 'Maternal great-grandmother', NULL, 'FEMALE', false, true, 109, 'Par-nani', 3, 'MATERNAL', 'BIRTH'),
  ('rel-husband', 'husband', 'Husband', 'wife', 'MALE', true, true, 110, 'Pati', 0, NULL, 'MARRIAGE'),
  ('rel-wife', 'wife', 'Wife', 'husband', 'FEMALE', true, true, 111, 'Patni', 0, NULL, 'MARRIAGE'),
  ('rel-brother', 'brother', 'Brother', 'brother', 'MALE', false, true, 112, 'Bhai', 0, NULL, 'BIRTH'),
  ('rel-sister', 'sister', 'Sister', 'brother', 'FEMALE', false, true, 113, 'Behen', 0, NULL, 'BIRTH'),
  ('rel-brothers_wife', 'brothers_wife', 'Brother''s wife', 'husbands_brother', 'FEMALE', false, true, 114, 'Bhabhi', 0, NULL, 'MARRIAGE'),
  ('rel-sisters_husband', 'sisters_husband', 'Sister''s husband', 'wifes_brother', 'MALE', false, true, 115, 'Jija / Behnoi', 0, NULL, 'MARRIAGE'),
  ('rel-husbands_brother', 'husbands_brother', 'Husband''s brother', 'brothers_wife', 'MALE', false, true, 116, 'Jeth / Devar', 0, 'HUSBAND_SIDE', 'MARRIAGE'),
  ('rel-husbands_sister', 'husbands_sister', 'Husband''s sister', 'brothers_wife', 'FEMALE', false, true, 117, 'Nanad', 0, 'HUSBAND_SIDE', 'MARRIAGE'),
  ('rel-wifes_brother', 'wifes_brother', 'Wife''s brother', 'sisters_husband', 'MALE', false, true, 118, 'Saala', 0, 'WIFE_SIDE', 'MARRIAGE'),
  ('rel-wifes_sister', 'wifes_sister', 'Wife''s sister', 'sisters_husband', 'FEMALE', false, true, 119, 'Saali', 0, 'WIFE_SIDE', 'MARRIAGE'),
  ('rel-fathers_elder_brother', 'fathers_elder_brother', 'Father''s elder brother', 'nephew_brothers', 'MALE', false, true, 120, 'Tau', 1, 'PATERNAL', 'BIRTH'),
  ('rel-fathers_elder_brothers_wife', 'fathers_elder_brothers_wife', 'Father''s elder brother''s wife', 'nephew', 'FEMALE', false, true, 121, 'Tai', 1, 'PATERNAL', 'MARRIAGE'),
  ('rel-fathers_younger_brother', 'fathers_younger_brother', 'Father''s younger brother', 'nephew_brothers', 'MALE', false, true, 122, 'Chacha / Kaka', 1, 'PATERNAL', 'BIRTH'),
  ('rel-fathers_younger_brothers_wife', 'fathers_younger_brothers_wife', 'Father''s younger brother''s wife', 'nephew', 'FEMALE', false, true, 123, 'Chachi / Kaku', 1, 'PATERNAL', 'MARRIAGE'),
  ('rel-fathers_sister', 'fathers_sister', 'Father''s sister', 'nephew_brothers', 'FEMALE', false, true, 124, 'Bua / Atya', 1, 'PATERNAL', 'BIRTH'),
  ('rel-fathers_sisters_husband', 'fathers_sisters_husband', 'Father''s sister''s husband', 'nephew', 'MALE', false, true, 125, 'Phupha', 1, 'PATERNAL', 'MARRIAGE'),
  ('rel-mothers_brother', 'mothers_brother', 'Mother''s brother', 'nephew_sisters', 'MALE', false, true, 126, 'Mama', 1, 'MATERNAL', 'BIRTH'),
  ('rel-mothers_brothers_wife', 'mothers_brothers_wife', 'Mother''s brother''s wife', 'nephew', 'FEMALE', false, true, 127, 'Mami', 1, 'MATERNAL', 'MARRIAGE'),
  ('rel-mothers_sister', 'mothers_sister', 'Mother''s sister', 'nephew_sisters', 'FEMALE', false, true, 128, 'Mausi / Mavshi', 1, 'MATERNAL', 'BIRTH'),
  ('rel-mothers_sisters_husband', 'mothers_sisters_husband', 'Mother''s sister''s husband', 'nephew', 'MALE', false, true, 129, 'Mausa', 1, 'MATERNAL', 'MARRIAGE'),
  ('rel-father_in_law', 'father_in_law', 'Father-in-law', 'son_in_law', 'MALE', false, true, 130, 'Sasur', 1, 'SPOUSE_SIDE', 'MARRIAGE'),
  ('rel-mother_in_law', 'mother_in_law', 'Mother-in-law', 'son_in_law', 'FEMALE', false, true, 131, 'Saas', 1, 'SPOUSE_SIDE', 'MARRIAGE'),
  ('rel-son_in_law', 'son_in_law', 'Son-in-law', 'father_in_law', 'MALE', false, true, 132, 'Damad / Jamai', -1, NULL, 'MARRIAGE'),
  ('rel-daughter_in_law', 'daughter_in_law', 'Daughter-in-law', 'father_in_law', 'FEMALE', false, true, 133, 'Bahu / Sun', -1, NULL, 'MARRIAGE'),
  ('rel-son', 'son', 'Son', 'father', 'MALE', false, true, 134, 'Beta / Putra', -1, NULL, 'BIRTH_OR_ADOPTION'),
  ('rel-daughter', 'daughter', 'Daughter', 'father', 'FEMALE', false, true, 135, 'Beti / Putri', -1, NULL, 'BIRTH_OR_ADOPTION'),
  ('rel-grandson_sons_son', 'grandson_sons_son', 'Grandson (son''s son)', 'grandfather_p', 'MALE', false, true, 136, 'Pota', -2, 'PATERNAL', 'BIRTH'),
  ('rel-granddaughter_sons_daughter', 'granddaughter_sons_daughter', 'Granddaughter (son''s daughter)', 'grandfather_p', 'FEMALE', false, true, 137, 'Poti', -2, 'PATERNAL', 'BIRTH'),
  ('rel-grandson_daughters_son', 'grandson_daughters_son', 'Grandson (daughter''s son)', 'grandfather_m', 'MALE', false, true, 138, 'Nati / Dohta', -2, 'MATERNAL', 'BIRTH'),
  ('rel-granddaughter_daughters_daughter', 'granddaughter_daughters_daughter', 'Granddaughter (daughter''s daughter)', 'grandfather_m', 'FEMALE', false, true, 139, 'Natin / Dohti', -2, 'MATERNAL', 'BIRTH'),
  ('rel-nephew_brothers', 'nephew_brothers', 'Nephew (brother''s son)', 'fathers_younger_brother', 'MALE', false, true, 140, 'Bhatija', -1, NULL, 'BIRTH'),
  ('rel-niece_brothers', 'niece_brothers', 'Niece (brother''s daughter)', 'fathers_younger_brother', 'FEMALE', false, true, 141, 'Bhatiji', -1, NULL, 'BIRTH'),
  ('rel-nephew_sisters', 'nephew_sisters', 'Nephew (sister''s son)', 'mothers_brother', 'MALE', false, true, 142, 'Bhanja', -1, NULL, 'BIRTH'),
  ('rel-niece_sisters', 'niece_sisters', 'Niece (sister''s daughter)', 'mothers_brother', 'FEMALE', false, true, 143, 'Bhanji', -1, NULL, 'BIRTH')
ON CONFLICT DO NOTHING;
UPDATE "relationship_types" SET "localName" = 'Pita', "generation" = 1, "side" = 'PATERNAL', "linkType" = 'BIRTH' WHERE "code" = 'father' AND "localName" IS NULL;
UPDATE "relationship_types" SET "localName" = 'Mata', "generation" = 1, "side" = 'MATERNAL', "linkType" = 'BIRTH' WHERE "code" = 'mother' AND "localName" IS NULL;
UPDATE "relationship_types" SET "localName" = 'Dada / Ajoba', "generation" = 2, "side" = 'PATERNAL', "linkType" = 'BIRTH' WHERE "code" = 'grandfather_p' AND "localName" IS NULL;
UPDATE "relationship_types" SET "localName" = 'Dadi / Aaji', "generation" = 2, "side" = 'PATERNAL', "linkType" = 'BIRTH' WHERE "code" = 'grandmother_p' AND "localName" IS NULL;
UPDATE "relationship_types" SET "localName" = 'Nana', "generation" = 2, "side" = 'MATERNAL', "linkType" = 'BIRTH' WHERE "code" = 'grandfather_m' AND "localName" IS NULL;
UPDATE "relationship_types" SET "localName" = 'Nani', "generation" = 2, "side" = 'MATERNAL', "linkType" = 'BIRTH' WHERE "code" = 'grandmother_m' AND "localName" IS NULL;
UPDATE "relationship_types" SET "localName" = 'Par-dada / Panjoba', "generation" = 3, "side" = 'PATERNAL', "linkType" = 'BIRTH' WHERE "code" = 'great_grandfather_p' AND "localName" IS NULL;
UPDATE "relationship_types" SET "localName" = 'Par-dadi / Panji', "generation" = 3, "side" = 'PATERNAL', "linkType" = 'BIRTH' WHERE "code" = 'great_grandmother_p' AND "localName" IS NULL;
UPDATE "relationship_types" SET "localName" = 'Par-nana', "generation" = 3, "side" = 'MATERNAL', "linkType" = 'BIRTH' WHERE "code" = 'great_grandfather_m' AND "localName" IS NULL;
UPDATE "relationship_types" SET "localName" = 'Par-nani', "generation" = 3, "side" = 'MATERNAL', "linkType" = 'BIRTH' WHERE "code" = 'great_grandmother_m' AND "localName" IS NULL;
UPDATE "relationship_types" SET "localName" = 'Pati', "generation" = 0, "side" = NULL, "linkType" = 'MARRIAGE' WHERE "code" = 'husband' AND "localName" IS NULL;
UPDATE "relationship_types" SET "localName" = 'Patni', "generation" = 0, "side" = NULL, "linkType" = 'MARRIAGE' WHERE "code" = 'wife' AND "localName" IS NULL;
UPDATE "relationship_types" SET "localName" = 'Bhai', "generation" = 0, "side" = NULL, "linkType" = 'BIRTH' WHERE "code" = 'brother' AND "localName" IS NULL;
UPDATE "relationship_types" SET "localName" = 'Behen', "generation" = 0, "side" = NULL, "linkType" = 'BIRTH' WHERE "code" = 'sister' AND "localName" IS NULL;
UPDATE "relationship_types" SET "localName" = 'Bhabhi', "generation" = 0, "side" = NULL, "linkType" = 'MARRIAGE' WHERE "code" = 'brothers_wife' AND "localName" IS NULL;
UPDATE "relationship_types" SET "localName" = 'Jija / Behnoi', "generation" = 0, "side" = NULL, "linkType" = 'MARRIAGE' WHERE "code" = 'sisters_husband' AND "localName" IS NULL;
UPDATE "relationship_types" SET "localName" = 'Jeth / Devar', "generation" = 0, "side" = 'HUSBAND_SIDE', "linkType" = 'MARRIAGE' WHERE "code" = 'husbands_brother' AND "localName" IS NULL;
UPDATE "relationship_types" SET "localName" = 'Nanad', "generation" = 0, "side" = 'HUSBAND_SIDE', "linkType" = 'MARRIAGE' WHERE "code" = 'husbands_sister' AND "localName" IS NULL;
UPDATE "relationship_types" SET "localName" = 'Saala', "generation" = 0, "side" = 'WIFE_SIDE', "linkType" = 'MARRIAGE' WHERE "code" = 'wifes_brother' AND "localName" IS NULL;
UPDATE "relationship_types" SET "localName" = 'Saali', "generation" = 0, "side" = 'WIFE_SIDE', "linkType" = 'MARRIAGE' WHERE "code" = 'wifes_sister' AND "localName" IS NULL;
UPDATE "relationship_types" SET "localName" = 'Tau', "generation" = 1, "side" = 'PATERNAL', "linkType" = 'BIRTH' WHERE "code" = 'fathers_elder_brother' AND "localName" IS NULL;
UPDATE "relationship_types" SET "localName" = 'Tai', "generation" = 1, "side" = 'PATERNAL', "linkType" = 'MARRIAGE' WHERE "code" = 'fathers_elder_brothers_wife' AND "localName" IS NULL;
UPDATE "relationship_types" SET "localName" = 'Chacha / Kaka', "generation" = 1, "side" = 'PATERNAL', "linkType" = 'BIRTH' WHERE "code" = 'fathers_younger_brother' AND "localName" IS NULL;
UPDATE "relationship_types" SET "localName" = 'Chachi / Kaku', "generation" = 1, "side" = 'PATERNAL', "linkType" = 'MARRIAGE' WHERE "code" = 'fathers_younger_brothers_wife' AND "localName" IS NULL;
UPDATE "relationship_types" SET "localName" = 'Bua / Atya', "generation" = 1, "side" = 'PATERNAL', "linkType" = 'BIRTH' WHERE "code" = 'fathers_sister' AND "localName" IS NULL;
UPDATE "relationship_types" SET "localName" = 'Phupha', "generation" = 1, "side" = 'PATERNAL', "linkType" = 'MARRIAGE' WHERE "code" = 'fathers_sisters_husband' AND "localName" IS NULL;
UPDATE "relationship_types" SET "localName" = 'Mama', "generation" = 1, "side" = 'MATERNAL', "linkType" = 'BIRTH' WHERE "code" = 'mothers_brother' AND "localName" IS NULL;
UPDATE "relationship_types" SET "localName" = 'Mami', "generation" = 1, "side" = 'MATERNAL', "linkType" = 'MARRIAGE' WHERE "code" = 'mothers_brothers_wife' AND "localName" IS NULL;
UPDATE "relationship_types" SET "localName" = 'Mausi / Mavshi', "generation" = 1, "side" = 'MATERNAL', "linkType" = 'BIRTH' WHERE "code" = 'mothers_sister' AND "localName" IS NULL;
UPDATE "relationship_types" SET "localName" = 'Mausa', "generation" = 1, "side" = 'MATERNAL', "linkType" = 'MARRIAGE' WHERE "code" = 'mothers_sisters_husband' AND "localName" IS NULL;
UPDATE "relationship_types" SET "localName" = 'Sasur', "generation" = 1, "side" = 'SPOUSE_SIDE', "linkType" = 'MARRIAGE' WHERE "code" = 'father_in_law' AND "localName" IS NULL;
UPDATE "relationship_types" SET "localName" = 'Saas', "generation" = 1, "side" = 'SPOUSE_SIDE', "linkType" = 'MARRIAGE' WHERE "code" = 'mother_in_law' AND "localName" IS NULL;
UPDATE "relationship_types" SET "localName" = 'Damad / Jamai', "generation" = -1, "side" = NULL, "linkType" = 'MARRIAGE' WHERE "code" = 'son_in_law' AND "localName" IS NULL;
UPDATE "relationship_types" SET "localName" = 'Bahu / Sun', "generation" = -1, "side" = NULL, "linkType" = 'MARRIAGE' WHERE "code" = 'daughter_in_law' AND "localName" IS NULL;
UPDATE "relationship_types" SET "localName" = 'Beta / Putra', "generation" = -1, "side" = NULL, "linkType" = 'BIRTH_OR_ADOPTION' WHERE "code" = 'son' AND "localName" IS NULL;
UPDATE "relationship_types" SET "localName" = 'Beti / Putri', "generation" = -1, "side" = NULL, "linkType" = 'BIRTH_OR_ADOPTION' WHERE "code" = 'daughter' AND "localName" IS NULL;
UPDATE "relationship_types" SET "localName" = 'Pota', "generation" = -2, "side" = 'PATERNAL', "linkType" = 'BIRTH' WHERE "code" = 'grandson_sons_son' AND "localName" IS NULL;
UPDATE "relationship_types" SET "localName" = 'Poti', "generation" = -2, "side" = 'PATERNAL', "linkType" = 'BIRTH' WHERE "code" = 'granddaughter_sons_daughter' AND "localName" IS NULL;
UPDATE "relationship_types" SET "localName" = 'Nati / Dohta', "generation" = -2, "side" = 'MATERNAL', "linkType" = 'BIRTH' WHERE "code" = 'grandson_daughters_son' AND "localName" IS NULL;
UPDATE "relationship_types" SET "localName" = 'Natin / Dohti', "generation" = -2, "side" = 'MATERNAL', "linkType" = 'BIRTH' WHERE "code" = 'granddaughter_daughters_daughter' AND "localName" IS NULL;
UPDATE "relationship_types" SET "localName" = 'Bhatija', "generation" = -1, "side" = NULL, "linkType" = 'BIRTH' WHERE "code" = 'nephew_brothers' AND "localName" IS NULL;
UPDATE "relationship_types" SET "localName" = 'Bhatiji', "generation" = -1, "side" = NULL, "linkType" = 'BIRTH' WHERE "code" = 'niece_brothers' AND "localName" IS NULL;
UPDATE "relationship_types" SET "localName" = 'Bhanja', "generation" = -1, "side" = NULL, "linkType" = 'BIRTH' WHERE "code" = 'nephew_sisters' AND "localName" IS NULL;
UPDATE "relationship_types" SET "localName" = 'Bhanji', "generation" = -1, "side" = NULL, "linkType" = 'BIRTH' WHERE "code" = 'niece_sisters' AND "localName" IS NULL;

-- Settings: F15 join-request expiry, OP-02 tree depth, F34/F36 report threshold,
-- F37/F38 bureau workbook rules (on: owner's decision), F12 death certificate (off until go-live).
INSERT INTO "settings" ("id", "key", "value", "description", "updatedAt") VALUES
  ('setting-join-request-expiry-days', 'family.join_request_expiry_days', '30', 'Days before an unanswered family join request expires (F15)', CURRENT_TIMESTAMP),
  ('setting-tree-ancestor-levels', 'tree.ancestor_levels', '3', 'Generations of ancestors above the Karta the tree builder allows (F19, OP-02)', CURRENT_TIMESTAMP),
  ('setting-moderation-report-threshold', 'moderation.report_threshold', '3', 'Abuse reports from different people that hide a post, comment or photo until reviewed (F34, F36)', CURRENT_TIMESTAMP),
  ('setting-bureau-workbook-rules', 'bureau.workbook_rules', 'true', 'Marriage bureau: only Unmarried + earning may list, only listed users and their Karta may browse (F37, F38). Off = previous behaviour.', CURRENT_TIMESTAMP),
  ('setting-deceased-certificate-required', 'deceased.certificate_required', 'false', 'F12: a death certificate must be attached when marking a member Expired. Switch to true at go-live.', CURRENT_TIMESTAMP)
ON CONFLICT DO NOTHING;
UPDATE "settings" SET "value" = 'true', "updatedAt" = CURRENT_TIMESTAMP WHERE "key" = 'bureau.workbook_rules';

-- F08: address changes by verified members save instantly (owner's decision).
INSERT INTO "approval_rules" ("id", "actionCode", "requiresApproval", "approverRole", "isActive", "updatedAt") VALUES
  ('rule-member-address-change', 'member.address.change', false, 'OPERATOR', true, CURRENT_TIMESTAMP)
ON CONFLICT DO NOTHING;
UPDATE "approval_rules" SET "requiresApproval" = false, "updatedAt" = CURRENT_TIMESTAMP WHERE "actionCode" = 'member.address.change';
