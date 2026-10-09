import { prisma } from '@/lib/prisma'
import { ViewerScope, memberScopeWhere } from '@/lib/scope'

/**
 * F39 dashboards — every figure respects the viewer's scope (Admin and
 * National team: all; State team: own state; District team: own district).
 * Counts are aggregated in a handful of grouped queries so the page stays
 * cheap on shared hosting.
 */
type AreaRow = { id: string; name: string; type: string; parentId: string | null }

async function areaIndex() {
  const areas = await prisma.area.findMany({ select: { id: true, name: true, type: true, parentId: true } })
  const byId = new Map(areas.map((a) => [a.id, a]))
  const up = (id: string | null, type: string): AreaRow | null => {
    for (let a = id ? byId.get(id) : undefined, i = 0; a && i < 10; a = a.parentId ? byId.get(a.parentId) : undefined, i++) {
      if (a.type === type) return a
    }
    return null
  }
  return { byId, districtOf: (id: string | null) => up(id, 'DISTRICT'), stateOf: (id: string | null) => up(id, 'STATE') }
}

export interface DistrictRow { stateId: string | null; state: string; districtId: string; district: string; families: number; members: number; pendingApprovals: number; organisations: number }

export async function districtCounts(scope: ViewerScope): Promise<DistrictRow[]> {
  if (scope.level === 'NONE') return []
  const idx = await areaIndex()
  const inScope = (districtId: string) => scope.level === 'ALL' || scope.areaIds.includes(districtId)
  const rows = new Map<string, DistrictRow>()
  const row = (areaId: string | null) => {
    const d = idx.districtOf(areaId)
    if (!d || !inScope(d.id)) return null
    if (!rows.has(d.id)) {
      const s = idx.stateOf(d.id)
      rows.set(d.id, { stateId: s?.id ?? null, state: s?.name ?? '', districtId: d.id, district: d.name, families: 0, members: 0, pendingApprovals: 0, organisations: 0 })
    }
    return rows.get(d.id)!
  }

  const [members, families, tasks, orgs] = await Promise.all([
    prisma.memberArea.groupBy({ by: ['areaId'], where: { isPrimary: true, member: { status: 'ACTIVE', deletedAt: null } }, _count: { _all: true } }),
    prisma.familyArea.groupBy({ by: ['areaId'], where: { isPrimary: true, family: { status: { in: ['ACTIVE', 'KARTA_VACANT'] } } }, _count: { _all: true } }),
    prisma.approvalTask.findMany({ where: { supersededAt: null, status: { in: ['OPEN', 'ESCALATED'] } }, select: { districtAreaId: true, kind: true, subjectUserId: true, changeRequestId: true, organisationId: true, round: true } }),
    prisma.organisation.groupBy({ by: ['areaId'], where: { kind: 'LOCAL', status: 'ACTIVE' }, _count: { _all: true } }),
  ])
  for (const m of members) { const r = row(m.areaId); if (r) r.members += m._count._all }
  for (const f of families) { const r = row(f.areaId); if (r) r.families += f._count._all }
  for (const o of orgs) { const r = row(o.areaId); if (r) r.organisations += o._count._all }
  // A pending approval = one round (two task slots) not yet decided.
  const rounds = new Set<string>()
  for (const t of tasks) {
    const key = [t.kind, t.subjectUserId, t.changeRequestId, t.organisationId, t.round].join('|')
    if (rounds.has(key)) continue
    rounds.add(key)
    const r = row(t.districtAreaId); if (r) r.pendingApprovals++
  }
  return Array.from(rows.values()).sort((a, b) => a.state.localeCompare(b.state) || a.district.localeCompare(b.district))
}

export const AGE_BANDS = [
  { label: 'Under 18', min: 0, max: 17 }, { label: '18–25', min: 18, max: 25 }, { label: '26–35', min: 26, max: 35 },
  { label: '36–50', min: 36, max: 50 }, { label: '51–65', min: 51, max: 65 }, { label: 'Over 65', min: 66, max: 200 },
]

export async function ageDistribution(scope: ViewerScope) {
  if (scope.level === 'NONE') return []
  const rows = await prisma.member.findMany({ where: { status: 'ACTIVE', deletedAt: null, ...memberScopeWhere(scope) }, select: { dateOfBirth: true } })
  const now = new Date()
  const counts = AGE_BANDS.map((b) => ({ band: b.label, members: 0 }))
  let unknown = 0
  for (const r of rows) {
    if (!r.dateOfBirth) { unknown++; continue }
    let age = now.getFullYear() - r.dateOfBirth.getFullYear()
    if (now < new Date(now.getFullYear(), r.dateOfBirth.getMonth(), r.dateOfBirth.getDate())) age--
    const i = AGE_BANDS.findIndex((b) => age >= b.min && age <= b.max)
    if (i >= 0) counts[i].members++
  }
  return [...counts, { band: 'Not given', members: unknown }]
}

const EDUCATION: Record<string, string> = { SCHOOL: 'School', DIPLOMA: 'Diploma', ITI: 'ITI', UG: 'Graduate', PG: 'Post-graduate', DOCTORATE: 'Doctorate', PROFESSIONAL: 'Professional', OTHER: 'Other' }

export async function educationDistribution(scope: ViewerScope) {
  if (scope.level === 'NONE') return []
  const memberWhere = { status: 'ACTIVE' as const, deletedAt: null, ...memberScopeWhere(scope) }
  const [grouped, total] = await Promise.all([
    prisma.educationRecord.groupBy({ by: ['level'], where: { isHighest: true, member: memberWhere }, _count: { _all: true } }),
    prisma.member.count({ where: memberWhere }),
  ])
  const rows = grouped.map((g) => ({ level: EDUCATION[g.level ?? ''] ?? g.level ?? 'Not given', members: g._count._all }))
  const counted = rows.reduce((s, r) => s + r.members, 0)
  return [...rows.sort((a, b) => b.members - a.members), { level: 'Not given', members: Math.max(0, total - counted) }]
}

/** F39 step 3 — Admin only: each Operator's load, overdue tasks and decision time. */
export async function operatorSla() {
  const tasks = await prisma.approvalTask.findMany({
    where: { operatorUserId: { not: null } },
    select: { operatorUserId: true, status: true, dueAt: true, createdAt: true, decidedAt: true, supersededAt: true },
  })
  const now = Date.now()
  const by = new Map<string, { open: number; overdue: number; decided: number; escalated: number; hours: number[] }>()
  for (const t of tasks) {
    const s = by.get(t.operatorUserId!) ?? { open: 0, overdue: 0, decided: 0, escalated: 0, hours: [] }
    if (t.status === 'ESCALATED') s.escalated++
    if (!t.supersededAt && ['OPEN', 'ESCALATED'].includes(t.status)) {
      s.open++
      if (t.dueAt.getTime() < now) s.overdue++
    }
    if (t.decidedAt) { s.decided++; s.hours.push((t.decidedAt.getTime() - t.createdAt.getTime()) / 3600000) }
    by.set(t.operatorUserId!, s)
  }
  const people = await prisma.user.findMany({ where: { id: { in: Array.from(by.keys()) } }, select: { id: true, email: true, member: { select: { firstName: true, lastName: true } } } })
  return Array.from(by.entries()).map(([id, s]) => {
    const u = people.find((p) => p.id === id)
    return {
      operatorUserId: id, operator: u?.member ? [u.member.firstName, u.member.lastName].filter(Boolean).join(' ') : u?.email ?? id,
      open: s.open, overdue: s.overdue, decided: s.decided, escalated: s.escalated,
      avgDecisionHours: s.hours.length ? Math.round((s.hours.reduce((a, b) => a + b, 0) / s.hours.length) * 10) / 10 : null,
    }
  }).sort((a, b) => b.overdue - a.overdue || b.open - a.open)
}

/** CSV with a UTF-8 byte-order mark so Excel opens it with the right characters. */
export function toCsv(rows: Record<string, unknown>[]) {
  if (!rows.length) return '﻿'
  const cols = Object.keys(rows[0])
  const cell = (v: unknown) => {
    const s = v === null || v === undefined ? '' : String(v)
    // Spreadsheet formula injection: neutralise leading = + - @.
    const safe = /^[=+\-@]/.test(s) ? `'${s}` : s
    return /[",\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe
  }
  return '﻿' + [cols.join(','), ...rows.map((r) => cols.map((c) => cell(r[c])).join(','))].join('\n')
}
