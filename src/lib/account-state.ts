import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

/**
 * F01: a new account starts DRAFT and "can only fill own profile" until both
 * operators approve it (F06 → ACTIVE). Routes that do anything else — create
 * or join a family, post, register a group or asset, matrimony — call this
 * first. Accounts that pre-date P1 are already ACTIVE and unaffected.
 */
export const REGISTRATION_STATUSES = ['DRAFT', 'PENDING_APPROVAL', 'CORRECTION_REQUIRED', 'REJECTED'] as const

const MESSAGES: Record<string, string> = {
  DRAFT: 'Complete your profile and submit it for verification first.',
  PENDING_APPROVAL: 'Your registration is being verified. You can do this once it is approved.',
  CORRECTION_REQUIRED: 'Your registration needs a correction. Update your profile and resubmit it first.',
  REJECTED: 'Your registration was not approved.',
}

/** null when the account is ACTIVE; otherwise the 403 response to return. */
export async function requireActiveAccount(userId: string | null | undefined): Promise<NextResponse | null> {
  if (!userId) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { status: true } })
  if (user?.status === 'ACTIVE') return null
  return NextResponse.json(
    { message: MESSAGES[user?.status ?? ''] ?? 'Your account is not active.', accountStatus: user?.status ?? null },
    { status: 403 }
  )
}
