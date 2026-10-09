-- Manual rollback for 20261009130000_otp_attempts (then delete its _prisma_migrations row).
ALTER TABLE `verification_tokens` DROP COLUMN `attempts`;
