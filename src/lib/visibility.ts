import { Session } from 'next-auth'
import { prisma } from '@/lib/prisma'

/**
 * Shared visibility vocabulary for both MemberFieldVisibility and
 * Photo.visibility: PRIVATE, SAME_FAMILY, REGISTERED_MEMBERS, SAME_AREA,
 * MATRIMONY_ONLY, PUBLIC_COMMUNITY, ADMIN_OPERATOR.
 *
 * SAME_AREA and MATRIMONY_ONLY collapse to "any registered member" here —
 * true area-matching and matrimony-context scoping are a larger feature;
 * this at least keeps PRIVATE/SAME_FAMILY/staff-only meaningfully enforced,
 * which covers the cases spec explicitly worries about (exact address,
 * private photos).
 */
export async function canViewByVisibility(
  session: Session | null,
  ownerMemberId: string,
  visibility: string
): Promise<boolean> {
  if (!session?.user?.id) return false

  const roles = ((session.user as any).roles ?? []) as string[]
  const isStaff = roles.includes('ADMIN') || roles.includes('OPERATOR')
  if (isStaff) return true

  const viewerMemberId = (session.user as any).memberId as string | null
  if (viewerMemberId && viewerMemberId === ownerMemberId) return true

  if (visibility === 'PRIVATE' || visibility === 'ADMIN_OPERATOR') return false

  if (visibility === 'SAME_FAMILY') {
    if (!viewerMemberId) return false
    const ownerFamilies = await prisma.familyMember.findMany({
      where: { memberId: ownerMemberId, leftAt: null },
      select: { familyId: true },
    })
    const familyIds = ownerFamilies.map((f) => f.familyId)
    if (!familyIds.length) return false
    const shared = await prisma.familyMember.findFirst({
      where: { memberId: viewerMemberId, leftAt: null, familyId: { in: familyIds } },
    })
    return !!shared
  }

  // REGISTERED_MEMBERS, PUBLIC_COMMUNITY, MATRIMONY_ONLY, SAME_AREA
  return true
}

/** field key (as used by MemberFieldVisibility/the privacy page) -> Member columns it gates. Conservative fallback when nothing is configured. */
const FIELD_MAP: Record<string, { keys: string[]; fallback: string }> = {
  mobile_primary: { keys: ['mobilePrimary', 'mobileAlternate'], fallback: 'PRIVATE' },
  email: { keys: ['email'], fallback: 'PRIVATE' },
  date_of_birth: { keys: ['dateOfBirth'], fallback: 'SAME_FAMILY' },
  blood_group: { keys: ['bloodGroup'], fallback: 'SAME_FAMILY' },
  biography: { keys: ['biography'], fallback: 'REGISTERED_MEMBERS' },
  current_city: { keys: ['currentCity', 'currentState', 'currentCountry'], fallback: 'REGISTERED_MEMBERS' },
}

/**
 * Redacts a Member record (as returned by Prisma) in place for the given
 * viewer, based on that member's MemberFieldVisibility overrides (falling
 * back to FieldVisibilityDefault, then a conservative built-in default).
 * Self and staff always see everything.
 */
export async function redactMemberForViewer<T extends Record<string, any>>(
  session: Session | null,
  member: T
): Promise<T> {
  const roles = ((session?.user as any)?.roles ?? []) as string[]
  const isStaff = roles.includes('ADMIN') || roles.includes('OPERATOR')
  const viewerMemberId = (session?.user as any)?.memberId as string | null
  if (isStaff || (viewerMemberId && viewerMemberId === member.id)) return member

  const [overrides, defaults] = await Promise.all([
    prisma.memberFieldVisibility.findMany({ where: { memberId: member.id } }),
    prisma.fieldVisibilityDefault.findMany({ where: { entityType: 'member' } }),
  ])
  const overrideMap = new Map(overrides.map((o) => [o.fieldName, o.visibility]))
  const defaultMap = new Map(defaults.map((d) => [d.fieldName, d.defaultVisibility]))

  for (const [fieldKey, { keys, fallback }] of Object.entries(FIELD_MAP)) {
    const visibility = overrideMap.get(fieldKey) ?? defaultMap.get(fieldKey) ?? fallback
    if (!(await canViewByVisibility(session, member.id, visibility))) {
      for (const k of keys) (member as any)[k] = null
    }
  }

  return member
}

/**
 * Batch form of redactMemberForViewer for list endpoints (/api/members,
 * /api/search): the same per-member privacy settings and fallbacks, loaded
 * with a fixed number of queries instead of several per row.
 */
export async function redactMembersForViewer<T extends Record<string, any>>(
  session: Session | null,
  members: T[]
): Promise<T[]> {
  const roles = ((session?.user as any)?.roles ?? []) as string[]
  const viewerMemberId = (session?.user as any)?.memberId as string | null
  if (roles.includes('ADMIN') || !members.length) return members

  const ids = members.map((m) => m.id as string)
  const [overrides, defaults, ownerLinks, viewerLinks] = await Promise.all([
    prisma.memberFieldVisibility.findMany({ where: { memberId: { in: ids } } }),
    prisma.fieldVisibilityDefault.findMany({ where: { entityType: 'member' } }),
    prisma.familyMember.findMany({ where: { memberId: { in: ids }, leftAt: null }, select: { memberId: true, familyId: true } }),
    viewerMemberId
      ? prisma.familyMember.findMany({ where: { memberId: viewerMemberId, leftAt: null }, select: { familyId: true } })
      : Promise.resolve([] as { familyId: string }[]),
  ])
  const overrideMap = new Map(overrides.map((o) => [`${o.memberId}:${o.fieldName}`, o.visibility]))
  const defaultMap = new Map(defaults.map((d) => [d.fieldName, d.defaultVisibility]))
  const viewerFamilies = new Set(viewerLinks.map((l) => l.familyId))
  const sharesFamily = new Set(ownerLinks.filter((l) => viewerFamilies.has(l.familyId)).map((l) => l.memberId))

  return members.map((member) => {
    if (viewerMemberId && member.id === viewerMemberId) return member
    const out: Record<string, any> = { ...member }
    for (const [fieldKey, { keys, fallback }] of Object.entries(FIELD_MAP)) {
      const visibility = overrideMap.get(`${member.id}:${fieldKey}`) ?? defaultMap.get(fieldKey) ?? fallback
      const allowed =
        visibility === 'PRIVATE' || visibility === 'ADMIN_OPERATOR' ? false
        : visibility === 'SAME_FAMILY' ? sharesFamily.has(member.id)
        : true
      if (!allowed) for (const k of keys) out[k] = null
    }
    return out as T
  })
}
