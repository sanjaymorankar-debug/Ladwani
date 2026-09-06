/**
 * UAT test data: two accounts per role, plus family/member records covering
 * the scenarios in the UAT plan (single person, multi-generation, married,
 * cross-family, divorced, widowed, deceased, no-login member).
 *
 * All data is fictional. Idempotent — safe to re-run.
 *
 *   npm run db:seed:uat            (dev database)
 *   node scripts/with-env.js .env.test npx ts-node --project prisma/seeds/tsconfig.seed.json prisma/seeds/uat-seed.ts
 */
import { PrismaClient, Gender, MaritalStatus, MemberStatus } from '@prisma/client'
import { hash } from 'bcryptjs'

const prisma = new PrismaClient()

export const UAT_PASSWORD = 'TestPass@123'
export const UAT_DOMAIN = 'uat.test'

type RoleCode = 'MEMBER' | 'KARTA' | 'OPERATOR' | 'ASSET_OWNER' | 'ADMIN'

async function upsertAccount(opts: {
  label: string
  email: string
  mobile: string | null
  role: RoleCode
  firstName: string
  lastName: string
  gender?: Gender
  dateOfBirth?: Date
  maritalStatus?: MaritalStatus
}) {
  const passwordHash = await hash(UAT_PASSWORD, 12)
  const user = await prisma.user.upsert({
    where: { email: opts.email },
    update: { status: 'ACTIVE', emailVerified: true },
    create: {
      email: opts.email,
      mobile: opts.mobile,
      passwordHash,
      emailVerified: true,
      mobileVerified: !!opts.mobile,
      status: 'ACTIVE',
      joinIntent: opts.role === 'KARTA' ? 'KARTA' : 'JOIN_EXISTING',
    },
  })

  const role = await prisma.role.findUniqueOrThrow({ where: { code: opts.role } })
  const existingRole = await prisma.userRole.findFirst({ where: { userId: user.id, roleId: role.id } })
  if (!existingRole) {
    await prisma.userRole.create({ data: { userId: user.id, roleId: role.id } })
  }

  const member = await prisma.member.upsert({
    where: { memberNumber: `UAT-${opts.label}` },
    update: {},
    create: {
      memberNumber: `UAT-${opts.label}`,
      userId: user.id,
      firstName: opts.firstName,
      lastName: opts.lastName,
      gender: opts.gender ?? 'NOT_STATED',
      dateOfBirth: opts.dateOfBirth ?? null,
      maritalStatus: opts.maritalStatus ?? 'UNMARRIED',
      status: 'ACTIVE',
    },
  })

  return { user, member }
}

/** A family member with no login account (spec §32: not everyone has a user). */
async function upsertBareMember(opts: {
  label: string
  firstName: string
  lastName: string
  gender: Gender
  dateOfBirth?: Date
  maritalStatus?: MaritalStatus
  status?: MemberStatus
  deceasedAt?: Date
}) {
  return prisma.member.upsert({
    where: { memberNumber: `UAT-${opts.label}` },
    update: {},
    create: {
      memberNumber: `UAT-${opts.label}`,
      firstName: opts.firstName,
      lastName: opts.lastName,
      gender: opts.gender,
      dateOfBirth: opts.dateOfBirth ?? null,
      maritalStatus: opts.maritalStatus ?? 'UNMARRIED',
      status: opts.status ?? 'ACTIVE',
      deceasedAt: opts.deceasedAt ?? null,
    },
  })
}

async function upsertFamily(opts: {
  regNo: string
  name: string
  kartaMemberId: string
  createdBy: string
  verified?: boolean
}) {
  return prisma.family.upsert({
    where: { registrationNumber: opts.regNo },
    update: {},
    create: {
      registrationNumber: opts.regNo,
      name: opts.name,
      status: opts.verified ? 'ACTIVE' : 'PENDING',
      verificationStatus: opts.verified ? 'VERIFIED' : 'UNVERIFIED',
      kartaMemberId: opts.kartaMemberId,
      createdBy: opts.createdBy,
    },
  })
}

async function link(familyId: string, memberId: string, isKarta = false, joinedBy?: string) {
  await prisma.familyMember.upsert({
    where: { familyId_memberId: { familyId, memberId } },
    update: { isKarta },
    create: { familyId, memberId, isKarta, joinedBy: joinedBy ?? null },
  })
}

/** Creates a relationship and its inverse, the same way the app's own routes do. */
async function relate(fromMemberId: string, toMemberId: string, code: string, familyId?: string) {
  const relType = await prisma.relationshipType.findUnique({ where: { code } })
  if (!relType) throw new Error(`relationship type "${code}" not seeded`)

  await prisma.memberRelationship.upsert({
    where: { fromMemberId_toMemberId_relationshipTypeId: { fromMemberId, toMemberId, relationshipTypeId: relType.id } },
    update: {},
    create: { fromMemberId, toMemberId, relationshipTypeId: relType.id, familyId: familyId ?? null },
  })

  if (relType.inverseCode) {
    const inverse = await prisma.relationshipType.findUnique({ where: { code: relType.inverseCode } })
    if (inverse) {
      await prisma.memberRelationship.upsert({
        where: { fromMemberId_toMemberId_relationshipTypeId: { fromMemberId: toMemberId, toMemberId: fromMemberId, relationshipTypeId: inverse.id } },
        update: {},
        create: { fromMemberId: toMemberId, toMemberId: fromMemberId, relationshipTypeId: inverse.id, familyId: familyId ?? null },
      })
    }
  }
}

const years = (n: number) => new Date(new Date().getFullYear() - n, 5, 15)

export async function seedUat() {
  // ── Accounts: two per role ──────────────────────────────────────
  const member01 = await upsertAccount({
    label: 'MEMBER-01', email: `member01@${UAT_DOMAIN}`, mobile: '9800000001', role: 'MEMBER',
    firstName: 'Arun', lastName: 'Deshmukh', gender: 'MALE', dateOfBirth: years(28),
  })
  const member02 = await upsertAccount({
    label: 'MEMBER-02', email: `member02@${UAT_DOMAIN}`, mobile: '9800000002', role: 'MEMBER',
    firstName: 'Neha', lastName: 'Joshi', gender: 'FEMALE', dateOfBirth: years(26),
  })
  const karta01 = await upsertAccount({
    label: 'KARTA-01', email: `karta01@${UAT_DOMAIN}`, mobile: '9800000003', role: 'KARTA',
    firstName: 'Rajesh', lastName: 'Sharma', gender: 'MALE', dateOfBirth: years(52), maritalStatus: 'MARRIED',
  })
  const karta02 = await upsertAccount({
    label: 'KARTA-02', email: `karta02@${UAT_DOMAIN}`, mobile: '9800000004', role: 'KARTA',
    firstName: 'Vikram', lastName: 'Patel', gender: 'MALE', dateOfBirth: years(55), maritalStatus: 'MARRIED',
  })
  const operator01 = await upsertAccount({
    label: 'OPERATOR-01', email: `operator01@${UAT_DOMAIN}`, mobile: '9800000005', role: 'OPERATOR',
    firstName: 'Ops', lastName: 'One', gender: 'FEMALE',
  })
  const operator02 = await upsertAccount({
    label: 'OPERATOR-02', email: `operator02@${UAT_DOMAIN}`, mobile: '9800000006', role: 'OPERATOR',
    firstName: 'Ops', lastName: 'Two', gender: 'MALE',
  })
  const owner01 = await upsertAccount({
    label: 'OWNER-01', email: `owner01@${UAT_DOMAIN}`, mobile: '9800000007', role: 'ASSET_OWNER',
    firstName: 'Owner', lastName: 'One', gender: 'MALE',
  })
  const owner02 = await upsertAccount({
    label: 'OWNER-02', email: `owner02@${UAT_DOMAIN}`, mobile: '9800000008', role: 'ASSET_OWNER',
    firstName: 'Owner', lastName: 'Two', gender: 'FEMALE',
  })
  const admin01 = await upsertAccount({
    label: 'ADMIN-01', email: `admin01@${UAT_DOMAIN}`, mobile: '9800000009', role: 'ADMIN',
    firstName: 'Admin', lastName: 'One', gender: 'MALE',
  })
  const admin02 = await upsertAccount({
    label: 'ADMIN-02', email: `admin02@${UAT_DOMAIN}`, mobile: '9800000010', role: 'ADMIN',
    firstName: 'Admin', lastName: 'Two', gender: 'FEMALE',
  })

  // ── Family-01 (Sharma): multi-generation ────────────────────────
  const family01 = await upsertFamily({
    regNo: 'UAT-FAM-01', name: 'Sharma', kartaMemberId: karta01.member.id,
    createdBy: karta01.user.id, verified: true,
  })
  await link(family01.id, karta01.member.id, true, karta01.user.id)

  const f1Father = await upsertBareMember({ label: 'F1-FATHER', firstName: 'Mohan', lastName: 'Sharma', gender: 'MALE', dateOfBirth: years(78), maritalStatus: 'MARRIED' })
  const f1Mother = await upsertBareMember({ label: 'F1-MOTHER', firstName: 'Sita', lastName: 'Sharma', gender: 'FEMALE', dateOfBirth: years(74), maritalStatus: 'MARRIED' })
  const f1Wife = await upsertBareMember({ label: 'F1-WIFE', firstName: 'Anita', lastName: 'Sharma', gender: 'FEMALE', dateOfBirth: years(48), maritalStatus: 'MARRIED' })
  const f1Son = await upsertBareMember({ label: 'F1-SON', firstName: 'Rahul', lastName: 'Sharma', gender: 'MALE', dateOfBirth: years(26) })
  const f1Daughter = await upsertBareMember({ label: 'F1-DAUGHTER', firstName: 'Kavita', lastName: 'Sharma', gender: 'FEMALE', dateOfBirth: years(23) })
  const f1Brother = await upsertBareMember({ label: 'F1-BROTHER', firstName: 'Suresh', lastName: 'Sharma', gender: 'MALE', dateOfBirth: years(49) })
  const f1Sister = await upsertBareMember({ label: 'F1-SISTER', firstName: 'Meena', lastName: 'Sharma', gender: 'FEMALE', dateOfBirth: years(45), maritalStatus: 'WIDOWED' })
  const f1Deceased = await upsertBareMember({
    label: 'F1-DECEASED', firstName: 'Ramlal', lastName: 'Sharma', gender: 'MALE',
    dateOfBirth: years(99), status: 'DECEASED', deceasedAt: new Date('2020-03-11'),
  })
  const f1Divorced = await upsertBareMember({ label: 'F1-DIVORCED', firstName: 'Pooja', lastName: 'Sharma', gender: 'FEMALE', dateOfBirth: years(35), maritalStatus: 'DIVORCED' })

  for (const m of [f1Father, f1Mother, f1Wife, f1Son, f1Daughter, f1Brother, f1Sister, f1Deceased, f1Divorced]) {
    await link(family01.id, m.id, false, karta01.user.id)
  }
  // MEMBER-01 is a plain (non-Karta) member of Family-01 — used for the
  // "member of a family but cannot manage it" permission tests.
  await link(family01.id, member01.member.id, false, karta01.user.id)

  await relate(karta01.member.id, f1Father.id, 'son', family01.id)
  await relate(karta01.member.id, f1Mother.id, 'son', family01.id)
  await relate(karta01.member.id, f1Wife.id, 'husband', family01.id)
  await relate(f1Son.id, karta01.member.id, 'son', family01.id)
  await relate(f1Daughter.id, karta01.member.id, 'daughter', family01.id)
  await relate(karta01.member.id, f1Brother.id, 'brother', family01.id)
  await relate(f1Father.id, f1Deceased.id, 'son', family01.id) // 3 generations

  // ── Family-02 (Patel): for cross-family marriage + isolation tests ──
  const family02 = await upsertFamily({
    regNo: 'UAT-FAM-02', name: 'Patel', kartaMemberId: karta02.member.id,
    createdBy: karta02.user.id, verified: true,
  })
  await link(family02.id, karta02.member.id, true, karta02.user.id)

  const f2Wife = await upsertBareMember({ label: 'F2-WIFE', firstName: 'Sunita', lastName: 'Patel', gender: 'FEMALE', dateOfBirth: years(50), maritalStatus: 'MARRIED' })
  const f2Daughter = await upsertBareMember({ label: 'F2-DAUGHTER', firstName: 'Priya', lastName: 'Patel', gender: 'FEMALE', dateOfBirth: years(24) })
  for (const m of [f2Wife, f2Daughter]) await link(family02.id, m.id, false, karta02.user.id)
  await relate(karta02.member.id, f2Wife.id, 'husband', family02.id)
  await relate(f2Daughter.id, karta02.member.id, 'daughter', family02.id)

  // ── Family-03: single-person family (independent person) ────────
  const independent = await upsertAccount({
    label: 'INDEPENDENT-01', email: `independent01@${UAT_DOMAIN}`, mobile: '9800000011', role: 'KARTA',
    firstName: 'Kiran', lastName: 'Rao', gender: 'MALE', dateOfBirth: years(34),
  })
  const family03 = await upsertFamily({
    regNo: 'UAT-FAM-03', name: 'Rao', kartaMemberId: independent.member.id,
    createdBy: independent.user.id, verified: false,
  })
  await link(family03.id, independent.member.id, true, independent.user.id)

  const summary = {
    accounts: {
      'MEMBER-01': member01, 'MEMBER-02': member02,
      'KARTA-01': karta01, 'KARTA-02': karta02,
      'OPERATOR-01': operator01, 'OPERATOR-02': operator02,
      'OWNER-01': owner01, 'OWNER-02': owner02,
      'ADMIN-01': admin01, 'ADMIN-02': admin02,
      'INDEPENDENT-01': independent,
    },
    families: { family01, family02, family03 },
    members: {
      f1Father, f1Mother, f1Wife, f1Son, f1Daughter, f1Brother, f1Sister,
      f1Deceased, f1Divorced, f2Wife, f2Daughter,
    },
  }
  return summary
}

if (require.main === module) {
  seedUat()
    .then((s) => {
      console.log('\n🧪 UAT data seeded\n')
      console.log(`Password for every account: ${UAT_PASSWORD}\n`)
      for (const [label, a] of Object.entries(s.accounts)) {
        console.log(`  ${label.padEnd(15)} ${a.user.email!.padEnd(28)} member=${a.member.memberNumber}`)
      }
      console.log(`\n  Family-01 (Sharma) ${s.families.family01.registrationNumber} — Karta-01, 10 members`)
      console.log(`  Family-02 (Patel)  ${s.families.family02.registrationNumber} — Karta-02, 3 members`)
      console.log(`  Family-03 (Rao)    ${s.families.family03.registrationNumber} — independent person, 1 member`)
    })
    .catch((e) => { console.error(e); process.exit(1) })
    .finally(() => prisma.$disconnect())
}
