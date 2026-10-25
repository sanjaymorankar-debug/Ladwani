import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getTeamScope } from '@/lib/additional-details/access'
import { namedSupportRequests, supportReport } from '@/lib/community-connect'
import { actorFor, json } from '@/lib/additional-details/http'

/**
 * Community support list (rule 3). The District team sees named requests for
 * its own district; State and National teams (and Admin/Operators) see counts
 * only, never names.
 */
export async function GET(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return json({ message: 'Unauthorized' }, 401)
  const scope = await getTeamScope(session)
  if (!scope.any) return json({ message: 'Forbidden' }, 403)

  const [counts, named] = await Promise.all([supportReport(scope), namedSupportRequests(scope)])
  if (named.length) {
    const actor = actorFor(session, req)
    await prisma.auditLog.create({
      data: {
        actorId: actor.userId, actorRole: actor.role, action: 'additional_details.view', entityType: 'support_request_list',
        ipAddress: actor.ipAddress, userAgent: actor.userAgent,
        metadata: { districts: scope.districts, memberIds: Array.from(new Set(named.map((n) => n.member.id))) },
      },
    })
  }
  return json({ scope: { districts: scope.districts, states: scope.states, national: scope.national }, counts, requests: named })
}

/** District team marks a request as handled. body: { requestId } */
export async function PATCH(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return json({ message: 'Unauthorized' }, 401)
  const scope = await getTeamScope(session)
  const body = await req.json().catch(() => ({}))
  const request = body.requestId ? await prisma.supportRequest.findUnique({ where: { id: String(body.requestId) } }) : null
  if (!request || request.status !== 'OPEN') return json({ message: 'Request not found' }, 404)
  if (!request.district || !scope.districts.includes(request.district.toLowerCase())) return json({ message: 'Forbidden' }, 403)
  const actor = actorFor(session, req)
  await prisma.$transaction([
    prisma.supportRequest.update({ where: { id: request.id }, data: { status: 'CLOSED', closedAt: new Date(), closedBy: actor.userId } }),
    prisma.auditLog.create({
      data: { actorId: actor.userId, actorRole: actor.role, action: 'support_request.close', entityType: 'support_request', entityId: request.id },
    }),
  ])
  return json({ message: 'Marked as handled' })
}
