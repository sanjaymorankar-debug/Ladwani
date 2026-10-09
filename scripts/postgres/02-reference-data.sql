-- ===========================================================================
-- Mi Ladwani — 02-reference-data.sql  (DATA ONLY: no CREATE TABLE)
--
-- Run this SECOND, after 01-schema.sql, into the same database:
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f scripts/postgres/02-reference-data.sql
--
-- Contains ONLY reference/config data the app needs to function: roles, the
-- permission matrix, relationship types, approval rules, post types, areas,
-- income ranges, interests, settings, the family registration fee type, the
-- _prisma_migrations row, and ONE admin login:
--
--       admin@miladwani.com / ChangeThisInProduction123!
--       ^ CHANGE THIS PASSWORD IMMEDIATELY AFTER YOUR FIRST LOGIN.
--
-- Contains NO test accounts, NO families, NO member data.
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
-- Data for Name: _prisma_migrations; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public._prisma_migrations (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count) VALUES
	('217b83e5-094f-413c-96da-74748a33d776', '9e9b97a00248be69fb877a94d05208f3c8a9894fd613c9f7862e87fc2b1ee7fc', '2026-10-09 20:44:06.070332+00', '20261009120000_init', NULL, NULL, '2026-10-09 20:44:05.93257+00', 1);


--
-- Data for Name: families; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.users (id, email, mobile, "passwordHash", "emailVerified", "mobileVerified", status, "joinIntent", "lastLoginAt", "lastLoginIp", "failedAttempts", "lockedUntil", "createdAt", "updatedAt", "deletedAt") VALUES
	('cmv1fo47h000mq0znu3o2ieqp', 'admin@miladwani.com', '9000000000', '$2a$12$CBscB9k3m6SzgH/.aU.6W.AtPLKNbNQwA13w1ez0lKBv1edQZJfdK', true, true, 'ACTIVE', NULL, NULL, NULL, 0, NULL, '2026-10-09 20:44:08.141', '2026-10-09 20:44:08.141', NULL);


--
-- Data for Name: members; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.members (id, "memberNumber", "userId", "firstName", "middleName", "lastName", gender, "dateOfBirth", "dateOfBirthApprox", "bloodGroup", "heightCm", "weightKg", "bodyType", "physicalDisability", "mobilePrimary", "mobileAlternate", email, "profilePhotoId", biography, "currentCity", "currentState", "currentCountry", "nativeVillage", "nativeDistrict", "nativeState", nationality, languages, "maritalStatus", "employmentStatus", "occupationCategory", status, "deceasedAt", "deceasedPlace", "deceasedNotes", "verificationStatus", "createdAt", "updatedAt", "createdBy", "updatedBy", "deletedAt") VALUES
	('cmv1fo47o000oq0znno23wgmy', 'MEM-ADMIN-001', 'cmv1fo47h000mq0znu3o2ieqp', 'Admin', NULL, 'Ladwani', 'MALE', NULL, false, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'Indian', NULL, 'UNMARRIED', NULL, NULL, 'ACTIVE', NULL, NULL, NULL, 'UNVERIFIED', '2026-10-09 20:44:08.148', '2026-10-09 20:44:08.148', NULL, NULL, NULL);


--
-- Data for Name: addresses; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: approval_rules; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.approval_rules (id, "actionCode", "requiresApproval", "approverRole", "autoApproveRole", "isActive", "updatedAt") VALUES
	('cmv1fo48p001jq0znaf95jxpm', 'family.create', true, 'OPERATOR', NULL, true, '2026-10-09 20:44:08.186'),
	('cmv1fo48r001kq0znbrwerimh', 'family.member.add', true, 'OPERATOR', NULL, true, '2026-10-09 20:44:08.187'),
	('cmv1fo48s001lq0zn9ys7rz7j', 'member.marital_status.change', true, 'OPERATOR', NULL, true, '2026-10-09 20:44:08.188'),
	('cmv1fo48t001mq0zns2gr77ar', 'member.mark_deceased', true, 'OPERATOR', NULL, true, '2026-10-09 20:44:08.189'),
	('cmv1fo48u001nq0zn8peeuymp', 'member.relationship.change', true, 'OPERATOR', NULL, true, '2026-10-09 20:44:08.19'),
	('cmv1fo48v001oq0znrz1x4s3d', 'member.address.change', true, 'OPERATOR', NULL, true, '2026-10-09 20:44:08.191'),
	('cmv1fo48v001pq0znzozbhmdn', 'family.karta.change', true, 'ADMIN', NULL, true, '2026-10-09 20:44:08.192'),
	('cmv1fo48w001qq0zndgc56esn', 'family.merge', true, 'ADMIN', NULL, true, '2026-10-09 20:44:08.193'),
	('cmv1fo48x001rq0zn8xta0lkb', 'member.edit_own', false, NULL, 'MEMBER', true, '2026-10-09 20:44:08.194'),
	('cmv1fo48y001sq0znx83h2q2v', 'member.education.edit_own', false, NULL, 'MEMBER', true, '2026-10-09 20:44:08.195'),
	('cmv1fo48z001tq0zni4722rmi', 'member.employment.edit_own', false, NULL, 'MEMBER', true, '2026-10-09 20:44:08.196'),
	('cmv1fo49i001yq0znsl404w35', 'asset.create', true, 'OPERATOR', NULL, true, '2026-10-09 20:44:08.214'),
	('cmv1fo49j001zq0zndmvx4stb', 'group.create', true, 'OPERATOR', NULL, true, '2026-10-09 20:44:08.216');


--
-- Data for Name: approvals; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: areas; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.areas (id, "parentId", name, type, code, "isActive", "sortOrder") VALUES
	('area-india', NULL, 'India', 'COUNTRY', 'IN', true, 0),
	('area-mh', 'area-india', 'Maharashtra', 'STATE', 'MH', true, 0),
	('area-pune', 'area-mh', 'Pune', 'CITY', NULL, true, 0),
	('area-mumbai', 'area-mh', 'Mumbai', 'CITY', NULL, true, 0),
	('area-nagpur', 'area-mh', 'Nagpur', 'CITY', NULL, true, 0),
	('area-dist-pune', 'area-mh', 'Pune', 'DISTRICT', NULL, true, 0),
	('area-dist-mumbai', 'area-mh', 'Mumbai', 'DISTRICT', NULL, true, 0),
	('area-dist-nagpur', 'area-mh', 'Nagpur', 'DISTRICT', NULL, true, 0),
	('area-dist-satara', 'area-mh', 'Satara', 'DISTRICT', NULL, true, 0),
	('area-dist-kolhapur', 'area-mh', 'Kolhapur', 'DISTRICT', NULL, true, 0),
	('area-dist-nashik', 'area-mh', 'Nashik', 'DISTRICT', NULL, true, 0),
	('area-dist-aurangabad', 'area-mh', 'Aurangabad', 'DISTRICT', NULL, true, 0),
	('area-dist-solapur', 'area-mh', 'Solapur', 'DISTRICT', NULL, true, 0),
	('area-dist-sangli', 'area-mh', 'Sangli', 'DISTRICT', NULL, true, 0),
	('area-dist-ahmednagar', 'area-mh', 'Ahmednagar', 'DISTRICT', NULL, true, 0);


--
-- Data for Name: assets; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: asset_blackouts; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: audit_logs; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: blocked_users; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: bookings; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: income_ranges; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.income_ranges (id, label, "minValue", "maxValue", "sortOrder", "isActive") VALUES
	('income-1', 'Below ₹2 lakh', 0, 200000, 1, true),
	('income-2', '₹2–5 lakh', 200000, 500000, 2, true),
	('income-3', '₹5–10 lakh', 500000, 1000000, 3, true),
	('income-4', '₹10–20 lakh', 1000000, 2000000, 4, true),
	('income-5', '₹20–50 lakh', 2000000, 5000000, 5, true),
	('income-6', 'Above ₹50 lakh', 5000000, NULL, 6, true);


--
-- Data for Name: businesses; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: interests; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.interests (id, name, slug, category, "isSport", "isChildSafe", status, "mergedIntoId", "suggestedByMemberId", "reviewedBy", "reviewedAt", "sortOrder", "isActive", "createdAt") VALUES
	('cmv1fo49y0023q0zn42jx4dbm', 'Drawing and painting', 'drawing-painting', 'Arts', false, true, 'APPROVED', NULL, NULL, NULL, NULL, 0, true, '2026-10-09 20:44:08.23'),
	('cmv1fo49z0024q0znojih6mqi', 'Rangoli', 'rangoli', 'Arts', false, true, 'APPROVED', NULL, NULL, NULL, NULL, 1, true, '2026-10-09 20:44:08.232'),
	('cmv1fo4a00025q0zngmi5tvuu', 'Mehndi', 'mehndi', 'Arts', false, true, 'APPROVED', NULL, NULL, NULL, NULL, 2, true, '2026-10-09 20:44:08.233'),
	('cmv1fo4a20026q0znds8flbq4', 'Craft', 'craft', 'Arts', false, true, 'APPROVED', NULL, NULL, NULL, NULL, 3, true, '2026-10-09 20:44:08.234'),
	('cmv1fo4a30027q0zn9s47p7a8', 'Photography', 'photography', 'Arts', false, true, 'APPROVED', NULL, NULL, NULL, NULL, 4, true, '2026-10-09 20:44:08.235'),
	('cmv1fo4a40028q0zntm4uka01', 'Videography', 'videography', 'Arts', false, true, 'APPROVED', NULL, NULL, NULL, NULL, 5, true, '2026-10-09 20:44:08.236'),
	('cmv1fo4a50029q0znorvurwqk', 'Singing', 'singing', 'Music and stage', false, true, 'APPROVED', NULL, NULL, NULL, NULL, 6, true, '2026-10-09 20:44:08.237'),
	('cmv1fo4a6002aq0zn6lpjanby', 'Bhajan / kirtan', 'bhajan-kirtan', 'Music and stage', false, true, 'APPROVED', NULL, NULL, NULL, NULL, 7, true, '2026-10-09 20:44:08.238'),
	('cmv1fo4a7002bq0znq3nm269p', 'Musical instrument', 'instrument', 'Music and stage', false, true, 'APPROVED', NULL, NULL, NULL, NULL, 8, true, '2026-10-09 20:44:08.239'),
	('cmv1fo4a8002cq0zn1yp392rd', 'Dance', 'dance', 'Music and stage', false, true, 'APPROVED', NULL, NULL, NULL, NULL, 9, true, '2026-10-09 20:44:08.24'),
	('cmv1fo4a9002dq0znz6cz3v0p', 'Drama', 'drama', 'Music and stage', false, true, 'APPROVED', NULL, NULL, NULL, NULL, 10, true, '2026-10-09 20:44:08.242'),
	('cmv1fo4aa002eq0zn56nflujf', 'Anchoring', 'anchoring', 'Music and stage', false, true, 'APPROVED', NULL, NULL, NULL, NULL, 11, true, '2026-10-09 20:44:08.242'),
	('cmv1fo4ab002fq0znn1hb8qve', 'Reading', 'reading', 'Reading and writing', false, true, 'APPROVED', NULL, NULL, NULL, NULL, 12, true, '2026-10-09 20:44:08.243'),
	('cmv1fo4ac002gq0zneh1tby0d', 'Poetry', 'poetry', 'Reading and writing', false, true, 'APPROVED', NULL, NULL, NULL, NULL, 13, true, '2026-10-09 20:44:08.244'),
	('cmv1fo4ad002hq0znb4ps913v', 'Story and blog writing', 'story-blog-writing', 'Reading and writing', false, true, 'APPROVED', NULL, NULL, NULL, NULL, 14, true, '2026-10-09 20:44:08.246'),
	('cmv1fo4ae002iq0zninwiekgj', 'Public speaking', 'public-speaking', 'Reading and writing', false, true, 'APPROVED', NULL, NULL, NULL, NULL, 15, true, '2026-10-09 20:44:08.246'),
	('cmv1fo4af002jq0znp7u4gzbr', 'Cooking', 'cooking', 'Food', false, false, 'APPROVED', NULL, NULL, NULL, NULL, 16, true, '2026-10-09 20:44:08.247'),
	('cmv1fo4ag002kq0znheeldpdo', 'Baking', 'baking', 'Food', false, false, 'APPROVED', NULL, NULL, NULL, NULL, 17, true, '2026-10-09 20:44:08.248'),
	('cmv1fo4ah002lq0znza90tcij', 'Traditional recipes', 'traditional-recipes', 'Food', false, false, 'APPROVED', NULL, NULL, NULL, NULL, 18, true, '2026-10-09 20:44:08.25'),
	('cmv1fo4ai002mq0zn0u5sgoz5', 'Trekking', 'trekking', 'Outdoors', false, false, 'APPROVED', NULL, NULL, NULL, NULL, 19, true, '2026-10-09 20:44:08.251'),
	('cmv1fo4aj002nq0znff51wn2f', 'Cycling', 'cycling', 'Outdoors', false, false, 'APPROVED', NULL, NULL, NULL, NULL, 20, true, '2026-10-09 20:44:08.252'),
	('cmv1fo4ak002oq0znpk9dry2j', 'Running', 'running', 'Outdoors', false, false, 'APPROVED', NULL, NULL, NULL, NULL, 21, true, '2026-10-09 20:44:08.252'),
	('cmv1fo4al002pq0zntxbb9t4k', 'Travel', 'travel', 'Outdoors', false, false, 'APPROVED', NULL, NULL, NULL, NULL, 22, true, '2026-10-09 20:44:08.254'),
	('cmv1fo4am002qq0znutii1m5p', 'Pilgrimage (yatra)', 'pilgrimage', 'Outdoors', false, false, 'APPROVED', NULL, NULL, NULL, NULL, 23, true, '2026-10-09 20:44:08.255'),
	('cmv1fo4an002rq0zn0w3w38f4', 'Gardening', 'gardening', 'Outdoors', false, false, 'APPROVED', NULL, NULL, NULL, NULL, 24, true, '2026-10-09 20:44:08.256'),
	('cmv1fo4ao002sq0zn7rhkipxp', 'Farming methods', 'farming-methods', 'Outdoors', false, false, 'APPROVED', NULL, NULL, NULL, NULL, 25, true, '2026-10-09 20:44:08.257'),
	('cmv1fo4ap002tq0znm0df9722', 'Bird watching', 'bird-watching', 'Outdoors', false, false, 'APPROVED', NULL, NULL, NULL, NULL, 26, true, '2026-10-09 20:44:08.258'),
	('cmv1fo4aq002uq0znicpnmjms', 'Cricket', 'cricket', 'Games', true, true, 'APPROVED', NULL, NULL, NULL, NULL, 27, true, '2026-10-09 20:44:08.259'),
	('cmv1fo4ar002vq0znh2zev3gd', 'Badminton', 'badminton', 'Games', true, true, 'APPROVED', NULL, NULL, NULL, NULL, 28, true, '2026-10-09 20:44:08.26'),
	('cmv1fo4as002wq0znyy0173r5', 'Chess', 'chess', 'Games', true, true, 'APPROVED', NULL, NULL, NULL, NULL, 29, true, '2026-10-09 20:44:08.261'),
	('cmv1fo4at002xq0znie832v6z', 'Carrom', 'carrom', 'Games', true, true, 'APPROVED', NULL, NULL, NULL, NULL, 30, true, '2026-10-09 20:44:08.262'),
	('cmv1fo4av002yq0zncee366hq', 'Kabaddi', 'kabaddi', 'Games', true, true, 'APPROVED', NULL, NULL, NULL, NULL, 31, true, '2026-10-09 20:44:08.263'),
	('cmv1fo4aw002zq0zn7nrvg15n', 'Kho-kho', 'kho-kho', 'Games', true, true, 'APPROVED', NULL, NULL, NULL, NULL, 32, true, '2026-10-09 20:44:08.264'),
	('cmv1fo4ax0030q0znyretjc7n', 'Football', 'football', 'Games', true, true, 'APPROVED', NULL, NULL, NULL, NULL, 33, true, '2026-10-09 20:44:08.265'),
	('cmv1fo4ay0031q0zna37txyow', 'Volleyball', 'volleyball', 'Games', true, true, 'APPROVED', NULL, NULL, NULL, NULL, 34, true, '2026-10-09 20:44:08.267'),
	('cmv1fo4az0032q0zn1l10l8ur', 'Table tennis', 'table-tennis', 'Games', true, true, 'APPROVED', NULL, NULL, NULL, NULL, 35, true, '2026-10-09 20:44:08.268'),
	('cmv1fo4b00033q0zn7l5kxe08', 'Athletics', 'athletics', 'Games', true, true, 'APPROVED', NULL, NULL, NULL, NULL, 36, true, '2026-10-09 20:44:08.269'),
	('cmv1fo4b20034q0znx0sse9pf', 'Swimming', 'swimming', 'Games', true, true, 'APPROVED', NULL, NULL, NULL, NULL, 37, true, '2026-10-09 20:44:08.27'),
	('cmv1fo4b30035q0zn3memb2jt', 'Wrestling', 'wrestling', 'Games', true, true, 'APPROVED', NULL, NULL, NULL, NULL, 38, true, '2026-10-09 20:44:08.271'),
	('cmv1fo4b40036q0zni5drok35', 'Other sports', 'other-sports', 'Games', true, true, 'APPROVED', NULL, NULL, NULL, NULL, 39, true, '2026-10-09 20:44:08.272'),
	('cmv1fo4b50037q0zngvdc7djj', 'Yoga', 'yoga', 'Wellness', false, false, 'APPROVED', NULL, NULL, NULL, NULL, 40, true, '2026-10-09 20:44:08.273'),
	('cmv1fo4b60038q0znk6z5gyqg', 'Meditation', 'meditation', 'Wellness', false, false, 'APPROVED', NULL, NULL, NULL, NULL, 41, true, '2026-10-09 20:44:08.274'),
	('cmv1fo4b70039q0zngchsr7tf', 'Gym and fitness', 'gym-fitness', 'Wellness', false, false, 'APPROVED', NULL, NULL, NULL, NULL, 42, true, '2026-10-09 20:44:08.275'),
	('cmv1fo4b8003aq0zny069q9l6', 'Coding', 'coding', 'Technology', false, false, 'APPROVED', NULL, NULL, NULL, NULL, 43, true, '2026-10-09 20:44:08.276'),
	('cmv1fo4b9003bq0zne2l8ae9l', 'Gadgets', 'gadgets', 'Technology', false, false, 'APPROVED', NULL, NULL, NULL, NULL, 44, true, '2026-10-09 20:44:08.277'),
	('cmv1fo4ba003cq0zn3ft6p4kl', 'AI', 'ai', 'Technology', false, false, 'APPROVED', NULL, NULL, NULL, NULL, 45, true, '2026-10-09 20:44:08.279'),
	('cmv1fo4bb003dq0znj6zhdtqc', 'Video editing', 'video-editing', 'Technology', false, false, 'APPROVED', NULL, NULL, NULL, NULL, 46, true, '2026-10-09 20:44:08.28'),
	('cmv1fo4bc003eq0zns9c8gz67', 'Gaming', 'gaming', 'Technology', false, false, 'APPROVED', NULL, NULL, NULL, NULL, 47, true, '2026-10-09 20:44:08.281'),
	('cmv1fo4bd003fq0zn6qubudhl', 'Share market', 'share-market', 'Money and business', false, false, 'APPROVED', NULL, NULL, NULL, NULL, 48, true, '2026-10-09 20:44:08.282'),
	('cmv1fo4be003gq0znzx1c8vhl', 'Personal finance', 'personal-finance', 'Money and business', false, false, 'APPROVED', NULL, NULL, NULL, NULL, 49, true, '2026-10-09 20:44:08.283'),
	('cmv1fo4bf003hq0znt1dygd6c', 'Start-ups', 'start-ups', 'Money and business', false, false, 'APPROVED', NULL, NULL, NULL, NULL, 50, true, '2026-10-09 20:44:08.284'),
	('cmv1fo4bg003iq0zn3selu3eg', 'Interior decoration', 'interior-decoration', 'Home', false, false, 'APPROVED', NULL, NULL, NULL, NULL, 51, true, '2026-10-09 20:44:08.285'),
	('cmv1fo4bh003jq0znicqcqpb9', 'Tailoring and embroidery', 'tailoring-embroidery', 'Home', false, false, 'APPROVED', NULL, NULL, NULL, NULL, 52, true, '2026-10-09 20:44:08.286'),
	('cmv1fo4bi003kq0zn9zdp6i4q', 'Pets', 'pets', 'Home', false, false, 'APPROVED', NULL, NULL, NULL, NULL, 53, true, '2026-10-09 20:44:08.287'),
	('cmv1fo4bj003lq0znhk65hqq0', 'Social work', 'social-work', 'Service', false, false, 'APPROVED', NULL, NULL, NULL, NULL, 54, true, '2026-10-09 20:44:08.288'),
	('cmv1fo4bk003mq0znow4ho90n', 'Teaching', 'teaching', 'Service', false, false, 'APPROVED', NULL, NULL, NULL, NULL, 55, true, '2026-10-09 20:44:08.289'),
	('cmv1fo4bl003nq0znprjyoidn', 'Blood donation', 'blood-donation', 'Service', false, false, 'APPROVED', NULL, NULL, NULL, NULL, 56, true, '2026-10-09 20:44:08.29'),
	('cmv1fo4bm003oq0zniivg6rxt', 'Environment', 'environment', 'Service', false, false, 'APPROVED', NULL, NULL, NULL, NULL, 57, true, '2026-10-09 20:44:08.291');


--
-- Data for Name: community_groups; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: post_types; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.post_types (id, code, label, icon, "requiresApproval", "isActive") VALUES
	('cmv1fo47r000pq0znv5c3crgc', 'GENERAL', 'General', '📌', false, true),
	('cmv1fo47u000qq0znrqsnuzoj', 'ANNOUNCEMENT', 'Announcement', '📢', false, true),
	('cmv1fo47v000rq0zn1lcscc59', 'EVENT', 'Event', '🎉', false, true),
	('cmv1fo47w000sq0zn190yv396', 'ACHIEVEMENT', 'Achievement', '🏆', false, true),
	('cmv1fo47y000tq0znsxvweuqm', 'BIRTHDAY', 'Birthday', '🎂', false, true),
	('cmv1fo47z000uq0znvttdlc2o', 'MARRIAGE', 'Marriage', '💒', false, true),
	('cmv1fo480000vq0zn0bkw5vrq', 'CONDOLENCE', 'Condolence', '🙏', false, true),
	('cmv1fo480000wq0zno4lawrcc', 'JOB', 'Job Opportunity', '💼', false, true),
	('cmv1fo481000xq0znwubwy6us', 'BUSINESS', 'Business', '🏢', false, true),
	('cmv1fo482000yq0zny4e1uuxt', 'LOST_FOUND', 'Lost & Found', '🔍', false, true),
	('cmv1fo4bn003pq0zninwctrs7', 'GROUP_POST', 'Group post', '💬', false, true),
	('cmv1fo4bo003qq0znku79wudl', 'GROUP_QUESTION', 'Problem / need help', '🙋', false, true),
	('cmv1fo4bp003rq0zn1okjteic', 'GROUP_KNOWLEDGE', 'Knowledge', '📘', false, true),
	('cmv1fo4bq003sq0znnfdej0yj', 'GROUP_EVENT', 'Event / meet-up', '📅', false, true),
	('cmv1fo4br003tq0znw2lgjess', 'GROUP_POLL', 'Poll', '📊', false, true);


--
-- Data for Name: posts; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: comments; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: community_group_members; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: consent_records; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: contact_requests; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: education_records; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: employment_records; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: family_areas; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: family_join_requests; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: family_members; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: fee_types; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.fee_types (id, code, label, description, "amountPaise", "appliesTo", "isActive", "updatedAt") VALUES
	('cmv1fo49g001xq0znnlecg9uh', 'FAMILY_REGISTRATION', 'Family Registration Fee', 'One-time fee payable by the Karta when a new family is registered. Other family members join free.', 200000, 'FAMILY_KARTA', true, '2026-10-09 20:44:08.213');


--
-- Data for Name: fee_invoices; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: field_visibility_defaults; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: marital_status_history; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: marriage_records; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: matrimonial_interests; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: matrimonial_profiles; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: matrimonial_preferences; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: matrimonial_saves; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: member_additional_details; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: member_areas; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: member_farm_holdings; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: member_field_visibility; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: member_files; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: member_hobbies; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: member_insurances; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: member_invitations; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: member_loan_needs; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: member_profile_details; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: relationship_types; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.relationship_types (id, code, label, "inverseCode", "genderApplicable", "isSpouse", "isActive", "sortOrder") VALUES
	('cmv1fo484000zq0znfd9iwflx', 'father', 'Father', 'son', 'MALE', false, true, 0),
	('cmv1fo4860010q0zn8f6e7vin', 'mother', 'Mother', 'son', 'FEMALE', false, true, 0),
	('cmv1fo4870011q0znx47zohpv', 'son', 'Son', 'father', 'MALE', false, true, 0),
	('cmv1fo4880012q0znwv5s4ian', 'daughter', 'Daughter', 'father', 'FEMALE', false, true, 0),
	('cmv1fo4890013q0znoyaspp2r', 'husband', 'Husband', 'wife', 'MALE', true, true, 0),
	('cmv1fo48b0014q0znsvc88abs', 'wife', 'Wife', 'husband', 'FEMALE', true, true, 0),
	('cmv1fo48c0015q0znagkw2zu5', 'brother', 'Brother', 'brother', 'MALE', false, true, 0),
	('cmv1fo48d0016q0znt5b6ryap', 'sister', 'Sister', 'brother', 'FEMALE', false, true, 0),
	('cmv1fo48e0017q0znoyx4bclz', 'grandfather_p', 'Grandfather (Paternal)', 'grandson', 'MALE', false, true, 0),
	('cmv1fo48f0018q0znaqshe6rg', 'grandmother_p', 'Grandmother (Paternal)', 'grandson', 'FEMALE', false, true, 0),
	('cmv1fo48g0019q0znkn7b5au3', 'grandson', 'Grandson', 'grandfather_p', 'MALE', false, true, 0),
	('cmv1fo48h001aq0zn2zoxxxsa', 'granddaughter', 'Granddaughter', 'grandfather_p', 'FEMALE', false, true, 0),
	('cmv1fo48i001bq0znp8fph0gs', 'uncle', 'Uncle', 'nephew', 'MALE', false, true, 0),
	('cmv1fo48j001cq0znur1vbdp4', 'aunt', 'Aunt', 'nephew', 'FEMALE', false, true, 0),
	('cmv1fo48j001dq0zn316cdkb5', 'nephew', 'Nephew', 'uncle', 'MALE', false, true, 0),
	('cmv1fo48k001eq0zn4lvymp2x', 'niece', 'Niece', 'uncle', 'FEMALE', false, true, 0),
	('cmv1fo48l001fq0znayfnj1pj', 'son_in_law', 'Son-in-law', 'father_in_law', 'MALE', false, true, 0),
	('cmv1fo48m001gq0znkew3ou6h', 'daughter_in_law', 'Daughter-in-law', 'father_in_law', 'FEMALE', false, true, 0),
	('cmv1fo48n001hq0zn5vcalbpc', 'father_in_law', 'Father-in-law', 'son_in_law', 'MALE', false, true, 0),
	('cmv1fo48o001iq0znkdo01gir', 'mother_in_law', 'Mother-in-law', 'son_in_law', 'FEMALE', false, true, 0);


--
-- Data for Name: member_relationships; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: member_section_settings; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: skills; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: member_skills; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: member_sports; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: member_sport_achievements; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: member_vehicles; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: notifications; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: option_masters; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: payments; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: permissions; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.permissions (id, code, label, module) VALUES
	('cmv1fo3yn0005q0znyu5vd360', 'family:create', 'Register a new family', 'family'),
	('cmv1fo3yp0006q0znbiosavzq', 'family:edit_own', 'Edit own family', 'family'),
	('cmv1fo3yq0007q0zna4ioqu41', 'family:edit_any', 'Edit any family', 'family'),
	('cmv1fo3yr0008q0zndenu0los', 'family:member_add', 'Add members to own family', 'family'),
	('cmv1fo3ys0009q0zns7694my3', 'family:view_tree', 'View own family tree', 'family'),
	('cmv1fo3yt000aq0zn82qk4w5y', 'family:approve', 'Verify/approve families', 'family'),
	('cmv1fo3yu000bq0znuxlot9n8', 'member:edit_own', 'Edit own member profile', 'member'),
	('cmv1fo3yv000cq0znk13fbmn2', 'member:edit_any', 'Edit any member profile', 'member'),
	('cmv1fo3yw000dq0zn3v9pgtfu', 'member:mark_deceased', 'Mark a member deceased', 'member'),
	('cmv1fo3yx000eq0znyk8v18du', 'matrimony:manage_own', 'Manage own matrimonial profile', 'matrimony'),
	('cmv1fo3yy000fq0zn7tm3cl34', 'approval:review', 'Review approval requests', 'approval'),
	('cmv1fo3yy000gq0zns2bxkf3f', 'admin:users', 'Manage users and roles', 'admin'),
	('cmv1fo3yz000hq0zndnzvq343', 'admin:settings', 'Manage platform settings', 'admin'),
	('cmv1fo3z0000iq0znfemmsx58', 'admin:audit', 'View audit logs', 'admin'),
	('cmv1fo3z1000jq0znzqw0se51', 'asset:manage_own', 'Manage own assets', 'asset'),
	('cmv1fo3z2000kq0zntp4t223o', 'group:manage_own', 'Register and convene community groups', 'group'),
	('cmv1fo3z3000lq0znb3g3fhpx', 'group:approve', 'Approve community groups', 'group');


--
-- Data for Name: photos; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: post_poll_options; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: post_poll_votes; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: post_rsvps; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: reactions; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: refresh_tokens; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: reports; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: roles; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.roles (id, code, label, description, "isSystem", "createdAt") VALUES
	('cmv1fo3yi0002q0znmg254mxz', 'KARTA', 'Family Head (Karta)', NULL, true, '2026-10-09 20:44:07.816'),
	('cmv1fo49k0020q0znc6ofgr5o', 'DISTRICT_TEAM', 'District team', NULL, true, '2026-10-09 20:44:08.217'),
	('cmv1fo49l0021q0znbxp2faut', 'STATE_TEAM', 'State team', NULL, true, '2026-10-09 20:44:08.218'),
	('cmv1fo49m0022q0znlqiu1kff', 'NATIONAL_TEAM', 'National team', NULL, true, '2026-10-09 20:44:08.219'),
	('cmv1fo3yi0001q0zna1m2xsfc', 'OPERATOR', 'Operator', NULL, true, '2026-10-09 20:44:07.816'),
	('cmv1fo3yf0000q0znri27h1bm', 'MEMBER', 'Member', NULL, true, '2026-10-09 20:44:07.816'),
	('cmv1fo3yj0003q0zn73sjbbnm', 'ASSET_OWNER', 'Asset Owner', NULL, true, '2026-10-09 20:44:07.816'),
	('cmv1fo3yj0004q0zned16kbh1', 'ADMIN', 'Administrator', NULL, true, '2026-10-09 20:44:07.816');


--
-- Data for Name: role_permissions; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.role_permissions ("roleId", "permissionId") VALUES
	('cmv1fo3yf0000q0znri27h1bm', 'cmv1fo3yu000bq0znuxlot9n8'),
	('cmv1fo3yf0000q0znri27h1bm', 'cmv1fo3yx000eq0znyk8v18du'),
	('cmv1fo3yf0000q0znri27h1bm', 'cmv1fo3ys0009q0zns7694my3'),
	('cmv1fo3yf0000q0znri27h1bm', 'cmv1fo3z2000kq0zntp4t223o'),
	('cmv1fo3yi0002q0znmg254mxz', 'cmv1fo3yu000bq0znuxlot9n8'),
	('cmv1fo3yi0002q0znmg254mxz', 'cmv1fo3yx000eq0znyk8v18du'),
	('cmv1fo3yi0002q0znmg254mxz', 'cmv1fo3ys0009q0zns7694my3'),
	('cmv1fo3yi0002q0znmg254mxz', 'cmv1fo3yn0005q0znyu5vd360'),
	('cmv1fo3yi0002q0znmg254mxz', 'cmv1fo3yp0006q0znbiosavzq'),
	('cmv1fo3yi0002q0znmg254mxz', 'cmv1fo3yr0008q0zndenu0los'),
	('cmv1fo3yi0002q0znmg254mxz', 'cmv1fo3z2000kq0zntp4t223o'),
	('cmv1fo3yj0003q0zn73sjbbnm', 'cmv1fo3yu000bq0znuxlot9n8'),
	('cmv1fo3yj0003q0zn73sjbbnm', 'cmv1fo3yx000eq0znyk8v18du'),
	('cmv1fo3yj0003q0zn73sjbbnm', 'cmv1fo3ys0009q0zns7694my3'),
	('cmv1fo3yj0003q0zn73sjbbnm', 'cmv1fo3z1000jq0znzqw0se51'),
	('cmv1fo3yj0003q0zn73sjbbnm', 'cmv1fo3z2000kq0zntp4t223o'),
	('cmv1fo3yi0001q0zna1m2xsfc', 'cmv1fo3yu000bq0znuxlot9n8'),
	('cmv1fo3yi0001q0zna1m2xsfc', 'cmv1fo3yx000eq0znyk8v18du'),
	('cmv1fo3yi0001q0zna1m2xsfc', 'cmv1fo3ys0009q0zns7694my3'),
	('cmv1fo3yi0001q0zna1m2xsfc', 'cmv1fo3yv000cq0znk13fbmn2'),
	('cmv1fo3yi0001q0zna1m2xsfc', 'cmv1fo3yw000dq0zn3v9pgtfu'),
	('cmv1fo3yi0001q0zna1m2xsfc', 'cmv1fo3yq0007q0zna4ioqu41'),
	('cmv1fo3yi0001q0zna1m2xsfc', 'cmv1fo3yr0008q0zndenu0los'),
	('cmv1fo3yi0001q0zna1m2xsfc', 'cmv1fo3yt000aq0zn82qk4w5y'),
	('cmv1fo3yi0001q0zna1m2xsfc', 'cmv1fo3yy000fq0zn7tm3cl34'),
	('cmv1fo3yi0001q0zna1m2xsfc', 'cmv1fo3z2000kq0zntp4t223o'),
	('cmv1fo3yi0001q0zna1m2xsfc', 'cmv1fo3z3000lq0znb3g3fhpx'),
	('cmv1fo3yj0004q0zned16kbh1', 'cmv1fo3yn0005q0znyu5vd360'),
	('cmv1fo3yj0004q0zned16kbh1', 'cmv1fo3yp0006q0znbiosavzq'),
	('cmv1fo3yj0004q0zned16kbh1', 'cmv1fo3yq0007q0zna4ioqu41'),
	('cmv1fo3yj0004q0zned16kbh1', 'cmv1fo3yr0008q0zndenu0los'),
	('cmv1fo3yj0004q0zned16kbh1', 'cmv1fo3ys0009q0zns7694my3'),
	('cmv1fo3yj0004q0zned16kbh1', 'cmv1fo3yt000aq0zn82qk4w5y'),
	('cmv1fo3yj0004q0zned16kbh1', 'cmv1fo3yu000bq0znuxlot9n8'),
	('cmv1fo3yj0004q0zned16kbh1', 'cmv1fo3yv000cq0znk13fbmn2'),
	('cmv1fo3yj0004q0zned16kbh1', 'cmv1fo3yw000dq0zn3v9pgtfu'),
	('cmv1fo3yj0004q0zned16kbh1', 'cmv1fo3yx000eq0znyk8v18du'),
	('cmv1fo3yj0004q0zned16kbh1', 'cmv1fo3yy000fq0zn7tm3cl34'),
	('cmv1fo3yj0004q0zned16kbh1', 'cmv1fo3yy000gq0zns2bxkf3f'),
	('cmv1fo3yj0004q0zned16kbh1', 'cmv1fo3yz000hq0zndnzvq343'),
	('cmv1fo3yj0004q0zned16kbh1', 'cmv1fo3z0000iq0znfemmsx58'),
	('cmv1fo3yj0004q0zned16kbh1', 'cmv1fo3z1000jq0znzqw0se51'),
	('cmv1fo3yj0004q0zned16kbh1', 'cmv1fo3z2000kq0zntp4t223o'),
	('cmv1fo3yj0004q0zned16kbh1', 'cmv1fo3z3000lq0znb3g3fhpx');


--
-- Data for Name: settings; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.settings (id, key, value, description, "updatedBy", "updatedAt") VALUES
	('cmv1fo49d001uq0znfoi71o67', 'community.name', '"\"Ladwani Samaj\""', 'Community display name', NULL, '2026-10-09 20:44:08.209'),
	('cmv1fo49e001vq0znrfbcls1p', 'community.tagline', '"\"Our Community, Our Heritage, Our Future\""', 'Community tagline', NULL, '2026-10-09 20:44:08.211'),
	('cmv1fo49f001wq0znvy4mh42u', 'matrimony.contact_exchange', '"\"ACCEPT_FIRST\""', 'When to reveal contact: ACCEPT_FIRST or FAMILY_APPROVAL', NULL, '2026-10-09 20:44:08.212');


--
-- Data for Name: support_requests; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: user_roles; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.user_roles (id, "userId", "roleId", "familyId", "areaId", "grantedBy", "grantedAt", "expiresAt") VALUES
	('admin-role-cmv1fo47h000mq0znu3o2ieqp', 'cmv1fo47h000mq0znu3o2ieqp', 'cmv1fo3yj0004q0zned16kbh1', NULL, NULL, NULL, '2026-10-09 20:44:08.144', NULL);


--
-- Data for Name: verification_tokens; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- PostgreSQL database dump complete
--


