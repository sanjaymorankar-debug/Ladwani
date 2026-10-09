-- Manual rollback for 20261009190000_p6_data_rights (then delete its
-- _prisma_migrations row). Loses the list of deletion requests (people
-- already anonymised stay anonymised).
DROP TABLE IF EXISTS `data_deletion_requests`;
