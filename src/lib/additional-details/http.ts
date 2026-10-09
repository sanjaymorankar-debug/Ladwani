import { NextResponse } from 'next/server'
import { Session } from 'next-auth'
import { prisma } from '@/lib/prisma'
import { type DetailsContext } from './access'
import { requestMeta } from './server'

export const json = (body: unknown, status = 200) => NextResponse.json(body, { status })

export function actorFor(session: Session, req: Request) {
  const roles = (((session.user as any)?.roles ?? []) as string[])
  return { userId: session.user!.id as string, role: roles[0] ?? 'MEMBER', ...requestMeta(req) }
}

/**
 * Rule 7: every view of another person's Additional Details is logged. Views
 * of one's own details (or by the person who maintains them) are not.
 */
export async function auditView(ctx: DetailsContext, session: Session, req: Request, sections: string[], what = 'sections') {
  if (ctx.canEdit || ctx.isOwn || !sections.length) return
  const { ipAddress, userAgent } = requestMeta(req)
  const roles = (((session.user as any)?.roles ?? []) as string[])
  await prisma.auditLog.create({
    data: {
      actorId: session.user!.id as string,
      actorRole: roles[0] ?? 'MEMBER',
      action: 'additional_details.view',
      entityType: 'member',
      entityId: ctx.member!.id,
      ipAddress,
      userAgent,
      metadata: { sections, what, viewerLevel: ctx.viewerLevel },
    },
  })
}
