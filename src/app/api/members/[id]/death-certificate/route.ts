import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { readDecrypted } from '@/lib/secure-files'
import { recordAudit } from '@/lib/audit'

/**
 * F12 death certificate (stored encrypted): Admins and Operators only. With
 * `?approvalId=` it reads the one attached to a pending Expired request;
 * otherwise the one on the member's record. Audited.
 */
export async function GET(req: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
  const roles = ((session.user as any).roles ?? []) as string[]
  if (!roles.includes('ADMIN') && !roles.includes('OPERATOR')) return NextResponse.json({ message: 'Not found' }, { status: 404 })

  const approvalId = new URL(req.url).searchParams.get('approvalId')
  let key: string | null | undefined
  let mime: string | null | undefined
  if (approvalId) {
    const approval = await prisma.approval.findFirst({ where: { id: approvalId, actionCode: 'member.mark_deceased', entityId: params.id } })
    const value = approval?.newValue as { certificateKey?: string; certificateMime?: string } | null
    key = value?.certificateKey
    mime = value?.certificateMime
  } else {
    const member = await prisma.member.findUnique({ where: { id: params.id }, select: { deathCertKey: true, deathCertMime: true } })
    key = member?.deathCertKey
    mime = member?.deathCertMime
  }
  if (!key) return NextResponse.json({ message: 'Not found' }, { status: 404 })

  const file = await readDecrypted(key)
  await recordAudit({ actorId: session.user.id, action: 'member.death_certificate.view', entityType: 'member', entityId: params.id }, req)
  return new NextResponse(new Uint8Array(file), {
    headers: { 'Content-Type': mime ?? 'application/octet-stream', 'Cache-Control': 'private, no-store', 'Content-Disposition': 'inline' },
  })
}
