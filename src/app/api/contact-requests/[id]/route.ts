import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { actorFor, json } from '@/lib/additional-details/http'

/** The recipient accepts (shares their number) or declines. body: { action: 'accept' | 'decline' } */
export async function PATCH(req: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return json({ message: 'Unauthorized' }, 401)
  const memberId = (session.user as any).memberId as string | null
  const request = await prisma.contactRequest.findUnique({ where: { id: params.id } })
  if (!request || request.toMemberId !== memberId) return json({ message: 'Not found' }, 404)
  if (request.status !== 'PENDING') return json({ message: 'Already answered' }, 409)
  const body = await req.json().catch(() => ({}))
  if (!['accept', 'decline'].includes(body.action)) return json({ message: 'Accept or decline' }, 400)
  const status = body.action === 'accept' ? 'ACCEPTED' : 'DECLINED'
  await prisma.contactRequest.update({ where: { id: request.id }, data: { status, respondedAt: new Date() } })

  const from = await prisma.member.findUnique({ where: { id: request.fromMemberId }, select: { userId: true } })
  if (from?.userId) {
    await prisma.notification.create({
      data: {
        recipientId: from.userId, senderId: session.user.id as string, type: 'CONTACT_REQUEST',
        title: status === 'ACCEPTED' ? 'Your contact request was accepted' : 'Your contact request was declined',
        body: status === 'ACCEPTED' ? 'Open "My contact requests" to see their number.' : null,
        data: { contactRequestId: request.id },
      },
    })
  }
  const actor = actorFor(session, req)
  await prisma.auditLog.create({ data: { actorId: actor.userId, actorRole: actor.role, action: `contact_request.${body.action}`, entityType: 'contact_request', entityId: request.id } })
  return json({ message: status === 'ACCEPTED' ? 'Accepted — your number is now shared with them' : 'Declined' })
}
