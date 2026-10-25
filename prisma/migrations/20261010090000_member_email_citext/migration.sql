-- members.email becomes CITEXT, matching users.email, so the Karta's
-- duplicate-member check (POST /api/families/[id]/members) finds an existing
-- member whatever case the address was typed in. MySQL's collation did this
-- implicitly. The column has no unique constraint, so existing rows that
-- differ only in case are kept as they are. The citext extension is created
-- by the baseline migration.

-- AlterTable
ALTER TABLE "members" ALTER COLUMN "email" SET DATA TYPE CITEXT;
