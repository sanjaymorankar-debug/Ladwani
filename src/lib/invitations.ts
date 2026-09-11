import { createHash, randomBytes } from 'crypto'
import { prisma } from '@/lib/prisma'

/** How long a profile-claim invitation stays valid. */
export const INVITATION_TTL_DAYS = 14

/**
 * Invitation tokens follow the same rule as password-reset tokens: the raw
 * token exists only in the email we send, and only its SHA-256 is stored. A
 * leak of the database therefore doesn't let anyone claim a profile.
 *
 * SHA-256 (not bcrypt) is deliberate here — the token is 32 random bytes, so
 * there's nothing to brute-force, and lookup has to be by exact hash.
 */
export function generateInvitationToken() {
  const token = randomBytes(32).toString('hex')
  return { token, tokenHash: hashInvitationToken(token) }
}

export function hashInvitationToken(token: string) {
  return createHash('sha256').update(token).digest('hex')
}

export function invitationExpiry(from = new Date()) {
  return new Date(from.getTime() + INVITATION_TTL_DAYS * 86400000)
}

export interface InvitationLookup {
  ok: boolean
  reason?: 'NOT_FOUND' | 'ALREADY_USED' | 'REVOKED' | 'EXPIRED' | 'ALREADY_LINKED'
  invitation?: Awaited<ReturnType<typeof findInvitationRecord>>
}

async function findInvitationRecord(tokenHash: string) {
  return prisma.memberInvitation.findUnique({
    where: { tokenHash },
    include: {
      member: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          userId: true,
          families: {
            where: { leftAt: null },
            take: 1,
            select: { family: { select: { name: true } } },
          },
        },
      },
    },
  })
}

/**
 * Resolves a raw token to a usable invitation, or an explicit reason why not.
 * Every rejection path is distinguished so the claim page can say something
 * true ("this link has expired") instead of a generic failure.
 */
export async function resolveInvitation(token: string): Promise<InvitationLookup> {
  if (!token) return { ok: false, reason: 'NOT_FOUND' }

  const invitation = await findInvitationRecord(hashInvitationToken(token))
  if (!invitation) return { ok: false, reason: 'NOT_FOUND' }

  if (invitation.status === 'ACCEPTED') return { ok: false, reason: 'ALREADY_USED', invitation }
  if (invitation.status === 'REVOKED') return { ok: false, reason: 'REVOKED', invitation }
  if (invitation.expiresAt.getTime() < Date.now()) return { ok: false, reason: 'EXPIRED', invitation }

  // Someone else may have linked this profile to an account since the
  // invitation was sent — claiming it now would hijack a live account.
  if (invitation.member.userId) return { ok: false, reason: 'ALREADY_LINKED', invitation }

  return { ok: true, invitation }
}

export function invitationRejectionMessage(reason: InvitationLookup['reason']) {
  switch (reason) {
    case 'EXPIRED':
      return 'This invitation has expired. Ask the person who invited you to send a new one.'
    case 'ALREADY_USED':
      return 'This invitation has already been used. Try signing in instead.'
    case 'REVOKED':
      return 'This invitation was cancelled. Ask the person who invited you to send a new one.'
    case 'ALREADY_LINKED':
      return 'This profile already has an account. Try signing in, or use "forgot password".'
    default:
      return 'This invitation link is not valid.'
  }
}

export function invitationEmailTemplate(opts: {
  memberName: string
  inviterName: string
  familyName?: string | null
  url: string
}) {
  const { memberName, inviterName, familyName, url } = opts
  const family = familyName ? ` of the ${familyName} family` : ''
  return {
    subject: `${inviterName} has invited you to Mi Ladwani`,
    text:
      `Hello ${memberName},\n\n` +
      `${inviterName} has created a profile for you${family} on Mi Ladwani, ` +
      `the Ladwani Samaj community platform, and invited you to take it over.\n\n` +
      `Set your password and claim your profile here:\n${url}\n\n` +
      `This link works once and expires in ${INVITATION_TTL_DAYS} days.\n\n` +
      `If you weren't expecting this, you can ignore this email — nothing will change.\n`,
    html: `
      <div style="font-family:system-ui,-apple-system,'Segoe UI',sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#1f2937">
        <h1 style="font-size:20px;margin:0 0 4px">Mi Ladwani</h1>
        <p style="color:#6b7280;margin:0 0 24px;font-size:14px">Ladwani Samaj community platform</p>
        <p>Hello ${memberName},</p>
        <p><strong>${inviterName}</strong> has created a profile for you${family} and invited you to take it over.</p>
        <p style="margin:28px 0">
          <a href="${url}" style="background:#ea7317;color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;display:inline-block;font-weight:600">
            Claim your profile
          </a>
        </p>
        <p style="color:#6b7280;font-size:13px">
          This link works once and expires in ${INVITATION_TTL_DAYS} days.
          If the button doesn't work, copy this into your browser:<br>
          <span style="word-break:break-all">${url}</span>
        </p>
        <p style="color:#6b7280;font-size:13px">
          If you weren't expecting this, you can ignore this email — nothing will change.
        </p>
      </div>`,
  }
}
