import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { profileCompleteness, ID_TYPES } from '@/lib/registration'
import { DECLARATION_TEXT, DECLARATION_VERSION } from '@/lib/declaration'
import { maskIdNumber } from '@/lib/secure-files'

/**
 * F02/F03/F06 — the signed-in user's own verification state. The user sees
 * only their status and the combined reason, never who reviewed or how each
 * operator decided.
 */
export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })

  const user = await prisma.user.findUniqueOrThrow({
    where: { id: session.user.id },
    select: {
      status: true, registrationSubmittedAt: true, registrationDecidedAt: true, registrationNote: true,
      member: { select: { id: true } },
    },
  })
  if (!user.member) return NextResponse.json({ message: 'No member profile' }, { status: 404 })

  const [completeness, proofs, consent, change] = await Promise.all([
    profileCompleteness(user.member.id),
    prisma.idProof.findMany({
      where: { memberId: user.member.id, status: { in: ['ACTIVE', 'PENDING_CHANGE'] } },
      select: { id: true, idType: true, idLast4: true, status: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.consentRecord.findFirst({
      where: { userId: session.user.id, consentType: 'REGISTRATION_DECLARATION', otpReference: { not: null } },
      orderBy: { grantedAt: 'desc' }, select: { version: true, grantedAt: true },
    }),
    prisma.profileChangeRequest.findFirst({
      where: { memberId: user.member.id }, orderBy: { createdAt: 'desc' },
      select: { status: true, createdAt: true, decidedAt: true, reason: true, changes: true },
    }),
  ])

  return NextResponse.json({
    status: user.status,
    submittedAt: user.registrationSubmittedAt,
    decidedAt: user.registrationDecidedAt,
    note: user.registrationNote,
    completeness,
    idProofs: proofs.map((p) => ({ ...p, masked: maskIdNumber(p.idLast4) })),
    idTypes: ID_TYPES,
    declaration: { version: DECLARATION_VERSION, text: DECLARATION_TEXT, agreed: consent },
    latestChangeRequest: change ? { ...change, changes: Object.keys(change.changes as object) } : null,
  })
}
