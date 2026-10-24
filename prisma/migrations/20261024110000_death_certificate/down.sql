-- Manual rollback for 20261024110000_death_certificate (then delete its
-- _prisma_migrations row). Certificate files already stored stay in the
-- uploads folder; delete them by hand if wanted (prefix death-certificates/).
DELETE FROM `settings` WHERE `key` = 'deceased.certificate_required';
ALTER TABLE `members` DROP COLUMN `deathCertMime`, DROP COLUMN `deathCertKey`;
