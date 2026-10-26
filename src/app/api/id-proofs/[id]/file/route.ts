import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { recordAudit } from '@/lib/audit'
import { canViewIdProof } from '@/lib/verification'
import { isActiveAdmin } from '@/lib/scope'
import { readDecrypted } from '@/lib/secure-files'

/**
 * Rule 7 / F33: an ID proof file is visible only to its owner, an Admin, and
 * an Operator while holding an undecided task for that person. Every view is
 * audit-logged. ?kind=proof (default) or ?kind=selfSigned.
 */
export async function GET(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })

  const proof = await prisma.idProof.findUnique({ where: { id: params.id } })
  const isAdmin = await isActiveAdmin(session.user.id)
  if (!proof || !(await canViewIdProof(session.user.id, proof, isAdmin))) {
    return NextResponse.json({ message: 'Not found' }, { status: 404 })
  }
  const kind = new URL(req.url).searchParams.get('kind') === 'selfSigned' ? 'selfSigned' : 'proof'

  await recordAudit({
    actorId: session.user.id, actorRole: isAdmin ? 'ADMIN' : proof.userId === session.user.id ? 'SELF' : 'OPERATOR',
    action: 'id_proof.view', entityType: 'id_proof', entityId: proof.id,
    metadata: { kind, subjectUserId: proof.userId },
  }, req)

  const body = await readDecrypted(kind === 'proof' ? proof.proofKey : proof.selfSignedKey)
  return new NextResponse(new Uint8Array(body), {
    headers: {
      'Content-Type': kind === 'proof' ? proof.proofMime : proof.selfSignedMime,
      'Content-Disposition': 'inline',
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  })
}
