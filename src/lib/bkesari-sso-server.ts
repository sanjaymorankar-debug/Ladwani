/**
 * Server half of the central login bridge: turns a verified central identity
 * into this app's own user, creating it on first visit.
 *
 * LadWani keeps its own users table (members, families and roles hang off it),
 * linked to the central account by email. A user created here gets an
 * unusable random password: they only ever sign in through bkesari.com.
 *
 * Roles: a central ADMIN (or the owner) is a LadWani ADMIN, and a central
 * moderator of LADWANI is an OPERATOR. Only roles this bridge granted
 * (grantedBy = 'bkesari-sso') are ever removed by it, so roles given inside
 * LadWani (Karta of a family, an area Operator) are never touched.
 */
import { randomBytes } from 'crypto'
import { hash } from 'bcryptjs'
import { prisma } from './prisma'
import { generateMemberNumber } from './utils'
import type { AuthorizedUser } from './auth'
import { FEATURE, type SsoIdentity } from './bkesari-sso'

export const SSO_GRANTOR = 'bkesari-sso'

/** The LadWani role codes a central identity should hold through this bridge. */
export function bridgedRoles(identity: SsoIdentity): string[] {
  const roles = new Set<string>()
  if (identity.roles.includes('ADMIN') || identity.roles.includes('SUPER_ADMIN')) roles.add('ADMIN')
  if (identity.moderator_of.includes(FEATURE)) roles.add('OPERATOR')
  return [...roles]
}

function splitName(identity: SsoIdentity): { firstName: string; lastName: string | null } {
  const name = (identity.user.name ?? '').trim()
  if (!name) return { firstName: identity.user.email.split('@')[0].slice(0, 50), lastName: null }
  const [first, ...rest] = name.split(/\s+/)
  return { firstName: first.slice(0, 50), lastName: rest.join(' ').slice(0, 50) || null }
}

async function roleId(code: string): Promise<string> {
  const existing = await prisma.role.findUnique({ where: { code } })
  if (existing) return existing.id
  const label = code.charAt(0) + code.slice(1).toLowerCase()
  return (await prisma.role.create({ data: { code, label, isSystem: true } })).id
}

/**
 * Finds or creates the local user for a central identity, syncs the bridged
 * roles, and returns what next-auth puts in its token. Throws when the local
 * account exists but is suspended or blocked here.
 */
export async function provisionFromSso(identity: SsoIdentity): Promise<AuthorizedUser & { ssoSub: string }> {
  const email = identity.user.email.toLowerCase()
  let user = await prisma.user.findFirst({ where: { email, deletedAt: null } })

  if (!user) {
    const { firstName, lastName } = splitName(identity)
    const memberRoleId = await roleId('MEMBER')
    user = await prisma.$transaction(async (tx: any) => {
      const created = await tx.user.create({
        data: {
          email,
          // Never usable: a random secret nobody is told.
          passwordHash: await hash(randomBytes(32).toString('base64url'), 12),
          status: 'ACTIVE',
          emailVerified: identity.user.email_verified,
        },
      })
      await tx.member.create({ data: { memberNumber: generateMemberNumber(), userId: created.id, firstName, lastName, status: 'ACTIVE' } })
      await tx.userRole.create({ data: { userId: created.id, roleId: memberRoleId } })
      // Consent was given at the central sign-up; recorded here as this app's own record of it.
      await tx.consentRecord.create({ data: { userId: created.id, consentType: 'PROFILE_STORAGE', granted: true, version: 'bkesari-sso' } })
      return created
    })
  }

  if (user!.status === 'SUSPENDED' || user!.status === 'BLOCKED' || user!.status === 'DEACTIVATED') {
    throw new Error('ACCOUNT_SUSPENDED')
  }

  // Sync only the roles this bridge owns.
  const wanted = new Set(bridgedRoles(identity))
  const current = await prisma.userRole.findMany({ where: { userId: user!.id }, include: { role: true } })
  for (const ur of current) {
    if (ur.grantedBy === SSO_GRANTOR && !wanted.has(ur.role.code)) await prisma.userRole.delete({ where: { id: ur.id } })
  }
  for (const code of wanted) {
    if (!current.some((ur) => ur.role.code === code && !ur.familyId && !ur.areaId)) {
      await prisma.userRole.create({ data: { userId: user!.id, roleId: await roleId(code), grantedBy: SSO_GRANTOR } })
    }
  }

  const fresh = await prisma.user.update({
    where: { id: user!.id },
    data: {
      lastLoginAt: new Date(),
      failedAttempts: 0,
      lockedUntil: null,
      // A central account is email-verified before it can sign in at all.
      ...(user!.status === 'PENDING' ? { status: 'ACTIVE' } : {}),
      ...(identity.user.email_verified ? { emailVerified: true } : {}),
    },
    include: { userRoles: { include: { role: true } }, member: { select: { id: true, firstName: true, lastName: true } } },
  })

  return {
    id: fresh.id,
    email: fresh.email,
    mobile: fresh.mobile,
    name: fresh.member ? `${fresh.member.firstName} ${fresh.member.lastName ?? ''}`.trim() : (fresh.email ?? 'Member'),
    roles: fresh.userRoles.map((ur) => ur.role.code),
    memberId: fresh.member?.id ?? null,
    status: fresh.status,
    ssoSub: identity.user.id,
  }
}
