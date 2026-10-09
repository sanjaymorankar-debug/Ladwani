import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getDetailsContext } from '@/lib/additional-details/access'
import { actorFor, json } from '@/lib/additional-details/http'

/** The member's own support requests (the editor's view). */
export async function GET(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return json({ message: 'Unauthorized' }, 401)
  const ctx = await getDetailsContext(session, params.id)
  if (!ctx.exists) return json({ message: 'Not found' }, 404)
  if (!ctx.canEdit) return json({ message: 'Forbidden' }, 403)
  const requests = await prisma.supportRequest.findMany({ where: { memberId: params.id }, orderBy: { createdAt: 'desc' } })
  return json({ requests })
}

/** Withdraw a shared request at any time (rule 3). body: { requestId } */
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return json({ message: 'Unauthorized' }, 401)
  const ctx = await getDetailsContext(session, params.id)
  if (!ctx.exists) return json({ message: 'Not found' }, 404)
  if (!ctx.canEdit) return json({ message: 'Forbidden' }, 403)
  const body = await req.json().catch(() => ({}))
  const request = body.requestId ? await prisma.supportRequest.findUnique({ where: { id: String(body.requestId) } }) : null
  if (!request || request.memberId !== params.id) return json({ message: 'Request not found' }, 404)
  if (request.status !== 'OPEN') return json({ message: 'This request is no longer open' }, 409)

  const actor = actorFor(session, req)
  await prisma.$transaction([
    prisma.supportRequest.update({ where: { id: request.id }, data: { status: 'WITHDRAWN', withdrawnAt: new Date() } }),
    prisma.auditLog.create({
      data: {
        actorId: actor.userId, actorRole: actor.role, action: 'support_request.withdraw', entityType: 'support_request',
        entityId: request.id, ipAddress: actor.ipAddress, userAgent: actor.userAgent, metadata: { memberId: params.id, category: request.category },
      },
    }),
  ])
  return json({ message: 'Request withdrawn' })
}
