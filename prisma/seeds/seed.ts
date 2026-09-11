import { PrismaClient } from '@prisma/client'
import { hash } from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Seeding database...')

  // ── Roles ──────────────────────────────────────────────────────
  const roles = await Promise.all([
    prisma.role.upsert({ where: { code: 'MEMBER' }, update: {}, create: { code: 'MEMBER', label: 'Member', isSystem: true } }),
    prisma.role.upsert({ where: { code: 'KARTA' }, update: {}, create: { code: 'KARTA', label: 'Family Head (Karta)', isSystem: true } }),
    prisma.role.upsert({ where: { code: 'OPERATOR' }, update: {}, create: { code: 'OPERATOR', label: 'Operator', isSystem: true } }),
    prisma.role.upsert({ where: { code: 'ADMIN' }, update: {}, create: { code: 'ADMIN', label: 'Administrator', isSystem: true } }),
    prisma.role.upsert({ where: { code: 'ASSET_OWNER' }, update: {}, create: { code: 'ASSET_OWNER', label: 'Asset Owner', isSystem: true } }),
  ])
  const [memberRole, kartaRole, operatorRole, adminRole, assetOwnerRole] = roles
  console.log('✅ Roles created')

  // ── Permissions + role→permission matrix ───────────────────────
  // Spec §6: "The role should come from the database and permission system."
  // These rows make the permission matrix inspectable and admin-editable
  // instead of living only as hardcoded role-code checks in route handlers.
  const permissions: { code: string; label: string; module: string }[] = [
    { code: 'family:create', label: 'Register a new family', module: 'family' },
    { code: 'family:edit_own', label: 'Edit own family', module: 'family' },
    { code: 'family:edit_any', label: 'Edit any family', module: 'family' },
    { code: 'family:member_add', label: 'Add members to own family', module: 'family' },
    { code: 'family:view_tree', label: 'View own family tree', module: 'family' },
    { code: 'family:approve', label: 'Verify/approve families', module: 'family' },
    { code: 'member:edit_own', label: 'Edit own member profile', module: 'member' },
    { code: 'member:edit_any', label: 'Edit any member profile', module: 'member' },
    { code: 'member:mark_deceased', label: 'Mark a member deceased', module: 'member' },
    { code: 'matrimony:manage_own', label: 'Manage own matrimonial profile', module: 'matrimony' },
    { code: 'approval:review', label: 'Review approval requests', module: 'approval' },
    { code: 'admin:users', label: 'Manage users and roles', module: 'admin' },
    { code: 'admin:settings', label: 'Manage platform settings', module: 'admin' },
    { code: 'admin:audit', label: 'View audit logs', module: 'admin' },
    { code: 'asset:manage_own', label: 'Manage own assets', module: 'asset' },
    { code: 'group:manage_own', label: 'Register and convene community groups', module: 'group' },
    { code: 'group:approve', label: 'Approve community groups', module: 'group' },
  ]
  const permissionRecords: Record<string, string> = {}
  for (const p of permissions) {
    const rec = await prisma.permission.upsert({ where: { code: p.code }, update: {}, create: p })
    permissionRecords[p.code] = rec.id
  }

  const ROLE_PERMISSIONS: Record<string, string[]> = {
    MEMBER: ['member:edit_own', 'matrimony:manage_own', 'family:view_tree', 'group:manage_own'],
    KARTA: [
      'member:edit_own', 'matrimony:manage_own', 'family:view_tree',
      'family:create', 'family:edit_own', 'family:member_add', 'group:manage_own',
    ],
    ASSET_OWNER: ['member:edit_own', 'matrimony:manage_own', 'family:view_tree', 'asset:manage_own', 'group:manage_own'],
    OPERATOR: [
      'member:edit_own', 'matrimony:manage_own', 'family:view_tree',
      'member:edit_any', 'member:mark_deceased', 'family:edit_any',
      'family:member_add', 'family:approve', 'approval:review',
      'group:manage_own', 'group:approve',
    ],
    ADMIN: permissions.map((p) => p.code), // full access
  }
  const roleByCode: Record<string, string> = {
    MEMBER: memberRole.id, KARTA: kartaRole.id, OPERATOR: operatorRole.id,
    ADMIN: adminRole.id, ASSET_OWNER: assetOwnerRole.id,
  }
  for (const [roleCode, permCodes] of Object.entries(ROLE_PERMISSIONS)) {
    for (const permCode of permCodes) {
      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: roleByCode[roleCode], permissionId: permissionRecords[permCode] } },
        update: {},
        create: { roleId: roleByCode[roleCode], permissionId: permissionRecords[permCode] },
      })
    }
  }
  console.log('✅ Permissions + role matrix created')

  // ── Admin User ────────────────────────────────────────────────
  const adminPwdHash = await hash(process.env.ADMIN_PASSWORD ?? 'Admin@123456', 12)
  const adminUser = await prisma.user.upsert({
    where: { email: process.env.ADMIN_EMAIL ?? 'admin@miladwani.com' },
    update: {},
    create: {
      email: process.env.ADMIN_EMAIL ?? 'admin@miladwani.com',
      mobile: '9000000000',
      passwordHash: adminPwdHash,
      emailVerified: true,
      mobileVerified: true,
      status: 'ACTIVE',
    },
  })
  await prisma.userRole.upsert({
    where: { id: `admin-role-${adminUser.id}` },
    update: {},
    create: { id: `admin-role-${adminUser.id}`, userId: adminUser.id, roleId: adminRole.id },
  }).catch(async () => {
    await prisma.userRole.create({ data: { userId: adminUser.id, roleId: adminRole.id } })
  })
  const adminMember = await prisma.member.upsert({
    where: { memberNumber: 'MEM-ADMIN-001' },
    update: {},
    create: {
      memberNumber: 'MEM-ADMIN-001',
      userId: adminUser.id,
      firstName: 'Admin',
      lastName: 'Ladwani',
      gender: 'MALE',
      status: 'ACTIVE',
    },
  })
  console.log('✅ Admin user created:', adminUser.email)

  // ── Post Types ─────────────────────────────────────────────────
  const postTypes = [
    { code: 'GENERAL', label: 'General', icon: '📌' },
    { code: 'ANNOUNCEMENT', label: 'Announcement', icon: '📢' },
    { code: 'EVENT', label: 'Event', icon: '🎉' },
    { code: 'ACHIEVEMENT', label: 'Achievement', icon: '🏆' },
    { code: 'BIRTHDAY', label: 'Birthday', icon: '🎂' },
    { code: 'MARRIAGE', label: 'Marriage', icon: '💒' },
    { code: 'CONDOLENCE', label: 'Condolence', icon: '🙏' },
    { code: 'JOB', label: 'Job Opportunity', icon: '💼' },
    { code: 'BUSINESS', label: 'Business', icon: '🏢' },
    { code: 'LOST_FOUND', label: 'Lost & Found', icon: '🔍' },
  ]
  for (const pt of postTypes) {
    await prisma.postType.upsert({ where: { code: pt.code }, update: {}, create: pt })
  }
  console.log('✅ Post types created')

  // ── Relationship Types ─────────────────────────────────────────
  const relTypes = [
    { code: 'father', label: 'Father', inverseCode: 'son', genderApplicable: 'MALE' },
    { code: 'mother', label: 'Mother', inverseCode: 'son', genderApplicable: 'FEMALE' },
    { code: 'son', label: 'Son', inverseCode: 'father', genderApplicable: 'MALE' },
    { code: 'daughter', label: 'Daughter', inverseCode: 'father', genderApplicable: 'FEMALE' },
    { code: 'husband', label: 'Husband', inverseCode: 'wife', genderApplicable: 'MALE', isSpouse: true },
    { code: 'wife', label: 'Wife', inverseCode: 'husband', genderApplicable: 'FEMALE', isSpouse: true },
    { code: 'brother', label: 'Brother', inverseCode: 'brother', genderApplicable: 'MALE' },
    { code: 'sister', label: 'Sister', inverseCode: 'brother', genderApplicable: 'FEMALE' },
    { code: 'grandfather_p', label: 'Grandfather (Paternal)', inverseCode: 'grandson', genderApplicable: 'MALE' },
    { code: 'grandmother_p', label: 'Grandmother (Paternal)', inverseCode: 'grandson', genderApplicable: 'FEMALE' },
    { code: 'grandson', label: 'Grandson', inverseCode: 'grandfather_p', genderApplicable: 'MALE' },
    { code: 'granddaughter', label: 'Granddaughter', inverseCode: 'grandfather_p', genderApplicable: 'FEMALE' },
    { code: 'uncle', label: 'Uncle', inverseCode: 'nephew', genderApplicable: 'MALE' },
    { code: 'aunt', label: 'Aunt', inverseCode: 'nephew', genderApplicable: 'FEMALE' },
    { code: 'nephew', label: 'Nephew', inverseCode: 'uncle', genderApplicable: 'MALE' },
    { code: 'niece', label: 'Niece', inverseCode: 'uncle', genderApplicable: 'FEMALE' },
    { code: 'son_in_law', label: 'Son-in-law', inverseCode: 'father_in_law', genderApplicable: 'MALE' },
    { code: 'daughter_in_law', label: 'Daughter-in-law', inverseCode: 'father_in_law', genderApplicable: 'FEMALE' },
    { code: 'father_in_law', label: 'Father-in-law', inverseCode: 'son_in_law', genderApplicable: 'MALE' },
    { code: 'mother_in_law', label: 'Mother-in-law', inverseCode: 'son_in_law', genderApplicable: 'FEMALE' },
  ]
  for (const rt of relTypes) {
    await prisma.relationshipType.upsert({ where: { code: rt.code }, update: {}, create: rt })
  }
  console.log('✅ Relationship types created')

  // ── Approval Rules ─────────────────────────────────────────────
  const approvalRules = [
    { actionCode: 'family.create', requiresApproval: true, approverRole: 'OPERATOR' },
    { actionCode: 'family.member.add', requiresApproval: true, approverRole: 'OPERATOR' },
    { actionCode: 'member.marital_status.change', requiresApproval: true, approverRole: 'OPERATOR' },
    { actionCode: 'member.mark_deceased', requiresApproval: true, approverRole: 'OPERATOR' },
    { actionCode: 'member.relationship.change', requiresApproval: true, approverRole: 'OPERATOR' },
    { actionCode: 'family.karta.change', requiresApproval: true, approverRole: 'ADMIN' },
    { actionCode: 'family.merge', requiresApproval: true, approverRole: 'ADMIN' },
    { actionCode: 'member.edit_own', requiresApproval: false, autoApproveRole: 'MEMBER' },
    { actionCode: 'member.education.edit_own', requiresApproval: false, autoApproveRole: 'MEMBER' },
    { actionCode: 'member.employment.edit_own', requiresApproval: false, autoApproveRole: 'MEMBER' },
  ]
  for (const ar of approvalRules) {
    await prisma.approvalRule.upsert({ where: { actionCode: ar.actionCode }, update: {}, create: ar })
  }
  console.log('✅ Approval rules created')

  // ── Areas (India > Maharashtra > Pune) ─────────────────────────
  const india = await prisma.area.upsert({ where: { id: 'area-india' }, update: {}, create: { id: 'area-india', name: 'India', type: 'COUNTRY', code: 'IN' } })
  const maharashtra = await prisma.area.upsert({ where: { id: 'area-mh' }, update: {}, create: { id: 'area-mh', name: 'Maharashtra', type: 'STATE', code: 'MH', parentId: india.id } })
  const pune = await prisma.area.upsert({ where: { id: 'area-pune' }, update: {}, create: { id: 'area-pune', name: 'Pune', type: 'CITY', parentId: maharashtra.id } })
  const mumbai = await prisma.area.upsert({ where: { id: 'area-mumbai' }, update: {}, create: { id: 'area-mumbai', name: 'Mumbai', type: 'CITY', parentId: maharashtra.id } })
  const nagpur = await prisma.area.upsert({ where: { id: 'area-nagpur' }, update: {}, create: { id: 'area-nagpur', name: 'Nagpur', type: 'CITY', parentId: maharashtra.id } })
  console.log('✅ Areas created')

  // ── Income Ranges ──────────────────────────────────────────────
  const incomeRanges = [
    { label: 'Below ₹2 lakh', minValue: 0n, maxValue: 200000n, sortOrder: 1 },
    { label: '₹2–5 lakh', minValue: 200000n, maxValue: 500000n, sortOrder: 2 },
    { label: '₹5–10 lakh', minValue: 500000n, maxValue: 1000000n, sortOrder: 3 },
    { label: '₹10–20 lakh', minValue: 1000000n, maxValue: 2000000n, sortOrder: 4 },
    { label: '₹20–50 lakh', minValue: 2000000n, maxValue: 5000000n, sortOrder: 5 },
    { label: 'Above ₹50 lakh', minValue: 5000000n, maxValue: null, sortOrder: 6 },
  ]
  for (const ir of incomeRanges) {
    await prisma.incomeRange.upsert({ where: { id: `income-${ir.sortOrder}` }, update: {}, create: { id: `income-${ir.sortOrder}`, ...ir } })
  }

  // ── Settings ───────────────────────────────────────────────────
  await prisma.setting.upsert({
    where: { key: 'community.name' },
    update: {},
    create: { key: 'community.name', value: '"Ladwani Samaj"', description: 'Community display name' }
  })
  await prisma.setting.upsert({
    where: { key: 'community.tagline' },
    update: {},
    create: { key: 'community.tagline', value: '"Our Community, Our Heritage, Our Future"', description: 'Community tagline' }
  })
  await prisma.setting.upsert({
    where: { key: 'matrimony.contact_exchange' },
    update: {},
    create: { key: 'matrimony.contact_exchange', value: '"ACCEPT_FIRST"', description: 'When to reveal contact: ACCEPT_FIRST or FAMILY_APPROVAL' }
  })
  console.log('✅ Settings created')

  // ── Fees ───────────────────────────────────────────────────────
  // One-time registration fee, charged to the Karta who registers a family.
  // Everyone who joins that family afterwards registers free. Amount is in
  // paise (200000 = ₹2,000) and is admin-editable.
  await prisma.feeType.upsert({
    where: { code: 'FAMILY_REGISTRATION' },
    update: {},
    create: {
      code: 'FAMILY_REGISTRATION',
      label: 'Family Registration Fee',
      description: 'One-time fee payable by the Karta when a new family is registered. Other family members join free.',
      amountPaise: 200000,
      appliesTo: 'FAMILY_KARTA',
      isActive: true,
    },
  })
  await prisma.approvalRule.upsert({
    where: { actionCode: 'asset.create' },
    update: {},
    create: { actionCode: 'asset.create', requiresApproval: true, approverRole: 'OPERATOR' },
  })
  await prisma.approvalRule.upsert({
    where: { actionCode: 'group.create' },
    update: {},
    create: { actionCode: 'group.create', requiresApproval: true, approverRole: 'OPERATOR' },
  })
  console.log('✅ Fee types + asset/group approval rules created')

  // ── Test Accounts (dev/test only - obviously fake data) ─────────
  // These share one published password, so they must never exist on a
  // production database. Opt in explicitly with SEED_TEST_ACCOUNTS=true —
  // .env and .env.test set it locally; the production runbook does not, so
  // a production seed stops here with reference data only.
  if (process.env.SEED_TEST_ACCOUNTS !== 'true') {
    console.log('\n🎉 Seed complete — reference data only, no test accounts.\n')
    console.log('Admin login:')
    console.log(`  Email:    ${process.env.ADMIN_EMAIL ?? 'admin@miladwani.com'}`)
    console.log('  Password: as set in ADMIN_PASSWORD — change it immediately after first login.\n')
    return
  }

  const testPwdHash = await hash('TestPass@123', 12)

  const operatorUser = await prisma.user.upsert({
    where: { email: 'test.operator@example.test' },
    update: {},
    create: {
      email: 'test.operator@example.test',
      mobile: '9000000002',
      passwordHash: testPwdHash,
      emailVerified: true,
      mobileVerified: true,
      status: 'ACTIVE',
    },
  })
  await prisma.userRole.upsert({
    where: { id: `test-operator-role-${operatorUser.id}` },
    update: {},
    create: { id: `test-operator-role-${operatorUser.id}`, userId: operatorUser.id, roleId: operatorRole.id },
  })
  await prisma.member.upsert({
    where: { memberNumber: 'MEM-TEST-OPERATOR' },
    update: {},
    create: {
      memberNumber: 'MEM-TEST-OPERATOR',
      userId: operatorUser.id,
      firstName: 'Test',
      lastName: 'Operator',
      gender: 'FEMALE',
      status: 'ACTIVE',
    },
  })

  const kartaUser = await prisma.user.upsert({
    where: { email: 'test.karta@example.test' },
    update: {},
    create: {
      email: 'test.karta@example.test',
      mobile: '9000000003',
      passwordHash: testPwdHash,
      emailVerified: true,
      mobileVerified: true,
      status: 'ACTIVE',
    },
  })
  await prisma.userRole.upsert({
    where: { id: `test-karta-role-${kartaUser.id}` },
    update: {},
    create: { id: `test-karta-role-${kartaUser.id}`, userId: kartaUser.id, roleId: kartaRole.id },
  })
  const kartaMember = await prisma.member.upsert({
    where: { memberNumber: 'MEM-TEST-KARTA' },
    update: {},
    create: {
      memberNumber: 'MEM-TEST-KARTA',
      userId: kartaUser.id,
      firstName: 'Test',
      lastName: 'Karta',
      gender: 'MALE',
      status: 'ACTIVE',
    },
  })
  const testFamily = await prisma.family.upsert({
    where: { registrationNumber: 'FAM-TEST-0001' },
    update: {},
    create: {
      registrationNumber: 'FAM-TEST-0001',
      name: 'Test',
      status: 'ACTIVE',
      verificationStatus: 'VERIFIED',
      kartaMemberId: kartaMember.id,
      createdBy: kartaUser.id,
    },
  })
  await prisma.familyMember.upsert({
    where: { familyId_memberId: { familyId: testFamily.id, memberId: kartaMember.id } },
    update: { isKarta: true },
    create: { familyId: testFamily.id, memberId: kartaMember.id, isKarta: true, joinedBy: kartaUser.id },
  })
  await prisma.userRole.updateMany({
    where: { userId: kartaUser.id, roleId: kartaRole.id },
    data: { familyId: testFamily.id },
  })

  const memberUser = await prisma.user.upsert({
    where: { email: 'test.member@example.test' },
    update: {},
    create: {
      email: 'test.member@example.test',
      mobile: '9000000004',
      passwordHash: testPwdHash,
      emailVerified: true,
      mobileVerified: true,
      status: 'ACTIVE',
    },
  })
  await prisma.userRole.upsert({
    where: { id: `test-member-role-${memberUser.id}` },
    update: {},
    create: { id: `test-member-role-${memberUser.id}`, userId: memberUser.id, roleId: memberRole.id },
  })
  const testMember = await prisma.member.upsert({
    where: { memberNumber: 'MEM-TEST-MEMBER' },
    update: {},
    create: {
      memberNumber: 'MEM-TEST-MEMBER',
      userId: memberUser.id,
      firstName: 'Test',
      lastName: 'Member',
      gender: 'FEMALE',
      status: 'ACTIVE',
    },
  })
  await prisma.familyMember.upsert({
    where: { familyId_memberId: { familyId: testFamily.id, memberId: testMember.id } },
    update: {},
    create: { familyId: testFamily.id, memberId: testMember.id, joinedBy: kartaUser.id },
  })

  // A second, unrelated family + Karta - needed by authorization tests to
  // prove cross-family access is actually blocked, not just untested.
  const otherKartaUser = await prisma.user.upsert({
    where: { email: 'test.other-karta@example.test' },
    update: {},
    create: {
      email: 'test.other-karta@example.test',
      mobile: '9000000005',
      passwordHash: testPwdHash,
      emailVerified: true,
      mobileVerified: true,
      status: 'ACTIVE',
    },
  })
  await prisma.userRole.upsert({
    where: { id: `test-other-karta-role-${otherKartaUser.id}` },
    update: {},
    create: { id: `test-other-karta-role-${otherKartaUser.id}`, userId: otherKartaUser.id, roleId: kartaRole.id },
  })
  const otherKartaMember = await prisma.member.upsert({
    where: { memberNumber: 'MEM-TEST-OTHER-KARTA' },
    update: {},
    create: {
      memberNumber: 'MEM-TEST-OTHER-KARTA',
      userId: otherKartaUser.id,
      firstName: 'Other',
      lastName: 'Karta',
      gender: 'MALE',
      status: 'ACTIVE',
    },
  })
  const otherFamily = await prisma.family.upsert({
    where: { registrationNumber: 'FAM-TEST-0002' },
    update: {},
    create: {
      registrationNumber: 'FAM-TEST-0002',
      name: 'Other',
      status: 'ACTIVE',
      verificationStatus: 'VERIFIED',
      kartaMemberId: otherKartaMember.id,
      createdBy: otherKartaUser.id,
    },
  })
  await prisma.familyMember.upsert({
    where: { familyId_memberId: { familyId: otherFamily.id, memberId: otherKartaMember.id } },
    update: { isKarta: true },
    create: { familyId: otherFamily.id, memberId: otherKartaMember.id, isKarta: true, joinedBy: otherKartaUser.id },
  })
  await prisma.userRole.updateMany({
    where: { userId: otherKartaUser.id, roleId: kartaRole.id },
    data: { familyId: otherFamily.id },
  })

  const assetOwnerUser = await prisma.user.upsert({
    where: { email: 'test.assetowner@example.test' },
    update: {},
    create: {
      email: 'test.assetowner@example.test',
      mobile: '9000000006',
      passwordHash: testPwdHash,
      emailVerified: true,
      mobileVerified: true,
      status: 'ACTIVE',
      joinIntent: 'JOIN_EXISTING',
    },
  })
  await prisma.userRole.upsert({
    where: { id: `test-assetowner-role-${assetOwnerUser.id}` },
    update: {},
    create: { id: `test-assetowner-role-${assetOwnerUser.id}`, userId: assetOwnerUser.id, roleId: assetOwnerRole.id },
  })
  await prisma.member.upsert({
    where: { memberNumber: 'MEM-TEST-ASSETOWNER' },
    update: {},
    create: {
      memberNumber: 'MEM-TEST-ASSETOWNER',
      userId: assetOwnerUser.id,
      firstName: 'Test',
      lastName: 'AssetOwner',
      gender: 'MALE',
      status: 'ACTIVE',
    },
  })

  console.log('✅ Test accounts created (MEMBER, KARTA x2, OPERATOR, ASSET_OWNER, ADMIN)')

  console.log('\n🎉 Seed complete!\n')
  console.log('Admin credentials:')
  console.log(`  Email:    ${process.env.ADMIN_EMAIL ?? 'admin@miladwani.com'}`)
  console.log(`  Password: ${process.env.ADMIN_PASSWORD ?? 'Admin@123456'}`)
  console.log('\nTest accounts (password for all: TestPass@123):')
  console.log('  test.member@example.test       - MEMBER, no family')
  console.log('  test.karta@example.test        - KARTA of "Test" family')
  console.log('  test.other-karta@example.test  - KARTA of "Other" family (for cross-family authz tests)')
  console.log('  test.operator@example.test     - OPERATOR')
  console.log('  test.assetowner@example.test   - ASSET_OWNER')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
