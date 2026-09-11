-- ===========================================================================
-- Mi Ladwani — 02-reference-data.sql  (DATA ONLY: no CREATE TABLE)
--
-- Run this SECOND, after 01-schema.sql, into the same database.
--
-- Contains ONLY reference/config data the app needs to function: roles, the
-- permission matrix, relationship types, approval rules, post types, areas,
-- income ranges, settings, the family registration fee type, the
-- _prisma_migrations rows, and ONE admin login:
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
INSERT INTO `_prisma_migrations` (`id`, `checksum`, `finished_at`, `migration_name`, `logs`, `rolled_back_at`, `started_at`, `applied_steps_count`) VALUES ('105fdd6e-a06b-4c50-b29c-c65959c918bb','c82675ee4126d590035b047acd84502263f41828cbe5b8711bc3436e1e302f9b','2026-09-11 15:32:05.379','20260911150000_member_invitations_and_join_direction',NULL,NULL,'2026-09-11 15:32:05.267',1),('a6e63255-87ae-4703-9655-3de43ffabbdc','584c8fab176b065f3aedbdf8d0012d17cbc1ab48026c15c30caeaf85f667372d','2026-09-11 15:32:05.158','20260910163143_init',NULL,NULL,'2026-09-11 15:32:01.408',1);
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
INSERT INTO `approval_rules` (`id`, `actionCode`, `requiresApproval`, `approverRole`, `autoApproveRole`, `isActive`, `updatedAt`) VALUES ('cmtx47b0y001j10n9vqwadozz','family.create',1,'OPERATOR',NULL,1,'2026-09-11 15:32:21.010'),('cmtx47b14001k10n9i5frcsdl','family.member.add',1,'OPERATOR',NULL,1,'2026-09-11 15:32:21.017'),('cmtx47b18001l10n9hv4p9m3y','member.marital_status.change',1,'OPERATOR',NULL,1,'2026-09-11 15:32:21.021'),('cmtx47b1e001m10n9tpswylku','member.mark_deceased',1,'OPERATOR',NULL,1,'2026-09-11 15:32:21.026'),('cmtx47b1h001n10n9krmk8krf','member.relationship.change',1,'OPERATOR',NULL,1,'2026-09-11 15:32:21.029'),('cmtx47b1l001o10n9x0y7nkhl','family.karta.change',1,'ADMIN',NULL,1,'2026-09-11 15:32:21.033'),('cmtx47b1o001p10n9xyr2kp00','family.merge',1,'ADMIN',NULL,1,'2026-09-11 15:32:21.037'),('cmtx47b1t001q10n9jetyvm2j','member.edit_own',0,NULL,'MEMBER',1,'2026-09-11 15:32:21.041'),('cmtx47b1y001r10n983963bi6','member.education.edit_own',0,NULL,'MEMBER',1,'2026-09-11 15:32:21.046'),('cmtx47b22001s10n9j39iuxah','member.employment.edit_own',0,NULL,'MEMBER',1,'2026-09-11 15:32:21.050'),('cmtx47b3x001x10n94pq5rclt','asset.create',1,'OPERATOR',NULL,1,'2026-09-11 15:32:21.117'),('cmtx47b40001y10n9ndmk3zjw','group.create',1,'OPERATOR',NULL,1,'2026-09-11 15:32:21.120');
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
INSERT INTO `fee_types` (`id`, `code`, `label`, `description`, `amountPaise`, `appliesTo`, `isActive`, `updatedAt`) VALUES ('cmtx47b3t001w10n93t5j0ivk','FAMILY_REGISTRATION','Family Registration Fee','One-time fee payable by the Karta when a new family is registered. Other family members join free.',200000,'FAMILY_KARTA',1,'2026-09-11 15:32:21.113');
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
-- Dumping data for table `member_invitations`
--

LOCK TABLES `member_invitations` WRITE;
/*!40000 ALTER TABLE `member_invitations` DISABLE KEYS */;
/*!40000 ALTER TABLE `member_invitations` ENABLE KEYS */;
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
INSERT INTO `members` (`id`, `memberNumber`, `userId`, `firstName`, `middleName`, `lastName`, `gender`, `dateOfBirth`, `dateOfBirthApprox`, `bloodGroup`, `heightCm`, `weightKg`, `bodyType`, `physicalDisability`, `mobilePrimary`, `mobileAlternate`, `email`, `profilePhotoId`, `biography`, `currentCity`, `currentState`, `currentCountry`, `nativeVillage`, `nativeDistrict`, `nativeState`, `nationality`, `maritalStatus`, `employmentStatus`, `occupationCategory`, `status`, `deceasedAt`, `deceasedPlace`, `deceasedNotes`, `verificationStatus`, `createdAt`, `updatedAt`, `createdBy`, `updatedBy`, `deletedAt`) VALUES ('cmtx47awg000o10n9jheg61hy','MEM-ADMIN-001','cmtx47avs000m10n9kfi4gro9','Admin',NULL,'Ladwani','MALE',NULL,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'Indian','UNMARRIED',NULL,NULL,'ACTIVE',NULL,NULL,NULL,'UNVERIFIED','2026-09-11 15:32:20.848','2026-09-11 15:32:20.848',NULL,NULL,NULL);
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
INSERT INTO `permissions` (`id`, `code`, `label`, `module`) VALUES ('cmtx47afd000510n9lrdlvx0r','family:create','Register a new family','family'),('cmtx47afr000610n9s94an4zi','family:edit_own','Edit own family','family'),('cmtx47afu000710n9ki0kv41n','family:edit_any','Edit any family','family'),('cmtx47afx000810n9iu9ov4ye','family:member_add','Add members to own family','family'),('cmtx47ag0000910n95w2n8m8a','family:view_tree','View own family tree','family'),('cmtx47ag3000a10n9ib4onw2o','family:approve','Verify/approve families','family'),('cmtx47ag5000b10n9nbdtnhkx','member:edit_own','Edit own member profile','member'),('cmtx47ag7000c10n9k6hjk9zs','member:edit_any','Edit any member profile','member'),('cmtx47ag9000d10n9jaibzmv6','member:mark_deceased','Mark a member deceased','member'),('cmtx47agc000e10n95lml61cb','matrimony:manage_own','Manage own matrimonial profile','matrimony'),('cmtx47age000f10n90cro8x1e','approval:review','Review approval requests','approval'),('cmtx47agh000g10n9bzf4iqxx','admin:users','Manage users and roles','admin'),('cmtx47agk000h10n9iy7hh34k','admin:settings','Manage platform settings','admin'),('cmtx47agn000i10n9t74vdjjj','admin:audit','View audit logs','admin'),('cmtx47agq000j10n9qvdhdjx5','asset:manage_own','Manage own assets','asset'),('cmtx47ags000k10n9hzgp16ho','group:manage_own','Register and convene community groups','group'),('cmtx47agv000l10n9sv3yburj','group:approve','Approve community groups','group');
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
INSERT INTO `post_types` (`id`, `code`, `label`, `icon`, `requiresApproval`, `isActive`) VALUES ('cmtx47awv000p10n9819d4sq6','GENERAL','General','📌',0,1),('cmtx47ax2000q10n9uhfcprvz','ANNOUNCEMENT','Announcement','📢',0,1),('cmtx47ax7000r10n9dy4gp0iw','EVENT','Event','🎉',0,1),('cmtx47axc000s10n9gwndf463','ACHIEVEMENT','Achievement','🏆',0,1),('cmtx47axg000t10n97snpiugi','BIRTHDAY','Birthday','🎂',0,1),('cmtx47axk000u10n9wtqfiq7x','MARRIAGE','Marriage','💒',0,1),('cmtx47axp000v10n9y7bz8y7f','CONDOLENCE','Condolence','🙏',0,1),('cmtx47axy000w10n9iqbk24as','JOB','Job Opportunity','💼',0,1),('cmtx47ay3000x10n9tgb7gfbr','BUSINESS','Business','🏢',0,1),('cmtx47ay7000y10n9fmfnfgm8','LOST_FOUND','Lost & Found','🔍',0,1);
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
INSERT INTO `relationship_types` (`id`, `code`, `label`, `inverseCode`, `genderApplicable`, `isSpouse`, `isActive`, `sortOrder`) VALUES ('cmtx47ayb000z10n9pyvnlx7o','father','Father','son','MALE',0,1,0),('cmtx47ayj001010n966wac400','mother','Mother','son','FEMALE',0,1,0),('cmtx47ayo001110n9m01lxi3t','son','Son','father','MALE',0,1,0),('cmtx47ayr001210n9oqge8af1','daughter','Daughter','father','FEMALE',0,1,0),('cmtx47ayv001310n9vmvf62mt','husband','Husband','wife','MALE',1,1,0),('cmtx47az0001410n93zashbr8','wife','Wife','husband','FEMALE',1,1,0),('cmtx47az5001510n9yxb5d26w','brother','Brother','brother','MALE',0,1,0),('cmtx47aza001610n91cctmzs8','sister','Sister','brother','FEMALE',0,1,0),('cmtx47aze001710n9wa7ht4lb','grandfather_p','Grandfather (Paternal)','grandson','MALE',0,1,0),('cmtx47azl001810n9tmd2lxlq','grandmother_p','Grandmother (Paternal)','grandson','FEMALE',0,1,0),('cmtx47azq001910n9vzewuzku','grandson','Grandson','grandfather_p','MALE',0,1,0),('cmtx47azu001a10n9sskn3iwy','granddaughter','Granddaughter','grandfather_p','FEMALE',0,1,0),('cmtx47azy001b10n9wiwtq1hu','uncle','Uncle','nephew','MALE',0,1,0),('cmtx47b03001c10n9hi94az6m','aunt','Aunt','nephew','FEMALE',0,1,0),('cmtx47b07001d10n97cpqqsal','nephew','Nephew','uncle','MALE',0,1,0),('cmtx47b0b001e10n9jkqwkccz','niece','Niece','uncle','FEMALE',0,1,0),('cmtx47b0f001f10n9y7jf6upi','son_in_law','Son-in-law','father_in_law','MALE',0,1,0),('cmtx47b0k001g10n9owzqxk6i','daughter_in_law','Daughter-in-law','father_in_law','FEMALE',0,1,0),('cmtx47b0n001h10n9c7nrmdd9','father_in_law','Father-in-law','son_in_law','MALE',0,1,0),('cmtx47b0s001i10n9pwneh4xn','mother_in_law','Mother-in-law','son_in_law','FEMALE',0,1,0);
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
INSERT INTO `role_permissions` (`roleId`, `permissionId`) VALUES ('cmtx47ae1000210n9d8yrriz0','cmtx47afd000510n9lrdlvx0r'),('cmtx47aee000310n9eskw3r63','cmtx47afd000510n9lrdlvx0r'),('cmtx47ae1000210n9d8yrriz0','cmtx47afr000610n9s94an4zi'),('cmtx47aee000310n9eskw3r63','cmtx47afr000610n9s94an4zi'),('cmtx47ae1000110n9g7f6idpo','cmtx47afu000710n9ki0kv41n'),('cmtx47ae1000210n9d8yrriz0','cmtx47afu000710n9ki0kv41n'),('cmtx47ae1000110n9g7f6idpo','cmtx47afx000810n9iu9ov4ye'),('cmtx47ae1000210n9d8yrriz0','cmtx47afx000810n9iu9ov4ye'),('cmtx47aee000310n9eskw3r63','cmtx47afx000810n9iu9ov4ye'),('cmtx47adz000010n9k7pvy4ge','cmtx47ag0000910n95w2n8m8a'),('cmtx47ae1000110n9g7f6idpo','cmtx47ag0000910n95w2n8m8a'),('cmtx47ae1000210n9d8yrriz0','cmtx47ag0000910n95w2n8m8a'),('cmtx47aee000310n9eskw3r63','cmtx47ag0000910n95w2n8m8a'),('cmtx47aey000410n9j493g77e','cmtx47ag0000910n95w2n8m8a'),('cmtx47ae1000110n9g7f6idpo','cmtx47ag3000a10n9ib4onw2o'),('cmtx47ae1000210n9d8yrriz0','cmtx47ag3000a10n9ib4onw2o'),('cmtx47adz000010n9k7pvy4ge','cmtx47ag5000b10n9nbdtnhkx'),('cmtx47ae1000110n9g7f6idpo','cmtx47ag5000b10n9nbdtnhkx'),('cmtx47ae1000210n9d8yrriz0','cmtx47ag5000b10n9nbdtnhkx'),('cmtx47aee000310n9eskw3r63','cmtx47ag5000b10n9nbdtnhkx'),('cmtx47aey000410n9j493g77e','cmtx47ag5000b10n9nbdtnhkx'),('cmtx47ae1000110n9g7f6idpo','cmtx47ag7000c10n9k6hjk9zs'),('cmtx47ae1000210n9d8yrriz0','cmtx47ag7000c10n9k6hjk9zs'),('cmtx47ae1000110n9g7f6idpo','cmtx47ag9000d10n9jaibzmv6'),('cmtx47ae1000210n9d8yrriz0','cmtx47ag9000d10n9jaibzmv6'),('cmtx47adz000010n9k7pvy4ge','cmtx47agc000e10n95lml61cb'),('cmtx47ae1000110n9g7f6idpo','cmtx47agc000e10n95lml61cb'),('cmtx47ae1000210n9d8yrriz0','cmtx47agc000e10n95lml61cb'),('cmtx47aee000310n9eskw3r63','cmtx47agc000e10n95lml61cb'),('cmtx47aey000410n9j493g77e','cmtx47agc000e10n95lml61cb'),('cmtx47ae1000110n9g7f6idpo','cmtx47age000f10n90cro8x1e'),('cmtx47ae1000210n9d8yrriz0','cmtx47age000f10n90cro8x1e'),('cmtx47ae1000210n9d8yrriz0','cmtx47agh000g10n9bzf4iqxx'),('cmtx47ae1000210n9d8yrriz0','cmtx47agk000h10n9iy7hh34k'),('cmtx47ae1000210n9d8yrriz0','cmtx47agn000i10n9t74vdjjj'),('cmtx47ae1000210n9d8yrriz0','cmtx47agq000j10n9qvdhdjx5'),('cmtx47aey000410n9j493g77e','cmtx47agq000j10n9qvdhdjx5'),('cmtx47adz000010n9k7pvy4ge','cmtx47ags000k10n9hzgp16ho'),('cmtx47ae1000110n9g7f6idpo','cmtx47ags000k10n9hzgp16ho'),('cmtx47ae1000210n9d8yrriz0','cmtx47ags000k10n9hzgp16ho'),('cmtx47aee000310n9eskw3r63','cmtx47ags000k10n9hzgp16ho'),('cmtx47aey000410n9j493g77e','cmtx47ags000k10n9hzgp16ho'),('cmtx47ae1000110n9g7f6idpo','cmtx47agv000l10n9sv3yburj'),('cmtx47ae1000210n9d8yrriz0','cmtx47agv000l10n9sv3yburj');
/*!40000 ALTER TABLE `role_permissions` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Dumping data for table `roles`
--

LOCK TABLES `roles` WRITE;
/*!40000 ALTER TABLE `roles` DISABLE KEYS */;
INSERT INTO `roles` (`id`, `code`, `label`, `description`, `isSystem`, `createdAt`) VALUES ('cmtx47adz000010n9k7pvy4ge','MEMBER','Member',NULL,1,'2026-09-11 15:32:20.181'),('cmtx47ae1000110n9g7f6idpo','OPERATOR','Operator',NULL,1,'2026-09-11 15:32:20.181'),('cmtx47ae1000210n9d8yrriz0','ADMIN','Administrator',NULL,1,'2026-09-11 15:32:20.181'),('cmtx47aee000310n9eskw3r63','KARTA','Family Head (Karta)',NULL,1,'2026-09-11 15:32:20.181'),('cmtx47aey000410n9j493g77e','ASSET_OWNER','Asset Owner',NULL,1,'2026-09-11 15:32:20.181');
/*!40000 ALTER TABLE `roles` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Dumping data for table `settings`
--

LOCK TABLES `settings` WRITE;
/*!40000 ALTER TABLE `settings` DISABLE KEYS */;
INSERT INTO `settings` (`id`, `key`, `value`, `description`, `updatedBy`, `updatedAt`) VALUES ('cmtx47b3f001t10n9y0tjlrov','community.name','\"\\\"Ladwani Samaj\\\"\"','Community display name',NULL,'2026-09-11 15:32:21.100'),('cmtx47b3l001u10n92j6q03ra','community.tagline','\"\\\"Our Community, Our Heritage, Our Future\\\"\"','Community tagline',NULL,'2026-09-11 15:32:21.105'),('cmtx47b3p001v10n9gbhyjy3c','matrimony.contact_exchange','\"\\\"ACCEPT_FIRST\\\"\"','When to reveal contact: ACCEPT_FIRST or FAMILY_APPROVAL',NULL,'2026-09-11 15:32:21.110');
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
INSERT INTO `user_roles` (`id`, `userId`, `roleId`, `familyId`, `areaId`, `grantedBy`, `grantedAt`, `expiresAt`) VALUES ('admin-role-cmtx47avs000m10n9kfi4gro9','cmtx47avs000m10n9kfi4gro9','cmtx47ae1000210n9d8yrriz0',NULL,NULL,NULL,'2026-09-11 15:32:20.837',NULL);
/*!40000 ALTER TABLE `user_roles` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Dumping data for table `users`
--

LOCK TABLES `users` WRITE;
/*!40000 ALTER TABLE `users` DISABLE KEYS */;
INSERT INTO `users` (`id`, `email`, `mobile`, `passwordHash`, `emailVerified`, `mobileVerified`, `status`, `joinIntent`, `lastLoginAt`, `lastLoginIp`, `failedAttempts`, `lockedUntil`, `createdAt`, `updatedAt`, `deletedAt`) VALUES ('cmtx47avs000m10n9kfi4gro9','admin@miladwani.com','9000000000','$2a$12$omENyQrsyQ49fgkEy.cE/OiDDJsejhu2wroU67suQsfRwpOwQBUZG',1,1,'ACTIVE',NULL,NULL,NULL,0,NULL,'2026-09-11 15:32:20.824','2026-09-11 15:32:20.824',NULL);
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

-- Dump completed on 2026-09-11 21:02:32
