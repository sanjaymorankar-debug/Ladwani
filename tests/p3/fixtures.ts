import { prisma } from '@/lib/prisma'
import { p2Fixtures } from '../p2/fixtures'

export { actAs, json } from '../p1/fixtures'
export type { Person } from '../p2/fixtures'

/** P2 fixtures, plus cleanup of people the tree builder / marriages created and of tree links. */
export function p3Fixtures(prefix: string) {
  const base = p2Fixtures(prefix)
  async function cleanup() {
    const families = Array.from(new Set([
      ...base.familyIds,
      ...(await prisma.familyMember.findMany({ where: { memberId: { in: base.memberIds } }, select: { familyId: true } })).map((f) => f.familyId),
    ]))
    await prisma.treeLinkRequest.deleteMany({ where: { OR: [{ fromFamilyId: { in: families } }, { toFamilyId: { in: families } }] } })
    // Ancestors, siblings, spouses created through the API, and records retired by a merge.
    const created = await prisma.member.findMany({ where: { createdBy: { in: base.userIds } }, select: { id: true } })
    for (const c of created) if (!base.memberIds.includes(c.id)) base.memberIds.push(c.id)
    await prisma.familyJoinRequest.deleteMany({ where: { memberId: { in: base.memberIds } } })
    await base.cleanup()
  }
  return { ...base, cleanup }
}
