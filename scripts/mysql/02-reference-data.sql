-- ===========================================================================
-- Mi Ladwani — 02-reference-data.sql  (DATA ONLY: no CREATE TABLE)
--
-- Run this SECOND, after 01-schema.sql, into the same database.
--
-- Contains ONLY reference/config data the app needs to function:
--   5 roles, 17 permissions, 44 role-permission grants, 20 relationship
--   types, 12 approval rules, 10 post types, 5 areas, 6 income ranges,
--   3 settings, the family registration fee type, the _prisma_migrations
--   row, and ONE admin login:
--
--       admin@miladwani.com / ChangeThisInProduction123!
--       ^ CHANGE THIS PASSWORD IMMEDIATELY AFTER YOUR FIRST LOGIN.
--
-- Contains NO test accounts, NO families, NO member data.
-- ===========================================================================

-- MySQL dump 10.13  Distrib 8.4.9, for Win64 (x86_64)
--
-- Host: localhost    Database: miladwani_sqlgen
-- ------------------------------------------------------
-- Server version	8.4.9

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Dumping data for table `_prisma_migrations`
--

LOCK TABLES `_prisma_migrations` WRITE;
/*!40000 ALTER TABLE `_prisma_migrations` DISABLE KEYS */;
INSERT INTO `_prisma_migrations` (`id`, `checksum`, `finished_at`, `migration_name`, `logs`, `rolled_back_at`, `started_at`, `applied_steps_count`) VALUES ('6b37ccad-6cf5-4e2f-84a8-0570f7d5a41f','584c8fab176b065f3aedbdf8d0012d17cbc1ab48026c15c30caeaf85f667372d','2026-09-11 14:50:13.729','20260910163143_init',NULL,NULL,'2026-09-11 14:50:05.611',1);
/*!40000 ALTER TABLE `_prisma_migrations` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Dumping data for table `addresses`
--

LOCK TABLES `addresses` WRITE;
/*!40000 ALTER TABLE `addresses` DISABLE KEYS */;
/*!40000 ALTER TABLE `addresses` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Dumping data for table `approval_rules`
--

LOCK TABLES `approval_rules` WRITE;
/*!40000 ALTER TABLE `approval_rules` DISABLE KEYS */;
INSERT INTO `approval_rules` (`id`, `actionCode`, `requiresApproval`, `approverRole`, `autoApproveRole`, `isActive`, `updatedAt`) VALUES ('cmtx2pm9l001jr4734jkfkecr','family.create',1,'OPERATOR',NULL,1,'2026-09-11 14:50:36.153'),('cmtx2pm9q001kr473dlf2qe9c','family.member.add',1,'OPERATOR',NULL,1,'2026-09-11 14:50:36.159'),('cmtx2pm9t001lr473jptn0i7l','member.marital_status.change',1,'OPERATOR',NULL,1,'2026-09-11 14:50:36.162'),('cmtx2pm9w001mr473sga9kda1','member.mark_deceased',1,'OPERATOR',NULL,1,'2026-09-11 14:50:36.164'),('cmtx2pm9y001nr473x9a6276p','member.relationship.change',1,'OPERATOR',NULL,1,'2026-09-11 14:50:36.167'),('cmtx2pma1001or473qzp33vvv','family.karta.change',1,'ADMIN',NULL,1,'2026-09-11 14:50:36.169'),('cmtx2pma3001pr473m033lgt6','family.merge',1,'ADMIN',NULL,1,'2026-09-11 14:50:36.171'),('cmtx2pma7001qr473qwhbl0np','member.edit_own',0,NULL,'MEMBER',1,'2026-09-11 14:50:36.176'),('cmtx2pmaa001rr473fb2ydbto','member.education.edit_own',0,NULL,'MEMBER',1,'2026-09-11 14:50:36.179'),('cmtx2pmad001sr473wosa8qsw','member.employment.edit_own',0,NULL,'MEMBER',1,'2026-09-11 14:50:36.181'),('cmtx2pmby001xr473b1dl4lpk','asset.create',1,'OPERATOR',NULL,1,'2026-09-11 14:50:36.238'),('cmtx2pmc2001yr473td5uyw4x','group.create',1,'OPERATOR',NULL,1,'2026-09-11 14:50:36.242');
/*!40000 ALTER TABLE `approval_rules` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Dumping data for table `approvals`
--

LOCK TABLES `approvals` WRITE;
/*!40000 ALTER TABLE `approvals` DISABLE KEYS */;
/*!40000 ALTER TABLE `approvals` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Dumping data for table `areas`
--

LOCK TABLES `areas` WRITE;
/*!40000 ALTER TABLE `areas` DISABLE KEYS */;
INSERT INTO `areas` (`id`, `parentId`, `name`, `type`, `code`, `isActive`, `sortOrder`) VALUES ('area-india',NULL,'India','COUNTRY','IN',1,0),('area-mh','area-india','Maharashtra','STATE','MH',1,0),('area-mumbai','area-mh','Mumbai','CITY',NULL,1,0),('area-nagpur','area-mh','Nagpur','CITY',NULL,1,0),('area-pune','area-mh','Pune','CITY',NULL,1,0);
/*!40000 ALTER TABLE `areas` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Dumping data for table `asset_blackouts`
--

LOCK TABLES `asset_blackouts` WRITE;
/*!40000 ALTER TABLE `asset_blackouts` DISABLE KEYS */;
/*!40000 ALTER TABLE `asset_blackouts` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Dumping data for table `assets`
--

LOCK TABLES `assets` WRITE;
/*!40000 ALTER TABLE `assets` DISABLE KEYS */;
/*!40000 ALTER TABLE `assets` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Dumping data for table `audit_logs`
--

LOCK TABLES `audit_logs` WRITE;
/*!40000 ALTER TABLE `audit_logs` DISABLE KEYS */;
/*!40000 ALTER TABLE `audit_logs` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Dumping data for table `blocked_users`
--

LOCK TABLES `blocked_users` WRITE;
/*!40000 ALTER TABLE `blocked_users` DISABLE KEYS */;
/*!40000 ALTER TABLE `blocked_users` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Dumping data for table `bookings`
--

LOCK TABLES `bookings` WRITE;
/*!40000 ALTER TABLE `bookings` DISABLE KEYS */;
/*!40000 ALTER TABLE `bookings` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Dumping data for table `businesses`
--

LOCK TABLES `businesses` WRITE;
/*!40000 ALTER TABLE `businesses` DISABLE KEYS */;
/*!40000 ALTER TABLE `businesses` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Dumping data for table `comments`
--

LOCK TABLES `comments` WRITE;
/*!40000 ALTER TABLE `comments` DISABLE KEYS */;
/*!40000 ALTER TABLE `comments` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Dumping data for table `community_group_members`
--

LOCK TABLES `community_group_members` WRITE;
/*!40000 ALTER TABLE `community_group_members` DISABLE KEYS */;
/*!40000 ALTER TABLE `community_group_members` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Dumping data for table `community_groups`
--

LOCK TABLES `community_groups` WRITE;
/*!40000 ALTER TABLE `community_groups` DISABLE KEYS */;
/*!40000 ALTER TABLE `community_groups` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Dumping data for table `consent_records`
--

LOCK TABLES `consent_records` WRITE;
/*!40000 ALTER TABLE `consent_records` DISABLE KEYS */;
/*!40000 ALTER TABLE `consent_records` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Dumping data for table `education_records`
--

LOCK TABLES `education_records` WRITE;
/*!40000 ALTER TABLE `education_records` DISABLE KEYS */;
/*!40000 ALTER TABLE `education_records` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Dumping data for table `employment_records`
--

LOCK TABLES `employment_records` WRITE;
/*!40000 ALTER TABLE `employment_records` DISABLE KEYS */;
/*!40000 ALTER TABLE `employment_records` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Dumping data for table `families`
--

LOCK TABLES `families` WRITE;
/*!40000 ALTER TABLE `families` DISABLE KEYS */;
/*!40000 ALTER TABLE `families` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Dumping data for table `family_areas`
--

LOCK TABLES `family_areas` WRITE;
/*!40000 ALTER TABLE `family_areas` DISABLE KEYS */;
/*!40000 ALTER TABLE `family_areas` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Dumping data for table `family_join_requests`
--

LOCK TABLES `family_join_requests` WRITE;
/*!40000 ALTER TABLE `family_join_requests` DISABLE KEYS */;
/*!40000 ALTER TABLE `family_join_requests` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Dumping data for table `family_members`
--

LOCK TABLES `family_members` WRITE;
/*!40000 ALTER TABLE `family_members` DISABLE KEYS */;
/*!40000 ALTER TABLE `family_members` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Dumping data for table `fee_invoices`
--

LOCK TABLES `fee_invoices` WRITE;
/*!40000 ALTER TABLE `fee_invoices` DISABLE KEYS */;
/*!40000 ALTER TABLE `fee_invoices` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Dumping data for table `fee_types`
--

LOCK TABLES `fee_types` WRITE;
/*!40000 ALTER TABLE `fee_types` DISABLE KEYS */;
INSERT INTO `fee_types` (`id`, `code`, `label`, `description`, `amountPaise`, `appliesTo`, `isActive`, `updatedAt`) VALUES ('cmtx2pmbu001wr4738oqnr59v','FAMILY_REGISTRATION','Family Registration Fee','One-time fee payable by the Karta when a new family is registered. Other family members join free.',200000,'FAMILY_KARTA',1,'2026-09-11 14:50:36.235');
/*!40000 ALTER TABLE `fee_types` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Dumping data for table `field_visibility_defaults`
--

LOCK TABLES `field_visibility_defaults` WRITE;
/*!40000 ALTER TABLE `field_visibility_defaults` DISABLE KEYS */;
/*!40000 ALTER TABLE `field_visibility_defaults` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Dumping data for table `income_ranges`
--

LOCK TABLES `income_ranges` WRITE;
/*!40000 ALTER TABLE `income_ranges` DISABLE KEYS */;
INSERT INTO `income_ranges` (`id`, `label`, `minValue`, `maxValue`, `sortOrder`, `isActive`) VALUES ('income-1','Below ₹2 lakh',0,200000,1,1),('income-2','₹2–5 lakh',200000,500000,2,1),('income-3','₹5–10 lakh',500000,1000000,3,1),('income-4','₹10–20 lakh',1000000,2000000,4,1),('income-5','₹20–50 lakh',2000000,5000000,5,1),('income-6','Above ₹50 lakh',5000000,NULL,6,1);
/*!40000 ALTER TABLE `income_ranges` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Dumping data for table `marital_status_history`
--

LOCK TABLES `marital_status_history` WRITE;
/*!40000 ALTER TABLE `marital_status_history` DISABLE KEYS */;
/*!40000 ALTER TABLE `marital_status_history` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Dumping data for table `marriage_records`
--

LOCK TABLES `marriage_records` WRITE;
/*!40000 ALTER TABLE `marriage_records` DISABLE KEYS */;
/*!40000 ALTER TABLE `marriage_records` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Dumping data for table `matrimonial_interests`
--

LOCK TABLES `matrimonial_interests` WRITE;
/*!40000 ALTER TABLE `matrimonial_interests` DISABLE KEYS */;
/*!40000 ALTER TABLE `matrimonial_interests` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Dumping data for table `matrimonial_preferences`
--

LOCK TABLES `matrimonial_preferences` WRITE;
/*!40000 ALTER TABLE `matrimonial_preferences` DISABLE KEYS */;
/*!40000 ALTER TABLE `matrimonial_preferences` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Dumping data for table `matrimonial_profiles`
--

LOCK TABLES `matrimonial_profiles` WRITE;
/*!40000 ALTER TABLE `matrimonial_profiles` DISABLE KEYS */;
/*!40000 ALTER TABLE `matrimonial_profiles` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Dumping data for table `matrimonial_saves`
--

LOCK TABLES `matrimonial_saves` WRITE;
/*!40000 ALTER TABLE `matrimonial_saves` DISABLE KEYS */;
/*!40000 ALTER TABLE `matrimonial_saves` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Dumping data for table `member_areas`
--

LOCK TABLES `member_areas` WRITE;
/*!40000 ALTER TABLE `member_areas` DISABLE KEYS */;
/*!40000 ALTER TABLE `member_areas` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Dumping data for table `member_field_visibility`
--

LOCK TABLES `member_field_visibility` WRITE;
/*!40000 ALTER TABLE `member_field_visibility` DISABLE KEYS */;
/*!40000 ALTER TABLE `member_field_visibility` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Dumping data for table `member_relationships`
--

LOCK TABLES `member_relationships` WRITE;
/*!40000 ALTER TABLE `member_relationships` DISABLE KEYS */;
/*!40000 ALTER TABLE `member_relationships` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Dumping data for table `member_skills`
--

LOCK TABLES `member_skills` WRITE;
/*!40000 ALTER TABLE `member_skills` DISABLE KEYS */;
/*!40000 ALTER TABLE `member_skills` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Dumping data for table `members`
--

LOCK TABLES `members` WRITE;
/*!40000 ALTER TABLE `members` DISABLE KEYS */;
INSERT INTO `members` (`id`, `memberNumber`, `userId`, `firstName`, `middleName`, `lastName`, `gender`, `dateOfBirth`, `dateOfBirthApprox`, `bloodGroup`, `heightCm`, `weightKg`, `bodyType`, `physicalDisability`, `mobilePrimary`, `mobileAlternate`, `email`, `profilePhotoId`, `biography`, `currentCity`, `currentState`, `currentCountry`, `nativeVillage`, `nativeDistrict`, `nativeState`, `nationality`, `maritalStatus`, `employmentStatus`, `occupationCategory`, `status`, `deceasedAt`, `deceasedPlace`, `deceasedNotes`, `verificationStatus`, `createdAt`, `updatedAt`, `createdBy`, `updatedBy`, `deletedAt`) VALUES ('cmtx2plyi000or473lx40yh5p','MEM-ADMIN-001','cmtx2pglb000mr473ad507hz3','Admin',NULL,'Ladwani','MALE',NULL,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'Indian','UNMARRIED',NULL,NULL,'ACTIVE',NULL,NULL,NULL,'UNVERIFIED','2026-09-11 14:50:35.753','2026-09-11 14:50:35.753',NULL,NULL,NULL);
/*!40000 ALTER TABLE `members` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Dumping data for table `notifications`
--

LOCK TABLES `notifications` WRITE;
/*!40000 ALTER TABLE `notifications` DISABLE KEYS */;
/*!40000 ALTER TABLE `notifications` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Dumping data for table `payments`
--

LOCK TABLES `payments` WRITE;
/*!40000 ALTER TABLE `payments` DISABLE KEYS */;
/*!40000 ALTER TABLE `payments` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Dumping data for table `permissions`
--

LOCK TABLES `permissions` WRITE;
/*!40000 ALTER TABLE `permissions` DISABLE KEYS */;
INSERT INTO `permissions` (`id`, `code`, `label`, `module`) VALUES ('cmtx2pfy80005r473keyf3jnk','family:create','Register a new family','family'),('cmtx2pfyj0006r4736l8dvtec','family:edit_own','Edit own family','family'),('cmtx2pfys0007r473cfejjdso','family:edit_any','Edit any family','family'),('cmtx2pfyz0008r4734nsl38qc','family:member_add','Add members to own family','family'),('cmtx2pfz70009r473o0grz4up','family:view_tree','View own family tree','family'),('cmtx2pfze000ar473mgn0cj0c','family:approve','Verify/approve families','family'),('cmtx2pfzl000br473ibzlduzi','member:edit_own','Edit own member profile','member'),('cmtx2pfzs000cr4734mref0wa','member:edit_any','Edit any member profile','member'),('cmtx2pg00000dr473jpvx8nbd','member:mark_deceased','Mark a member deceased','member'),('cmtx2pg08000er473nyj639ma','matrimony:manage_own','Manage own matrimonial profile','matrimony'),('cmtx2pg0e000fr473x3gumsn9','approval:review','Review approval requests','approval'),('cmtx2pg0m000gr4734ccid74a','admin:users','Manage users and roles','admin'),('cmtx2pg0t000hr473qpbah3a6','admin:settings','Manage platform settings','admin'),('cmtx2pg10000ir47374flcl0v','admin:audit','View audit logs','admin'),('cmtx2pg18000jr473jp0jw4ps','asset:manage_own','Manage own assets','asset'),('cmtx2pg1f000kr473tw0jm737','group:manage_own','Register and convene community groups','group'),('cmtx2pg1n000lr4737hed1cem','group:approve','Approve community groups','group');
/*!40000 ALTER TABLE `permissions` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Dumping data for table `photos`
--

LOCK TABLES `photos` WRITE;
/*!40000 ALTER TABLE `photos` DISABLE KEYS */;
/*!40000 ALTER TABLE `photos` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Dumping data for table `post_types`
--

LOCK TABLES `post_types` WRITE;
/*!40000 ALTER TABLE `post_types` DISABLE KEYS */;
INSERT INTO `post_types` (`id`, `code`, `label`, `icon`, `requiresApproval`, `isActive`) VALUES ('cmtx2plzp000pr473ussb8rkv','GENERAL','General','📌',0,1),('cmtx2pm0h000qr47331d9jv4o','ANNOUNCEMENT','Announcement','📢',0,1),('cmtx2pm0z000rr473p46k7bqv','EVENT','Event','🎉',0,1),('cmtx2pm1l000sr473h9uryuvp','ACHIEVEMENT','Achievement','🏆',0,1),('cmtx2pm26000tr473itiaik6x','BIRTHDAY','Birthday','🎂',0,1),('cmtx2pm2l000ur473mhijognc','MARRIAGE','Marriage','💒',0,1),('cmtx2pm37000vr473z34wjawz','CONDOLENCE','Condolence','🙏',0,1),('cmtx2pm4r000wr473t9e42agh','JOB','Job Opportunity','💼',0,1),('cmtx2pm51000xr473n0gj8is2','BUSINESS','Business','🏢',0,1),('cmtx2pm5d000yr4735tlohmwq','LOST_FOUND','Lost & Found','🔍',0,1);
/*!40000 ALTER TABLE `post_types` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Dumping data for table `posts`
--

LOCK TABLES `posts` WRITE;
/*!40000 ALTER TABLE `posts` DISABLE KEYS */;
/*!40000 ALTER TABLE `posts` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Dumping data for table `reactions`
--

LOCK TABLES `reactions` WRITE;
/*!40000 ALTER TABLE `reactions` DISABLE KEYS */;
/*!40000 ALTER TABLE `reactions` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Dumping data for table `refresh_tokens`
--

LOCK TABLES `refresh_tokens` WRITE;
/*!40000 ALTER TABLE `refresh_tokens` DISABLE KEYS */;
/*!40000 ALTER TABLE `refresh_tokens` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Dumping data for table `relationship_types`
--

LOCK TABLES `relationship_types` WRITE;
/*!40000 ALTER TABLE `relationship_types` DISABLE KEYS */;
INSERT INTO `relationship_types` (`id`, `code`, `label`, `inverseCode`, `genderApplicable`, `isSpouse`, `isActive`, `sortOrder`) VALUES ('cmtx2pm5u000zr473em99741p','father','Father','son','MALE',0,1,0),('cmtx2pm630010r473uqm0y2re','mother','Mother','son','FEMALE',0,1,0),('cmtx2pm680011r473a1oj1bkp','son','Son','father','MALE',0,1,0),('cmtx2pm6e0012r4737x9f6jqg','daughter','Daughter','father','FEMALE',0,1,0),('cmtx2pm6k0013r473v8pr32uo','husband','Husband','wife','MALE',1,1,0),('cmtx2pm7x0014r4731mxky3th','wife','Wife','husband','FEMALE',1,1,0),('cmtx2pm820015r473ml197y4s','brother','Brother','brother','MALE',0,1,0),('cmtx2pm860016r473wyecgk0r','sister','Sister','brother','FEMALE',0,1,0),('cmtx2pm8c0017r473ieo75x1i','grandfather_p','Grandfather (Paternal)','grandson','MALE',0,1,0),('cmtx2pm8g0018r473lt0sszyk','grandmother_p','Grandmother (Paternal)','grandson','FEMALE',0,1,0),('cmtx2pm8k0019r473eqpl1lxf','grandson','Grandson','grandfather_p','MALE',0,1,0),('cmtx2pm8p001ar473dzgmwkj4','granddaughter','Granddaughter','grandfather_p','FEMALE',0,1,0),('cmtx2pm8v001br473ddexhwu5','uncle','Uncle','nephew','MALE',0,1,0),('cmtx2pm8z001cr473c884srcl','aunt','Aunt','nephew','FEMALE',0,1,0),('cmtx2pm92001dr473y6eihnel','nephew','Nephew','uncle','MALE',0,1,0),('cmtx2pm95001er47397nybr6b','niece','Niece','uncle','FEMALE',0,1,0),('cmtx2pm9a001fr4731bdrzbe7','son_in_law','Son-in-law','father_in_law','MALE',0,1,0),('cmtx2pm9d001gr473tkgywhkk','daughter_in_law','Daughter-in-law','father_in_law','FEMALE',0,1,0),('cmtx2pm9f001hr4734dxidn10','father_in_law','Father-in-law','son_in_law','MALE',0,1,0),('cmtx2pm9i001ir473j0kklxn9','mother_in_law','Mother-in-law','son_in_law','FEMALE',0,1,0);
/*!40000 ALTER TABLE `relationship_types` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Dumping data for table `reports`
--

LOCK TABLES `reports` WRITE;
/*!40000 ALTER TABLE `reports` DISABLE KEYS */;
/*!40000 ALTER TABLE `reports` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Dumping data for table `role_permissions`
--

LOCK TABLES `role_permissions` WRITE;
/*!40000 ALTER TABLE `role_permissions` DISABLE KEYS */;
INSERT INTO `role_permissions` (`roleId`, `permissionId`) VALUES ('cmtx2pfwo0001r4738yy0g0yd','cmtx2pfy80005r473keyf3jnk'),('cmtx2pfwo0003r473ztflq803','cmtx2pfy80005r473keyf3jnk'),('cmtx2pfwo0001r4738yy0g0yd','cmtx2pfyj0006r4736l8dvtec'),('cmtx2pfwo0003r473ztflq803','cmtx2pfyj0006r4736l8dvtec'),('cmtx2pfwo0003r473ztflq803','cmtx2pfys0007r473cfejjdso'),('cmtx2pfwp0004r473a3kk1rjr','cmtx2pfys0007r473cfejjdso'),('cmtx2pfwo0001r4738yy0g0yd','cmtx2pfyz0008r4734nsl38qc'),('cmtx2pfwo0003r473ztflq803','cmtx2pfyz0008r4734nsl38qc'),('cmtx2pfwp0004r473a3kk1rjr','cmtx2pfyz0008r4734nsl38qc'),('cmtx2pfwo0000r473jzwqsq54','cmtx2pfz70009r473o0grz4up'),('cmtx2pfwo0001r4738yy0g0yd','cmtx2pfz70009r473o0grz4up'),('cmtx2pfwo0002r473nskb6jru','cmtx2pfz70009r473o0grz4up'),('cmtx2pfwo0003r473ztflq803','cmtx2pfz70009r473o0grz4up'),('cmtx2pfwp0004r473a3kk1rjr','cmtx2pfz70009r473o0grz4up'),('cmtx2pfwo0003r473ztflq803','cmtx2pfze000ar473mgn0cj0c'),('cmtx2pfwp0004r473a3kk1rjr','cmtx2pfze000ar473mgn0cj0c'),('cmtx2pfwo0000r473jzwqsq54','cmtx2pfzl000br473ibzlduzi'),('cmtx2pfwo0001r4738yy0g0yd','cmtx2pfzl000br473ibzlduzi'),('cmtx2pfwo0002r473nskb6jru','cmtx2pfzl000br473ibzlduzi'),('cmtx2pfwo0003r473ztflq803','cmtx2pfzl000br473ibzlduzi'),('cmtx2pfwp0004r473a3kk1rjr','cmtx2pfzl000br473ibzlduzi'),('cmtx2pfwo0003r473ztflq803','cmtx2pfzs000cr4734mref0wa'),('cmtx2pfwp0004r473a3kk1rjr','cmtx2pfzs000cr4734mref0wa'),('cmtx2pfwo0003r473ztflq803','cmtx2pg00000dr473jpvx8nbd'),('cmtx2pfwp0004r473a3kk1rjr','cmtx2pg00000dr473jpvx8nbd'),('cmtx2pfwo0000r473jzwqsq54','cmtx2pg08000er473nyj639ma'),('cmtx2pfwo0001r4738yy0g0yd','cmtx2pg08000er473nyj639ma'),('cmtx2pfwo0002r473nskb6jru','cmtx2pg08000er473nyj639ma'),('cmtx2pfwo0003r473ztflq803','cmtx2pg08000er473nyj639ma'),('cmtx2pfwp0004r473a3kk1rjr','cmtx2pg08000er473nyj639ma'),('cmtx2pfwo0003r473ztflq803','cmtx2pg0e000fr473x3gumsn9'),('cmtx2pfwp0004r473a3kk1rjr','cmtx2pg0e000fr473x3gumsn9'),('cmtx2pfwo0003r473ztflq803','cmtx2pg0m000gr4734ccid74a'),('cmtx2pfwo0003r473ztflq803','cmtx2pg0t000hr473qpbah3a6'),('cmtx2pfwo0003r473ztflq803','cmtx2pg10000ir47374flcl0v'),('cmtx2pfwo0002r473nskb6jru','cmtx2pg18000jr473jp0jw4ps'),('cmtx2pfwo0003r473ztflq803','cmtx2pg18000jr473jp0jw4ps'),('cmtx2pfwo0000r473jzwqsq54','cmtx2pg1f000kr473tw0jm737'),('cmtx2pfwo0001r4738yy0g0yd','cmtx2pg1f000kr473tw0jm737'),('cmtx2pfwo0002r473nskb6jru','cmtx2pg1f000kr473tw0jm737'),('cmtx2pfwo0003r473ztflq803','cmtx2pg1f000kr473tw0jm737'),('cmtx2pfwp0004r473a3kk1rjr','cmtx2pg1f000kr473tw0jm737'),('cmtx2pfwo0003r473ztflq803','cmtx2pg1n000lr4737hed1cem'),('cmtx2pfwp0004r473a3kk1rjr','cmtx2pg1n000lr4737hed1cem');
/*!40000 ALTER TABLE `role_permissions` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Dumping data for table `roles`
--

LOCK TABLES `roles` WRITE;
/*!40000 ALTER TABLE `roles` DISABLE KEYS */;
INSERT INTO `roles` (`id`, `code`, `label`, `description`, `isSystem`, `createdAt`) VALUES ('cmtx2pfwo0000r473jzwqsq54','MEMBER','Member',NULL,1,'2026-09-11 14:50:27.910'),('cmtx2pfwo0001r4738yy0g0yd','KARTA','Family Head (Karta)',NULL,1,'2026-09-11 14:50:27.910'),('cmtx2pfwo0002r473nskb6jru','ASSET_OWNER','Asset Owner',NULL,1,'2026-09-11 14:50:27.910'),('cmtx2pfwo0003r473ztflq803','ADMIN','Administrator',NULL,1,'2026-09-11 14:50:27.910'),('cmtx2pfwp0004r473a3kk1rjr','OPERATOR','Operator',NULL,1,'2026-09-11 14:50:27.910');
/*!40000 ALTER TABLE `roles` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Dumping data for table `settings`
--

LOCK TABLES `settings` WRITE;
/*!40000 ALTER TABLE `settings` DISABLE KEYS */;
INSERT INTO `settings` (`id`, `key`, `value`, `description`, `updatedBy`, `updatedAt`) VALUES ('cmtx2pmbk001tr473huwz52ek','community.name','\"\\\"Ladwani Samaj\\\"\"','Community display name',NULL,'2026-09-11 14:50:36.224'),('cmtx2pmbp001ur4730xo5qez6','community.tagline','\"\\\"Our Community, Our Heritage, Our Future\\\"\"','Community tagline',NULL,'2026-09-11 14:50:36.230'),('cmtx2pmbs001vr473hygrh9kf','matrimony.contact_exchange','\"\\\"ACCEPT_FIRST\\\"\"','When to reveal contact: ACCEPT_FIRST or FAMILY_APPROVAL',NULL,'2026-09-11 14:50:36.232');
/*!40000 ALTER TABLE `settings` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Dumping data for table `skills`
--

LOCK TABLES `skills` WRITE;
/*!40000 ALTER TABLE `skills` DISABLE KEYS */;
/*!40000 ALTER TABLE `skills` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Dumping data for table `user_roles`
--

LOCK TABLES `user_roles` WRITE;
/*!40000 ALTER TABLE `user_roles` DISABLE KEYS */;
INSERT INTO `user_roles` (`id`, `userId`, `roleId`, `familyId`, `areaId`, `grantedBy`, `grantedAt`, `expiresAt`) VALUES ('admin-role-cmtx2pglb000mr473ad507hz3','cmtx2pglb000mr473ad507hz3','cmtx2pfwo0003r473ztflq803',NULL,NULL,NULL,'2026-09-11 14:50:35.701',NULL);
/*!40000 ALTER TABLE `user_roles` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Dumping data for table `users`
--

LOCK TABLES `users` WRITE;
/*!40000 ALTER TABLE `users` DISABLE KEYS */;
INSERT INTO `users` (`id`, `email`, `mobile`, `passwordHash`, `emailVerified`, `mobileVerified`, `status`, `joinIntent`, `lastLoginAt`, `lastLoginIp`, `failedAttempts`, `lockedUntil`, `createdAt`, `updatedAt`, `deletedAt`) VALUES ('cmtx2pglb000mr473ad507hz3','admin@miladwani.com','9000000000','$2a$12$H0PY6RAqqBgSj/p1QtFPOOlJtQetyoLm7J9lT1aFDQGGSfmEVAe6a',1,1,'ACTIVE',NULL,NULL,NULL,0,NULL,'2026-09-11 14:50:28.799','2026-09-11 14:50:28.799',NULL);
/*!40000 ALTER TABLE `users` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Dumping data for table `verification_tokens`
--

LOCK TABLES `verification_tokens` WRITE;
/*!40000 ALTER TABLE `verification_tokens` DISABLE KEYS */;
/*!40000 ALTER TABLE `verification_tokens` ENABLE KEYS */;
UNLOCK TABLES;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2026-09-11 20:21:12
