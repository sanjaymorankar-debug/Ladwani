import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { actorFor, json } from '@/lib/additional-details/http'
import { contactAllowed, findBloodDonors } from '@/lib/community-connect'

/**
 * "Request contact" — from the blood donor finder or a matching suggestion.
 * The recipient's phone number is revealed to the requester only after the
 * recipient accepts.
 */
export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return json({ message: 'Unauthorized' }, 401)
  const memberId = (session.user as any).memberId as string | null
  if (!memberId) return json({ incoming: [], outgoing: [] })
  const name = (m: { firstName: string; lastName: string | null }) => `${m.firstName} ${m.lastName ?? ''}`.trim()
  const [incoming, outgoing] = await Promise.all([
    prisma.contactRequest.findMany({
      where: { toMemberId: memberId }, orderBy: { createdAt: 'desc' }, take: 50,
      include: { fromMember: { select: { id: true, firstName: true, lastName: true, currentCity: true } } },
    }),
    prisma.contactRequest.findMany({
      where: { fromMemberId: memberId }, orderBy: { createdAt: 'desc' }, take: 50,
      include: { toMember: { select: { id: true, firstName: true, lastName: true, currentCity: true, mobilePrimary: true } } },
    }),
  ])
  return json({
    incoming: incoming.map((r) => ({ id: r.id, purpose: r.purpose, message: r.message, status: r.status, createdAt: r.createdAt, from: { id: r.fromMember.id, name: name(r.fromMember), city: r.fromMember.currentCity } })),
    outgoing: outgoing.map((r) => ({
      id: r.id, purpose: r.purpose, status: r.status, createdAt: r.createdAt,
      to: { id: r.toMember.id, name: name(r.toMember), city: r.toMember.currentCity, phone: r.status === 'ACCEPTED' ? r.toMember.mobilePrimary : null },
    })),
  })
}

/** body: { toMemberId, purpose: 'BLOOD_DONOR' | 'CONNECT', message?, bloodGroup?, city? } */
export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return json({ message: 'Unauthorized' }, 401)
  const fromMemberId = (session.user as any).memberId as string | null
  if (!fromMemberId) return json({ message: 'Complete your member profile first' }, 400)
  const body = await req.json().catch(() => ({}))
  const toMemberId = String(body.toMemberId ?? '')
  const purpose = body.purpose === 'BLOOD_DONOR' ? 'BLOOD_DONOR' : 'CONNECT'

  const allowed = await contactAllowed(fromMemberId, toMemberId)
  if (!allowed.ok) return json({ message: allowed.reason }, 403)
  if (purpose === 'BLOOD_DONOR') {
    // Only someone who shows up in the finder can be asked through it.
    const target = await prisma.member.findUnique({ where: { id: toMemberId }, select: { bloodGroup: true, currentCity: true } })
    const listed = target?.bloodGroup && target.currentCity
      ? (await findBloodDonors(target.bloodGroup, target.currentCity, fromMemberId)).some((d) => d.memberId === toMemberId)
      : false
    if (!listed) return json({ message: 'This member is not listed as a donor' }, 404)
  }
  const pending = await prisma.contactRequest.findFirst({ where: { fromMemberId, toMemberId, status: 'PENDING' } })
  if (pending) return json({ message: 'You already have a pending request with this member' }, 409)
  const recentCount = await prisma.contactRequest.count({ where: { fromMemberId, createdAt: { gte: new Date(Date.now() - 86400000) } } })
  if (recentCount >= 20) return json({ message: 'Too many requests today — please try again tomorrow' }, 429)

  const message = typeof body.message === 'string' ? body.message.trim().slice(0, 500) : null
  const request = await prisma.contactRequest.create({ data: { purpose, fromMemberId, toMemberId, message } })
  const [to, from] = await Promise.all([
    prisma.member.findUnique({ where: { id: toMemberId }, select: { userId: true } }),
    prisma.member.findUnique({ where: { id: fromMemberId }, select: { firstName: true, lastName: true } }),
  ])
  if (to?.userId) {
    await prisma.notification.create({
      data: {
        recipientId: to.userId, senderId: session.user.id as string, type: 'CONTACT_REQUEST',
        title: purpose === 'BLOOD_DONOR' ? 'Someone needs blood — can you help?' : 'A member would like to connect',
        body: `${from?.firstName ?? ''} ${from?.lastName ?? ''}`.trim() + (message ? `: ${message}` : ''),
        data: { contactRequestId: request.id },
      },
    })
  }
  const actor = actorFor(session, req)
  await prisma.auditLog.create({ data: { actorId: actor.userId, actorRole: actor.role, action: 'contact_request.create', entityType: 'contact_request', entityId: request.id, metadata: { purpose, toMemberId } } })
  return json({ message: 'Request sent. Their number is shared with you only if they accept.', id: request.id }, 201)
}
