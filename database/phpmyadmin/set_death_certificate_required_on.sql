-- GO-LIVE ONLY (P6 runbook): from now on every request to mark a member Expired (F12)
-- must include a death certificate. Not a Prisma migration, so test and dev keep it off.
-- Run after add_death_certificate.sql. No member data changes.
-- Rollback: UPDATE `settings` SET `value` = 'false', `updatedAt` = CURRENT_TIMESTAMP(3) WHERE `key` = 'deceased.certificate_required';
UPDATE `settings` SET `value` = 'true', `updatedAt` = CURRENT_TIMESTAMP(3) WHERE `key` = 'deceased.certificate_required';
