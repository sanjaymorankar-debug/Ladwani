import { Session } from 'next-auth'
import { prisma } from '@/lib/prisma'
import { getFamilyAccess } from '@/lib/family-auth'
import { PARENT_CODES, CHILD_CODES } from '@/lib/relations'

/**
 * F25 tree view.
 *   FULL   — a member of this family, or an Admin.
 *   BRANCH — a member of a *linked* family (one that shares a person with
 *            this one) sees only the connecting branch.
 *   NONE   — everyone else sees nothing.
 */
export type TreeMode = 'FULL' | 'BRANCH' | 'NONE'

export async function treeAccess(session: Session | null, familyId: string): Promise<{ mode: TreeMode; viewerMemberId: string | null }> {
  const access = await getFamilyAccess(session, familyId)
  const viewerMemberId = (access as any).memberId ?? null
  if (access.isMember || access.isStaff) return { mode: 'FULL', viewerMemberId }
  if (!viewerMemberId) return { mode: 'NONE', viewerMemberId }
  const shared = await sharedPeople(familyId, viewerMemberId)
  return { mode: shared.length ? 'BRANCH' : 'NONE', viewerMemberId }
}

/** People active in `familyId` who are also active in a family the viewer belongs to. */
async function sharedPeople(familyId: string, viewerMemberId: string) {
  const viewerFamilies = (await prisma.familyMember.findMany({ where: { memberId: viewerMemberId, leftAt: null }, select: { familyId: true } }))
    .map((f) => f.familyId).filter((id) => id !== familyId)
  if (!viewerFamilies.length) return []
  const rows = await prisma.familyMember.findMany({
    where: { familyId, leftAt: null, member: { families: { some: { familyId: { in: viewerFamilies }, leftAt: null } } } },
    select: { memberId: true },
  })
  return rows.map((r) => r.memberId)
}

// Older master rows carry no generation; these are their offsets.
const LEGACY_GENERATION: Record<string, number> = {
  grandson: -2, granddaughter: -2, uncle: 1, aunt: 1, nephew: -1, niece: -1,
}

export interface TreeNode {
  id: string
  type: 'memberNode'
  position: { x: number; y: number }
  data: {
    id: string; firstName: string; lastName: string; gender: string | null
    status: string; late: boolean; maritalStatus?: string | null
    dateOfBirth?: string | null; birthYear: number | null; currentCity?: string
    isKarta: boolean; role: string | null; generation: number
    linkedFamilies: { id: string; name: string }[]; hasChildren: boolean; limited: boolean
  }
}
export interface TreeEdge {
  id: string; source: string; target: string; type: string; label?: string
  kind: 'parent' | 'spouse' | 'relation'; status?: string
}

export async function buildTree(familyId: string, mode: Exclude<TreeMode, 'NONE'>, viewerMemberId: string | null) {
  const family = await prisma.family.findUnique({
    where: { id: familyId },
    select: {
      id: true, name: true, status: true,
      members: {
        where: { leftAt: null },
        select: {
          isKarta: true, relationshipRole: true, relativeToMemberId: true,
          member: {
            select: {
              id: true, firstName: true, lastName: true, gender: true, maritalStatus: true, status: true,
              dateOfBirth: true, dateOfBirthApprox: true, currentCity: true,
              families: { where: { leftAt: null, familyId: { not: familyId } }, select: { family: { select: { id: true, name: true } } } },
            },
          },
        },
      },
    },
  })
  if (!family) return null
  const ids = family.members.map((m) => m.member.id)
  const idSet = new Set(ids)
  const rels = await prisma.memberRelationship.findMany({
    where: { isActive: true, fromMemberId: { in: ids }, toMemberId: { in: ids } },
    select: { id: true, fromMemberId: true, toMemberId: true, relationshipType: { select: { code: true, label: true, isSpouse: true, generation: true } } },
  })

  // Edges: parent → child, spouse ↔ spouse (deduplicated across the two stored directions).
  const edges: TreeEdge[] = []
  const seen = new Set<string>()
  const parentsOf = new Map<string, Set<string>>()
  const childrenOf = new Map<string, Set<string>>()
  const spouseOf = new Map<string, Set<string>>()
  const add = (m: Map<string, Set<string>>, k: string, v: string) => { if (!m.has(k)) m.set(k, new Set()); m.get(k)!.add(v) }
  for (const r of rels) {
    const code = r.relationshipType.code
    let parent: string | null = null
    let child: string | null = null
    if (PARENT_CODES.includes(code)) { parent = r.fromMemberId; child = r.toMemberId }
    if (CHILD_CODES.includes(code)) { parent = r.toMemberId; child = r.fromMemberId }
    if (parent && child) {
      const key = `p:${parent}:${child}`
      if (seen.has(key)) continue
      seen.add(key)
      add(parentsOf, child, parent); add(childrenOf, parent, child)
      edges.push({ id: key, source: parent, target: child, type: 'smoothstep', kind: 'parent' })
    } else if (r.relationshipType.isSpouse) {
      const [a, b] = [r.fromMemberId, r.toMemberId].sort()
      const key = `s:${a}:${b}`
      if (seen.has(key)) continue
      seen.add(key)
      add(spouseOf, a, b); add(spouseOf, b, a)
      edges.push({ id: key, source: a, target: b, type: 'spouse', kind: 'spouse', label: 'Married' })
    }
  }
  // Divorced / widowed: the marriage link stays, marked with its status (F23).
  const marriages = await prisma.marriageRecord.findMany({
    where: { memberId1: { in: ids }, memberId2: { in: ids }, status: { not: 'MARRIED' } },
    select: { memberId1: true, memberId2: true, status: true },
  })
  for (const m of marriages) {
    const [a, b] = [m.memberId1, m.memberId2!].sort()
    const e = edges.find((x) => x.id === `s:${a}:${b}`)
    if (e) { e.status = m.status; e.label = m.status === 'DIVORCED' ? 'Divorced' : m.status === 'WIDOWED' ? 'Widowed' : m.status }
  }

  // Generations, relative to the Karta (0); ancestors are positive.
  const gen = new Map<string, number>()
  const start = family.members.find((m) => m.isKarta)?.member.id ?? ids[0]
  if (start) {
    gen.set(start, 0)
    const queue = [start]
    while (queue.length) {
      const cur = queue.shift()!
      for (const r of rels) {
        const g = r.relationshipType.generation ?? LEGACY_GENERATION[r.relationshipType.code] ?? (r.relationshipType.isSpouse ? 0 : null)
        if (g === null) continue
        // from is <type> of to: gen(from) = gen(to) + g
        if (r.toMemberId === cur && !gen.has(r.fromMemberId)) { gen.set(r.fromMemberId, gen.get(cur)! + g); queue.push(r.fromMemberId) }
        if (r.fromMemberId === cur && !gen.has(r.toMemberId)) { gen.set(r.toMemberId, gen.get(cur)! - g); queue.push(r.toMemberId) }
      }
    }
  }

  // Not reached through relationship rows: place by the membership role
  // ("son of X" is one generation below X).
  const types = await prisma.relationshipType.findMany({ select: { code: true, label: true, generation: true, isSpouse: true } })
  const roleLabels = new Map(types.map((t) => [t.code, t.label]))
  const roleGen = new Map(types.map((t) => [t.code, t.generation ?? LEGACY_GENERATION[t.code] ?? (t.isSpouse ? 0 : null)]))
  for (let changed = true; changed;) {
    changed = false
    for (const m of family.members) {
      const id = m.member.id
      if (gen.has(id) || !m.relativeToMemberId || !gen.has(m.relativeToMemberId)) continue
      const g = m.relationshipRole ? roleGen.get(m.relationshipRole) : null
      if (g === null || g === undefined) continue
      gen.set(id, gen.get(m.relativeToMemberId)! + g)
      changed = true
    }
  }

  // A person with no parent / child / spouse edge hangs off their relative.
  const connected = new Set(edges.flatMap((e) => [e.source, e.target]))
  for (const m of family.members) {
    const id = m.member.id
    if (connected.has(id) || !m.relativeToMemberId || !idSet.has(m.relativeToMemberId)) continue
    edges.push({ id: `r:${id}`, source: m.relativeToMemberId, target: id, type: 'smoothstep', kind: 'relation', label: m.relationshipRole ? roleLabels.get(m.relationshipRole) ?? m.relationshipRole : undefined })
  }

  // Which people the viewer may see.
  let visible = idSet
  if (mode === 'BRANCH' && viewerMemberId) {
    const shared = await sharedPeople(familyId, viewerMemberId)
    visible = new Set(shared)
    for (const s of shared) {
      for (const p of parentsOf.get(s) ?? []) { visible.add(p); for (const sib of childrenOf.get(p) ?? []) visible.add(sib) }
      for (const c of childrenOf.get(s) ?? []) visible.add(c)
      for (const sp of spouseOf.get(s) ?? []) visible.add(sp)
    }
  }

  const nodes: TreeNode[] = family.members.filter((m) => visible.has(m.member.id)).map((m) => {
    const p = m.member
    const limited = mode === 'BRANCH'
    return {
      id: p.id, type: 'memberNode', position: { x: 0, y: 0 },
      data: {
        id: p.id, firstName: p.firstName, lastName: p.lastName ?? '', gender: p.gender,
        status: p.status, late: p.status === 'DECEASED',
        birthYear: p.dateOfBirth ? p.dateOfBirth.getFullYear() : null,
        ...(limited ? {} : {
          maritalStatus: p.maritalStatus,
          dateOfBirth: p.dateOfBirth && !p.dateOfBirthApprox ? p.dateOfBirth.toISOString() : null,
          currentCity: p.currentCity ?? '',
        }),
        isKarta: m.isKarta,
        role: m.isKarta ? 'Karta' : m.relationshipRole ? roleLabels.get(m.relationshipRole) ?? m.relationshipRole : null,
        generation: gen.get(p.id) ?? 0,
        linkedFamilies: p.families.map((f) => f.family),
        hasChildren: (childrenOf.get(p.id)?.size ?? 0) > 0,
        limited,
      },
    }
  })
  return {
    familyId: family.id, familyName: family.name, familyStatus: family.status, mode,
    nodes, edges: edges.filter((e) => visible.has(e.source) && visible.has(e.target)),
  }
}

/** F19: ancestor depth allowed above the Karta (Setting tree.ancestor_levels, OP-02; default 3). */
export async function ancestorLevels() {
  const s = await prisma.setting.findUnique({ where: { key: 'tree.ancestor_levels' } })
  const n = Number(typeof s?.value === 'string' ? JSON.parse(s.value) : s?.value)
  return Number.isFinite(n) && n > 0 ? n : 3
}

/** Generation of one person in a family's tree (Karta = 0), or null when not connected. */
export async function generationIn(familyId: string, memberId: string) {
  const tree = await buildTree(familyId, 'FULL', null)
  const node = tree?.nodes.find((n) => n.id === memberId)
  return node ? node.data.generation : null
}
