import { prisma } from '@/lib/prisma'

/**
 * Throw-away people and locations for the P0 tests. Everything is tagged
 * with the given prefix so cleanup() removes exactly what the file created.
 */
export function p0Fixtures(prefix: string) {
  const userIds: string[] = []
  const memberIds: string[] = []
  const areaIds: string[] = []

  async function area(key: string, name: string, type: string, parentId: string | null) {
    const id = `${prefix}-${key}`
    await prisma.area.upsert({ where: { id }, update: {}, create: { id, name, type, parentId } })
    areaIds.push(id)
    return id
  }

  async function person(tag: string, opts: {
    roles?: { code: string; areaId?: string | null }[]
    homeAreaId?: string | null
    status?: 'ACTIVE' | 'SUSPENDED' | 'PENDING'
    login?: boolean
    email?: string
    mobile?: string
  } = {}) {
    let userId: string | null = null
    if (opts.login !== false) {
      const user = await prisma.user.create({
        data: {
          email: opts.email ?? `${prefix}-${tag}@p0.example.test`,
          mobile: opts.mobile ?? null,
          passwordHash: 'x',
          status: opts.status ?? 'ACTIVE',
        },
      })
      userId = user.id
      userIds.push(user.id)
      for (const r of opts.roles ?? [{ code: 'MEMBER' }]) {
        const role = await prisma.role.findUniqueOrThrow({ where: { code: r.code } })
        await prisma.userRole.create({ data: { userId: user.id, roleId: role.id, areaId: r.areaId ?? null } })
      }
    }
    const member = await prisma.member.create({
      data: {
        memberNumber: `${prefix}-${tag}`.toUpperCase(),
        userId,
        firstName: tag,
        lastName: prefix,
        gender: 'MALE',
        dateOfBirth: new Date('1990-01-15'),
        mobilePrimary: '9876500000',
        email: `${prefix}-${tag}-contact@p0.example.test`,
      },
    })
    memberIds.push(member.id)
    if (opts.homeAreaId) {
      await prisma.memberArea.create({ data: { memberId: member.id, areaId: opts.homeAreaId, isPrimary: true } })
    }
    const roles = (opts.roles ?? [{ code: 'MEMBER' }]).map((r) => r.code)
    return { userId: userId!, memberId: member.id, roles }
  }

  async function cleanup() {
    await prisma.auditLog.deleteMany({ where: { OR: [{ actorId: { in: userIds } }, { entityId: { in: [...userIds, ...areaIds] } }] } })
    await prisma.notification.deleteMany({ where: { OR: [{ recipientId: { in: userIds } }, { senderId: { in: userIds } }] } })
    await prisma.memberArea.deleteMany({ where: { memberId: { in: memberIds } } })
    await prisma.member.deleteMany({ where: { id: { in: memberIds } } })
    await prisma.userRole.deleteMany({ where: { userId: { in: userIds } } })
    await prisma.user.deleteMany({ where: { id: { in: userIds } } })
    // Areas children-first: anything any test created under these, then these.
    for (let i = 0; i < 6; i++) {
      await prisma.userRole.deleteMany({ where: { areaId: { in: areaIds } } })
      await prisma.area.deleteMany({ where: { id: { in: areaIds }, children: { none: {} } } })
      await prisma.area.deleteMany({ where: { parentId: { in: areaIds }, children: { none: {} } } })
    }
  }

  return { area, person, cleanup, userIds, memberIds, areaIds }
}
