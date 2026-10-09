-- Manual rollback for 20261009160000_p3_tree_links (then delete its
-- _prisma_migrations row). Loses: link requests, and which join requests
-- were created by a marriage (they stay as ordinary requests).
DELETE FROM `settings` WHERE `key` = 'tree.ancestor_levels';
DROP TABLE IF EXISTS `tree_link_requests`;
ALTER TABLE `family_join_requests` DROP COLUMN `origin`;
