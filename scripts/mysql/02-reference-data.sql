-- =====================================================================
-- Mi Ladwani — 02-reference-data.sql
-- Output of prisma/seeds/seed.ts (main @ f12780f, test accounts OFF):
-- 5 roles, 17 permissions + 44 grants, 20 relationship types,
-- 13 approval rules, 10 post types, 5 areas, 6 income ranges, 3 settings,
-- the ₹2,000 family registration fee, and ONE admin login:
--
--     admin@miladwani.com  /  ChangeThisInProduction123!
--
-- That password is public (it's in this repo) — LOG IN AND CHANGE IT
-- IMMEDIATELY. Also records all 4 migrations in _prisma_migrations, so
-- a later `npx prisma migrate deploy` is a no-op instead of an error.
-- Import AFTER 01-schema.sql, with the database selected.
-- =====================================================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;
INSERT INTO `_prisma_migrations` (`id`, `checksum`, `finished_at`, `migration_name`, `logs`, `rolled_back_at`, `started_at`, `applied_steps_count`) VALUES ('19ada72f-12c2-4a02-a0ab-494dcd048cca','fffd6c37b011057af75ad5b74eeb71457870ed5fea7095a1529a53972fbb1b2a','2026-10-03 13:50:59.670','20260922120000_member_languages',NULL,NULL,'2026-10-03 13:50:59.666',1),
('3dda1024-4244-4af4-b1c9-8368a9fe33fa','c82675ee4126d590035b047acd84502263f41828cbe5b8711bc3436e1e302f9b','2026-10-03 13:50:59.666','20260911150000_member_invitations_and_join_direction',NULL,NULL,'2026-10-03 13:50:59.653',1),
('ae9d992a-acc4-46f2-b9a2-ce654a254855','3393bb854009c34425203e8ddfed958a61e07e0ac2003610ff5514535dd68991','2026-10-03 13:50:59.701','20261003120000_member_profile_details',NULL,NULL,'2026-10-03 13:50:59.670',1),
('c97ca3d7-d250-4e82-be65-cbaf0cbd1547','584c8fab176b065f3aedbdf8d0012d17cbc1ab48026c15c30caeaf85f667372d','2026-10-03 13:50:59.653','20260910163143_init',NULL,NULL,'2026-10-03 13:50:59.239',1);
INSERT INTO `approval_rules` (`id`, `actionCode`, `requiresApproval`, `approverRole`, `autoApproveRole`, `isActive`, `updatedAt`) VALUES ('cmusg9yvn001jr7ekpiobx7i3','family.create',1,'OPERATOR',NULL,1,'2026-10-03 13:51:12.084'),
('cmusg9yvp001kr7eklogmv5h8','family.member.add',1,'OPERATOR',NULL,1,'2026-10-03 13:51:12.085'),
('cmusg9yvr001lr7ekvfxuxm8x','member.marital_status.change',1,'OPERATOR',NULL,1,'2026-10-03 13:51:12.087'),
('cmusg9yvs001mr7ek4g1hezfy','member.mark_deceased',1,'OPERATOR',NULL,1,'2026-10-03 13:51:12.088'),
('cmusg9yvt001nr7ekyhjobznx','member.relationship.change',1,'OPERATOR',NULL,1,'2026-10-03 13:51:12.090'),
('cmusg9yvv001or7ek494bmkck','member.address.change',1,'OPERATOR',NULL,1,'2026-10-03 13:51:12.091'),
('cmusg9yvw001pr7ekvi2buy4o','family.karta.change',1,'ADMIN',NULL,1,'2026-10-03 13:51:12.092'),
('cmusg9yvx001qr7ek32bkymbb','family.merge',1,'ADMIN',NULL,1,'2026-10-03 13:51:12.094'),
('cmusg9yvz001rr7ekenk4qcar','member.edit_own',0,NULL,'MEMBER',1,'2026-10-03 13:51:12.095'),
('cmusg9yw0001sr7eku0xjyzc2','member.education.edit_own',0,NULL,'MEMBER',1,'2026-10-03 13:51:12.096'),
('cmusg9yw1001tr7ekeh0rpahb','member.employment.edit_own',0,NULL,'MEMBER',1,'2026-10-03 13:51:12.097'),
('cmusg9ywq001yr7ekwzworpfq','asset.create',1,'OPERATOR',NULL,1,'2026-10-03 13:51:12.122'),
('cmusg9ywr001zr7ek3b8g3xxb','group.create',1,'OPERATOR',NULL,1,'2026-10-03 13:51:12.124');
INSERT INTO `areas` (`id`, `parentId`, `name`, `type`, `code`, `isActive`, `sortOrder`) VALUES ('area-india',NULL,'India','COUNTRY','IN',1,0),
('area-mh','area-india','Maharashtra','STATE','MH',1,0),
('area-mumbai','area-mh','Mumbai','CITY',NULL,1,0),
('area-nagpur','area-mh','Nagpur','CITY',NULL,1,0),
('area-pune','area-mh','Pune','CITY',NULL,1,0);
INSERT INTO `fee_types` (`id`, `code`, `label`, `description`, `amountPaise`, `appliesTo`, `isActive`, `updatedAt`) VALUES ('cmusg9ywo001xr7ekl1rvry0y','FAMILY_REGISTRATION','Family Registration Fee','One-time fee payable by the Karta when a new family is registered. Other family members join free.',200000,'FAMILY_KARTA',1,'2026-10-03 13:51:12.120');
INSERT INTO `income_ranges` (`id`, `label`, `minValue`, `maxValue`, `sortOrder`, `isActive`) VALUES ('income-1','Below ₹2 lakh',0,200000,1,1),
('income-2','₹2–5 lakh',200000,500000,2,1),
('income-3','₹5–10 lakh',500000,1000000,3,1),
('income-4','₹10–20 lakh',1000000,2000000,4,1),
('income-5','₹20–50 lakh',2000000,5000000,5,1),
('income-6','Above ₹50 lakh',5000000,NULL,6,1);
INSERT INTO `permissions` (`id`, `code`, `label`, `module`) VALUES ('cmusg9yje0005r7eke4k43pg8','family:create','Register a new family','family'),
('cmusg9yjf0006r7ek74wd447q','family:edit_own','Edit own family','family'),
('cmusg9yjh0007r7ekst2vuqv2','family:edit_any','Edit any family','family'),
('cmusg9yji0008r7ekj7kvszvo','family:member_add','Add members to own family','family'),
('cmusg9yjk0009r7eke6kpn40j','family:view_tree','View own family tree','family'),
('cmusg9yjl000ar7ekbuj6ocmz','family:approve','Verify/approve families','family'),
('cmusg9yjm000br7ek55bbn8ki','member:edit_own','Edit own member profile','member'),
('cmusg9yjn000cr7ekd4zi2ypt','member:edit_any','Edit any member profile','member'),
('cmusg9yjo000dr7ekydwhgfx3','member:mark_deceased','Mark a member deceased','member'),
('cmusg9yjp000er7ek2a3bklpy','matrimony:manage_own','Manage own matrimonial profile','matrimony'),
('cmusg9yjr000fr7ek54mzap42','approval:review','Review approval requests','approval'),
('cmusg9yjs000gr7ekb9fyjutd','admin:users','Manage users and roles','admin'),
('cmusg9yjs000hr7eknn65quge','admin:settings','Manage platform settings','admin'),
('cmusg9yju000ir7ek23u6vzye','admin:audit','View audit logs','admin'),
('cmusg9yjv000jr7ek33tpwinw','asset:manage_own','Manage own assets','asset'),
('cmusg9yjw000kr7ekg2eqxpzh','group:manage_own','Register and convene community groups','group'),
('cmusg9yjx000lr7ekxrwwf3it','group:approve','Approve community groups','group');
INSERT INTO `post_types` (`id`, `code`, `label`, `icon`, `requiresApproval`, `isActive`) VALUES ('cmusg9yuj000pr7eksiatgg3r','GENERAL','General','📌',0,1),
('cmusg9yul000qr7ekkh6os2bp','ANNOUNCEMENT','Announcement','📢',0,1),
('cmusg9yum000rr7ek8f2jtw6k','EVENT','Event','🎉',0,1),
('cmusg9yun000sr7ekisodlpcr','ACHIEVEMENT','Achievement','🏆',0,1),
('cmusg9yup000tr7ekidy8oiff','BIRTHDAY','Birthday','🎂',0,1),
('cmusg9yuq000ur7ekrea2dahx','MARRIAGE','Marriage','💒',0,1),
('cmusg9yur000vr7ekcd282t51','CONDOLENCE','Condolence','🙏',0,1),
('cmusg9yut000wr7ekm60n39bg','JOB','Job Opportunity','💼',0,1),
('cmusg9yuu000xr7ek1fwv2s58','BUSINESS','Business','🏢',0,1),
('cmusg9yuv000yr7eku2voehqg','LOST_FOUND','Lost & Found','🔍',0,1);
INSERT INTO `relationship_types` (`id`, `code`, `label`, `inverseCode`, `genderApplicable`, `isSpouse`, `isActive`, `sortOrder`) VALUES ('cmusg9yux000zr7ekw3fwe5ki','father','Father','son','MALE',0,1,0),
('cmusg9yuz0010r7ekwuerervt','mother','Mother','son','FEMALE',0,1,0),
('cmusg9yv00011r7ek9qmgfbdw','son','Son','father','MALE',0,1,0),
('cmusg9yv10012r7ekg0fvyeuv','daughter','Daughter','father','FEMALE',0,1,0),
('cmusg9yv30013r7ekjaqvcbgz','husband','Husband','wife','MALE',1,1,0),
('cmusg9yv40014r7ekosm8gm5v','wife','Wife','husband','FEMALE',1,1,0),
('cmusg9yv50015r7ek3udezvc3','brother','Brother','brother','MALE',0,1,0),
('cmusg9yv60016r7ekau14m4a0','sister','Sister','brother','FEMALE',0,1,0),
('cmusg9yv70017r7ekj9ibuxzq','grandfather_p','Grandfather (Paternal)','grandson','MALE',0,1,0),
('cmusg9yv90018r7ekljtb094j','grandmother_p','Grandmother (Paternal)','grandson','FEMALE',0,1,0),
('cmusg9yva0019r7ek1op973dq','grandson','Grandson','grandfather_p','MALE',0,1,0),
('cmusg9yvb001ar7ektuyc1pbg','granddaughter','Granddaughter','grandfather_p','FEMALE',0,1,0),
('cmusg9yvd001br7ekg4vxt4qq','uncle','Uncle','nephew','MALE',0,1,0),
('cmusg9yve001cr7ekn205s7gi','aunt','Aunt','nephew','FEMALE',0,1,0),
('cmusg9yvf001dr7ekz5gxqk5w','nephew','Nephew','uncle','MALE',0,1,0),
('cmusg9yvg001er7ekqq609ks4','niece','Niece','uncle','FEMALE',0,1,0),
('cmusg9yvi001fr7eko00zn54p','son_in_law','Son-in-law','father_in_law','MALE',0,1,0),
('cmusg9yvj001gr7ekrej1nwed','daughter_in_law','Daughter-in-law','father_in_law','FEMALE',0,1,0),
('cmusg9yvk001hr7ekwbqyolbs','father_in_law','Father-in-law','son_in_law','MALE',0,1,0),
('cmusg9yvl001ir7ek1agopm41','mother_in_law','Mother-in-law','son_in_law','FEMALE',0,1,0);
INSERT INTO `role_permissions` (`roleId`, `permissionId`) VALUES ('cmusg9yj80000r7ekes8lumrx','cmusg9yjk0009r7eke6kpn40j'),
('cmusg9yj80000r7ekes8lumrx','cmusg9yjm000br7ek55bbn8ki'),
('cmusg9yj80000r7ekes8lumrx','cmusg9yjp000er7ek2a3bklpy'),
('cmusg9yj80000r7ekes8lumrx','cmusg9yjw000kr7ekg2eqxpzh'),
('cmusg9yja0001r7ekj6w5s40i','cmusg9yje0005r7eke4k43pg8'),
('cmusg9yja0001r7ekj6w5s40i','cmusg9yjf0006r7ek74wd447q'),
('cmusg9yja0001r7ekj6w5s40i','cmusg9yjh0007r7ekst2vuqv2'),
('cmusg9yja0001r7ekj6w5s40i','cmusg9yji0008r7ekj7kvszvo'),
('cmusg9yja0001r7ekj6w5s40i','cmusg9yjk0009r7eke6kpn40j'),
('cmusg9yja0001r7ekj6w5s40i','cmusg9yjl000ar7ekbuj6ocmz'),
('cmusg9yja0001r7ekj6w5s40i','cmusg9yjm000br7ek55bbn8ki'),
('cmusg9yja0001r7ekj6w5s40i','cmusg9yjn000cr7ekd4zi2ypt'),
('cmusg9yja0001r7ekj6w5s40i','cmusg9yjo000dr7ekydwhgfx3'),
('cmusg9yja0001r7ekj6w5s40i','cmusg9yjp000er7ek2a3bklpy'),
('cmusg9yja0001r7ekj6w5s40i','cmusg9yjr000fr7ek54mzap42'),
('cmusg9yja0001r7ekj6w5s40i','cmusg9yjs000gr7ekb9fyjutd'),
('cmusg9yja0001r7ekj6w5s40i','cmusg9yjs000hr7eknn65quge'),
('cmusg9yja0001r7ekj6w5s40i','cmusg9yju000ir7ek23u6vzye'),
('cmusg9yja0001r7ekj6w5s40i','cmusg9yjv000jr7ek33tpwinw'),
('cmusg9yja0001r7ekj6w5s40i','cmusg9yjw000kr7ekg2eqxpzh'),
('cmusg9yja0001r7ekj6w5s40i','cmusg9yjx000lr7ekxrwwf3it'),
('cmusg9yja0002r7ek5xo8ogyq','cmusg9yje0005r7eke4k43pg8'),
('cmusg9yja0002r7ek5xo8ogyq','cmusg9yjf0006r7ek74wd447q'),
('cmusg9yja0002r7ek5xo8ogyq','cmusg9yji0008r7ekj7kvszvo'),
('cmusg9yja0002r7ek5xo8ogyq','cmusg9yjk0009r7eke6kpn40j'),
('cmusg9yja0002r7ek5xo8ogyq','cmusg9yjm000br7ek55bbn8ki'),
('cmusg9yja0002r7ek5xo8ogyq','cmusg9yjp000er7ek2a3bklpy'),
('cmusg9yja0002r7ek5xo8ogyq','cmusg9yjw000kr7ekg2eqxpzh'),
('cmusg9yjb0003r7ekwvuyl11u','cmusg9yjk0009r7eke6kpn40j'),
('cmusg9yjb0003r7ekwvuyl11u','cmusg9yjm000br7ek55bbn8ki'),
('cmusg9yjb0003r7ekwvuyl11u','cmusg9yjp000er7ek2a3bklpy'),
('cmusg9yjb0003r7ekwvuyl11u','cmusg9yjv000jr7ek33tpwinw'),
('cmusg9yjb0003r7ekwvuyl11u','cmusg9yjw000kr7ekg2eqxpzh'),
('cmusg9yjb0004r7ekvhq25v2b','cmusg9yjh0007r7ekst2vuqv2'),
('cmusg9yjb0004r7ekvhq25v2b','cmusg9yji0008r7ekj7kvszvo'),
('cmusg9yjb0004r7ekvhq25v2b','cmusg9yjk0009r7eke6kpn40j'),
('cmusg9yjb0004r7ekvhq25v2b','cmusg9yjl000ar7ekbuj6ocmz'),
('cmusg9yjb0004r7ekvhq25v2b','cmusg9yjm000br7ek55bbn8ki'),
('cmusg9yjb0004r7ekvhq25v2b','cmusg9yjn000cr7ekd4zi2ypt'),
('cmusg9yjb0004r7ekvhq25v2b','cmusg9yjo000dr7ekydwhgfx3'),
('cmusg9yjb0004r7ekvhq25v2b','cmusg9yjp000er7ek2a3bklpy'),
('cmusg9yjb0004r7ekvhq25v2b','cmusg9yjr000fr7ek54mzap42'),
('cmusg9yjb0004r7ekvhq25v2b','cmusg9yjw000kr7ekg2eqxpzh'),
('cmusg9yjb0004r7ekvhq25v2b','cmusg9yjx000lr7ekxrwwf3it');
INSERT INTO `roles` (`id`, `code`, `label`, `description`, `isSystem`, `createdAt`) VALUES ('cmusg9yj80000r7ekes8lumrx','MEMBER','Member',NULL,1,'2026-10-03 13:51:11.636'),
('cmusg9yja0001r7ekj6w5s40i','ADMIN','Administrator',NULL,1,'2026-10-03 13:51:11.637'),
('cmusg9yja0002r7ek5xo8ogyq','KARTA','Family Head (Karta)',NULL,1,'2026-10-03 13:51:11.636'),
('cmusg9yjb0003r7ekwvuyl11u','ASSET_OWNER','Asset Owner',NULL,1,'2026-10-03 13:51:11.637'),
('cmusg9yjb0004r7ekvhq25v2b','OPERATOR','Operator',NULL,1,'2026-10-03 13:51:11.637');
INSERT INTO `settings` (`id`, `key`, `value`, `description`, `updatedBy`, `updatedAt`) VALUES ('cmusg9ywj001ur7ekil9v2q0a','community.name','\"\\\"Ladwani Samaj\\\"\"','Community display name',NULL,'2026-10-03 13:51:12.116'),
('cmusg9ywl001vr7ekpiv338nc','community.tagline','\"\\\"Our Community, Our Heritage, Our Future\\\"\"','Community tagline',NULL,'2026-10-03 13:51:12.117'),
('cmusg9ywm001wr7ek68audvdv','matrimony.contact_exchange','\"\\\"ACCEPT_FIRST\\\"\"','When to reveal contact: ACCEPT_FIRST or FAMILY_APPROVAL',NULL,'2026-10-03 13:51:12.119');
INSERT INTO `users` (`id`, `email`, `mobile`, `passwordHash`, `emailVerified`, `mobileVerified`, `status`, `joinIntent`, `lastLoginAt`, `lastLoginIp`, `failedAttempts`, `lockedUntil`, `createdAt`, `updatedAt`, `deletedAt`) VALUES ('cmusg9yua000mr7ekhpzcdejy','admin@miladwani.com','9000000000','$2a$12$wtk3zvIvTsEWfuAIH005IOesG3nT4Dt13jrd5lXa0DKvcKMYlKS4y',1,1,'ACTIVE',NULL,NULL,NULL,0,NULL,'2026-10-03 13:51:12.034','2026-10-03 13:51:12.034',NULL);
INSERT INTO `members` (`id`, `memberNumber`, `userId`, `firstName`, `middleName`, `lastName`, `gender`, `dateOfBirth`, `dateOfBirthApprox`, `bloodGroup`, `heightCm`, `weightKg`, `bodyType`, `physicalDisability`, `mobilePrimary`, `mobileAlternate`, `email`, `profilePhotoId`, `biography`, `currentCity`, `currentState`, `currentCountry`, `nativeVillage`, `nativeDistrict`, `nativeState`, `nationality`, `maritalStatus`, `employmentStatus`, `occupationCategory`, `status`, `deceasedAt`, `deceasedPlace`, `deceasedNotes`, `verificationStatus`, `createdAt`, `updatedAt`, `createdBy`, `updatedBy`, `deletedAt`, `languages`) VALUES ('cmusg9yug000or7eka248sai8','MEM-ADMIN-001','cmusg9yua000mr7ekhpzcdejy','Admin',NULL,'Ladwani','MALE',NULL,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'Indian','UNMARRIED',NULL,NULL,'ACTIVE',NULL,NULL,NULL,'UNVERIFIED','2026-10-03 13:51:12.040','2026-10-03 13:51:12.040',NULL,NULL,NULL,NULL);
INSERT INTO `user_roles` (`id`, `userId`, `roleId`, `familyId`, `areaId`, `grantedBy`, `grantedAt`, `expiresAt`) VALUES ('admin-role-cmusg9yua000mr7ekhpzcdejy','cmusg9yua000mr7ekhpzcdejy','cmusg9yja0001r7ekj6w5s40i',NULL,NULL,NULL,'2026-10-03 13:51:12.038',NULL);
SET FOREIGN_KEY_CHECKS = 1;
