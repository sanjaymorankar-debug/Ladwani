-- ===========================================================================
-- Mi Ladwani — 01-schema.sql  (STRUCTURE ONLY: 54 tables, no rows)
--
-- Run this FIRST, then 02-reference-data.sql.
--
-- HOW TO USE IN phpMyAdmin (Hostinger shared hosting):
--   1. hPanel > Databases > phpMyAdmin, open your miladwani database.
--   2. Select that database in the LEFT sidebar first — this file contains no
--      CREATE DATABASE/USE statement on purpose, so it imports into whichever
--      database you have selected (your real name is prefixed, e.g.
--      u123456789_miladwani).
--   3. Import tab > Choose File > this file > Go.
--
-- Generated from prisma/migrations by mysqldump (MySQL 8.4). It includes the
-- _prisma_migrations table AND (in file 02) its rows, so a later
-- `npx prisma migrate deploy` sees the migrations as already applied instead
-- of trying to re-create every table.
--
-- Verified: a database built from these two files passes the app's full
-- test suite.
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
-- Table structure for table `_prisma_migrations`
--

/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `_prisma_migrations` (
  `id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `checksum` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `finished_at` datetime(3) DEFAULT NULL,
  `migration_name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `logs` text COLLATE utf8mb4_unicode_ci,
  `rolled_back_at` datetime(3) DEFAULT NULL,
  `started_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `applied_steps_count` int unsigned NOT NULL DEFAULT '0',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `addresses`
--

/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `addresses` (
  `id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `addressableType` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `familyId` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `memberId` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `addressType` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `line1` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `line2` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `city` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `district` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `state` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `country` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'India',
  `pincode` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `isPrimary` tinyint(1) NOT NULL DEFAULT '0',
  `createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` datetime(3) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `addresses_familyId_fkey` (`familyId`),
  KEY `addresses_memberId_fkey` (`memberId`),
  CONSTRAINT `addresses_familyId_fkey` FOREIGN KEY (`familyId`) REFERENCES `families` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `addresses_memberId_fkey` FOREIGN KEY (`memberId`) REFERENCES `members` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `approval_rules`
--

/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `approval_rules` (
  `id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `actionCode` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `requiresApproval` tinyint(1) NOT NULL DEFAULT '1',
  `approverRole` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `autoApproveRole` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `isActive` tinyint(1) NOT NULL DEFAULT '1',
  `updatedAt` datetime(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `approval_rules_actionCode_key` (`actionCode`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `approvals`
--

/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `approvals` (
  `id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `actionCode` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `entityType` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `entityId` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `fieldName` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `oldValue` json DEFAULT NULL,
  `newValue` json DEFAULT NULL,
  `status` enum('DRAFT','SUBMITTED','UNDER_REVIEW','APPROVED','REJECTED','RETURNED','ESCALATED') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'SUBMITTED',
  `submittedBy` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `submittedAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `reviewedBy` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `reviewedAt` datetime(3) DEFAULT NULL,
  `reviewNote` text COLLATE utf8mb4_unicode_ci,
  `reason` text COLLATE utf8mb4_unicode_ci,
  `escalatedTo` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `escalatedAt` datetime(3) DEFAULT NULL,
  `escalationNote` text COLLATE utf8mb4_unicode_ci,
  `createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` datetime(3) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `approvals_submittedBy_fkey` (`submittedBy`),
  KEY `approvals_reviewedBy_fkey` (`reviewedBy`),
  CONSTRAINT `approvals_reviewedBy_fkey` FOREIGN KEY (`reviewedBy`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `approvals_submittedBy_fkey` FOREIGN KEY (`submittedBy`) REFERENCES `users` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `areas`
--

/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `areas` (
  `id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `parentId` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `name` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `type` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `code` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `isActive` tinyint(1) NOT NULL DEFAULT '1',
  `sortOrder` int NOT NULL DEFAULT '0',
  PRIMARY KEY (`id`),
  KEY `areas_parentId_fkey` (`parentId`),
  CONSTRAINT `areas_parentId_fkey` FOREIGN KEY (`parentId`) REFERENCES `areas` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `asset_blackouts`
--

/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `asset_blackouts` (
  `id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `assetId` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `startAt` datetime(3) NOT NULL,
  `endAt` datetime(3) NOT NULL,
  `reason` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `asset_blackouts_assetId_startAt_endAt_idx` (`assetId`,`startAt`,`endAt`),
  CONSTRAINT `asset_blackouts_assetId_fkey` FOREIGN KEY (`assetId`) REFERENCES `assets` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `assets`
--

/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `assets` (
  `id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `ownerMemberId` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `name` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `assetType` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` text COLLATE utf8mb4_unicode_ci,
  `addressLine` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `city` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `district` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `state` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `pincode` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `capacity` int DEFAULT NULL,
  `facilities` json DEFAULT NULL,
  `bookingMode` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'DAILY',
  `ratePerDay` int DEFAULT NULL,
  `ratePerHour` int DEFAULT NULL,
  `status` enum('DRAFT','PENDING_APPROVAL','APPROVED','REJECTED','SUSPENDED') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'DRAFT',
  `reviewedBy` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `reviewedAt` datetime(3) DEFAULT NULL,
  `reviewNote` text COLLATE utf8mb4_unicode_ci,
  `isActive` tinyint(1) NOT NULL DEFAULT '1',
  `createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` datetime(3) NOT NULL,
  `deletedAt` datetime(3) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `assets_status_isActive_idx` (`status`,`isActive`),
  KEY `assets_ownerMemberId_fkey` (`ownerMemberId`),
  CONSTRAINT `assets_ownerMemberId_fkey` FOREIGN KEY (`ownerMemberId`) REFERENCES `members` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `audit_logs`
--

/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `audit_logs` (
  `id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `actorId` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `actorRole` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `action` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `entityType` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `entityId` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `fieldName` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `oldValue` json DEFAULT NULL,
  `newValue` json DEFAULT NULL,
  `approvalId` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `ipAddress` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `userAgent` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `metadata` json DEFAULT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `audit_logs_actorId_fkey` (`actorId`),
  CONSTRAINT `audit_logs_actorId_fkey` FOREIGN KEY (`actorId`) REFERENCES `users` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `blocked_users`
--

/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `blocked_users` (
  `blockerId` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `blockedId` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `reason` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `blockedAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`blockerId`,`blockedId`),
  KEY `blocked_users_blockedId_fkey` (`blockedId`),
  CONSTRAINT `blocked_users_blockedId_fkey` FOREIGN KEY (`blockedId`) REFERENCES `users` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `blocked_users_blockerId_fkey` FOREIGN KEY (`blockerId`) REFERENCES `users` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `bookings`
--

/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `bookings` (
  `id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `reference` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `assetId` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `memberId` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `bookedByUserId` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `startAt` datetime(3) NOT NULL,
  `endAt` datetime(3) NOT NULL,
  `status` enum('PENDING_PAYMENT','CONFIRMED','CANCELLED','COMPLETED','REJECTED','EXPIRED') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'PENDING_PAYMENT',
  `amountPaise` int NOT NULL,
  `guestCount` int DEFAULT NULL,
  `notes` text COLLATE utf8mb4_unicode_ci,
  `cancelledAt` datetime(3) DEFAULT NULL,
  `cancelReason` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` datetime(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `bookings_reference_key` (`reference`),
  KEY `bookings_assetId_startAt_endAt_idx` (`assetId`,`startAt`,`endAt`),
  KEY `bookings_memberId_idx` (`memberId`),
  CONSTRAINT `bookings_assetId_fkey` FOREIGN KEY (`assetId`) REFERENCES `assets` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `bookings_memberId_fkey` FOREIGN KEY (`memberId`) REFERENCES `members` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `businesses`
--

/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `businesses` (
  `id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `memberId` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `businessName` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `businessType` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `industry` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `city` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `country` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `description` text COLLATE utf8mb4_unicode_ci,
  `website` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `establishedYear` int DEFAULT NULL,
  `incomeRangeId` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `isActive` tinyint(1) NOT NULL DEFAULT '1',
  `createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` datetime(3) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `businesses_memberId_fkey` (`memberId`),
  KEY `businesses_incomeRangeId_fkey` (`incomeRangeId`),
  CONSTRAINT `businesses_incomeRangeId_fkey` FOREIGN KEY (`incomeRangeId`) REFERENCES `income_ranges` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `businesses_memberId_fkey` FOREIGN KEY (`memberId`) REFERENCES `members` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `comments`
--

/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `comments` (
  `id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `postId` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `authorId` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `parentId` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `content` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `status` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'ACTIVE',
  `createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` datetime(3) NOT NULL,
  `deletedAt` datetime(3) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `comments_postId_fkey` (`postId`),
  KEY `comments_authorId_fkey` (`authorId`),
  KEY `comments_parentId_fkey` (`parentId`),
  CONSTRAINT `comments_authorId_fkey` FOREIGN KEY (`authorId`) REFERENCES `users` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `comments_parentId_fkey` FOREIGN KEY (`parentId`) REFERENCES `comments` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `comments_postId_fkey` FOREIGN KEY (`postId`) REFERENCES `posts` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `community_group_members`
--

/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `community_group_members` (
  `id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `groupId` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `memberId` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `roleInGroup` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'MEMBER',
  `joinedAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `addedBy` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `leftAt` datetime(3) DEFAULT NULL,
  `leftReason` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `community_group_members_groupId_memberId_key` (`groupId`,`memberId`),
  KEY `community_group_members_memberId_idx` (`memberId`),
  CONSTRAINT `community_group_members_groupId_fkey` FOREIGN KEY (`groupId`) REFERENCES `community_groups` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `community_group_members_memberId_fkey` FOREIGN KEY (`memberId`) REFERENCES `members` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `community_groups`
--

/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `community_groups` (
  `id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `name` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `code` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `groupType` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'MANDAL',
  `description` text COLLATE utf8mb4_unicode_ci,
  `areaId` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `convenerMemberId` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `meetingSchedule` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `maxMembers` int DEFAULT '25',
  `status` enum('DRAFT','PENDING_APPROVAL','ACTIVE','REJECTED','INACTIVE') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'PENDING_APPROVAL',
  `reviewedBy` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `reviewedAt` datetime(3) DEFAULT NULL,
  `reviewNote` text COLLATE utf8mb4_unicode_ci,
  `lastRosterReviewAt` datetime(3) DEFAULT NULL,
  `lastRosterReviewBy` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `rosterReviewIntervalDays` int NOT NULL DEFAULT '180',
  `isActive` tinyint(1) NOT NULL DEFAULT '1',
  `createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` datetime(3) NOT NULL,
  `createdBy` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `deletedAt` datetime(3) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `community_groups_code_key` (`code`),
  KEY `community_groups_status_isActive_idx` (`status`,`isActive`),
  KEY `community_groups_areaId_fkey` (`areaId`),
  KEY `community_groups_convenerMemberId_fkey` (`convenerMemberId`),
  CONSTRAINT `community_groups_areaId_fkey` FOREIGN KEY (`areaId`) REFERENCES `areas` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `community_groups_convenerMemberId_fkey` FOREIGN KEY (`convenerMemberId`) REFERENCES `members` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `consent_records`
--

/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `consent_records` (
  `id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `userId` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `consentType` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `granted` tinyint(1) NOT NULL,
  `version` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `ipAddress` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `userAgent` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `grantedAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `revokedAt` datetime(3) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `consent_records_userId_fkey` (`userId`),
  CONSTRAINT `consent_records_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `education_records`
--

/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `education_records` (
  `id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `memberId` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `level` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `qualification` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `specialization` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `institution` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `yearCompleted` int DEFAULT NULL,
  `isHighest` tinyint(1) NOT NULL DEFAULT '0',
  `isOngoing` tinyint(1) NOT NULL DEFAULT '0',
  `createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` datetime(3) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `education_records_memberId_fkey` (`memberId`),
  CONSTRAINT `education_records_memberId_fkey` FOREIGN KEY (`memberId`) REFERENCES `members` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `employment_records`
--

/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `employment_records` (
  `id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `memberId` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `employmentType` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `employerName` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `designation` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `industry` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `city` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `country` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `incomeRangeId` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `startDate` datetime(3) DEFAULT NULL,
  `endDate` datetime(3) DEFAULT NULL,
  `isCurrent` tinyint(1) NOT NULL DEFAULT '1',
  `createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` datetime(3) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `employment_records_memberId_fkey` (`memberId`),
  KEY `employment_records_incomeRangeId_fkey` (`incomeRangeId`),
  CONSTRAINT `employment_records_incomeRangeId_fkey` FOREIGN KEY (`incomeRangeId`) REFERENCES `income_ranges` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `employment_records_memberId_fkey` FOREIGN KEY (`memberId`) REFERENCES `members` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `families`
--

/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `families` (
  `id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `registrationNumber` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `name` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `surname` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `description` text COLLATE utf8mb4_unicode_ci,
  `kuladevata` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `kuladevi` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `gotra` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `traditionalOccupation` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `nativeVillage` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `nativeDistrict` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `nativeState` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `nativeCountry` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'India',
  `kartaMemberId` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `familyPhotoId` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `status` enum('PENDING','ACTIVE','INACTIVE','MERGED','ARCHIVED') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'PENDING',
  `verificationStatus` enum('UNVERIFIED','VERIFIED','REJECTED') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'UNVERIFIED',
  `verifiedBy` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `verifiedAt` datetime(3) DEFAULT NULL,
  `communityId` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` datetime(3) NOT NULL,
  `createdBy` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `updatedBy` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `deletedAt` datetime(3) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `families_registrationNumber_key` (`registrationNumber`),
  KEY `families_kartaMemberId_fkey` (`kartaMemberId`),
  CONSTRAINT `families_kartaMemberId_fkey` FOREIGN KEY (`kartaMemberId`) REFERENCES `members` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `family_areas`
--

/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `family_areas` (
  `familyId` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `areaId` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `isPrimary` tinyint(1) NOT NULL DEFAULT '0',
  PRIMARY KEY (`familyId`,`areaId`),
  KEY `family_areas_areaId_fkey` (`areaId`),
  CONSTRAINT `family_areas_areaId_fkey` FOREIGN KEY (`areaId`) REFERENCES `areas` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `family_areas_familyId_fkey` FOREIGN KEY (`familyId`) REFERENCES `families` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `family_join_requests`
--

/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `family_join_requests` (
  `id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `familyId` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `memberId` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `relatedToMemberId` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `relationshipTypeCode` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `requestedBy` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `status` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'PENDING',
  `respondedBy` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `respondedAt` datetime(3) DEFAULT NULL,
  `responseNote` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `direction` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'MEMBER_REQUEST',
  PRIMARY KEY (`id`),
  UNIQUE KEY `family_join_requests_familyId_memberId_status_direction_key` (`familyId`,`memberId`,`status`,`direction`),
  KEY `family_join_requests_memberId_fkey` (`memberId`),
  CONSTRAINT `family_join_requests_familyId_fkey` FOREIGN KEY (`familyId`) REFERENCES `families` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `family_join_requests_memberId_fkey` FOREIGN KEY (`memberId`) REFERENCES `members` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `family_members`
--

/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `family_members` (
  `id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `familyId` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `memberId` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `isKarta` tinyint(1) NOT NULL DEFAULT '0',
  `joinedAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `joinedBy` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `leftAt` datetime(3) DEFAULT NULL,
  `leftReason` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `family_members_familyId_memberId_key` (`familyId`,`memberId`),
  KEY `family_members_memberId_fkey` (`memberId`),
  CONSTRAINT `family_members_familyId_fkey` FOREIGN KEY (`familyId`) REFERENCES `families` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `family_members_memberId_fkey` FOREIGN KEY (`memberId`) REFERENCES `members` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `fee_invoices`
--

/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `fee_invoices` (
  `id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `reference` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `feeTypeId` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `familyId` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `memberId` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `amountPaise` int NOT NULL,
  `status` enum('PENDING','PAID','WAIVED','CANCELLED') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'PENDING',
  `dueDate` datetime(3) DEFAULT NULL,
  `paidAt` datetime(3) DEFAULT NULL,
  `waivedBy` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `waiverReason` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` datetime(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `fee_invoices_reference_key` (`reference`),
  KEY `fee_invoices_memberId_status_idx` (`memberId`,`status`),
  KEY `fee_invoices_feeTypeId_fkey` (`feeTypeId`),
  KEY `fee_invoices_familyId_fkey` (`familyId`),
  CONSTRAINT `fee_invoices_familyId_fkey` FOREIGN KEY (`familyId`) REFERENCES `families` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fee_invoices_feeTypeId_fkey` FOREIGN KEY (`feeTypeId`) REFERENCES `fee_types` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `fee_invoices_memberId_fkey` FOREIGN KEY (`memberId`) REFERENCES `members` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `fee_types`
--

/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `fee_types` (
  `id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `code` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `label` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `amountPaise` int NOT NULL,
  `appliesTo` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'FAMILY_KARTA',
  `isActive` tinyint(1) NOT NULL DEFAULT '1',
  `updatedAt` datetime(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `fee_types_code_key` (`code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `field_visibility_defaults`
--

/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `field_visibility_defaults` (
  `entityType` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `fieldName` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `defaultVisibility` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `isUserConfigurable` tinyint(1) NOT NULL DEFAULT '1',
  PRIMARY KEY (`entityType`,`fieldName`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `income_ranges`
--

/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `income_ranges` (
  `id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `label` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `minValue` bigint DEFAULT NULL,
  `maxValue` bigint DEFAULT NULL,
  `sortOrder` int NOT NULL DEFAULT '0',
  `isActive` tinyint(1) NOT NULL DEFAULT '1',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `marital_status_history`
--

/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `marital_status_history` (
  `id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `memberId` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `status` enum('UNMARRIED','MARRIED','WIDOWED','DIVORCED','SEPARATED','NOT_STATED') COLLATE utf8mb4_unicode_ci NOT NULL,
  `effectiveDate` datetime(3) DEFAULT NULL,
  `notes` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `changedBy` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `approvalId` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `marital_status_history_memberId_fkey` (`memberId`),
  KEY `marital_status_history_approvalId_fkey` (`approvalId`),
  CONSTRAINT `marital_status_history_approvalId_fkey` FOREIGN KEY (`approvalId`) REFERENCES `approvals` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `marital_status_history_memberId_fkey` FOREIGN KEY (`memberId`) REFERENCES `members` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `marriage_records`
--

/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `marriage_records` (
  `id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `memberId1` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `memberId2` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `externalSpouseName` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `externalSpouseInfo` json DEFAULT NULL,
  `marriageDate` datetime(3) DEFAULT NULL,
  `marriagePlace` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `status` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'MARRIED',
  `dissolutionDate` datetime(3) DEFAULT NULL,
  `notes` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` datetime(3) NOT NULL,
  `createdBy` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `marriage_records_memberId1_fkey` (`memberId1`),
  KEY `marriage_records_memberId2_fkey` (`memberId2`),
  CONSTRAINT `marriage_records_memberId1_fkey` FOREIGN KEY (`memberId1`) REFERENCES `members` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `marriage_records_memberId2_fkey` FOREIGN KEY (`memberId2`) REFERENCES `members` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `matrimonial_interests`
--

/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `matrimonial_interests` (
  `id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `fromMemberId` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `toMemberId` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `message` text COLLATE utf8mb4_unicode_ci,
  `status` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'PENDING',
  `statusChangedAt` datetime(3) DEFAULT NULL,
  `statusNote` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `matrimonial_interests_fromMemberId_fkey` (`fromMemberId`),
  KEY `matrimonial_interests_toMemberId_fkey` (`toMemberId`),
  CONSTRAINT `matrimonial_interests_fromMemberId_fkey` FOREIGN KEY (`fromMemberId`) REFERENCES `members` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `matrimonial_interests_toMemberId_fkey` FOREIGN KEY (`toMemberId`) REFERENCES `members` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `matrimonial_preferences`
--

/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `matrimonial_preferences` (
  `id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `matrimonialProfileId` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `minAge` int DEFAULT NULL,
  `maxAge` int DEFAULT NULL,
  `preferredGender` enum('MALE','FEMALE','OTHER','NOT_STATED') COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `preferredLocations` json DEFAULT NULL,
  `educationPreference` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `occupationPreference` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `incomeRangeId` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `maritalStatusPref` json DEFAULT NULL,
  `otherPreferences` json DEFAULT NULL,
  `updatedAt` datetime(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `matrimonial_preferences_matrimonialProfileId_key` (`matrimonialProfileId`),
  KEY `matrimonial_preferences_incomeRangeId_fkey` (`incomeRangeId`),
  CONSTRAINT `matrimonial_preferences_incomeRangeId_fkey` FOREIGN KEY (`incomeRangeId`) REFERENCES `income_ranges` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `matrimonial_preferences_matrimonialProfileId_fkey` FOREIGN KEY (`matrimonialProfileId`) REFERENCES `matrimonial_profiles` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `matrimonial_profiles`
--

/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `matrimonial_profiles` (
  `id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `memberId` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `isVisible` tinyint(1) NOT NULL DEFAULT '0',
  `about` text COLLATE utf8mb4_unicode_ci,
  `heightCm` int DEFAULT NULL,
  `languages` json DEFAULT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` datetime(3) NOT NULL,
  `createdBy` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `matrimonial_profiles_memberId_key` (`memberId`),
  CONSTRAINT `matrimonial_profiles_memberId_fkey` FOREIGN KEY (`memberId`) REFERENCES `members` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `matrimonial_saves`
--

/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `matrimonial_saves` (
  `memberId` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `savedMemberId` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `savedAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`memberId`,`savedMemberId`),
  KEY `matrimonial_saves_savedMemberId_fkey` (`savedMemberId`),
  CONSTRAINT `matrimonial_saves_memberId_fkey` FOREIGN KEY (`memberId`) REFERENCES `members` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `matrimonial_saves_savedMemberId_fkey` FOREIGN KEY (`savedMemberId`) REFERENCES `members` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `member_areas`
--

/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `member_areas` (
  `memberId` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `areaId` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `isPrimary` tinyint(1) NOT NULL DEFAULT '0',
  PRIMARY KEY (`memberId`,`areaId`),
  KEY `member_areas_areaId_fkey` (`areaId`),
  CONSTRAINT `member_areas_areaId_fkey` FOREIGN KEY (`areaId`) REFERENCES `areas` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `member_areas_memberId_fkey` FOREIGN KEY (`memberId`) REFERENCES `members` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `member_field_visibility`
--

/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `member_field_visibility` (
  `memberId` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `fieldName` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `visibility` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  PRIMARY KEY (`memberId`,`fieldName`),
  CONSTRAINT `member_field_visibility_memberId_fkey` FOREIGN KEY (`memberId`) REFERENCES `members` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `member_invitations`
--

/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `member_invitations` (
  `id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `memberId` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `email` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `mobile` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `tokenHash` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `status` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'PENDING',
  `invitedBy` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `expiresAt` datetime(3) NOT NULL,
  `acceptedAt` datetime(3) DEFAULT NULL,
  `acceptedBy` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `revokedAt` datetime(3) DEFAULT NULL,
  `revokedBy` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `member_invitations_tokenHash_key` (`tokenHash`),
  KEY `member_invitations_memberId_status_idx` (`memberId`,`status`),
  CONSTRAINT `member_invitations_memberId_fkey` FOREIGN KEY (`memberId`) REFERENCES `members` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `member_relationships`
--

/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `member_relationships` (
  `id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `fromMemberId` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `toMemberId` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `relationshipTypeId` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `familyId` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `isActive` tinyint(1) NOT NULL DEFAULT '1',
  `notes` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` datetime(3) NOT NULL,
  `createdBy` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `member_relationships_fromMemberId_toMemberId_relationshipTyp_key` (`fromMemberId`,`toMemberId`,`relationshipTypeId`),
  KEY `member_relationships_toMemberId_fkey` (`toMemberId`),
  KEY `member_relationships_relationshipTypeId_fkey` (`relationshipTypeId`),
  CONSTRAINT `member_relationships_fromMemberId_fkey` FOREIGN KEY (`fromMemberId`) REFERENCES `members` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `member_relationships_relationshipTypeId_fkey` FOREIGN KEY (`relationshipTypeId`) REFERENCES `relationship_types` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `member_relationships_toMemberId_fkey` FOREIGN KEY (`toMemberId`) REFERENCES `members` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `member_skills`
--

/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `member_skills` (
  `memberId` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `skillId` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `level` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  PRIMARY KEY (`memberId`,`skillId`),
  KEY `member_skills_skillId_fkey` (`skillId`),
  CONSTRAINT `member_skills_memberId_fkey` FOREIGN KEY (`memberId`) REFERENCES `members` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `member_skills_skillId_fkey` FOREIGN KEY (`skillId`) REFERENCES `skills` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `members`
--

/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `members` (
  `id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `memberNumber` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `userId` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `firstName` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `middleName` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `lastName` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `gender` enum('MALE','FEMALE','OTHER','NOT_STATED') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'NOT_STATED',
  `dateOfBirth` datetime(3) DEFAULT NULL,
  `dateOfBirthApprox` tinyint(1) NOT NULL DEFAULT '0',
  `bloodGroup` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `heightCm` int DEFAULT NULL,
  `weightKg` int DEFAULT NULL,
  `bodyType` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `physicalDisability` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `mobilePrimary` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `mobileAlternate` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `email` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `profilePhotoId` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `biography` text COLLATE utf8mb4_unicode_ci,
  `currentCity` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `currentState` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `currentCountry` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `nativeVillage` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `nativeDistrict` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `nativeState` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `nationality` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'Indian',
  `maritalStatus` enum('UNMARRIED','MARRIED','WIDOWED','DIVORCED','SEPARATED','NOT_STATED') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'UNMARRIED',
  `employmentStatus` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `occupationCategory` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `status` enum('ACTIVE','INACTIVE','DECEASED','SUSPENDED') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'ACTIVE',
  `deceasedAt` datetime(3) DEFAULT NULL,
  `deceasedPlace` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `deceasedNotes` text COLLATE utf8mb4_unicode_ci,
  `verificationStatus` enum('UNVERIFIED','VERIFIED','REJECTED') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'UNVERIFIED',
  `createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` datetime(3) NOT NULL,
  `createdBy` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `updatedBy` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `deletedAt` datetime(3) DEFAULT NULL,
  `languages` json DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `members_memberNumber_key` (`memberNumber`),
  UNIQUE KEY `members_userId_key` (`userId`),
  UNIQUE KEY `members_profilePhotoId_key` (`profilePhotoId`),
  CONSTRAINT `members_profilePhotoId_fkey` FOREIGN KEY (`profilePhotoId`) REFERENCES `photos` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `members_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `notifications`
--

/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `notifications` (
  `id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `recipientId` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `senderId` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `type` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `title` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `body` text COLLATE utf8mb4_unicode_ci,
  `data` json DEFAULT NULL,
  `isRead` tinyint(1) NOT NULL DEFAULT '0',
  `readAt` datetime(3) DEFAULT NULL,
  `emailSent` tinyint(1) NOT NULL DEFAULT '0',
  `smsSent` tinyint(1) NOT NULL DEFAULT '0',
  `createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `notifications_recipientId_fkey` (`recipientId`),
  KEY `notifications_senderId_fkey` (`senderId`),
  CONSTRAINT `notifications_recipientId_fkey` FOREIGN KEY (`recipientId`) REFERENCES `users` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `notifications_senderId_fkey` FOREIGN KEY (`senderId`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `payments`
--

/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `payments` (
  `id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `reference` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `purpose` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `bookingId` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `feeInvoiceId` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `memberId` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `paidByUserId` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `amountPaise` int NOT NULL,
  `currency` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'INR',
  `status` enum('CREATED','PENDING','PAID','FAILED','CANCELLED','REFUNDED') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'CREATED',
  `gateway` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'MOCK',
  `gatewayOrderId` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `gatewayPaymentId` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `failureReason` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `paidAt` datetime(3) DEFAULT NULL,
  `refundedPaise` int NOT NULL DEFAULT '0',
  `createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` datetime(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `payments_reference_key` (`reference`),
  KEY `payments_memberId_idx` (`memberId`),
  KEY `payments_status_idx` (`status`),
  KEY `payments_bookingId_fkey` (`bookingId`),
  KEY `payments_feeInvoiceId_fkey` (`feeInvoiceId`),
  CONSTRAINT `payments_bookingId_fkey` FOREIGN KEY (`bookingId`) REFERENCES `bookings` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `payments_feeInvoiceId_fkey` FOREIGN KEY (`feeInvoiceId`) REFERENCES `fee_invoices` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `payments_memberId_fkey` FOREIGN KEY (`memberId`) REFERENCES `members` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `permissions`
--

/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `permissions` (
  `id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `code` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `label` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `module` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `permissions_code_key` (`code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `photos`
--

/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `photos` (
  `id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `ownerType` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `memberId` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `familyId` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `postId` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `assetId` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `uploadedBy` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `storageKey` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `thumbnailKey` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `optimizedKey` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `originalFilename` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `mimeType` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `fileSizeBytes` bigint DEFAULT NULL,
  `width` int DEFAULT NULL,
  `height` int DEFAULT NULL,
  `isProfilePhoto` tinyint(1) NOT NULL DEFAULT '0',
  `caption` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `visibility` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'PRIVATE',
  `status` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'ACTIVE',
  `createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` datetime(3) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `photos_uploadedBy_fkey` (`uploadedBy`),
  KEY `photos_memberId_fkey` (`memberId`),
  KEY `photos_familyId_fkey` (`familyId`),
  KEY `photos_postId_fkey` (`postId`),
  KEY `photos_assetId_fkey` (`assetId`),
  CONSTRAINT `photos_assetId_fkey` FOREIGN KEY (`assetId`) REFERENCES `assets` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `photos_familyId_fkey` FOREIGN KEY (`familyId`) REFERENCES `families` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `photos_memberId_fkey` FOREIGN KEY (`memberId`) REFERENCES `members` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `photos_postId_fkey` FOREIGN KEY (`postId`) REFERENCES `posts` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `photos_uploadedBy_fkey` FOREIGN KEY (`uploadedBy`) REFERENCES `users` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `post_types`
--

/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `post_types` (
  `id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `code` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `label` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `icon` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `requiresApproval` tinyint(1) NOT NULL DEFAULT '0',
  `isActive` tinyint(1) NOT NULL DEFAULT '1',
  PRIMARY KEY (`id`),
  UNIQUE KEY `post_types_code_key` (`code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `posts`
--

/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `posts` (
  `id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `authorId` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `postTypeId` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `title` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `content` text COLLATE utf8mb4_unicode_ci,
  `visibility` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'COMMUNITY',
  `targetAreaId` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `status` enum('DRAFT','PENDING_APPROVAL','PUBLISHED','REJECTED','HIDDEN','REMOVED','FLAGGED') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'PENDING_APPROVAL',
  `reviewedBy` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `reviewedAt` datetime(3) DEFAULT NULL,
  `reviewNote` text COLLATE utf8mb4_unicode_ci,
  `isPinned` tinyint(1) NOT NULL DEFAULT '0',
  `isAnnouncement` tinyint(1) NOT NULL DEFAULT '0',
  `eventDate` datetime(3) DEFAULT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` datetime(3) NOT NULL,
  `deletedAt` datetime(3) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `posts_authorId_fkey` (`authorId`),
  KEY `posts_postTypeId_fkey` (`postTypeId`),
  KEY `posts_targetAreaId_fkey` (`targetAreaId`),
  CONSTRAINT `posts_authorId_fkey` FOREIGN KEY (`authorId`) REFERENCES `users` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `posts_postTypeId_fkey` FOREIGN KEY (`postTypeId`) REFERENCES `post_types` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `posts_targetAreaId_fkey` FOREIGN KEY (`targetAreaId`) REFERENCES `areas` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `reactions`
--

/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `reactions` (
  `id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `postId` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `commentId` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `userId` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `reactionType` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'LIKE',
  `createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `reactions_postId_userId_key` (`postId`,`userId`),
  UNIQUE KEY `reactions_commentId_userId_key` (`commentId`,`userId`),
  KEY `reactions_userId_fkey` (`userId`),
  CONSTRAINT `reactions_commentId_fkey` FOREIGN KEY (`commentId`) REFERENCES `comments` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `reactions_postId_fkey` FOREIGN KEY (`postId`) REFERENCES `posts` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `reactions_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `refresh_tokens`
--

/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `refresh_tokens` (
  `id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `userId` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `tokenHash` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `deviceInfo` json DEFAULT NULL,
  `ipAddress` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `expiresAt` datetime(3) NOT NULL,
  `revokedAt` datetime(3) DEFAULT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `refresh_tokens_tokenHash_key` (`tokenHash`),
  KEY `refresh_tokens_userId_fkey` (`userId`),
  CONSTRAINT `refresh_tokens_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `relationship_types`
--

/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `relationship_types` (
  `id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `code` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `label` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `inverseCode` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `genderApplicable` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `isSpouse` tinyint(1) NOT NULL DEFAULT '0',
  `isActive` tinyint(1) NOT NULL DEFAULT '1',
  `sortOrder` int NOT NULL DEFAULT '0',
  PRIMARY KEY (`id`),
  UNIQUE KEY `relationship_types_code_key` (`code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `reports`
--

/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `reports` (
  `id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `reportableType` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `reportableId` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `reporterId` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `reason` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` text COLLATE utf8mb4_unicode_ci,
  `status` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'PENDING',
  `resolvedBy` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `resolutionNote` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `resolvedAt` datetime(3) DEFAULT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `reports_reporterId_fkey` (`reporterId`),
  CONSTRAINT `reports_reporterId_fkey` FOREIGN KEY (`reporterId`) REFERENCES `users` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `role_permissions`
--

/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `role_permissions` (
  `roleId` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `permissionId` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  PRIMARY KEY (`roleId`,`permissionId`),
  KEY `role_permissions_permissionId_fkey` (`permissionId`),
  CONSTRAINT `role_permissions_permissionId_fkey` FOREIGN KEY (`permissionId`) REFERENCES `permissions` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `role_permissions_roleId_fkey` FOREIGN KEY (`roleId`) REFERENCES `roles` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `roles`
--

/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `roles` (
  `id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `code` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `label` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `isSystem` tinyint(1) NOT NULL DEFAULT '0',
  `createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `roles_code_key` (`code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `settings`
--

/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `settings` (
  `id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `key` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `value` json NOT NULL,
  `description` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `updatedBy` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `updatedAt` datetime(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `settings_key_key` (`key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `skills`
--

/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `skills` (
  `id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `name` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `category` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `isActive` tinyint(1) NOT NULL DEFAULT '1',
  `sortOrder` int NOT NULL DEFAULT '0',
  PRIMARY KEY (`id`),
  UNIQUE KEY `skills_name_key` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `user_roles`
--

/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `user_roles` (
  `id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `userId` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `roleId` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `familyId` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `areaId` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `grantedBy` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `grantedAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `expiresAt` datetime(3) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `user_roles_userId_fkey` (`userId`),
  KEY `user_roles_roleId_fkey` (`roleId`),
  KEY `user_roles_familyId_fkey` (`familyId`),
  KEY `user_roles_areaId_fkey` (`areaId`),
  CONSTRAINT `user_roles_areaId_fkey` FOREIGN KEY (`areaId`) REFERENCES `areas` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `user_roles_familyId_fkey` FOREIGN KEY (`familyId`) REFERENCES `families` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `user_roles_roleId_fkey` FOREIGN KEY (`roleId`) REFERENCES `roles` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `user_roles_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `users`
--

/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `users` (
  `id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `email` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `mobile` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `passwordHash` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `emailVerified` tinyint(1) NOT NULL DEFAULT '0',
  `mobileVerified` tinyint(1) NOT NULL DEFAULT '0',
  `status` enum('PENDING','ACTIVE','SUSPENDED','BLOCKED','DEACTIVATED') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'PENDING',
  `joinIntent` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `lastLoginAt` datetime(3) DEFAULT NULL,
  `lastLoginIp` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `failedAttempts` int NOT NULL DEFAULT '0',
  `lockedUntil` datetime(3) DEFAULT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` datetime(3) NOT NULL,
  `deletedAt` datetime(3) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `users_email_key` (`email`),
  UNIQUE KEY `users_mobile_key` (`mobile`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `verification_tokens`
--

/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `verification_tokens` (
  `id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `userId` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `type` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `tokenHash` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `expiresAt` datetime(3) NOT NULL,
  `usedAt` datetime(3) DEFAULT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `verification_tokens_userId_fkey` (`userId`),
  CONSTRAINT `verification_tokens_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2026-09-11 21:02:31
