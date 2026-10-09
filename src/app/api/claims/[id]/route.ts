import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getFamilyAccess } from '@/lib/family-auth'
import { mergeClaim } from '@/lib/claims'
import { recordAudit } from '@/lib/audit'
import { notifyUser } from '@/lib/notify'

/** F17 — the Karta (or an Admin) confirms or rejects a claim: { decision: 'CONFIRM' | 'REJECT', note? }. */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
  const claim = await prisma.profileClaim.findUnique({ where: { id: params.id } })
  if (!claim) return NextResponse.json({ message: 'Not found' }, { status: 404 })
  const access = await getFamilyAccess(session, claim.familyId)
  if (!access.isKarta && !access.isStaff) return NextResponse.json({ message: "Only that family's Karta can confirm a claim" }, { status: 403 })
  if (claim.status !== 'PENDING') return NextResponse.json({ message: 'This claim has already been decided' }, { status: 409 })

  const body = await req.json().catch(() => ({}))
  if (body.decision === 'REJECT') {
    await prisma.profileClaim.update({ where: { id: claim.id }, data: { status: 'REJECTED', decidedBy: session.user.id, decidedAt: new Date(), note: body.note ?? null } })
    await recordAudit({ actorId: session.user.id, action: 'member.claim.reject', entityType: 'profile_claim', entityId: claim.id, oldValue: { status: 'PENDING' }, newValue: { status: 'REJECTED', note: body.note ?? null } }, req)
    await notifyUser({ userId: claim.userId, type: 'PROFILE_CLAIM', title: 'Your profile claim was not confirmed', body: body.note ?? undefined })
    return NextResponse.json({ message: 'Claim rejected' })
  }
  if (body.decision !== 'CONFIRM') return NextResponse.json({ message: 'decision must be CONFIRM or REJECT' }, { status: 400 })

  const target = await prisma.member.findUnique({ where: { id: claim.targetMemberId }, select: { userId: true, deletedAt: true } })
  if (!target || target.userId || target.deletedAt) return NextResponse.json({ message: 'That profile can no longer be claimed' }, { status: 409 })
  const { memberId } = await mergeClaim(claim.id, session.user.id)
  await notifyUser({
    userId: claim.userId, type: 'PROFILE_CLAIM', title: 'Your profile claim is confirmed',
    body: 'Your account is now linked to your family profile. The usual two-operator verification still applies.',
    data: { memberId },
  })
  return NextResponse.json({ message: 'Claim confirmed — the records are merged', memberId })
}
