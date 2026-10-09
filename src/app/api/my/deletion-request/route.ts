import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { recordAudit } from '@/lib/audit'
import { notifyUser } from '@/lib/notify'

/** F40 step 3: ask for my account to be deleted; an Admin processes it. */
export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
  const requests = await prisma.dataDeletionRequest.findMany({ where: { userId: session.user.id }, orderBy: { createdAt: 'desc' }, select: { id: true, status: true, createdAt: true, processedAt: true, note: true } })
  return NextResponse.json({ requests })
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
  if (await prisma.dataDeletionRequest.findFirst({ where: { userId: session.user.id, status: 'PENDING' } })) {
    return NextResponse.json({ message: 'Your request is already with the Admin' }, { status: 409 })
  }
  const body = await req.json().catch(() => ({}))
  const request = await prisma.dataDeletionRequest.create({
    data: { userId: session.user.id, memberId: (session.user as any).memberId ?? null, reason: body.reason ? String(body.reason).slice(0, 2000) : null },
  })
  await recordAudit({ actorId: session.user.id, action: 'data.deletion.request', entityType: 'user', entityId: session.user.id, metadata: { requestId: request.id } }, req)
  await notifyUser({ userId: session.user.id, type: 'DATA_DELETION', title: 'We have your deletion request', body: 'An Admin will process it. You can cancel it until then.', data: { requestId: request.id }, also: ['EMAIL'] })
  const admins = await prisma.user.findMany({ where: { status: 'ACTIVE', deletedAt: null, userRoles: { some: { role: { code: 'ADMIN' } } } }, select: { id: true } })
  for (const a of admins) await notifyUser({ userId: a.id, type: 'DATA_DELETION', title: 'A member asked for account deletion', body: 'Process it under Admin → Data requests.', data: { requestId: request.id } })
  return NextResponse.json({ message: 'Request sent. An Admin will process it and you will be told.', requestId: request.id }, { status: 201 })
}

export async function DELETE(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
  const done = await prisma.dataDeletionRequest.updateMany({ where: { userId: session.user.id, status: 'PENDING' }, data: { status: 'CANCELLED' } })
  if (!done.count) return NextResponse.json({ message: 'No pending request' }, { status: 404 })
  await recordAudit({ actorId: session.user.id, action: 'data.deletion.cancel', entityType: 'user', entityId: session.user.id }, req)
  return NextResponse.json({ message: 'Request cancelled' })
}
