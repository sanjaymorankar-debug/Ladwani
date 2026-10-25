import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { isActiveAdmin } from '@/lib/scope'
import { anonymise } from '@/lib/data-rights'
import { recordAudit } from '@/lib/audit'
import { notifyUser } from '@/lib/notify'

/** F40: the Admin completes (anonymises) or rejects (with a reason) a deletion request. */
export async function POST(req: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params
  const session = await getServerSession(authOptions)
  if (!session?.user?.id || !(await isActiveAdmin(session.user.id))) return NextResponse.json({ message: 'Forbidden' }, { status: 403 })
  const body = await req.json().catch(() => ({}))
  if (body.action === 'complete') {
    const result = await anonymise(params.id, session.user.id)
    if (!result.ok) return NextResponse.json({ message: result.message }, { status: 409 })
    return NextResponse.json({ message: 'The person has been anonymised and the login closed' })
  }
  if (body.action === 'reject') {
    const note = String(body.note ?? '').trim()
    if (!note) return NextResponse.json({ message: 'Give the reason' }, { status: 400 })
    const request = await prisma.dataDeletionRequest.findUnique({ where: { id: params.id } })
    if (!request || request.status !== 'PENDING') return NextResponse.json({ message: 'This request is not pending' }, { status: 409 })
    await prisma.dataDeletionRequest.update({ where: { id: request.id }, data: { status: 'REJECTED', note, processedBy: session.user.id, processedAt: new Date() } })
    await recordAudit({ actorId: session.user.id, actorRole: 'ADMIN', action: 'data.deletion.reject', entityType: 'user', entityId: request.userId, newValue: { note } }, req)
    await notifyUser({ userId: request.userId, type: 'DATA_DELETION', title: 'Your deletion request was not completed', body: note, data: { requestId: request.id }, also: ['EMAIL'] })
    return NextResponse.json({ message: 'Request rejected' })
  }
  return NextResponse.json({ message: 'action must be complete or reject' }, { status: 400 })
}
