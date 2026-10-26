import { prisma } from '@/lib/prisma'
import { recordAudit } from '@/lib/audit'
import { notifyUser } from '@/lib/notify'

/**
 * F34 / F36 report-abuse. Each person reports an item once. When reports
 * from `moderation.report_threshold` different people (default 3) are open,
 * the item is hidden until a moderator reviews it: restore (reports
 * dismissed) or remove (reports resolved).
 */
export const REPORTABLE = ['post', 'comment', 'photo'] as const
export type Reportable = (typeof REPORTABLE)[number]

export async function reportThreshold() {
  const s = await prisma.setting.findUnique({ where: { key: 'moderation.report_threshold' } })
  const n = Number(typeof s?.value === 'string' ? JSON.parse(s.value) : s?.value)
  return Number.isFinite(n) && n > 0 ? n : 3
}

async function setHidden(type: Reportable, id: string, hidden: boolean, removed = false) {
  if (type === 'post') {
    await prisma.post.update({ where: { id }, data: { status: removed ? 'REMOVED' : hidden ? 'FLAGGED' : 'PUBLISHED' } })
  } else if (type === 'comment') {
    await prisma.comment.update({ where: { id }, data: { status: removed ? 'REMOVED' : hidden ? 'HIDDEN' : 'ACTIVE' } })
  } else {
    await prisma.photo.update({ where: { id }, data: { status: removed ? 'REMOVED' : hidden ? 'FLAGGED' : 'ACTIVE' } })
  }
}

export async function itemExists(type: Reportable, id: string) {
  if (type === 'post') return !!(await prisma.post.findFirst({ where: { id, deletedAt: null } }))
  if (type === 'comment') return !!(await prisma.comment.findFirst({ where: { id, deletedAt: null } }))
  return !!(await prisma.photo.findUnique({ where: { id } }))
}

async function moderatorIds() {
  return (await prisma.user.findMany({
    where: { status: 'ACTIVE', deletedAt: null, userRoles: { some: { role: { code: { in: ['ADMIN', 'OPERATOR'] } } } } }, select: { id: true },
  })).map((u) => u.id)
}

export async function fileReport(type: Reportable, id: string, reporterId: string, reason: string, description?: string | null) {
  const already = await prisma.report.findFirst({ where: { reportableType: type, reportableId: id, reporterId, status: { in: ['PENDING', 'UNDER_REVIEW'] } } })
  if (already) return { duplicate: true, hidden: false }
  await prisma.report.create({ data: { reportableType: type, reportableId: id, reporterId, reason, description: description ?? null } })
  const open = await prisma.report.findMany({ where: { reportableType: type, reportableId: id, status: { in: ['PENDING', 'UNDER_REVIEW'] } }, select: { reporterId: true } })
  const people = new Set(open.map((r) => r.reporterId)).size
  const hidden = people >= (await reportThreshold())
  if (hidden) {
    await setHidden(type, id, true)
    await prisma.report.updateMany({ where: { reportableType: type, reportableId: id, status: 'PENDING' }, data: { status: 'UNDER_REVIEW' } })
    await recordAudit({ actorId: reporterId, action: 'report.auto_hide', entityType: type, entityId: id, newValue: { reports: people }, metadata: { by: 'report-threshold' } })
    for (const userId of await moderatorIds()) {
      await notifyUser({ userId, type: 'REPORT_REVIEW', title: `A ${type} was hidden after ${people} reports`, body: 'Review it in the moderation queue.', data: { type, id } })
    }
  }
  return { duplicate: false, hidden }
}

export async function reviewItem(type: Reportable, id: string, action: 'restore' | 'remove', actorId: string, note?: string | null) {
  await setHidden(type, id, action === 'remove', action === 'remove')
  await prisma.report.updateMany({
    where: { reportableType: type, reportableId: id, status: { in: ['PENDING', 'UNDER_REVIEW'] } },
    data: { status: action === 'remove' ? 'RESOLVED' : 'DISMISSED', resolvedBy: actorId, resolvedAt: new Date(), resolutionNote: note ?? null },
  })
  await recordAudit({ actorId, action: `report.${action}`, entityType: type, entityId: id, newValue: { action, note: note ?? null } })
}
