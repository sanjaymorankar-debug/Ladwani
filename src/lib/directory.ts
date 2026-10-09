import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { calculateAge } from '@/lib/utils'
import { ViewerScope, memberScopeWhere, expandAreas, approvalStatusVisible } from '@/lib/scope'

/**
 * F33 scoped member directory for Admin and the National / State / District
 * teams. Shared by the page, the JSON API and the export, so all three apply
 * exactly the same server-side scope.
 */
export const DIRECTORY_PAGE_SIZE = 50

export interface DirectoryFilters {
  q?: string | null
  areaId?: string | null
  page?: number
}

export interface DirectoryRow {
  id: string
  memberNumber: string
  name: string
  gender: string
  age: number | null
  homeArea: string | null
  memberStatus: string
  /** Final user status (account), or NO_LOGIN for a profile without an account. */
  accountStatus: string
  /** Admin, and State team for own state, only. */
  pendingReviews?: number
  /** Admin only. */
  mobile?: string | null
  email?: string | null
}

export type DirectoryResult =
  | { ok: true; rows: DirectoryRow[]; total: number; page: number; pageSize: number }
  | { ok: false; status: 403; message: string }

const ACTIVE_REVIEW = ['SUBMITTED', 'UNDER_REVIEW', 'ESCALATED'] as const

export async function queryDirectory(
  scope: ViewerScope,
  filters: DirectoryFilters,
  opts: { all?: boolean } = {}
): Promise<DirectoryResult> {
  if (scope.level === 'NONE') return { ok: false, status: 403, message: 'Forbidden' }

  const and: Prisma.MemberWhereInput[] = [{ deletedAt: null }, memberScopeWhere(scope)]

  if (filters.areaId) {
    // An area filter can only narrow the scope, never widen it.
    if (scope.level === 'AREAS' && !scope.areaIds.includes(filters.areaId)) {
      return { ok: false, status: 403, message: 'That area is outside your data scope' }
    }
    const within = await expandAreas([filters.areaId])
    and.push({ memberAreas: { some: { isPrimary: true, areaId: { in: within } } } })
  }

  const q = filters.q?.trim()
  if (q) {
    and.push({
      OR: [
        { firstName: { contains: q } },
        { lastName: { contains: q } },
        { memberNumber: { contains: q } },
      ],
    })
  }

  const where: Prisma.MemberWhereInput = { AND: and }
  const page = Math.max(1, filters.page ?? 1)

  const [members, total] = await Promise.all([
    prisma.member.findMany({
      where,
      select: {
        id: true, memberNumber: true, firstName: true, middleName: true, lastName: true,
        gender: true, dateOfBirth: true, status: true, mobilePrimary: true, email: true,
        user: { select: { status: true, email: true, mobile: true } },
        memberAreas: { where: { isPrimary: true }, select: { area: { select: { id: true, name: true, type: true } } }, take: 1 },
      },
      orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
      ...(opts.all ? {} : { skip: (page - 1) * DIRECTORY_PAGE_SIZE, take: DIRECTORY_PAGE_SIZE }),
    }),
    prisma.member.count({ where }),
  ])

  // Approval status: counted only for members this viewer is allowed to see it for.
  const reviewable = members.filter((m) => approvalStatusVisible(scope, m.memberAreas[0]?.area.id ?? null))
  const pendingByMember = new Map<string, number>()
  if (reviewable.length) {
    const grouped = await prisma.approval.groupBy({
      by: ['entityId'],
      where: { entityType: 'member', entityId: { in: reviewable.map((m) => m.id) }, status: { in: [...ACTIVE_REVIEW] } },
      _count: { _all: true },
    })
    for (const g of grouped) if (g.entityId) pendingByMember.set(g.entityId, g._count._all)
  }
  const reviewableIds = new Set(reviewable.map((m) => m.id))

  const rows: DirectoryRow[] = members.map((m) => {
    const home = m.memberAreas[0]?.area
    const row: DirectoryRow = {
      id: m.id,
      memberNumber: m.memberNumber,
      name: [m.firstName, m.middleName, m.lastName].filter(Boolean).join(' '),
      gender: m.gender,
      age: calculateAge(m.dateOfBirth), // rule 6: always derived from DOB
      homeArea: home ? home.name : null,
      memberStatus: m.status,
      accountStatus: m.user?.status ?? 'NO_LOGIN',
    }
    if (reviewableIds.has(m.id)) row.pendingReviews = pendingByMember.get(m.id) ?? 0
    if (scope.canSeeContact) {
      row.mobile = m.user?.mobile ?? m.mobilePrimary
      row.email = m.user?.email ?? m.email
    }
    return row
  })

  return { ok: true, rows, total, page, pageSize: DIRECTORY_PAGE_SIZE }
}

function csvCell(v: unknown): string {
  if (v === null || v === undefined) return ''
  let s = String(v)
  // Neutralise spreadsheet formula injection from user-entered names.
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export function directoryCsv(scope: ViewerScope, rows: DirectoryRow[]): string {
  const cols: [keyof DirectoryRow, string][] = [
    ['memberNumber', 'Person ID'], ['name', 'Name'], ['gender', 'Gender'], ['age', 'Age'],
    ['homeArea', 'Home area'], ['memberStatus', 'Person status'], ['accountStatus', 'Account status'],
  ]
  if (scope.canSeeApprovalStatus) cols.push(['pendingReviews', 'Pending reviews'])
  if (scope.canSeeContact) cols.push(['mobile', 'Mobile'], ['email', 'Email'])
  const lines = [cols.map(([, h]) => h).join(',')]
  for (const r of rows) lines.push(cols.map(([k]) => csvCell(r[k])).join(','))
  return lines.join('\r\n') + '\r\n'
}
