import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getFamilyAccess } from '@/lib/family-auth'
import { requireActiveAccount } from '@/lib/account-state'
import { recordAudit } from '@/lib/audit'
import { genderedCode, linkPeople, parentsOf, CHILD_CODES } from '@/lib/relations'
import { parsePerson, createPerson, addMembership, type PersonInput } from '@/lib/tree-edit'

/**
 * F21 — add a brother or sister of anyone in the tree (any level). The
 * sibling shares the person's recorded parents automatically. "Has own
 * family on site" leaves a link placeholder to that family, completed later
 * by choosing the matching person there (F22).
 */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
  const notActive = await requireActiveAccount(session.user.id)
  if (notActive) return notActive
  const access = await getFamilyAccess(session, params.id)
  if (!access.isMember && !access.isStaff) return NextResponse.json({ message: 'Only members of this family can add to its tree' }, { status: 403 })

  const body = await req.json().catch(() => ({}))
  const ofId = String(body.ofMemberId ?? '')
  const of = await prisma.familyMember.findFirst({
    where: { familyId: params.id, memberId: ofId, leftAt: null },
    include: { member: { select: { id: true, firstName: true, lastName: true } } },
  })
  if (!of) return NextResponse.json({ message: 'Choose a person in this family' }, { status: 400 })
  const person = parsePerson(body as PersonInput, 'sibling')
  if (typeof person === 'string') return NextResponse.json({ message: person }, { status: 400 })
  if (!person.lastName) person.lastName = of.member.lastName

  const parents = await parentsOf(ofId)
  // Duplicate: the same first name already a child of these parents, or already a sibling.
  const siblingIds = new Set<string>()
  if (parents.all.length) {
    const kids = await prisma.memberRelationship.findMany({
      where: { isActive: true, toMemberId: { in: parents.all.map((p) => p.id) }, relationshipType: { code: { in: CHILD_CODES } } },
      select: { fromMemberId: true },
    })
    kids.forEach((k) => siblingIds.add(k.fromMemberId))
  }
  const direct = await prisma.memberRelationship.findMany({
    where: { isActive: true, toMemberId: ofId, relationshipType: { code: { in: ['brother', 'sister'] } } }, select: { fromMemberId: true },
  })
  direct.forEach((d) => siblingIds.add(d.fromMemberId))
  siblingIds.add(ofId)
  const clash = await prisma.member.findFirst({
    where: { id: { in: Array.from(siblingIds) }, deletedAt: null, firstName: person.firstName },
    select: { id: true },
  })
  if (clash) return NextResponse.json({ message: `${person.firstName} is already recorded as ${of.member.firstName}'s sibling`, duplicateMemberId: clash.id }, { status: 409 })

  let linkFamilyId: string | null = null
  if (body.linkFamilyId) {
    const target = await prisma.family.findUnique({ where: { id: String(body.linkFamilyId) }, select: { id: true } })
    if (!target || target.id === params.id) return NextResponse.json({ message: 'Choose the other family from the search' }, { status: 400 })
    linkFamilyId = target.id
  }

  const actorId = session.user.id
  const role = genderedCode('brother', person.gender)
  const created = await prisma.$transaction(async (tx) => {
    const sib = await createPerson(tx, person, actorId)
    await addMembership(tx, params.id, sib.id, role, ofId, actorId)
    await linkPeople(tx, sib.id, ofId, 'brother', actorId, params.id)
    for (const p of parents.all) await linkPeople(tx, p.id, sib.id, p.gender === 'FEMALE' ? 'mother' : 'father', actorId, params.id)
    if (linkFamilyId) {
      await tx.treeLinkRequest.create({
        data: { fromFamilyId: params.id, fromMemberId: sib.id, toFamilyId: linkFamilyId, status: 'PLACEHOLDER', requestedBy: actorId },
      })
    }
    await recordAudit({
      actorId, actorRole: access.isStaff ? 'ADMIN' : access.isKarta ? 'KARTA' : 'MEMBER',
      action: 'family.tree.sibling.add', entityType: 'member', entityId: sib.id,
      newValue: { familyId: params.id, siblingOf: ofId, firstName: person.firstName, gender: person.gender, linkFamilyId },
    }, req, tx)
    return sib
  })
  return NextResponse.json({ message: 'Sibling added', memberId: created.id, linkPlaceholder: !!linkFamilyId }, { status: 201 })
}
