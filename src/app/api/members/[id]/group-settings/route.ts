import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getDetailsContext } from '@/lib/additional-details/access'
import { hasMinorGroupConsent } from '@/lib/additional-details/server'
import { actorFor, json } from '@/lib/additional-details/http'
import { syncMemberGroups } from '@/lib/interest-groups'

/** "Do not auto-add me to groups" (Step 3 rule 4). body: { autoAddToGroups: boolean } */
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return json({ message: 'Unauthorized' }, 401)
  const ctx = await getDetailsContext(session, params.id)
  if (!ctx.exists) return json({ message: 'Not found' }, 404)
  if (!ctx.canEdit) return json({ message: 'Forbidden' }, 403)
  const body = await req.json().catch(() => ({}))
  if (typeof body.autoAddToGroups !== 'boolean') return json({ message: 'autoAddToGroups must be true or false' }, 400)

  await prisma.memberAdditionalDetail.upsert({
    where: { memberId: params.id },
    update: { autoAddToGroups: body.autoAddToGroups },
    create: { memberId: params.id, autoAddToGroups: body.autoAddToGroups },
  })
  const actor = actorFor(session, req)
  await prisma.auditLog.create({
    data: {
      actorId: actor.userId, actorRole: actor.role, action: 'interest_group.auto_add_setting', entityType: 'member',
      entityId: params.id, newValue: { autoAddToGroups: body.autoAddToGroups },
    },
  })
  // Turning it back on applies to the member's current answers straight away.
  const groups = body.autoAddToGroups ? await syncMemberGroups(params.id, actor.userId) : { added: [], removable: [] }
  return json({ message: 'Saved', autoAddToGroups: body.autoAddToGroups, groups })
}

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return json({ message: 'Unauthorized' }, 401)
  const ctx = await getDetailsContext(session, params.id)
  if (!ctx.exists) return json({ message: 'Not found' }, 404)
  if (!ctx.canEdit) return json({ message: 'Forbidden' }, 403)
  const detail = await prisma.memberAdditionalDetail.findUnique({ where: { memberId: params.id }, select: { autoAddToGroups: true } })
  return json({
    autoAddToGroups: detail?.autoAddToGroups !== false,
    isMinor: ctx.isMinor,
    minorConsent: ctx.isMinor ? await hasMinorGroupConsent(params.id) : null,
  })
}
