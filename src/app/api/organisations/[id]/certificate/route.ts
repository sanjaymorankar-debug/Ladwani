import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { readDecrypted } from '@/lib/secure-files'
import { recordAudit } from '@/lib/audit'
import { OFFICES } from '@/lib/organisations'

/**
 * F26 certificate (stored encrypted): the applicant, the office bearers,
 * Admins, and the Operators holding a verification task for it. Audited.
 */
export async function GET(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
  const roles = ((session.user as any).roles ?? []) as string[]
  const memberId = (session.user as any).memberId as string | null
  const org = await prisma.organisation.findUnique({ where: { id: params.id } })
  if (!org?.certificateKey) return NextResponse.json({ message: 'Not found' }, { status: 404 })
  const officer = memberId && await prisma.organisationMember.findFirst({
    where: { organisationId: org.id, memberId, status: 'ACTIVE', designation: { in: [...OFFICES] } },
  })
  const operator = roles.includes('OPERATOR') && await prisma.approvalTask.findFirst({ where: { organisationId: org.id, operatorUserId: session.user.id, supersededAt: null } })
  if (!roles.includes('ADMIN') && org.applicantUserId !== session.user.id && !officer && !operator) {
    return NextResponse.json({ message: 'Not found' }, { status: 404 })
  }
  const file = await readDecrypted(org.certificateKey)
  await recordAudit({ actorId: session.user.id, action: 'organisation.certificate.view', entityType: 'organisation', entityId: org.id }, req)
  return new NextResponse(new Uint8Array(file), {
    headers: { 'Content-Type': org.certificateMime ?? 'application/octet-stream', 'Cache-Control': 'private, no-store', 'Content-Disposition': 'inline' },
  })
}
