import { prisma } from '@/lib/prisma'
import { hashPassword } from '@/lib/auth'
import { CONSENT_TYPE, CONSENT_VERSION, MINOR_GROUP_CONSENT_TYPE } from '@/lib/additional-details/server'

/**
 * Throw-away people for the Additional Details and interest-group tests. All
 * of them carry the XD- member-number prefix and the xd.example.test domain,
 * and cleanupXd() removes every trace (including interest groups, which no
 * other test creates).
 */
export const XD_DOMAIN = 'xd.example.test'
const yearsAgo = (n: number) => {
  const d = new Date()
  d.setFullYear(d.getFullYear() - n)
  d.setMonth(0, 1)
  return d
}

export interface XdPerson {
  memberId: string
  userId: string | null
  roles: string[]
}

let pwd: string | null = null

export async function makePerson(label: string, opts: {
  login?: boolean; age?: number | null; gender?: 'MALE' | 'FEMALE'; roles?: string[]; city?: string; district?: string | null
  familyId?: string; isKarta?: boolean; occupation?: string; createdAt?: Date
} = {}): Promise<XdPerson> {
  pwd ??= await hashPassword('TestPass@123')
  let userId: string | null = null
  const roles = opts.roles ?? (opts.login === false ? [] : ['MEMBER'])
  if (opts.login !== false) {
    const user = await prisma.user.create({
      data: { email: `${label.toLowerCase()}@${XD_DOMAIN}`, passwordHash: pwd, status: 'ACTIVE', emailVerified: true },
    })
    userId = user.id
    for (const code of roles) {
      const role = await prisma.role.upsert({ where: { code }, update: {}, create: { code, label: code, isSystem: true } })
      await prisma.userRole.create({ data: { userId, roleId: role.id } })
    }
  }
  const member = await prisma.member.create({
    data: {
      memberNumber: `XD-${label}`,
      userId,
      firstName: label,
      lastName: 'Xd',
      gender: opts.gender ?? 'MALE',
      dateOfBirth: opts.age === null ? null : yearsAgo(opts.age ?? 30),
      currentCity: opts.city ?? 'Pune',
      occupationCategory: opts.occupation ?? null,
      status: 'ACTIVE',
      ...(opts.createdAt ? { createdAt: opts.createdAt } : {}),
    },
  })
  if (opts.district !== null) {
    await prisma.address.create({
      data: { addressableType: 'member', memberId: member.id, addressType: 'CURRENT', city: opts.city ?? 'Pune', district: opts.district ?? 'Pune', state: 'Maharashtra' },
    })
  }
  if (opts.familyId) {
    await prisma.familyMember.create({ data: { familyId: opts.familyId, memberId: member.id, isKarta: !!opts.isKarta } })
  }
  return { memberId: member.id, userId, roles }
}

export async function makeFamily(label: string) {
  return prisma.family.create({ data: { registrationNumber: `XD-FAM-${label}`, name: `Xd ${label}`, status: 'ACTIVE' } })
}

export async function linkParent(parentId: string, childId: string, code: 'father' | 'mother' = 'father') {
  const type = await prisma.relationshipType.findUniqueOrThrow({ where: { code } })
  await prisma.memberRelationship.create({ data: { fromMemberId: parentId, toMemberId: childId, relationshipTypeId: type.id } })
}

export async function grantConsent(memberId: string, userId: string) {
  await prisma.consentRecord.create({ data: { userId, memberId, consentType: CONSENT_TYPE, version: CONSENT_VERSION, granted: true } })
}

export async function grantMinorGroupConsent(memberId: string, userId: string) {
  await prisma.consentRecord.create({ data: { userId, memberId, consentType: MINOR_GROUP_CONSENT_TYPE, version: 'minor-groups-v1', granted: true } })
}

export async function scopeRole(userId: string, roleCode: string, areaId: string) {
  const role = await prisma.role.upsert({ where: { code: roleCode }, update: {}, create: { code: roleCode, label: roleCode, isSystem: true } })
  await prisma.userRole.updateMany({ where: { userId, roleId: role.id }, data: { areaId } })
}

export async function ensureDistrictArea(name: string) {
  const state = await prisma.area.upsert({ where: { id: 'area-mh' }, update: {}, create: { id: 'area-mh', name: 'Maharashtra', type: 'STATE', code: 'MH' } })
  const id = `area-dist-${name.toLowerCase()}`
  return prisma.area.upsert({ where: { id }, update: {}, create: { id, name, type: 'DISTRICT', parentId: state.id } })
}

export async function interestBySlug(slug: string) {
  return prisma.interest.findUniqueOrThrow({ where: { slug } })
}

export async function cleanupXd() {
  const members = await prisma.member.findMany({ where: { memberNumber: { startsWith: 'XD-' } }, select: { id: true, userId: true } })
  const memberIds = members.map((m) => m.id)
  const userIds = members.map((m) => m.userId).filter((u): u is string => !!u)

  await prisma.communityGroup.deleteMany({ where: { groupType: 'INTEREST', parentGroupId: { not: null } } })
  await prisma.communityGroup.deleteMany({ where: { groupType: 'INTEREST' } })
  await prisma.optionMaster.deleteMany({ where: { listKey: 'VEHICLE_TYPE' } })

  const posts = await prisma.post.findMany({ where: { authorId: { in: userIds } }, select: { id: true } })
  await prisma.report.deleteMany({ where: { OR: [{ reporterId: { in: userIds } }, { reportableId: { in: posts.map((p) => p.id) } }] } })
  await prisma.comment.deleteMany({ where: { authorId: { in: userIds } } })
  await prisma.reaction.deleteMany({ where: { userId: { in: userIds } } })
  await prisma.photo.deleteMany({ where: { uploadedBy: { in: userIds } } })
  await prisma.post.deleteMany({ where: { authorId: { in: userIds } } })
  await prisma.notification.deleteMany({ where: { OR: [{ recipientId: { in: userIds } }, { senderId: { in: userIds } }] } })
  await prisma.auditLog.deleteMany({ where: { OR: [{ actorId: { in: userIds } }, { entityId: { in: memberIds } }] } })
  await prisma.communityGroupMember.deleteMany({ where: { memberId: { in: memberIds } } })
  await prisma.memberRelationship.deleteMany({ where: { OR: [{ fromMemberId: { in: memberIds } }, { toMemberId: { in: memberIds } }] } })
  await prisma.familyMember.deleteMany({ where: { memberId: { in: memberIds } } })
  await prisma.educationRecord.deleteMany({ where: { memberId: { in: memberIds } } })
  await prisma.business.deleteMany({ where: { memberId: { in: memberIds } } })
  await prisma.member.deleteMany({ where: { id: { in: memberIds } } })
  // After the members (their hobby rows reference these master entries).
  await prisma.memberHobby.deleteMany({ where: { interest: { slug: { startsWith: 'xd-' } } } })
  await prisma.interest.deleteMany({ where: { OR: [{ suggestedByMemberId: { in: memberIds } }, { slug: { startsWith: 'xd-' } }] } })
  await prisma.family.deleteMany({ where: { registrationNumber: { startsWith: 'XD-FAM-' } } })
  await prisma.userRole.deleteMany({ where: { userId: { in: userIds } } })
  await prisma.user.deleteMany({ where: { id: { in: userIds } } })
}
