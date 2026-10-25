import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getDetailsContext } from '@/lib/additional-details/access'
import {
  CONSENT_TEXT, CONSENT_TYPE, CONSENT_VERSION, MINOR_GROUP_CONSENT_TYPE, requestMeta,
} from '@/lib/additional-details/server'
import { json } from '@/lib/additional-details/http'
import { syncMemberGroups } from '@/lib/interest-groups'

/**
 * Rule 4: consent before the first save — stored with the text version,
 * timestamp and IP. For a child or an account-less elder the consent is given
 * by the parent/Karta entering the details, and recorded against the member.
 *
 * body: { agree: true, type?: 'ADDITIONAL_DETAILS' | 'MINOR_GROUPS', version }
 */
export async function POST(req: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return json({ message: 'Unauthorized' }, 401)
  const ctx = await getDetailsContext(session, params.id)
  if (!ctx.exists) return json({ message: 'Not found' }, 404)
  if (!ctx.canEdit) return json({ message: 'Forbidden' }, 403)

  const body = await req.json().catch(() => ({}))
  if (body.agree !== true) return json({ message: 'Tick "I agree" to continue' }, 400)
  const type = body.type === MINOR_GROUP_CONSENT_TYPE ? MINOR_GROUP_CONSENT_TYPE : CONSENT_TYPE
  if (type === CONSENT_TYPE && body.version !== CONSENT_VERSION) {
    return json({ message: 'The consent notice has changed — please read it again.', version: CONSENT_VERSION }, 409)
  }
  if (type === MINOR_GROUP_CONSENT_TYPE && !ctx.isMinor) return json({ message: 'Only needed for members under 18' }, 400)

  const { ipAddress, userAgent } = requestMeta(req)
  const record = await prisma.$transaction(async (tx) => {
    const rec = await tx.consentRecord.create({
      data: {
        userId: session.user!.id as string,
        memberId: params.id,
        consentType: type,
        granted: true,
        version: type === CONSENT_TYPE ? CONSENT_VERSION : 'minor-groups-v1',
        ipAddress,
        userAgent,
      },
    })
    await tx.auditLog.create({
      data: {
        actorId: session.user!.id as string, action: `consent.${type.toLowerCase()}.grant`,
        entityType: 'member', entityId: params.id, ipAddress, userAgent,
        metadata: { version: rec.version, enteredBy: ctx.editorKind },
      },
    })
    return rec
  })
  // Parent/Karta consent is what lets a minor be added to child-safe groups.
  const groups = type === MINOR_GROUP_CONSENT_TYPE ? await syncMemberGroups(params.id, session.user.id as string) : undefined
  return json({ groups, message: 'Thank you', consent: { id: record.id, version: record.version, grantedAt: record.grantedAt } }, 201)
}

export async function GET(req: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return json({ message: 'Unauthorized' }, 401)
  const ctx = await getDetailsContext(session, params.id)
  if (!ctx.exists) return json({ message: 'Not found' }, 404)
  if (!ctx.canEdit) return json({ message: 'Forbidden' }, 403)
  return json({ version: CONSENT_VERSION, text: CONSENT_TEXT })
}
