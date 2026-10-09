-- ===========================================================================
-- Mi Ladwani — 01-schema.sql  (STRUCTURE ONLY: 71 tables + _prisma_migrations, no rows)
--
-- Run this FIRST, then 02-reference-data.sql, into an EMPTY PostgreSQL
-- database (PostgreSQL 14 or newer). Everything is created in the `public`
-- schema.
--
-- HOW TO RUN:
--   psql:     psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f scripts/postgres/01-schema.sql
--   pgAdmin:  right-click the database > Query Tool > open this file > Execute (F5).
--   A hosted provider's SQL editor (Supabase, Neon, ...) works the same way:
--   paste the file and run it.
--
-- This file contains no CREATE DATABASE statement on purpose, so it builds
-- the schema in whichever database you are connected to.
--
-- Generated with pg_dump from a database built by `npx prisma migrate deploy`.
-- It includes the _prisma_migrations table AND (in file 02) its row, so a
-- later `npx prisma migrate deploy` sees the migration as already applied
-- instead of trying to re-create every table.
--
-- Verified: a database built from these two files passes the app's full
-- test suite. Regenerate after any schema change — see README.md here.
-- ===========================================================================

--
-- PostgreSQL database dump
--


-- Dumped from database version 16.15 (Ubuntu 16.15-0ubuntu0.24.04.1)
-- Dumped by pg_dump version 16.15 (Ubuntu 16.15-0ubuntu0.24.04.1)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: ApprovalStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."ApprovalStatus" AS ENUM (
    'DRAFT',
    'SUBMITTED',
    'UNDER_REVIEW',
    'APPROVED',
    'REJECTED',
    'RETURNED',
    'ESCALATED'
);


--
-- Name: AssetStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."AssetStatus" AS ENUM (
    'DRAFT',
    'PENDING_APPROVAL',
    'APPROVED',
    'REJECTED',
    'SUSPENDED'
);


--
-- Name: BookingStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."BookingStatus" AS ENUM (
    'PENDING_PAYMENT',
    'CONFIRMED',
    'CANCELLED',
    'COMPLETED',
    'REJECTED',
    'EXPIRED'
);


--
-- Name: FamilyStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."FamilyStatus" AS ENUM (
    'PENDING',
    'ACTIVE',
    'INACTIVE',
    'MERGED',
    'ARCHIVED'
);


--
-- Name: FeeInvoiceStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."FeeInvoiceStatus" AS ENUM (
    'PENDING',
    'PAID',
    'WAIVED',
    'CANCELLED'
);


--
-- Name: Gender; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."Gender" AS ENUM (
    'MALE',
    'FEMALE',
    'OTHER',
    'NOT_STATED'
);


--
-- Name: GroupStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."GroupStatus" AS ENUM (
    'DRAFT',
    'PENDING_APPROVAL',
    'ACTIVE',
    'REJECTED',
    'INACTIVE'
);


--
-- Name: MaritalStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."MaritalStatus" AS ENUM (
    'UNMARRIED',
    'MARRIED',
    'WIDOWED',
    'DIVORCED',
    'SEPARATED',
    'NOT_STATED'
);


--
-- Name: MemberStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."MemberStatus" AS ENUM (
    'ACTIVE',
    'INACTIVE',
    'DECEASED',
    'SUSPENDED'
);


--
-- Name: PaymentStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."PaymentStatus" AS ENUM (
    'CREATED',
    'PENDING',
    'PAID',
    'FAILED',
    'CANCELLED',
    'REFUNDED'
);


--
-- Name: PostStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."PostStatus" AS ENUM (
    'DRAFT',
    'PENDING_APPROVAL',
    'PUBLISHED',
    'REJECTED',
    'HIDDEN',
    'REMOVED',
    'FLAGGED'
);


--
-- Name: UserStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."UserStatus" AS ENUM (
    'PENDING',
    'ACTIVE',
    'SUSPENDED',
    'BLOCKED',
    'DEACTIVATED'
);


--
-- Name: VerificationStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."VerificationStatus" AS ENUM (
    'UNVERIFIED',
    'VERIFIED',
    'REJECTED'
);


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: _prisma_migrations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public._prisma_migrations (
    id character varying(36) NOT NULL,
    checksum character varying(64) NOT NULL,
    finished_at timestamp with time zone,
    migration_name character varying(255) NOT NULL,
    logs text,
    rolled_back_at timestamp with time zone,
    started_at timestamp with time zone DEFAULT now() NOT NULL,
    applied_steps_count integer DEFAULT 0 NOT NULL
);


--
-- Name: addresses; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.addresses (
    id text NOT NULL,
    "addressableType" text NOT NULL,
    "familyId" text,
    "memberId" text,
    "addressType" text NOT NULL,
    line1 text,
    line2 text,
    city text,
    district text,
    state text,
    country text DEFAULT 'India'::text NOT NULL,
    pincode text,
    taluka text,
    latitude double precision,
    longitude double precision,
    "isPrimary" boolean DEFAULT false NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: approval_rules; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.approval_rules (
    id text NOT NULL,
    "actionCode" text NOT NULL,
    "requiresApproval" boolean DEFAULT true NOT NULL,
    "approverRole" text,
    "autoApproveRole" text,
    "isActive" boolean DEFAULT true NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: approvals; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.approvals (
    id text NOT NULL,
    "actionCode" text NOT NULL,
    "entityType" text,
    "entityId" text,
    "fieldName" text,
    "oldValue" jsonb,
    "newValue" jsonb,
    status public."ApprovalStatus" DEFAULT 'SUBMITTED'::public."ApprovalStatus" NOT NULL,
    "submittedBy" text NOT NULL,
    "submittedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "reviewedBy" text,
    "reviewedAt" timestamp(3) without time zone,
    "reviewNote" text,
    reason text,
    "escalatedTo" text,
    "escalatedAt" timestamp(3) without time zone,
    "escalationNote" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: areas; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.areas (
    id text NOT NULL,
    "parentId" text,
    name text NOT NULL,
    type text NOT NULL,
    code text,
    "isActive" boolean DEFAULT true NOT NULL,
    "sortOrder" integer DEFAULT 0 NOT NULL
);


--
-- Name: asset_blackouts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.asset_blackouts (
    id text NOT NULL,
    "assetId" text NOT NULL,
    "startAt" timestamp(3) without time zone NOT NULL,
    "endAt" timestamp(3) without time zone NOT NULL,
    reason text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: assets; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.assets (
    id text NOT NULL,
    "ownerMemberId" text NOT NULL,
    name text NOT NULL,
    "assetType" text NOT NULL,
    description text,
    "addressLine" text,
    city text,
    district text,
    state text,
    pincode text,
    capacity integer,
    facilities jsonb,
    "bookingMode" text DEFAULT 'DAILY'::text NOT NULL,
    "ratePerDay" integer,
    "ratePerHour" integer,
    status public."AssetStatus" DEFAULT 'DRAFT'::public."AssetStatus" NOT NULL,
    "reviewedBy" text,
    "reviewedAt" timestamp(3) without time zone,
    "reviewNote" text,
    "isActive" boolean DEFAULT true NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "deletedAt" timestamp(3) without time zone
);


--
-- Name: audit_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.audit_logs (
    id text NOT NULL,
    "actorId" text NOT NULL,
    "actorRole" text,
    action text NOT NULL,
    "entityType" text,
    "entityId" text,
    "fieldName" text,
    "oldValue" jsonb,
    "newValue" jsonb,
    "approvalId" text,
    "ipAddress" text,
    "userAgent" text,
    metadata jsonb,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: blocked_users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.blocked_users (
    "blockerId" text NOT NULL,
    "blockedId" text NOT NULL,
    reason text,
    "blockedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: bookings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.bookings (
    id text NOT NULL,
    reference text NOT NULL,
    "assetId" text NOT NULL,
    "memberId" text NOT NULL,
    "bookedByUserId" text NOT NULL,
    "startAt" timestamp(3) without time zone NOT NULL,
    "endAt" timestamp(3) without time zone NOT NULL,
    status public."BookingStatus" DEFAULT 'PENDING_PAYMENT'::public."BookingStatus" NOT NULL,
    "amountPaise" integer NOT NULL,
    "guestCount" integer,
    notes text,
    "cancelledAt" timestamp(3) without time zone,
    "cancelReason" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: businesses; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.businesses (
    id text NOT NULL,
    "memberId" text NOT NULL,
    "businessName" text,
    "businessType" text,
    industry text,
    city text,
    country text,
    description text,
    website text,
    "establishedYear" integer,
    "incomeRangeId" text,
    "isActive" boolean DEFAULT true NOT NULL,
    contact text,
    "showInDirectory" boolean DEFAULT false,
    "supportNeeds" jsonb,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: comments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.comments (
    id text NOT NULL,
    "postId" text NOT NULL,
    "authorId" text NOT NULL,
    "parentId" text,
    content text NOT NULL,
    status text DEFAULT 'ACTIVE'::text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "deletedAt" timestamp(3) without time zone
);


--
-- Name: community_group_members; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.community_group_members (
    id text NOT NULL,
    "groupId" text NOT NULL,
    "memberId" text NOT NULL,
    "roleInGroup" text DEFAULT 'MEMBER'::text NOT NULL,
    "joinedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "addedBy" text,
    "leftAt" timestamp(3) without time zone,
    "leftReason" text,
    "autoJoined" boolean DEFAULT false,
    "notifyMode" text DEFAULT 'DAILY_DIGEST'::text,
    "isMuted" boolean DEFAULT false,
    "rulesAcceptedAt" timestamp(3) without time zone,
    "lastDigestAt" timestamp(3) without time zone
);


--
-- Name: community_groups; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.community_groups (
    id text NOT NULL,
    name text NOT NULL,
    code text,
    "groupType" text DEFAULT 'MANDAL'::text NOT NULL,
    description text,
    "areaId" text,
    "convenerMemberId" text,
    "meetingSchedule" text,
    "maxMembers" integer DEFAULT 25,
    status public."GroupStatus" DEFAULT 'PENDING_APPROVAL'::public."GroupStatus" NOT NULL,
    "reviewedBy" text,
    "reviewedAt" timestamp(3) without time zone,
    "reviewNote" text,
    "lastRosterReviewAt" timestamp(3) without time zone,
    "lastRosterReviewBy" text,
    "rosterReviewIntervalDays" integer DEFAULT 180 NOT NULL,
    "isActive" boolean DEFAULT true NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "createdBy" text,
    "deletedAt" timestamp(3) without time zone,
    "groupKey" text,
    "autoKey" text,
    "interestId" text,
    "parentGroupId" text,
    district text,
    "isChildSafe" boolean DEFAULT false,
    rules text
);


--
-- Name: consent_records; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.consent_records (
    id text NOT NULL,
    "userId" text NOT NULL,
    "consentType" text NOT NULL,
    granted boolean NOT NULL,
    version text,
    "ipAddress" text,
    "userAgent" text,
    "grantedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "revokedAt" timestamp(3) without time zone,
    "memberId" text
);


--
-- Name: contact_requests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.contact_requests (
    id text NOT NULL,
    purpose text NOT NULL,
    "fromMemberId" text NOT NULL,
    "toMemberId" text NOT NULL,
    message text,
    status text DEFAULT 'PENDING'::text,
    "respondedAt" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: education_records; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.education_records (
    id text NOT NULL,
    "memberId" text NOT NULL,
    level text,
    qualification text,
    specialization text,
    institution text,
    "yearCompleted" integer,
    "isHighest" boolean DEFAULT false NOT NULL,
    "isOngoing" boolean DEFAULT false NOT NULL,
    "marksType" text,
    "marksValue" text,
    "marksScale" integer,
    "boardUniversity" text,
    "marksheetFileId" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: employment_records; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.employment_records (
    id text NOT NULL,
    "memberId" text NOT NULL,
    "employmentType" text,
    "employerName" text,
    designation text,
    industry text,
    city text,
    country text,
    "incomeRangeId" text,
    "startDate" timestamp(3) without time zone,
    "endDate" timestamp(3) without time zone,
    "isCurrent" boolean DEFAULT true NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: families; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.families (
    id text NOT NULL,
    "registrationNumber" text NOT NULL,
    name text NOT NULL,
    surname text,
    description text,
    kuladevata text,
    kuladevi text,
    gotra text,
    "traditionalOccupation" text,
    "nativeVillage" text,
    "nativeDistrict" text,
    "nativeState" text,
    "nativeCountry" text DEFAULT 'India'::text NOT NULL,
    "kartaMemberId" text,
    "familyPhotoId" text,
    status public."FamilyStatus" DEFAULT 'PENDING'::public."FamilyStatus" NOT NULL,
    "verificationStatus" public."VerificationStatus" DEFAULT 'UNVERIFIED'::public."VerificationStatus" NOT NULL,
    "verifiedBy" text,
    "verifiedAt" timestamp(3) without time zone,
    "communityId" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "createdBy" text,
    "updatedBy" text,
    "deletedAt" timestamp(3) without time zone
);


--
-- Name: family_areas; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.family_areas (
    "familyId" text NOT NULL,
    "areaId" text NOT NULL,
    "isPrimary" boolean DEFAULT false NOT NULL
);


--
-- Name: family_join_requests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.family_join_requests (
    id text NOT NULL,
    "familyId" text NOT NULL,
    "memberId" text NOT NULL,
    "relatedToMemberId" text,
    "relationshipTypeCode" text,
    direction text DEFAULT 'MEMBER_REQUEST'::text NOT NULL,
    "requestedBy" text NOT NULL,
    status text DEFAULT 'PENDING'::text NOT NULL,
    "respondedBy" text,
    "respondedAt" timestamp(3) without time zone,
    "responseNote" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: family_members; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.family_members (
    id text NOT NULL,
    "familyId" text NOT NULL,
    "memberId" text NOT NULL,
    "isKarta" boolean DEFAULT false NOT NULL,
    "joinedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "joinedBy" text,
    "leftAt" timestamp(3) without time zone,
    "leftReason" text
);


--
-- Name: fee_invoices; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.fee_invoices (
    id text NOT NULL,
    reference text NOT NULL,
    "feeTypeId" text NOT NULL,
    "familyId" text,
    "memberId" text NOT NULL,
    "amountPaise" integer NOT NULL,
    status public."FeeInvoiceStatus" DEFAULT 'PENDING'::public."FeeInvoiceStatus" NOT NULL,
    "dueDate" timestamp(3) without time zone,
    "paidAt" timestamp(3) without time zone,
    "waivedBy" text,
    "waiverReason" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: fee_types; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.fee_types (
    id text NOT NULL,
    code text NOT NULL,
    label text NOT NULL,
    description text,
    "amountPaise" integer NOT NULL,
    "appliesTo" text DEFAULT 'FAMILY_KARTA'::text NOT NULL,
    "isActive" boolean DEFAULT true NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: field_visibility_defaults; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.field_visibility_defaults (
    "entityType" text NOT NULL,
    "fieldName" text NOT NULL,
    "defaultVisibility" text NOT NULL,
    "isUserConfigurable" boolean DEFAULT true NOT NULL
);


--
-- Name: income_ranges; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.income_ranges (
    id text NOT NULL,
    label text NOT NULL,
    "minValue" bigint,
    "maxValue" bigint,
    "sortOrder" integer DEFAULT 0 NOT NULL,
    "isActive" boolean DEFAULT true NOT NULL
);


--
-- Name: interests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.interests (
    id text NOT NULL,
    name text NOT NULL,
    slug text NOT NULL,
    category text,
    "isSport" boolean DEFAULT false,
    "isChildSafe" boolean DEFAULT false,
    status text DEFAULT 'APPROVED'::text,
    "mergedIntoId" text,
    "suggestedByMemberId" text,
    "reviewedBy" text,
    "reviewedAt" timestamp(3) without time zone,
    "sortOrder" integer DEFAULT 0,
    "isActive" boolean DEFAULT true,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: marital_status_history; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.marital_status_history (
    id text NOT NULL,
    "memberId" text NOT NULL,
    status public."MaritalStatus" NOT NULL,
    "effectiveDate" timestamp(3) without time zone,
    notes text,
    "changedBy" text,
    "approvalId" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: marriage_records; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.marriage_records (
    id text NOT NULL,
    "memberId1" text NOT NULL,
    "memberId2" text,
    "externalSpouseName" text,
    "externalSpouseInfo" jsonb,
    "marriageDate" timestamp(3) without time zone,
    "marriagePlace" text,
    status text DEFAULT 'MARRIED'::text NOT NULL,
    "dissolutionDate" timestamp(3) without time zone,
    notes text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "createdBy" text
);


--
-- Name: matrimonial_interests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.matrimonial_interests (
    id text NOT NULL,
    "fromMemberId" text NOT NULL,
    "toMemberId" text NOT NULL,
    message text,
    status text DEFAULT 'PENDING'::text NOT NULL,
    "statusChangedAt" timestamp(3) without time zone,
    "statusNote" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: matrimonial_preferences; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.matrimonial_preferences (
    id text NOT NULL,
    "matrimonialProfileId" text NOT NULL,
    "minAge" integer,
    "maxAge" integer,
    "preferredGender" public."Gender",
    "preferredLocations" jsonb,
    "educationPreference" text,
    "occupationPreference" text,
    "incomeRangeId" text,
    "maritalStatusPref" jsonb,
    "otherPreferences" jsonb,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: matrimonial_profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.matrimonial_profiles (
    id text NOT NULL,
    "memberId" text NOT NULL,
    "isVisible" boolean DEFAULT false NOT NULL,
    about text,
    "heightCm" integer,
    languages jsonb,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "createdBy" text
);


--
-- Name: matrimonial_saves; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.matrimonial_saves (
    "memberId" text NOT NULL,
    "savedMemberId" text NOT NULL,
    "savedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: member_additional_details; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.member_additional_details (
    id text NOT NULL,
    "memberId" text NOT NULL,
    "insuranceNeedsHelp" boolean,
    "insuranceHelpNote" text,
    "doctorName" text,
    "doctorSpeciality" text,
    "doctorClinic" text,
    "doctorCity" text,
    "doctorContact" text,
    "doctorNeedsHelp" boolean,
    "adviserName" text,
    "adviserType" text,
    "adviserContact" text,
    "adviserNeedsGuidance" boolean,
    "hasExistingLoans" boolean,
    "existingLoanTypes" jsonb,
    "otherBankingNeeds" jsonb,
    "houseOwnership" text,
    "houseType" text,
    "houseWantsToBuy" boolean,
    "eduNeedsSupport" boolean,
    "eduSupportTypes" jsonb,
    "eduSupportAmountBand" text,
    "eduSupportNote" text,
    "careerLookingFor" jsonb,
    "careerSkills" jsonb,
    "careerPreferredCity" text,
    "careerExperienceBand" text,
    "careerCanOffer" jsonb,
    "careerOfferField" text,
    "careerSupportNeeds" jsonb,
    "teachSubjects" text,
    "teachMode" text,
    "teachFeeMode" text,
    "guidanceFields" jsonb,
    "volunteerReady" boolean,
    "volunteerHoursBand" text,
    "willingToDonateBlood" boolean,
    "lastDonatedMonth" text,
    "wellnessActivities" jsonb,
    "wellnessWants" jsonb,
    "seniorLivesWith" text,
    "seniorNeeds" jsonb,
    "seniorEmergencyMemberId" text,
    "studentClassCourse" text,
    "studentCareerInterest" text,
    "studentNeeds" jsonb,
    "studentExamName" text,
    "womenInterests" jsonb,
    "womenNeeds" jsonb,
    "govDocNeeds" jsonb,
    "housingLookingTo" jsonb,
    "housingCity" text,
    "housingBudgetBand" text,
    "relocatingCity" text,
    "relocatingWantsContacts" boolean,
    "travelInterests" jsonb,
    "travelCanHost" boolean,
    "motherTongue" text,
    "cultureInterests" jsonb,
    "openToCityFriends" boolean,
    "openToMulGaon" boolean,
    "openToProfession" boolean,
    "marriageSupportNeeds" jsonb,
    "emergencyContactMemberId" text,
    "canHelpEmergency" boolean,
    "emergencyHelpTypes" jsonb,
    "autoAddToGroups" boolean DEFAULT true,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: member_areas; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.member_areas (
    "memberId" text NOT NULL,
    "areaId" text NOT NULL,
    "isPrimary" boolean DEFAULT false NOT NULL
);


--
-- Name: member_farm_holdings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.member_farm_holdings (
    id text NOT NULL,
    "memberId" text NOT NULL,
    "districtAreaId" text,
    district text,
    taluka text,
    village text,
    "areaValue" double precision,
    "areaUnit" text,
    ownership text,
    irrigated boolean,
    "mainCrops" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: member_field_visibility; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.member_field_visibility (
    "memberId" text NOT NULL,
    "fieldName" text NOT NULL,
    visibility text NOT NULL
);


--
-- Name: member_files; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.member_files (
    id text NOT NULL,
    "memberId" text NOT NULL,
    purpose text NOT NULL,
    "storageKey" text NOT NULL,
    "originalFilename" text,
    "mimeType" text,
    "sizeBytes" integer,
    "uploadedBy" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: member_hobbies; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.member_hobbies (
    id text NOT NULL,
    "memberId" text NOT NULL,
    "interestId" text NOT NULL,
    level text,
    detail text,
    "canTeach" boolean,
    "needsSupport" boolean,
    "supportTypes" jsonb,
    "supportNote" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: member_insurances; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.member_insurances (
    id text NOT NULL,
    "memberId" text NOT NULL,
    "insuranceType" text,
    "insurerName" text,
    "sumInsuredBand" text,
    "renewalMonth" integer,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: member_invitations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.member_invitations (
    id text NOT NULL,
    "memberId" text NOT NULL,
    email text,
    mobile text,
    "tokenHash" text NOT NULL,
    status text DEFAULT 'PENDING'::text NOT NULL,
    "invitedBy" text NOT NULL,
    "expiresAt" timestamp(3) without time zone NOT NULL,
    "acceptedAt" timestamp(3) without time zone,
    "acceptedBy" text,
    "revokedAt" timestamp(3) without time zone,
    "revokedBy" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: member_loan_needs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.member_loan_needs (
    id text NOT NULL,
    "memberId" text NOT NULL,
    "loanType" text,
    "amountBand" text,
    purpose text,
    "neededByMonth" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: member_profile_details; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.member_profile_details (
    id text NOT NULL,
    "memberId" text NOT NULL,
    "educationLevel" text,
    "educationOther" text,
    "educationStream" text,
    "educationInstitution" text,
    "annualIncomeRange" text,
    "isEarning" boolean DEFAULT false NOT NULL,
    "isPursuingEducation" boolean DEFAULT false NOT NULL,
    "currentCourse" text,
    "currentInstitution" text,
    "expectedCompletionYear" integer,
    "earningType" text,
    "companyName" text,
    designation text,
    "jobSector" text,
    "businessName" text,
    "businessType" text,
    "readyForMarriage" boolean DEFAULT false NOT NULL,
    "lookingForMarriage" boolean DEFAULT false NOT NULL,
    "marriageHeightCm" integer,
    "motherTongue" text,
    "nativePlace" text,
    "partnerExpectations" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: member_relationships; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.member_relationships (
    id text NOT NULL,
    "fromMemberId" text NOT NULL,
    "toMemberId" text NOT NULL,
    "relationshipTypeId" text NOT NULL,
    "familyId" text,
    "isActive" boolean DEFAULT true NOT NULL,
    notes text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "createdBy" text
);


--
-- Name: member_section_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.member_section_settings (
    id text NOT NULL,
    "memberId" text NOT NULL,
    "sectionKey" text NOT NULL,
    answer text,
    visibility text,
    "enteredByUserId" text,
    "entryNote" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: member_skills; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.member_skills (
    "memberId" text NOT NULL,
    "skillId" text NOT NULL,
    level text
);


--
-- Name: member_sport_achievements; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.member_sport_achievements (
    id text NOT NULL,
    "sportId" text NOT NULL,
    "eventName" text,
    year integer,
    medal text,
    "certificateFileId" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: member_sports; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.member_sports (
    id text NOT NULL,
    "memberId" text NOT NULL,
    "interestId" text,
    level text,
    "needsCoachingSupport" boolean,
    "supportTypes" jsonb,
    "supportNote" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: member_vehicles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.member_vehicles (
    id text NOT NULL,
    "memberId" text NOT NULL,
    "vehicleType" text,
    make text,
    model text,
    year integer,
    "fuelType" text,
    "lastServiceMonth" text,
    "nextServiceDueMonth" text,
    "preferredGarage" text,
    "needsServicingSupport" boolean,
    "servicingSupportNote" text,
    "registrationNumber" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: members; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.members (
    id text NOT NULL,
    "memberNumber" text NOT NULL,
    "userId" text,
    "firstName" text NOT NULL,
    "middleName" text,
    "lastName" text,
    gender public."Gender" DEFAULT 'NOT_STATED'::public."Gender" NOT NULL,
    "dateOfBirth" timestamp(3) without time zone,
    "dateOfBirthApprox" boolean DEFAULT false NOT NULL,
    "bloodGroup" text,
    "heightCm" integer,
    "weightKg" integer,
    "bodyType" text,
    "physicalDisability" text,
    "mobilePrimary" text,
    "mobileAlternate" text,
    email text,
    "profilePhotoId" text,
    biography text,
    "currentCity" text,
    "currentState" text,
    "currentCountry" text,
    "nativeVillage" text,
    "nativeDistrict" text,
    "nativeState" text,
    nationality text DEFAULT 'Indian'::text NOT NULL,
    languages jsonb,
    "maritalStatus" public."MaritalStatus" DEFAULT 'UNMARRIED'::public."MaritalStatus" NOT NULL,
    "employmentStatus" text,
    "occupationCategory" text,
    status public."MemberStatus" DEFAULT 'ACTIVE'::public."MemberStatus" NOT NULL,
    "deceasedAt" timestamp(3) without time zone,
    "deceasedPlace" text,
    "deceasedNotes" text,
    "verificationStatus" public."VerificationStatus" DEFAULT 'UNVERIFIED'::public."VerificationStatus" NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "createdBy" text,
    "updatedBy" text,
    "deletedAt" timestamp(3) without time zone
);


--
-- Name: notifications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.notifications (
    id text NOT NULL,
    "recipientId" text NOT NULL,
    "senderId" text,
    type text NOT NULL,
    title text NOT NULL,
    body text,
    data jsonb,
    "isRead" boolean DEFAULT false NOT NULL,
    "readAt" timestamp(3) without time zone,
    "emailSent" boolean DEFAULT false NOT NULL,
    "smsSent" boolean DEFAULT false NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: option_masters; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.option_masters (
    id text NOT NULL,
    "listKey" text NOT NULL,
    value text NOT NULL,
    label text NOT NULL,
    "sortOrder" integer DEFAULT 0,
    "isActive" boolean DEFAULT true,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: payments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.payments (
    id text NOT NULL,
    reference text NOT NULL,
    purpose text NOT NULL,
    "bookingId" text,
    "feeInvoiceId" text,
    "memberId" text NOT NULL,
    "paidByUserId" text NOT NULL,
    "amountPaise" integer NOT NULL,
    currency text DEFAULT 'INR'::text NOT NULL,
    status public."PaymentStatus" DEFAULT 'CREATED'::public."PaymentStatus" NOT NULL,
    gateway text DEFAULT 'MOCK'::text NOT NULL,
    "gatewayOrderId" text,
    "gatewayPaymentId" text,
    "failureReason" text,
    "paidAt" timestamp(3) without time zone,
    "refundedPaise" integer DEFAULT 0 NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: permissions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.permissions (
    id text NOT NULL,
    code text NOT NULL,
    label text NOT NULL,
    module text NOT NULL
);


--
-- Name: photos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.photos (
    id text NOT NULL,
    "ownerType" text NOT NULL,
    "memberId" text,
    "familyId" text,
    "postId" text,
    "assetId" text,
    "uploadedBy" text NOT NULL,
    "storageKey" text NOT NULL,
    "thumbnailKey" text,
    "optimizedKey" text,
    "originalFilename" text,
    "mimeType" text,
    "fileSizeBytes" bigint,
    width integer,
    height integer,
    "isProfilePhoto" boolean DEFAULT false NOT NULL,
    caption text,
    visibility text DEFAULT 'PRIVATE'::text NOT NULL,
    status text DEFAULT 'ACTIVE'::text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: post_poll_options; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.post_poll_options (
    id text NOT NULL,
    "postId" text NOT NULL,
    label text NOT NULL,
    "sortOrder" integer DEFAULT 0
);


--
-- Name: post_poll_votes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.post_poll_votes (
    id text NOT NULL,
    "postId" text NOT NULL,
    "optionId" text NOT NULL,
    "userId" text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: post_rsvps; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.post_rsvps (
    "postId" text NOT NULL,
    "userId" text NOT NULL,
    response text,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: post_types; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.post_types (
    id text NOT NULL,
    code text NOT NULL,
    label text NOT NULL,
    icon text,
    "requiresApproval" boolean DEFAULT false NOT NULL,
    "isActive" boolean DEFAULT true NOT NULL
);


--
-- Name: posts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.posts (
    id text NOT NULL,
    "authorId" text NOT NULL,
    "postTypeId" text NOT NULL,
    title text,
    content text,
    visibility text DEFAULT 'COMMUNITY'::text NOT NULL,
    "targetAreaId" text,
    status public."PostStatus" DEFAULT 'PENDING_APPROVAL'::public."PostStatus" NOT NULL,
    "reviewedBy" text,
    "reviewedAt" timestamp(3) without time zone,
    "reviewNote" text,
    "isPinned" boolean DEFAULT false NOT NULL,
    "isAnnouncement" boolean DEFAULT false NOT NULL,
    "eventDate" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "deletedAt" timestamp(3) without time zone,
    "groupId" text,
    "groupPostKind" text,
    "linkUrl" text,
    "isSolved" boolean DEFAULT false,
    "solvedAt" timestamp(3) without time zone,
    "solvedCommentId" text
);


--
-- Name: reactions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.reactions (
    id text NOT NULL,
    "postId" text,
    "commentId" text,
    "userId" text NOT NULL,
    "reactionType" text DEFAULT 'LIKE'::text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: refresh_tokens; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.refresh_tokens (
    id text NOT NULL,
    "userId" text NOT NULL,
    "tokenHash" text NOT NULL,
    "deviceInfo" jsonb,
    "ipAddress" text,
    "expiresAt" timestamp(3) without time zone NOT NULL,
    "revokedAt" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: relationship_types; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.relationship_types (
    id text NOT NULL,
    code text NOT NULL,
    label text NOT NULL,
    "inverseCode" text,
    "genderApplicable" text,
    "isSpouse" boolean DEFAULT false NOT NULL,
    "isActive" boolean DEFAULT true NOT NULL,
    "sortOrder" integer DEFAULT 0 NOT NULL
);


--
-- Name: reports; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.reports (
    id text NOT NULL,
    "reportableType" text NOT NULL,
    "reportableId" text NOT NULL,
    "reporterId" text NOT NULL,
    reason text NOT NULL,
    description text,
    status text DEFAULT 'PENDING'::text NOT NULL,
    "resolvedBy" text,
    "resolutionNote" text,
    "resolvedAt" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: role_permissions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.role_permissions (
    "roleId" text NOT NULL,
    "permissionId" text NOT NULL
);


--
-- Name: roles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.roles (
    id text NOT NULL,
    code text NOT NULL,
    label text NOT NULL,
    description text,
    "isSystem" boolean DEFAULT false NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.settings (
    id text NOT NULL,
    key text NOT NULL,
    value jsonb NOT NULL,
    description text,
    "updatedBy" text,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: skills; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.skills (
    id text NOT NULL,
    name text NOT NULL,
    category text,
    "isActive" boolean DEFAULT true NOT NULL,
    "sortOrder" integer DEFAULT 0 NOT NULL
);


--
-- Name: support_requests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.support_requests (
    id text NOT NULL,
    "memberId" text NOT NULL,
    "sourceKey" text NOT NULL,
    category text NOT NULL,
    district text,
    note text,
    status text DEFAULT 'OPEN'::text,
    "createdByUserId" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "withdrawnAt" timestamp(3) without time zone,
    "closedAt" timestamp(3) without time zone,
    "closedBy" text
);


--
-- Name: user_roles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_roles (
    id text NOT NULL,
    "userId" text NOT NULL,
    "roleId" text NOT NULL,
    "familyId" text,
    "areaId" text,
    "grantedBy" text,
    "grantedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "expiresAt" timestamp(3) without time zone
);


--
-- Name: users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.users (
    id text NOT NULL,
    email text,
    mobile text,
    "passwordHash" text NOT NULL,
    "emailVerified" boolean DEFAULT false NOT NULL,
    "mobileVerified" boolean DEFAULT false NOT NULL,
    status public."UserStatus" DEFAULT 'PENDING'::public."UserStatus" NOT NULL,
    "joinIntent" text,
    "lastLoginAt" timestamp(3) without time zone,
    "lastLoginIp" text,
    "failedAttempts" integer DEFAULT 0 NOT NULL,
    "lockedUntil" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "deletedAt" timestamp(3) without time zone
);


--
-- Name: verification_tokens; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.verification_tokens (
    id text NOT NULL,
    "userId" text NOT NULL,
    type text NOT NULL,
    "tokenHash" text NOT NULL,
    "expiresAt" timestamp(3) without time zone NOT NULL,
    "usedAt" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: _prisma_migrations _prisma_migrations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public._prisma_migrations
    ADD CONSTRAINT _prisma_migrations_pkey PRIMARY KEY (id);


--
-- Name: addresses addresses_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.addresses
    ADD CONSTRAINT addresses_pkey PRIMARY KEY (id);


--
-- Name: approval_rules approval_rules_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.approval_rules
    ADD CONSTRAINT approval_rules_pkey PRIMARY KEY (id);


--
-- Name: approvals approvals_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.approvals
    ADD CONSTRAINT approvals_pkey PRIMARY KEY (id);


--
-- Name: areas areas_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.areas
    ADD CONSTRAINT areas_pkey PRIMARY KEY (id);


--
-- Name: asset_blackouts asset_blackouts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.asset_blackouts
    ADD CONSTRAINT asset_blackouts_pkey PRIMARY KEY (id);


--
-- Name: assets assets_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.assets
    ADD CONSTRAINT assets_pkey PRIMARY KEY (id);


--
-- Name: audit_logs audit_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_pkey PRIMARY KEY (id);


--
-- Name: blocked_users blocked_users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.blocked_users
    ADD CONSTRAINT blocked_users_pkey PRIMARY KEY ("blockerId", "blockedId");


--
-- Name: bookings bookings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bookings
    ADD CONSTRAINT bookings_pkey PRIMARY KEY (id);


--
-- Name: businesses businesses_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.businesses
    ADD CONSTRAINT businesses_pkey PRIMARY KEY (id);


--
-- Name: comments comments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.comments
    ADD CONSTRAINT comments_pkey PRIMARY KEY (id);


--
-- Name: community_group_members community_group_members_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.community_group_members
    ADD CONSTRAINT community_group_members_pkey PRIMARY KEY (id);


--
-- Name: community_groups community_groups_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.community_groups
    ADD CONSTRAINT community_groups_pkey PRIMARY KEY (id);


--
-- Name: consent_records consent_records_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.consent_records
    ADD CONSTRAINT consent_records_pkey PRIMARY KEY (id);


--
-- Name: contact_requests contact_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contact_requests
    ADD CONSTRAINT contact_requests_pkey PRIMARY KEY (id);


--
-- Name: education_records education_records_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.education_records
    ADD CONSTRAINT education_records_pkey PRIMARY KEY (id);


--
-- Name: employment_records employment_records_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employment_records
    ADD CONSTRAINT employment_records_pkey PRIMARY KEY (id);


--
-- Name: families families_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.families
    ADD CONSTRAINT families_pkey PRIMARY KEY (id);


--
-- Name: family_areas family_areas_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.family_areas
    ADD CONSTRAINT family_areas_pkey PRIMARY KEY ("familyId", "areaId");


--
-- Name: family_join_requests family_join_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.family_join_requests
    ADD CONSTRAINT family_join_requests_pkey PRIMARY KEY (id);


--
-- Name: family_members family_members_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.family_members
    ADD CONSTRAINT family_members_pkey PRIMARY KEY (id);


--
-- Name: fee_invoices fee_invoices_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fee_invoices
    ADD CONSTRAINT fee_invoices_pkey PRIMARY KEY (id);


--
-- Name: fee_types fee_types_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fee_types
    ADD CONSTRAINT fee_types_pkey PRIMARY KEY (id);


--
-- Name: field_visibility_defaults field_visibility_defaults_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.field_visibility_defaults
    ADD CONSTRAINT field_visibility_defaults_pkey PRIMARY KEY ("entityType", "fieldName");


--
-- Name: income_ranges income_ranges_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.income_ranges
    ADD CONSTRAINT income_ranges_pkey PRIMARY KEY (id);


--
-- Name: interests interests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.interests
    ADD CONSTRAINT interests_pkey PRIMARY KEY (id);


--
-- Name: marital_status_history marital_status_history_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.marital_status_history
    ADD CONSTRAINT marital_status_history_pkey PRIMARY KEY (id);


--
-- Name: marriage_records marriage_records_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.marriage_records
    ADD CONSTRAINT marriage_records_pkey PRIMARY KEY (id);


--
-- Name: matrimonial_interests matrimonial_interests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.matrimonial_interests
    ADD CONSTRAINT matrimonial_interests_pkey PRIMARY KEY (id);


--
-- Name: matrimonial_preferences matrimonial_preferences_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.matrimonial_preferences
    ADD CONSTRAINT matrimonial_preferences_pkey PRIMARY KEY (id);


--
-- Name: matrimonial_profiles matrimonial_profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.matrimonial_profiles
    ADD CONSTRAINT matrimonial_profiles_pkey PRIMARY KEY (id);


--
-- Name: matrimonial_saves matrimonial_saves_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.matrimonial_saves
    ADD CONSTRAINT matrimonial_saves_pkey PRIMARY KEY ("memberId", "savedMemberId");


--
-- Name: member_additional_details member_additional_details_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.member_additional_details
    ADD CONSTRAINT member_additional_details_pkey PRIMARY KEY (id);


--
-- Name: member_areas member_areas_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.member_areas
    ADD CONSTRAINT member_areas_pkey PRIMARY KEY ("memberId", "areaId");


--
-- Name: member_farm_holdings member_farm_holdings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.member_farm_holdings
    ADD CONSTRAINT member_farm_holdings_pkey PRIMARY KEY (id);


--
-- Name: member_field_visibility member_field_visibility_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.member_field_visibility
    ADD CONSTRAINT member_field_visibility_pkey PRIMARY KEY ("memberId", "fieldName");


--
-- Name: member_files member_files_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.member_files
    ADD CONSTRAINT member_files_pkey PRIMARY KEY (id);


--
-- Name: member_hobbies member_hobbies_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.member_hobbies
    ADD CONSTRAINT member_hobbies_pkey PRIMARY KEY (id);


--
-- Name: member_insurances member_insurances_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.member_insurances
    ADD CONSTRAINT member_insurances_pkey PRIMARY KEY (id);


--
-- Name: member_invitations member_invitations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.member_invitations
    ADD CONSTRAINT member_invitations_pkey PRIMARY KEY (id);


--
-- Name: member_loan_needs member_loan_needs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.member_loan_needs
    ADD CONSTRAINT member_loan_needs_pkey PRIMARY KEY (id);


--
-- Name: member_profile_details member_profile_details_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.member_profile_details
    ADD CONSTRAINT member_profile_details_pkey PRIMARY KEY (id);


--
-- Name: member_relationships member_relationships_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.member_relationships
    ADD CONSTRAINT member_relationships_pkey PRIMARY KEY (id);


--
-- Name: member_section_settings member_section_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.member_section_settings
    ADD CONSTRAINT member_section_settings_pkey PRIMARY KEY (id);


--
-- Name: member_skills member_skills_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.member_skills
    ADD CONSTRAINT member_skills_pkey PRIMARY KEY ("memberId", "skillId");


--
-- Name: member_sport_achievements member_sport_achievements_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.member_sport_achievements
    ADD CONSTRAINT member_sport_achievements_pkey PRIMARY KEY (id);


--
-- Name: member_sports member_sports_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.member_sports
    ADD CONSTRAINT member_sports_pkey PRIMARY KEY (id);


--
-- Name: member_vehicles member_vehicles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.member_vehicles
    ADD CONSTRAINT member_vehicles_pkey PRIMARY KEY (id);


--
-- Name: members members_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.members
    ADD CONSTRAINT members_pkey PRIMARY KEY (id);


--
-- Name: notifications notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_pkey PRIMARY KEY (id);


--
-- Name: option_masters option_masters_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.option_masters
    ADD CONSTRAINT option_masters_pkey PRIMARY KEY (id);


--
-- Name: payments payments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_pkey PRIMARY KEY (id);


--
-- Name: permissions permissions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.permissions
    ADD CONSTRAINT permissions_pkey PRIMARY KEY (id);


--
-- Name: photos photos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.photos
    ADD CONSTRAINT photos_pkey PRIMARY KEY (id);


--
-- Name: post_poll_options post_poll_options_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.post_poll_options
    ADD CONSTRAINT post_poll_options_pkey PRIMARY KEY (id);


--
-- Name: post_poll_votes post_poll_votes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.post_poll_votes
    ADD CONSTRAINT post_poll_votes_pkey PRIMARY KEY (id);


--
-- Name: post_rsvps post_rsvps_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.post_rsvps
    ADD CONSTRAINT post_rsvps_pkey PRIMARY KEY ("postId", "userId");


--
-- Name: post_types post_types_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.post_types
    ADD CONSTRAINT post_types_pkey PRIMARY KEY (id);


--
-- Name: posts posts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.posts
    ADD CONSTRAINT posts_pkey PRIMARY KEY (id);


--
-- Name: reactions reactions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reactions
    ADD CONSTRAINT reactions_pkey PRIMARY KEY (id);


--
-- Name: refresh_tokens refresh_tokens_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.refresh_tokens
    ADD CONSTRAINT refresh_tokens_pkey PRIMARY KEY (id);


--
-- Name: relationship_types relationship_types_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.relationship_types
    ADD CONSTRAINT relationship_types_pkey PRIMARY KEY (id);


--
-- Name: reports reports_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reports
    ADD CONSTRAINT reports_pkey PRIMARY KEY (id);


--
-- Name: role_permissions role_permissions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.role_permissions
    ADD CONSTRAINT role_permissions_pkey PRIMARY KEY ("roleId", "permissionId");


--
-- Name: roles roles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.roles
    ADD CONSTRAINT roles_pkey PRIMARY KEY (id);


--
-- Name: settings settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.settings
    ADD CONSTRAINT settings_pkey PRIMARY KEY (id);


--
-- Name: skills skills_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.skills
    ADD CONSTRAINT skills_pkey PRIMARY KEY (id);


--
-- Name: support_requests support_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.support_requests
    ADD CONSTRAINT support_requests_pkey PRIMARY KEY (id);


--
-- Name: user_roles user_roles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_pkey PRIMARY KEY (id);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: verification_tokens verification_tokens_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.verification_tokens
    ADD CONSTRAINT verification_tokens_pkey PRIMARY KEY (id);


--
-- Name: approval_rules_actionCode_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "approval_rules_actionCode_key" ON public.approval_rules USING btree ("actionCode");


--
-- Name: asset_blackouts_assetId_startAt_endAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "asset_blackouts_assetId_startAt_endAt_idx" ON public.asset_blackouts USING btree ("assetId", "startAt", "endAt");


--
-- Name: assets_status_isActive_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "assets_status_isActive_idx" ON public.assets USING btree (status, "isActive");


--
-- Name: bookings_assetId_startAt_endAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "bookings_assetId_startAt_endAt_idx" ON public.bookings USING btree ("assetId", "startAt", "endAt");


--
-- Name: bookings_memberId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "bookings_memberId_idx" ON public.bookings USING btree ("memberId");


--
-- Name: bookings_reference_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX bookings_reference_key ON public.bookings USING btree (reference);


--
-- Name: community_group_members_groupId_memberId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "community_group_members_groupId_memberId_key" ON public.community_group_members USING btree ("groupId", "memberId");


--
-- Name: community_group_members_memberId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "community_group_members_memberId_idx" ON public.community_group_members USING btree ("memberId");


--
-- Name: community_groups_autoKey_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "community_groups_autoKey_key" ON public.community_groups USING btree ("autoKey");


--
-- Name: community_groups_code_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX community_groups_code_key ON public.community_groups USING btree (code);


--
-- Name: community_groups_groupType_parentGroupId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "community_groups_groupType_parentGroupId_idx" ON public.community_groups USING btree ("groupType", "parentGroupId");


--
-- Name: community_groups_status_isActive_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "community_groups_status_isActive_idx" ON public.community_groups USING btree (status, "isActive");


--
-- Name: consent_records_memberId_consentType_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "consent_records_memberId_consentType_idx" ON public.consent_records USING btree ("memberId", "consentType");


--
-- Name: contact_requests_toMemberId_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "contact_requests_toMemberId_status_idx" ON public.contact_requests USING btree ("toMemberId", status);


--
-- Name: families_registrationNumber_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "families_registrationNumber_key" ON public.families USING btree ("registrationNumber");


--
-- Name: family_join_requests_familyId_memberId_status_direction_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "family_join_requests_familyId_memberId_status_direction_key" ON public.family_join_requests USING btree ("familyId", "memberId", status, direction);


--
-- Name: family_members_familyId_memberId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "family_members_familyId_memberId_key" ON public.family_members USING btree ("familyId", "memberId");


--
-- Name: fee_invoices_memberId_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "fee_invoices_memberId_status_idx" ON public.fee_invoices USING btree ("memberId", status);


--
-- Name: fee_invoices_reference_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX fee_invoices_reference_key ON public.fee_invoices USING btree (reference);


--
-- Name: fee_types_code_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX fee_types_code_key ON public.fee_types USING btree (code);


--
-- Name: interests_slug_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX interests_slug_key ON public.interests USING btree (slug);


--
-- Name: interests_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX interests_status_idx ON public.interests USING btree (status);


--
-- Name: matrimonial_preferences_matrimonialProfileId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "matrimonial_preferences_matrimonialProfileId_key" ON public.matrimonial_preferences USING btree ("matrimonialProfileId");


--
-- Name: matrimonial_profiles_memberId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "matrimonial_profiles_memberId_key" ON public.matrimonial_profiles USING btree ("memberId");


--
-- Name: member_additional_details_memberId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "member_additional_details_memberId_key" ON public.member_additional_details USING btree ("memberId");


--
-- Name: member_farm_holdings_memberId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "member_farm_holdings_memberId_idx" ON public.member_farm_holdings USING btree ("memberId");


--
-- Name: member_files_memberId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "member_files_memberId_idx" ON public.member_files USING btree ("memberId");


--
-- Name: member_hobbies_memberId_interestId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "member_hobbies_memberId_interestId_key" ON public.member_hobbies USING btree ("memberId", "interestId");


--
-- Name: member_insurances_memberId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "member_insurances_memberId_idx" ON public.member_insurances USING btree ("memberId");


--
-- Name: member_invitations_memberId_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "member_invitations_memberId_status_idx" ON public.member_invitations USING btree ("memberId", status);


--
-- Name: member_invitations_tokenHash_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "member_invitations_tokenHash_key" ON public.member_invitations USING btree ("tokenHash");


--
-- Name: member_loan_needs_memberId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "member_loan_needs_memberId_idx" ON public.member_loan_needs USING btree ("memberId");


--
-- Name: member_profile_details_memberId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "member_profile_details_memberId_key" ON public.member_profile_details USING btree ("memberId");


--
-- Name: member_relationships_fromMemberId_toMemberId_relationshipTy_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "member_relationships_fromMemberId_toMemberId_relationshipTy_key" ON public.member_relationships USING btree ("fromMemberId", "toMemberId", "relationshipTypeId");


--
-- Name: member_section_settings_memberId_sectionKey_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "member_section_settings_memberId_sectionKey_key" ON public.member_section_settings USING btree ("memberId", "sectionKey");


--
-- Name: member_sports_memberId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "member_sports_memberId_idx" ON public.member_sports USING btree ("memberId");


--
-- Name: member_vehicles_memberId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "member_vehicles_memberId_idx" ON public.member_vehicles USING btree ("memberId");


--
-- Name: members_memberNumber_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "members_memberNumber_key" ON public.members USING btree ("memberNumber");


--
-- Name: members_profilePhotoId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "members_profilePhotoId_key" ON public.members USING btree ("profilePhotoId");


--
-- Name: members_userId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "members_userId_key" ON public.members USING btree ("userId");


--
-- Name: option_masters_listKey_value_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "option_masters_listKey_value_key" ON public.option_masters USING btree ("listKey", value);


--
-- Name: payments_memberId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "payments_memberId_idx" ON public.payments USING btree ("memberId");


--
-- Name: payments_reference_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX payments_reference_key ON public.payments USING btree (reference);


--
-- Name: payments_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX payments_status_idx ON public.payments USING btree (status);


--
-- Name: permissions_code_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX permissions_code_key ON public.permissions USING btree (code);


--
-- Name: post_poll_votes_postId_userId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "post_poll_votes_postId_userId_key" ON public.post_poll_votes USING btree ("postId", "userId");


--
-- Name: post_types_code_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX post_types_code_key ON public.post_types USING btree (code);


--
-- Name: posts_groupId_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "posts_groupId_status_idx" ON public.posts USING btree ("groupId", status);


--
-- Name: reactions_commentId_userId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "reactions_commentId_userId_key" ON public.reactions USING btree ("commentId", "userId");


--
-- Name: reactions_postId_userId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "reactions_postId_userId_key" ON public.reactions USING btree ("postId", "userId");


--
-- Name: refresh_tokens_tokenHash_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "refresh_tokens_tokenHash_key" ON public.refresh_tokens USING btree ("tokenHash");


--
-- Name: relationship_types_code_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX relationship_types_code_key ON public.relationship_types USING btree (code);


--
-- Name: roles_code_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX roles_code_key ON public.roles USING btree (code);


--
-- Name: settings_key_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX settings_key_key ON public.settings USING btree (key);


--
-- Name: skills_name_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX skills_name_key ON public.skills USING btree (name);


--
-- Name: support_requests_category_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX support_requests_category_status_idx ON public.support_requests USING btree (category, status);


--
-- Name: support_requests_memberId_sourceKey_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "support_requests_memberId_sourceKey_status_idx" ON public.support_requests USING btree ("memberId", "sourceKey", status);


--
-- Name: users_email_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX users_email_key ON public.users USING btree (email);


--
-- Name: users_mobile_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX users_mobile_key ON public.users USING btree (mobile);


--
-- Name: addresses addresses_familyId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.addresses
    ADD CONSTRAINT "addresses_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES public.families(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: addresses addresses_memberId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.addresses
    ADD CONSTRAINT "addresses_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES public.members(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: approvals approvals_reviewedBy_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.approvals
    ADD CONSTRAINT "approvals_reviewedBy_fkey" FOREIGN KEY ("reviewedBy") REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: approvals approvals_submittedBy_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.approvals
    ADD CONSTRAINT "approvals_submittedBy_fkey" FOREIGN KEY ("submittedBy") REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: areas areas_parentId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.areas
    ADD CONSTRAINT "areas_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES public.areas(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: asset_blackouts asset_blackouts_assetId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.asset_blackouts
    ADD CONSTRAINT "asset_blackouts_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES public.assets(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: assets assets_ownerMemberId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.assets
    ADD CONSTRAINT "assets_ownerMemberId_fkey" FOREIGN KEY ("ownerMemberId") REFERENCES public.members(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: audit_logs audit_logs_actorId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT "audit_logs_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: blocked_users blocked_users_blockedId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.blocked_users
    ADD CONSTRAINT "blocked_users_blockedId_fkey" FOREIGN KEY ("blockedId") REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: blocked_users blocked_users_blockerId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.blocked_users
    ADD CONSTRAINT "blocked_users_blockerId_fkey" FOREIGN KEY ("blockerId") REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: bookings bookings_assetId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bookings
    ADD CONSTRAINT "bookings_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES public.assets(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: bookings bookings_memberId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bookings
    ADD CONSTRAINT "bookings_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES public.members(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: businesses businesses_incomeRangeId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.businesses
    ADD CONSTRAINT "businesses_incomeRangeId_fkey" FOREIGN KEY ("incomeRangeId") REFERENCES public.income_ranges(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: businesses businesses_memberId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.businesses
    ADD CONSTRAINT "businesses_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES public.members(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: comments comments_authorId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.comments
    ADD CONSTRAINT "comments_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: comments comments_parentId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.comments
    ADD CONSTRAINT "comments_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES public.comments(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: comments comments_postId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.comments
    ADD CONSTRAINT "comments_postId_fkey" FOREIGN KEY ("postId") REFERENCES public.posts(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: community_group_members community_group_members_groupId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.community_group_members
    ADD CONSTRAINT "community_group_members_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES public.community_groups(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: community_group_members community_group_members_memberId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.community_group_members
    ADD CONSTRAINT "community_group_members_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES public.members(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: community_groups community_groups_areaId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.community_groups
    ADD CONSTRAINT "community_groups_areaId_fkey" FOREIGN KEY ("areaId") REFERENCES public.areas(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: community_groups community_groups_convenerMemberId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.community_groups
    ADD CONSTRAINT "community_groups_convenerMemberId_fkey" FOREIGN KEY ("convenerMemberId") REFERENCES public.members(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: community_groups community_groups_interestId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.community_groups
    ADD CONSTRAINT "community_groups_interestId_fkey" FOREIGN KEY ("interestId") REFERENCES public.interests(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: community_groups community_groups_parentGroupId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.community_groups
    ADD CONSTRAINT "community_groups_parentGroupId_fkey" FOREIGN KEY ("parentGroupId") REFERENCES public.community_groups(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: consent_records consent_records_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.consent_records
    ADD CONSTRAINT "consent_records_userId_fkey" FOREIGN KEY ("userId") REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: contact_requests contact_requests_fromMemberId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contact_requests
    ADD CONSTRAINT "contact_requests_fromMemberId_fkey" FOREIGN KEY ("fromMemberId") REFERENCES public.members(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: contact_requests contact_requests_toMemberId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contact_requests
    ADD CONSTRAINT "contact_requests_toMemberId_fkey" FOREIGN KEY ("toMemberId") REFERENCES public.members(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: education_records education_records_memberId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.education_records
    ADD CONSTRAINT "education_records_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES public.members(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: employment_records employment_records_incomeRangeId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employment_records
    ADD CONSTRAINT "employment_records_incomeRangeId_fkey" FOREIGN KEY ("incomeRangeId") REFERENCES public.income_ranges(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: employment_records employment_records_memberId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employment_records
    ADD CONSTRAINT "employment_records_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES public.members(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: families families_kartaMemberId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.families
    ADD CONSTRAINT "families_kartaMemberId_fkey" FOREIGN KEY ("kartaMemberId") REFERENCES public.members(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: family_areas family_areas_areaId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.family_areas
    ADD CONSTRAINT "family_areas_areaId_fkey" FOREIGN KEY ("areaId") REFERENCES public.areas(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: family_areas family_areas_familyId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.family_areas
    ADD CONSTRAINT "family_areas_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES public.families(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: family_join_requests family_join_requests_familyId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.family_join_requests
    ADD CONSTRAINT "family_join_requests_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES public.families(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: family_join_requests family_join_requests_memberId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.family_join_requests
    ADD CONSTRAINT "family_join_requests_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES public.members(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: family_members family_members_familyId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.family_members
    ADD CONSTRAINT "family_members_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES public.families(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: family_members family_members_memberId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.family_members
    ADD CONSTRAINT "family_members_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES public.members(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: fee_invoices fee_invoices_familyId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fee_invoices
    ADD CONSTRAINT "fee_invoices_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES public.families(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: fee_invoices fee_invoices_feeTypeId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fee_invoices
    ADD CONSTRAINT "fee_invoices_feeTypeId_fkey" FOREIGN KEY ("feeTypeId") REFERENCES public.fee_types(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: fee_invoices fee_invoices_memberId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fee_invoices
    ADD CONSTRAINT "fee_invoices_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES public.members(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: marital_status_history marital_status_history_approvalId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.marital_status_history
    ADD CONSTRAINT "marital_status_history_approvalId_fkey" FOREIGN KEY ("approvalId") REFERENCES public.approvals(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: marital_status_history marital_status_history_memberId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.marital_status_history
    ADD CONSTRAINT "marital_status_history_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES public.members(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: marriage_records marriage_records_memberId1_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.marriage_records
    ADD CONSTRAINT "marriage_records_memberId1_fkey" FOREIGN KEY ("memberId1") REFERENCES public.members(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: marriage_records marriage_records_memberId2_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.marriage_records
    ADD CONSTRAINT "marriage_records_memberId2_fkey" FOREIGN KEY ("memberId2") REFERENCES public.members(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: matrimonial_interests matrimonial_interests_fromMemberId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.matrimonial_interests
    ADD CONSTRAINT "matrimonial_interests_fromMemberId_fkey" FOREIGN KEY ("fromMemberId") REFERENCES public.members(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: matrimonial_interests matrimonial_interests_toMemberId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.matrimonial_interests
    ADD CONSTRAINT "matrimonial_interests_toMemberId_fkey" FOREIGN KEY ("toMemberId") REFERENCES public.members(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: matrimonial_preferences matrimonial_preferences_incomeRangeId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.matrimonial_preferences
    ADD CONSTRAINT "matrimonial_preferences_incomeRangeId_fkey" FOREIGN KEY ("incomeRangeId") REFERENCES public.income_ranges(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: matrimonial_preferences matrimonial_preferences_matrimonialProfileId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.matrimonial_preferences
    ADD CONSTRAINT "matrimonial_preferences_matrimonialProfileId_fkey" FOREIGN KEY ("matrimonialProfileId") REFERENCES public.matrimonial_profiles(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: matrimonial_profiles matrimonial_profiles_memberId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.matrimonial_profiles
    ADD CONSTRAINT "matrimonial_profiles_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES public.members(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: matrimonial_saves matrimonial_saves_memberId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.matrimonial_saves
    ADD CONSTRAINT "matrimonial_saves_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES public.members(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: matrimonial_saves matrimonial_saves_savedMemberId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.matrimonial_saves
    ADD CONSTRAINT "matrimonial_saves_savedMemberId_fkey" FOREIGN KEY ("savedMemberId") REFERENCES public.members(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: member_additional_details member_additional_details_memberId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.member_additional_details
    ADD CONSTRAINT "member_additional_details_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES public.members(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: member_areas member_areas_areaId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.member_areas
    ADD CONSTRAINT "member_areas_areaId_fkey" FOREIGN KEY ("areaId") REFERENCES public.areas(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: member_areas member_areas_memberId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.member_areas
    ADD CONSTRAINT "member_areas_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES public.members(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: member_farm_holdings member_farm_holdings_memberId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.member_farm_holdings
    ADD CONSTRAINT "member_farm_holdings_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES public.members(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: member_field_visibility member_field_visibility_memberId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.member_field_visibility
    ADD CONSTRAINT "member_field_visibility_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES public.members(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: member_files member_files_memberId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.member_files
    ADD CONSTRAINT "member_files_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES public.members(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: member_hobbies member_hobbies_interestId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.member_hobbies
    ADD CONSTRAINT "member_hobbies_interestId_fkey" FOREIGN KEY ("interestId") REFERENCES public.interests(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: member_hobbies member_hobbies_memberId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.member_hobbies
    ADD CONSTRAINT "member_hobbies_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES public.members(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: member_insurances member_insurances_memberId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.member_insurances
    ADD CONSTRAINT "member_insurances_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES public.members(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: member_invitations member_invitations_memberId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.member_invitations
    ADD CONSTRAINT "member_invitations_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES public.members(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: member_loan_needs member_loan_needs_memberId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.member_loan_needs
    ADD CONSTRAINT "member_loan_needs_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES public.members(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: member_profile_details member_profile_details_memberId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.member_profile_details
    ADD CONSTRAINT "member_profile_details_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES public.members(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: member_relationships member_relationships_fromMemberId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.member_relationships
    ADD CONSTRAINT "member_relationships_fromMemberId_fkey" FOREIGN KEY ("fromMemberId") REFERENCES public.members(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: member_relationships member_relationships_relationshipTypeId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.member_relationships
    ADD CONSTRAINT "member_relationships_relationshipTypeId_fkey" FOREIGN KEY ("relationshipTypeId") REFERENCES public.relationship_types(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: member_relationships member_relationships_toMemberId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.member_relationships
    ADD CONSTRAINT "member_relationships_toMemberId_fkey" FOREIGN KEY ("toMemberId") REFERENCES public.members(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: member_section_settings member_section_settings_memberId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.member_section_settings
    ADD CONSTRAINT "member_section_settings_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES public.members(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: member_skills member_skills_memberId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.member_skills
    ADD CONSTRAINT "member_skills_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES public.members(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: member_skills member_skills_skillId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.member_skills
    ADD CONSTRAINT "member_skills_skillId_fkey" FOREIGN KEY ("skillId") REFERENCES public.skills(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: member_sport_achievements member_sport_achievements_sportId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.member_sport_achievements
    ADD CONSTRAINT "member_sport_achievements_sportId_fkey" FOREIGN KEY ("sportId") REFERENCES public.member_sports(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: member_sports member_sports_interestId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.member_sports
    ADD CONSTRAINT "member_sports_interestId_fkey" FOREIGN KEY ("interestId") REFERENCES public.interests(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: member_sports member_sports_memberId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.member_sports
    ADD CONSTRAINT "member_sports_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES public.members(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: member_vehicles member_vehicles_memberId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.member_vehicles
    ADD CONSTRAINT "member_vehicles_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES public.members(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: members members_profilePhotoId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.members
    ADD CONSTRAINT "members_profilePhotoId_fkey" FOREIGN KEY ("profilePhotoId") REFERENCES public.photos(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: members members_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.members
    ADD CONSTRAINT "members_userId_fkey" FOREIGN KEY ("userId") REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: notifications notifications_recipientId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT "notifications_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: notifications notifications_senderId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT "notifications_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: payments payments_bookingId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT "payments_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES public.bookings(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: payments payments_feeInvoiceId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT "payments_feeInvoiceId_fkey" FOREIGN KEY ("feeInvoiceId") REFERENCES public.fee_invoices(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: payments payments_memberId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT "payments_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES public.members(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: photos photos_assetId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.photos
    ADD CONSTRAINT "photos_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES public.assets(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: photos photos_familyId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.photos
    ADD CONSTRAINT "photos_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES public.families(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: photos photos_memberId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.photos
    ADD CONSTRAINT "photos_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES public.members(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: photos photos_postId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.photos
    ADD CONSTRAINT "photos_postId_fkey" FOREIGN KEY ("postId") REFERENCES public.posts(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: photos photos_uploadedBy_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.photos
    ADD CONSTRAINT "photos_uploadedBy_fkey" FOREIGN KEY ("uploadedBy") REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: post_poll_options post_poll_options_postId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.post_poll_options
    ADD CONSTRAINT "post_poll_options_postId_fkey" FOREIGN KEY ("postId") REFERENCES public.posts(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: post_poll_votes post_poll_votes_optionId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.post_poll_votes
    ADD CONSTRAINT "post_poll_votes_optionId_fkey" FOREIGN KEY ("optionId") REFERENCES public.post_poll_options(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: post_poll_votes post_poll_votes_postId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.post_poll_votes
    ADD CONSTRAINT "post_poll_votes_postId_fkey" FOREIGN KEY ("postId") REFERENCES public.posts(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: post_rsvps post_rsvps_postId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.post_rsvps
    ADD CONSTRAINT "post_rsvps_postId_fkey" FOREIGN KEY ("postId") REFERENCES public.posts(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: posts posts_authorId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.posts
    ADD CONSTRAINT "posts_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: posts posts_groupId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.posts
    ADD CONSTRAINT "posts_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES public.community_groups(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: posts posts_postTypeId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.posts
    ADD CONSTRAINT "posts_postTypeId_fkey" FOREIGN KEY ("postTypeId") REFERENCES public.post_types(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: posts posts_targetAreaId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.posts
    ADD CONSTRAINT "posts_targetAreaId_fkey" FOREIGN KEY ("targetAreaId") REFERENCES public.areas(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: reactions reactions_commentId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reactions
    ADD CONSTRAINT "reactions_commentId_fkey" FOREIGN KEY ("commentId") REFERENCES public.comments(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: reactions reactions_postId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reactions
    ADD CONSTRAINT "reactions_postId_fkey" FOREIGN KEY ("postId") REFERENCES public.posts(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: reactions reactions_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reactions
    ADD CONSTRAINT "reactions_userId_fkey" FOREIGN KEY ("userId") REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: refresh_tokens refresh_tokens_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.refresh_tokens
    ADD CONSTRAINT "refresh_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: reports reports_reporterId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reports
    ADD CONSTRAINT "reports_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: role_permissions role_permissions_permissionId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.role_permissions
    ADD CONSTRAINT "role_permissions_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES public.permissions(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: role_permissions role_permissions_roleId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.role_permissions
    ADD CONSTRAINT "role_permissions_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES public.roles(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: support_requests support_requests_memberId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.support_requests
    ADD CONSTRAINT "support_requests_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES public.members(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: user_roles user_roles_areaId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT "user_roles_areaId_fkey" FOREIGN KEY ("areaId") REFERENCES public.areas(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: user_roles user_roles_familyId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT "user_roles_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES public.families(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: user_roles user_roles_roleId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT "user_roles_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES public.roles(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: user_roles user_roles_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT "user_roles_userId_fkey" FOREIGN KEY ("userId") REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: verification_tokens verification_tokens_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.verification_tokens
    ADD CONSTRAINT "verification_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--


