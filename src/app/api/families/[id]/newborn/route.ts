import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { canManageFamily, getFamilyAccess } from '@/lib/family-auth'
import { requireActiveAccount } from '@/lib/account-state'
import { generateMemberNumber } from '@/lib/utils'
import { recordAudit, requestIp } from '@/lib/audit'
import { notifyUser } from '@/lib/notify'
import { familyUserIds } from '@/lib/family-rules'
import { bloodRelated } from '@/lib/relations'

/**
 * F13 — the Karta adds a new-born. Both parents must be active members of the
 * family. The child gets no login and no ID proof, is linked as son/daughter
 * of both parents, and may be named "Baby of <mother>" until a name is chosen.
 * OP-07: a minor's data needs parental consent — recorded against the Karta
 * who adds the child. Family members are told.
 */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
  const notActive = await requireActiveAccount(session.user.id)
  if (notActive) return notActive
  if (!(await canManageFamily(session, params.id))) {
    return NextResponse.json({ message: "Only this family's Karta can add a new-born" }, { status: 403 })
  }
  const access = await getFamilyAccess(session, params.id)

  const body = await req.json().catch(() => ({}))
  if (!['MALE', 'FEMALE', 'OTHER'].includes(body.gender)) return NextResponse.json({ message: 'Select the baby\'s gender' }, { status: 400 })
  const born = new Date(body.dateOfBirth)
  if (!body.dateOfBirth || Number.isNaN(born.getTime())) return NextResponse.json({ message: 'Birth date is required' }, { status: 400 })
  if (born > new Date()) return NextResponse.json({ message: 'Birth date cannot be in the future' }, { status: 400 })

  const parents = await prisma.familyMember.findMany({
    where: { familyId: params.id, leftAt: null, memberId: { in: [String(body.fatherId ?? ''), String(body.motherId ?? '')] } },
    include: { member: { select: { id: true, gender: true, firstName: true, lastName: true, dateOfBirth: true, status: true } } },
  })
  const father = parents.find((p) => p.memberId === body.fatherId)?.member
  const mother = parents.find((p) => p.memberId === body.motherId)?.member
  if (!father || !mother) return NextResponse.json({ message: 'Choose the father and the mother from this family' }, { status: 400 })
  if (father.gender !== 'MALE' || mother.gender !== 'FEMALE') return NextResponse.json({ message: 'Check the parents: father must be male, mother female' }, { status: 400 })
  if (await bloodRelated(father.id, mother.id)) {
    return NextResponse.json({ message: 'These two are recorded as blood relatives. Check the father and mother.' }, { status: 400 })
  }
  for (const p of [father, mother]) {
    if (p.dateOfBirth && born <= p.dateOfBirth) return NextResponse.json({ message: 'Birth date must be after the parents\' dates of birth' }, { status: 400 })
  }

  const firstName = String(body.firstName ?? '').trim() || `Baby of ${mother.firstName}`
  const childRole = body.gender === 'FEMALE' ? 'daughter' : 'son'
  const actorId = session.user.id

  const child = await prisma.$transaction(async (tx) => {
    const created = await tx.member.create({
      data: {
        memberNumber: generateMemberNumber(), firstName, lastName: father.lastName ?? null, gender: body.gender,
        dateOfBirth: born, maritalStatus: 'UNMARRIED', status: 'ACTIVE', createdBy: actorId,
      },
    })
    await tx.familyMember.create({
      data: { familyId: params.id, memberId: created.id, joinedBy: actorId, relationshipRole: childRole, relativeToMemberId: father.id },
    })
    const types = await tx.relationshipType.findMany({ where: { code: { in: [childRole, 'father', 'mother'] } } })
    const t = (code: string) => types.find((x) => x.code === code)!
    for (const [from, to, code] of [
      [created.id, father.id, childRole], [created.id, mother.id, childRole],
      [father.id, created.id, 'father'], [mother.id, created.id, 'mother'],
    ] as const) {
      await tx.memberRelationship.create({ data: { fromMemberId: from, toMemberId: to, relationshipTypeId: t(code).id, familyId: params.id, createdBy: actorId } })
    }
    // OP-07: parental consent for a minor's data, by the adding Karta.
    await tx.consentRecord.create({
      data: {
        userId: actorId, consentType: 'MINOR_DATA_PARENTAL', granted: true, version: '1.0',
        ipAddress: requestIp(req), userAgent: req.headers.get('user-agent'),
      },
    })
    await recordAudit({
      actorId, actorRole: access.isStaff ? 'ADMIN' : 'KARTA', action: 'family.newborn.add', entityType: 'member', entityId: created.id,
      newValue: { firstName, gender: body.gender, dateOfBirth: born, fatherId: father.id, motherId: mother.id, familyId: params.id },
    }, req, tx)
    return created
  })

  const family = await prisma.family.findUnique({ where: { id: params.id }, select: { name: true } })
  for (const userId of await familyUserIds(params.id, actorId)) {
    await notifyUser({
      userId, type: 'NEW_BORN', title: `New arrival in the ${family?.name ?? ''} family`,
      body: `${firstName} was added to the family.`, data: { familyId: params.id, memberId: child.id },
    })
  }
  return NextResponse.json({ message: 'New-born added', memberId: child.id, name: firstName }, { status: 201 })
}
