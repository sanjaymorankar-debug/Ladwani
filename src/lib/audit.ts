import { Prisma, PrismaClient } from '@prisma/client'
import { prisma } from '@/lib/prisma'

type Db = PrismaClient | Prisma.TransactionClient

export interface AuditEntry {
  actorId: string
  actorRole?: string | null
  action: string
  entityType?: string | null
  entityId?: string | null
  fieldName?: string | null
  oldValue?: unknown
  newValue?: unknown
  metadata?: unknown
}

/** Caller IP as seen behind Hostinger's proxy, else null. */
export function requestIp(req?: Request | null): string | null {
  if (!req) return null
  const forwarded = req.headers.get('x-forwarded-for')
  if (forwarded) return forwarded.split(',')[0].trim() || null
  return req.headers.get('x-real-ip')
}

/**
 * Non-negotiable rule 9: every create / update / delete / approval / role
 * change is written to audit_logs with its old and new values. Pass the
 * transaction client when the change itself runs in a transaction, so the
 * log row commits or rolls back with it.
 */
export async function recordAudit(entry: AuditEntry, req?: Request | null, db: Db = prisma) {
  return db.auditLog.create({
    data: {
      actorId: entry.actorId,
      actorRole: entry.actorRole ?? null,
      action: entry.action,
      entityType: entry.entityType ?? null,
      entityId: entry.entityId ?? null,
      fieldName: entry.fieldName ?? null,
      oldValue: (entry.oldValue ?? undefined) as Prisma.InputJsonValue | undefined,
      newValue: (entry.newValue ?? undefined) as Prisma.InputJsonValue | undefined,
      metadata: (entry.metadata ?? undefined) as Prisma.InputJsonValue | undefined,
      ipAddress: requestIp(req),
      userAgent: req?.headers.get('user-agent') ?? null,
    },
  })
}
