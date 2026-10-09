-- Manual rollback for 20261009180000_p5_social_bureau (then delete its
-- _prisma_migrations row). Loses: friendships and friend lists, post
-- audiences (all posts become community posts again), photo friend-list
-- audiences, the extra bureau details and who answered an interest.
DELETE FROM `settings` WHERE `key` IN ('moderation.report_threshold', 'bureau.workbook_rules');
DROP INDEX `reports_reportableType_reportableId_idx` ON `reports`;
DROP INDEX `posts_audienceType_audienceId_idx` ON `posts`;
DROP TABLE IF EXISTS `friend_list_members`;
DROP TABLE IF EXISTS `friend_lists`;
DROP TABLE IF EXISTS `friendships`;
ALTER TABLE `posts` DROP COLUMN `audienceId`, DROP COLUMN `audienceType`;
ALTER TABLE `photos` DROP COLUMN `audienceListId`;
ALTER TABLE `matrimonial_profiles` DROP COLUMN `contactPreference`, DROP COLUMN `expectations`, DROP COLUMN `horoscope`;
ALTER TABLE `matrimonial_interests` DROP COLUMN `respondedBy`;
