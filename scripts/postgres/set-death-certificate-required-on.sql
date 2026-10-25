-- GO-LIVE ONLY (P6 runbook): from now on every request to mark a member Expired (F12)
-- must include a death certificate. Not a Prisma migration, so test and dev keep it off.
-- Needs migration 20261025100000_workbook_phases. No member data changes.
-- Rollback: UPDATE "settings" SET "value" = 'false', "updatedAt" = CURRENT_TIMESTAMP WHERE "key" = 'deceased.certificate_required';
UPDATE "settings" SET "value" = 'true', "updatedAt" = CURRENT_TIMESTAMP WHERE "key" = 'deceased.certificate_required';
