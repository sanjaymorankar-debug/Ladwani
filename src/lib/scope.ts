import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'

/**
 * P0 role and scope engine (F32, F33).
 *
 * Every decision here is re-derived from the database on each call — never
 * from the roles cached in the session JWT, which only refresh at sign-in. A
 * role the Admin revokes, or an account the Admin suspends, therefore stops
 * granting scope on the very next request.
 *
 * Data scope (workbook "Roles & Access"):
 *   ADMIN          all data
 *   NATIONAL_TEAM  all data, view only
 *   STATE_TEAM     members of the mapped STATE area, plus approval status
 *   DISTRICT_TEAM  members of the mapped DISTRICT area
 *   DATA_EXPORT    Admin-granted permission to export within the scope above
 *
 * A member belongs to the area of their primary `member_areas` row (their
 * home location from the location master); a STATE or DISTRICT scope covers
 * that area and every Taluka / Village beneath it.
 */

/** Location master levels, top to bottom (State > District > Taluka > Village). */
export const LOCATION_TYPES = ['COUNTRY', 'STATE', 'DISTRICT', 'TALUKA', 'VILLAGE', 'CITY'] as const

/** Which parent type each location level must sit under. */
export const LOCATION_PARENT: Record<string, (string | null)[]> = {
  COUNTRY: [null],
  STATE: ['COUNTRY', null],
  DISTRICT: ['STATE'],
  TALUKA: ['DISTRICT'],
  VILLAGE: ['TALUKA'],
  CITY: ['STATE', 'DISTRICT', 'TALUKA'],
}

export const TEAM_ROLES = ['NATIONAL_TEAM', 'STATE_TEAM', 'DISTRICT_TEAM'] as const

/** Scoped roles and the area type they must be mapped to (F32 steps 2–3). */
export const ROLE_AREA_TYPE: Record<string, string> = {
  OPERATOR: 'DISTRICT',
  DISTRICT_TEAM: 'DISTRICT',
  STATE_TEAM: 'STATE',
}

/** Roles that cannot be held without an area. */
export const ROLES_REQUIRING_AREA = ['DISTRICT_TEAM', 'STATE_TEAM']

export const MIN_ADMINS = 2

/**
 * The role grants that are live for this user right now: account ACTIVE and
 * not deleted, grant not expired. Anything else yields no grants at all.
 */
export async function getActiveRoleGrants(userId: string) {
  const user = await prisma.user.findFirst({
    where: { id: userId, deletedAt: null, status: 'ACTIVE' },
    select: {
      userRoles: {
        where: { OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] },
        select: {
          id: true,
          areaId: true,
          role: { select: { code: true } },
          area: { select: { id: true, name: true, type: true } },
        },
      },
    },
  })
  return user?.userRoles ?? []
}

export async function hasActiveRole(userId: string | null | undefined, code: string): Promise<boolean> {
  if (!userId) return false
  const grants = await getActiveRoleGrants(userId)
  return grants.some((g) => g.role.code === code)
}

/** F32: the Admin check used by role and location management — from the DB, not the JWT. */
export function isActiveAdmin(userId: string | null | undefined) {
  return hasActiveRole(userId, 'ADMIN')
}

/** Active, non-deleted users holding ADMIN — what the "minimum 2 Admins" rule counts. */
export async function countActiveAdmins(db: Prisma.TransactionClient | typeof prisma = prisma) {
  return db.user.count({
    where: { status: 'ACTIVE', deletedAt: null, userRoles: { some: { role: { code: 'ADMIN' } } } },
  })
}

/** The given areas plus every area beneath them (any depth). */
export async function expandAreas(rootIds: string[]): Promise<string[]> {
  const seen = new Set(rootIds)
  let frontier = [...seen]
  while (frontier.length) {
    const children = await prisma.area.findMany({
      where: { parentId: { in: frontier } },
      select: { id: true },
    })
    frontier = children.map((c) => c.id).filter((id) => !seen.has(id))
    for (const id of frontier) seen.add(id)
  }
  return [...seen]
}

export interface ViewerScope {
  userId: string
  isAdmin: boolean
  /** ALL — every member; AREAS — members whose home area is in `areaIds`; NONE — no directory access. */
  level: 'ALL' | 'AREAS' | 'NONE'
  /** Scope roots (mapped STATE / DISTRICT areas) expanded to every area beneath them. */
  areaIds: string[]
  /** Admin: every member's; State team: members in own state only. */
  canSeeApprovalStatus: boolean
  approvalAreaIds: string[]
  /** Admin, or a team member the Admin has granted DATA_EXPORT. */
  canExport: boolean
  /** Contact details (mobile / email) are Self, Karta, Operator, Admin only — never body teams. */
  canSeeContact: boolean
}

export async function getViewerScope(userId: string | null | undefined): Promise<ViewerScope> {
  const none: ViewerScope = {
    userId: userId ?? '', isAdmin: false, level: 'NONE', areaIds: [],
    canSeeApprovalStatus: false, approvalAreaIds: [], canExport: false, canSeeContact: false,
  }
  if (!userId) return none

  const grants = await getActiveRoleGrants(userId)
  const codes = new Set(grants.map((g) => g.role.code))
  const isAdmin = codes.has('ADMIN')
  const all = isAdmin || codes.has('NATIONAL_TEAM')

  // A team grant only counts when it is mapped to an area of the right type —
  // an unmapped or mis-mapped grant gives no scope rather than a wide one.
  const rootsFor = (code: string) =>
    grants
      .filter((g) => g.role.code === code && g.area && g.area.type === ROLE_AREA_TYPE[code])
      .map((g) => g.area!.id)
  const stateRoots = rootsFor('STATE_TEAM')
  const districtRoots = rootsFor('DISTRICT_TEAM')

  const level: ViewerScope['level'] = all ? 'ALL' : stateRoots.length + districtRoots.length > 0 ? 'AREAS' : 'NONE'
  if (level === 'NONE') return { ...none, isAdmin }

  return {
    userId,
    isAdmin,
    level,
    areaIds: level === 'ALL' ? [] : await expandAreas([...stateRoots, ...districtRoots]),
    canSeeApprovalStatus: isAdmin || stateRoots.length > 0,
    approvalAreaIds: isAdmin ? [] : await expandAreas(stateRoots),
    canExport: isAdmin || codes.has('DATA_EXPORT'),
    canSeeContact: isAdmin,
  }
}

/** Members whose primary (home) area is one of these. */
function homeAreaIn(areaIds: string[]): Prisma.MemberWhereInput {
  return { memberAreas: { some: { isPrimary: true, areaId: { in: areaIds } } } }
}

/** Server-side query filter for "members this viewer may see" (F33). */
export function memberScopeWhere(scope: ViewerScope): Prisma.MemberWhereInput {
  if (scope.level === 'ALL') return {}
  if (scope.level === 'AREAS') return homeAreaIn(scope.areaIds)
  return { id: { in: [] } }
}

/** Whether this viewer may see approval status for a member with this home area. */
export function approvalStatusVisible(scope: ViewerScope, memberHomeAreaId: string | null): boolean {
  if (!scope.canSeeApprovalStatus) return false
  if (scope.isAdmin) return true
  return !!memberHomeAreaId && scope.approvalAreaIds.includes(memberHomeAreaId)
}
