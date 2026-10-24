import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { recordAudit } from '@/lib/audit'
import { isActiveAdmin } from '@/lib/scope'

/**
 * Switch one approval rule (§28) on or off: whether its action waits in the
 * review queue or takes effect at once. Only `requiresApproval` is editable.
 * An inactive rule always requires approval (see requiresApproval() in
 * src/lib/approvals.ts), so toggling it would change nothing and is refused.
 *
 * body: { requiresApproval: boolean }
 */
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  const actorId = session?.user?.id as string | undefined
  if (!actorId || !(await isActiveAdmin(actorId))) return NextResponse.json({ message: 'Forbidden' }, { status: 403 })

  const rule = await prisma.approvalRule.findUnique({ where: { id: params.id } })
  if (!rule) return NextResponse.json({ message: 'Not found' }, { status: 404 })

  const body = await req.json().catch(() => ({}))
  if (typeof body.requiresApproval !== 'boolean') {
    return NextResponse.json({ message: 'requiresApproval must be true or false' }, { status: 400 })
  }
  if (!rule.isActive) {
    return NextResponse.json({ message: 'This rule is inactive, so approval is always required' }, { status: 409 })
  }
  if (body.requiresApproval === rule.requiresApproval) return NextResponse.json({ rule })

  const updated = await prisma.$transaction(async (tx) => {
    const u = await tx.approvalRule.update({ where: { id: rule.id }, data: { requiresApproval: body.requiresApproval } })
    await recordAudit({
      actorId, actorRole: 'ADMIN', action: 'approval_rule.update', entityType: 'approval_rule', entityId: rule.id,
      fieldName: 'requiresApproval',
      oldValue: { requiresApproval: rule.requiresApproval }, newValue: { requiresApproval: u.requiresApproval },
      metadata: { actionCode: rule.actionCode },
    }, req, tx)
    return u
  })
  return NextResponse.json({ rule: updated })
}
