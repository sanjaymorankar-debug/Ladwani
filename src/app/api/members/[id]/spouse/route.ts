import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getMemberAccess } from '@/lib/member-auth'
import { requiresApproval, createApprovalRecord, applySpouseLink, type SpouseLinkPayload } from '@/lib/approvals'
import { legalAgeError, afterMarriage } from '@/lib/marriage'

// Marking a member MARRIED and linking (or recording) their spouse.
// Gated by ApprovalRule('member.marital_status.change') — conservative
// default requires Operator/Admin review since it mutates two people's
// records and the family tree.
// F23: marriage date, legal age (18 F / 21 M), a spouse may be a new person
// record, and once applied each spouse's family Karta is asked to add the
// other (see marriage.ts).
export async function POST(req: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params
  const session = await getServerSession(authOptions)
  const access = await getMemberAccess(session, params.id)
  if (!access.exists) return NextResponse.json({ message: 'Not found' }, { status: 404 })
  if (!access.authorized) return NextResponse.json({ message: 'Forbidden' }, { status: 403 })

  const body = await req.json()
  if (!body.spouseMemberId && !body.externalSpouseName && !body.newSpouse) {
    return NextResponse.json({ message: 'spouseMemberId or externalSpouseName is required' }, { status: 400 })
  }
  if (body.spouseMemberId === params.id) {
    return NextResponse.json({ message: 'A member cannot be linked to themselves' }, { status: 400 })
  }

  let marriageDate: Date | null = null
  if (body.marriageDate) {
    marriageDate = new Date(body.marriageDate)
    if (Number.isNaN(marriageDate.getTime()) || marriageDate > new Date()) {
      return NextResponse.json({ message: 'Marriage date cannot be in the future' }, { status: 400 })
    }
  }
  let newSpouse: SpouseLinkPayload['newSpouse'] = null
  if (!body.spouseMemberId && body.newSpouse) {
    const ns = body.newSpouse
    if (!String(ns.firstName ?? '').trim() || !['MALE', 'FEMALE'].includes(ns.gender)) {
      return NextResponse.json({ message: "Enter the spouse's name and gender" }, { status: 400 })
    }
    if (ns.dateOfBirth && Number.isNaN(new Date(ns.dateOfBirth).getTime())) {
      return NextResponse.json({ message: "The spouse's date of birth is not valid" }, { status: 400 })
    }
    newSpouse = { firstName: String(ns.firstName).trim(), lastName: ns.lastName ? String(ns.lastName).trim() : null, gender: ns.gender, dateOfBirth: ns.dateOfBirth || null }
  }

  // F23: legal age check before "Married" is allowed, for both partners.
  const on = marriageDate ?? new Date()
  const me = await prisma.member.findUnique({ where: { id: params.id }, select: { firstName: true, gender: true, dateOfBirth: true } })
  const spouse = body.spouseMemberId
    ? await prisma.member.findUnique({ where: { id: body.spouseMemberId }, select: { firstName: true, gender: true, dateOfBirth: true } })
    : newSpouse ? { firstName: newSpouse.firstName, gender: newSpouse.gender, dateOfBirth: newSpouse.dateOfBirth ? new Date(newSpouse.dateOfBirth) : null } : null
  if (body.spouseMemberId && !spouse) return NextResponse.json({ message: 'Spouse not found' }, { status: 404 })
  for (const p of [me, spouse]) {
    const err = p && legalAgeError(p, on)
    if (err) return NextResponse.json({ message: err }, { status: 400 })
  }

  const actorId = session!.user!.id as string
  const payload: SpouseLinkPayload = {
    spouseMemberId: body.spouseMemberId ?? null,
    externalSpouseName: body.externalSpouseName ?? null,
    ...(marriageDate ? { marriageDate: marriageDate.toISOString() } : {}),
    ...(newSpouse ? { newSpouse } : {}),
  }

  if (await requiresApproval('member.marital_status.change')) {
    await prisma.$transaction(async (tx) => {
      await createApprovalRecord(tx, {
        actionCode: 'member.marital_status.change',
        entityType: 'member',
        entityId: params.id,
        newValue: payload,
        submittedBy: actorId,
      })
    })
    return NextResponse.json({ message: 'Marital status change submitted for review.' }, { status: 202 })
  }

  const linked = await prisma.$transaction((tx) => applySpouseLink(tx, params.id, payload, actorId))
  if (linked.spouseMemberId) await afterMarriage(params.id, linked.spouseMemberId, actorId)
  return NextResponse.json({ message: 'Marital status updated.', spouseMemberId: linked.spouseMemberId })
}
