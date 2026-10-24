import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getFamilyAccess } from '@/lib/family-auth'
import { requireActiveAccount } from '@/lib/account-state'
import { recordAudit } from '@/lib/audit'
import { linkPeople, parentsOf } from '@/lib/relations'
import { parsePerson, createPerson, addMembership, type PersonInput } from '@/lib/tree-edit'
import { ancestorLevels, generationIn } from '@/lib/tree'

/**
 * F19 / F20 — tree builder: add a person's father and mother, as a
 * husband + wife pair, alive or expired, with a full date or a birth year.
 *   F19: the ancestor line, up to `tree.ancestor_levels` generations above
 *        the Karta (OP-02, default 3).
 *   F20: the same on the spouse side — the parents of someone married into
 *        the family.
 * Any member of the family may build it, not only the Karta (owner's decision).
 * Each ancestor is a non-login record, joined to the family with the role
 * father / mother relative to the child.
 */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
  const notActive = await requireActiveAccount(session.user.id)
  if (notActive) return notActive
  const access = await getFamilyAccess(session, params.id)
  if (!access.isMember && !access.isStaff) return NextResponse.json({ message: 'Only members of this family can build its tree' }, { status: 403 })

  const body = await req.json().catch(() => ({}))
  const childId = String(body.childMemberId ?? '')
  const child = await prisma.familyMember.findFirst({
    where: { familyId: params.id, memberId: childId, leftAt: null },
    include: { member: { select: { id: true, firstName: true, dateOfBirth: true } } },
  })
  if (!child) return NextResponse.json({ message: 'Choose a person in this family' }, { status: 400 })

  const existing = await parentsOf(childId)
  if (existing.father || existing.mother) {
    return NextResponse.json({ message: `${child.member.firstName}'s parents are already in the tree` }, { status: 409 })
  }
  const childGen = await generationIn(params.id, childId)
  const levels = await ancestorLevels()
  if ((childGen ?? 0) + 1 > levels) {
    return NextResponse.json({ message: `The tree goes up to ${levels} generations above the Karta` }, { status: 400 })
  }

  const father = parsePerson(body.father as PersonInput, 'father', 'MALE')
  if (typeof father === 'string') return NextResponse.json({ message: father }, { status: 400 })
  const mother = parsePerson(body.mother as PersonInput, 'mother', 'FEMALE')
  if (typeof mother === 'string') return NextResponse.json({ message: mother }, { status: 400 })
  for (const p of [father, mother]) {
    if (p.dateOfBirth && child.member.dateOfBirth && p.dateOfBirth >= child.member.dateOfBirth) {
      return NextResponse.json({ message: 'Parents must be born before the child' }, { status: 400 })
    }
  }

  const actorId = session.user.id
  // Ancestors are a married pair; a surviving partner of an expired one is widowed.
  const status = (self: typeof father, other: typeof father) => (self.deceased ? 'MARRIED' : other.deceased ? 'WIDOWED' : 'MARRIED')
  const result = await prisma.$transaction(async (tx) => {
    const f = await createPerson(tx, father, actorId, status(father, mother))
    const m = await createPerson(tx, mother, actorId, status(mother, father))
    await addMembership(tx, params.id, f.id, 'father', childId, actorId)
    await addMembership(tx, params.id, m.id, 'mother', childId, actorId)
    await linkPeople(tx, f.id, childId, 'father', actorId, params.id)
    await linkPeople(tx, m.id, childId, 'mother', actorId, params.id)
    await linkPeople(tx, f.id, m.id, 'husband', actorId, params.id)
    await tx.marriageRecord.create({
      data: { memberId1: f.id, memberId2: m.id, status: father.deceased || mother.deceased ? 'WIDOWED' : 'MARRIED', createdBy: actorId },
    })
    await recordAudit({
      actorId, actorRole: access.isStaff ? 'ADMIN' : access.isKarta ? 'KARTA' : 'MEMBER',
      action: 'family.tree.parents.add', entityType: 'member', entityId: childId,
      newValue: { familyId: params.id, fatherId: f.id, motherId: m.id, father: father.firstName, mother: mother.firstName },
    }, req, tx)
    return { fatherId: f.id, motherId: m.id }
  })
  return NextResponse.json({ message: 'Parents added', ...result }, { status: 201 })
}
