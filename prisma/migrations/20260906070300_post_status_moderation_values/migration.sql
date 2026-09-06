-- Adds the moderation states to PostStatus.
--
-- Kept in its own migration because PostgreSQL will not let a newly added
-- enum value be USED (e.g. as a column default) in the same transaction that
-- adds it. This migration adds the values; the next one uses them.
ALTER TYPE "PostStatus" ADD VALUE IF NOT EXISTS 'PENDING_APPROVAL';
ALTER TYPE "PostStatus" ADD VALUE IF NOT EXISTS 'REJECTED';
