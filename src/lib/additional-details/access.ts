import { Session } from 'next-auth'
import { prisma } from '@/lib/prisma'
import { calculateAge } from '@/lib/utils'
import { isEligibleForMatrimony } from '@/lib/matrimony'
import {
  type ApplicabilityContext, type Visibility, VISIBILITY_LEVELS, visibilityRank,
} from './sections'

/**
 * Who may enter, and who may see, a member's Additional Details. Everything is
 * re-derived from the database on every request — nothing from the client is
 * trusted as proof of a relationship.
 *
 * Editing (rule 1):
 *   - under 18: only a parent or the Karta of the child's family — never the
 *     child, even with their own login;
 *   - adult with a login: only the member themself;
 *   - adult without a login: the Karta of their family (entry is logged).
 * Platform staff get no special edit or view rights in this area: unlike the
 * core profile, these sections are the member's own and are only shared by
 * the member's choice of visibility.
 *
 * Viewing (rule 2/8): the viewer's closest relationship to the member is
 * mapped onto the same ladder as the section's visibility setting.
 */

export const TEAM_ROLE_CODES = ['DISTRICT_TEAM', 'STATE_TEAM', 'NATIONAL_TEAM'] as const

export interface TeamScope {
  isAdmin: boolean
  isOperator: boolean
  /** Districts (lower-cased) where this user may see named support requests. */
  districts: string[]
  states: string[]
  national: boolean
  /** Any community-body role at all — gets counts on the support dashboard. */
  any: boolean
}

export async function getTeamScope(session: Session | null): Promise<TeamScope> {
  const roles = (((session?.user as any)?.roles ?? []) as string[])
  const scope: TeamScope = {
    isAdmin: roles.includes('ADMIN'),
    isOperator: roles.includes('OPERATOR'),
    districts: [], states: [], national: false, any: false,
  }
  if (!session?.user?.id) return scope
  const userRoles = await prisma.userRole.findMany({
    where: { userId: session.user.id, role: { code: { in: [...TEAM_ROLE_CODES, 'OPERATOR'] } } },
    include: { role: { select: { code: true } }, area: { select: { name: true, type: true } } },
  })
  for (const ur of userRoles) {
    const name = ur.area?.name?.trim().toLowerCase()
    if (ur.role.code === 'DISTRICT_TEAM' && name) scope.districts.push(name)
    // An Operator scoped to a district acts as that district's team.
    if (ur.role.code === 'OPERATOR' && name && ur.area?.type === 'DISTRICT') scope.districts.push(name)
    if (ur.role.code === 'STATE_TEAM' && name) scope.states.push(name)
    if (ur.role.code === 'NATIONAL_TEAM') scope.national = true
  }
  scope.any = scope.isAdmin || scope.isOperator || scope.districts.length > 0 || scope.states.length > 0 || scope.national
  return scope
}

export interface DetailsContext {
  exists: boolean
  member: {
    id: string
    userId: string | null
    firstName: string
    lastName: string | null
    gender: string
    dateOfBirth: Date | null
    maritalStatus: string
    employmentStatus: string | null
    occupationCategory: string | null
    currentCity: string | null
    status: string
    bloodGroup: string | null
    languages: unknown
  } | null
  age: number | null
  isMinor: boolean
  district: string | null
  familyIds: string[]
  viewerUserId: string | null
  viewerMemberId: string | null
  isOwn: boolean
  canEdit: boolean
  editorKind: 'SELF' | 'KARTA' | 'PARENT' | null
  /** Narrowest visibility level the viewer belongs to; null = may see nothing. */
  viewerLevel: Visibility | null
  applicability: ApplicabilityContext
}

const memberSelect = {
  id: true, userId: true, firstName: true, lastName: true, gender: true, dateOfBirth: true,
  maritalStatus: true, employmentStatus: true, occupationCategory: true, currentCity: true,
  status: true, bloodGroup: true, languages: true, deletedAt: true,
} as const

export async function memberDistrict(memberId: string): Promise<string | null> {
  const addr = await prisma.address.findFirst({
    where: { memberId, addressType: 'CURRENT' },
    select: { district: true },
  })
  return addr?.district?.trim() || null
}

export async function getDetailsContext(session: Session | null, memberId: string): Promise<DetailsContext> {
  const member = await prisma.member.findUnique({ where: { id: memberId }, select: memberSelect })
  const empty: DetailsContext = {
    exists: false, member: null, age: null, isMinor: false, district: null, familyIds: [],
    viewerUserId: null, viewerMemberId: null, isOwn: false, canEdit: false, editorKind: null, viewerLevel: null,
    applicability: { age: null, gender: 'NOT_STATED', maritalStatus: 'NOT_STATED', employmentStatus: null, matrimonyEligible: false },
  }
  if (!member || member.deletedAt) return empty

  const age = calculateAge(member.dateOfBirth)
  const isMinor = age !== null && age < 18
  const families = await prisma.familyMember.findMany({ where: { memberId, leftAt: null }, select: { familyId: true } })
  const familyIds = families.map((f) => f.familyId)
  const district = await memberDistrict(memberId)

  const viewerUserId = session?.user?.id ?? null
  const viewerMemberId = ((session?.user as any)?.memberId as string | null) ?? null
  const isOwn = !!viewerUserId && member.userId === viewerUserId

  let isKarta = false
  let isFamily = false
  let isParent = false
  if (viewerMemberId && viewerMemberId !== memberId) {
    if (familyIds.length) {
      const links = await prisma.familyMember.findMany({
        where: { memberId: viewerMemberId, familyId: { in: familyIds }, leftAt: null },
        select: { isKarta: true },
      })
      isFamily = links.length > 0
      isKarta = links.some((l) => l.isKarta)
    }
    if (isMinor) {
      // Relationship rows read "from is <type> of to" (see families/[id]/members).
      const parentLink = await prisma.memberRelationship.findFirst({
        where: {
          fromMemberId: viewerMemberId, toMemberId: memberId, isActive: true,
          relationshipType: { code: { in: ['father', 'mother'] } },
        },
      })
      isParent = !!parentLink
    }
  }

  let editorKind: DetailsContext['editorKind'] = null
  if (isMinor) editorKind = isParent ? 'PARENT' : isKarta ? 'KARTA' : null
  else if (member.userId) editorKind = isOwn ? 'SELF' : null
  else editorKind = isKarta ? 'KARTA' : null

  let viewerLevel: Visibility | null = null
  if (viewerUserId) {
    if (editorKind || isOwn) viewerLevel = 'ONLY_ME'
    else if (isKarta) viewerLevel = 'KARTA'
    else if (isFamily) viewerLevel = 'FAMILY'
    else {
      const scope = await getTeamScope(session)
      const isBody = scope.isAdmin || scope.isOperator || (!!district && scope.districts.includes(district.toLowerCase()))
      viewerLevel = isBody ? 'COMMUNITY_BODIES' : 'COMMUNITY'
    }
  }

  return {
    exists: true,
    member,
    age,
    isMinor,
    district,
    familyIds,
    viewerUserId,
    viewerMemberId,
    isOwn,
    canEdit: !!editorKind,
    editorKind,
    viewerLevel,
    applicability: {
      age,
      gender: member.gender,
      maritalStatus: member.maritalStatus,
      employmentStatus: member.employmentStatus,
      matrimonyEligible: isEligibleForMatrimony(member.maritalStatus as any),
    },
  }
}

/** Server-side visibility check (rule 8). */
export function canViewSection(ctx: DetailsContext, visibility: string | null | undefined): boolean {
  if (!ctx.viewerLevel) return false
  const v = (VISIBILITY_LEVELS as readonly string[]).includes(visibility ?? '') ? visibility! : 'ONLY_ME'
  return visibilityRank(ctx.viewerLevel) <= visibilityRank(v)
}

/** Members who share a family with this member (for the emergency-contact pickers). */
export async function familyMemberIds(familyIds: string[]): Promise<Set<string>> {
  if (!familyIds.length) return new Set()
  const rows = await prisma.familyMember.findMany({
    where: { familyId: { in: familyIds }, leftAt: null },
    select: { memberId: true },
  })
  return new Set(rows.map((r) => r.memberId))
}
