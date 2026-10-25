-- Manual rollback for 20261025100000_workbook_phases (PostgreSQL), then:
--   DELETE FROM "_prisma_migrations" WHERE "migration_name" = '20261025100000_workbook_phases';
-- Back up first: this drops the P0–P6 tables (ID proofs, approval tasks,
-- organisations, friendships, …) and their data. Encrypted files in UPLOAD_DIR
-- (ID proofs, certificates) stay until deleted by hand.
-- Enum values added here (FamilyStatus KARTA_VACANT; UserStatus DRAFT,
-- PENDING_APPROVAL, CORRECTION_REQUIRED, REJECTED) are left in place:
-- PostgreSQL cannot drop an enum value, and unused values are harmless. Move
-- any rows using them back to an older value first.

DROP TABLE IF EXISTS "friend_list_members", "friend_lists", "friendships",
  "body_seats", "organisation_members", "organisations", "tree_link_requests",
  "profile_claims", "karta_transfers", "approval_tasks", "profile_change_requests",
  "id_proofs", "data_deletion_requests" CASCADE;

DROP INDEX IF EXISTS "family_members_familyId_kartaGuard_key";
DROP INDEX IF EXISTS "posts_audienceType_audienceId_idx";
DROP INDEX IF EXISTS "reports_reportableType_reportableId_idx";
DROP INDEX IF EXISTS "family_join_requests_familyId_memberId_status_idx";
CREATE UNIQUE INDEX IF NOT EXISTS "family_join_requests_familyId_memberId_status_direction_key" ON "family_join_requests"("familyId", "memberId", "status", "direction");

ALTER TABLE "addresses" DROP COLUMN IF EXISTS "areaId", DROP COLUMN IF EXISTS "sameAsCurrent";
ALTER TABLE "consent_records" DROP COLUMN IF EXISTS "declarationText", DROP COLUMN IF EXISTS "otpReference";
ALTER TABLE "education_records" DROP COLUMN IF EXISTS "grade", DROP COLUMN IF EXISTS "university";
ALTER TABLE "family_join_requests" DROP COLUMN IF EXISTS "origin";
ALTER TABLE "family_members" DROP COLUMN IF EXISTS "kartaGuard", DROP COLUMN IF EXISTS "relationshipRole", DROP COLUMN IF EXISTS "relativeToMemberId", DROP COLUMN IF EXISTS "status";
ALTER TABLE "matrimonial_interests" DROP COLUMN IF EXISTS "respondedBy";
ALTER TABLE "matrimonial_profiles" DROP COLUMN IF EXISTS "contactPreference", DROP COLUMN IF EXISTS "expectations", DROP COLUMN IF EXISTS "horoscope";
ALTER TABLE "member_profile_details" DROP COLUMN IF EXISTS "employerName", DROP COLUMN IF EXISTS "incomeSource", DROP COLUMN IF EXISTS "occBusinessName", DROP COLUMN IF EXISTS "occBusinessType", DROP COLUMN IF EXISTS "profession", DROP COLUMN IF EXISTS "professionOther", DROP COLUMN IF EXISTS "serviceType";
ALTER TABLE "members" DROP COLUMN IF EXISTS "deathCertKey", DROP COLUMN IF EXISTS "deathCertMime";
ALTER TABLE "photos" DROP COLUMN IF EXISTS "audienceListId";
ALTER TABLE "posts" DROP COLUMN IF EXISTS "audienceId", DROP COLUMN IF EXISTS "audienceType";
ALTER TABLE "relationship_types" DROP COLUMN IF EXISTS "generation", DROP COLUMN IF EXISTS "linkType", DROP COLUMN IF EXISTS "localName", DROP COLUMN IF EXISTS "side";
ALTER TABLE "user_roles" DROP COLUMN IF EXISTS "bodySeatId";
ALTER TABLE "users" DROP COLUMN IF EXISTS "registrationDecidedAt", DROP COLUMN IF EXISTS "registrationNote", DROP COLUMN IF EXISTS "registrationSubmittedAt";
ALTER TABLE "verification_tokens" DROP COLUMN IF EXISTS "attempts";

-- Data rows this migration added (only the ones it owns, by id).
DELETE FROM "settings" WHERE "id" IN ('setting-join-request-expiry-days', 'setting-tree-ancestor-levels', 'setting-moderation-report-threshold', 'setting-bureau-workbook-rules', 'setting-deceased-certificate-required');
DELETE FROM "approval_rules" WHERE "id" = 'rule-member-address-change';
DELETE FROM "user_roles" WHERE "roleId" IN ('role-national-team', 'role-state-team', 'role-district-team', 'role-data-export');
DELETE FROM "roles" WHERE "id" IN ('role-national-team', 'role-state-team', 'role-district-team', 'role-data-export');
-- Relationship types rel-* are kept: member_relationships rows may point at them.
