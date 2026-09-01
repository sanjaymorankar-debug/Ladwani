import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getMemberAccess } from '@/lib/member-auth'
import { requiresApproval, createApprovalRecord, applySpouseLink } from '@/lib/approvals'

// Marking a member MARRIED and linking (or recording) their spouse.
// Gated by ApprovalRule('member.marital_status.change') — conservative
// default requires Operator/Admin review since it mutates two people's
// records and the family tree.
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  const access = await getMemberAccess(session, params.id)
  if (!access.exists) return NextResponse.json({ message: 'Not found' }, { status: 404 })
  if (!access.authorized) return NextResponse.json({ message: 'Forbidden' }, { status: 403 })

  const body = await req.json()
  if (!body.spouseMemberId && !body.externalSpouseName) {
    return NextResponse.json({ message: 'spouseMemberId or externalSpouseName is required' }, { status: 400 })
  }
  if (body.spouseMemberId === params.id) {
    return NextResponse.json({ message: 'A member cannot be linked to themselves' }, { status: 400 })
  }

  const actorId = session!.user!.id as string
  const payload = {
    spouseMemberId: body.spouseMemberId ?? null,
    externalSpouseName: body.externalSpouseName ?? null,
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

  await prisma.$transaction((tx) => applySpouseLink(tx, params.id, payload, actorId))
  return NextResponse.json({ message: 'Marital status updated.' })
}
