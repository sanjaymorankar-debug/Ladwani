import fs from 'fs/promises'
import path from 'path'
import { prisma } from '@/lib/prisma'
import { p3Fixtures } from '../p3/fixtures'

export { actAs, json } from '../p1/fixtures'
export { PNG } from '../p1/fixtures'
export type { Person } from '../p2/fixtures'

/** P3 fixtures plus cleanup of organisations, LadWani bodies in the test areas, seats and certificates. */
export function p4Fixtures(prefix: string) {
  const base = p3Fixtures(prefix)
  async function cleanup() {
    const orgs = await prisma.organisation.findMany({
      where: { OR: [{ applicantUserId: { in: base.userIds } }, { areaId: { in: base.areaIds } }] }, select: { id: true, certificateKey: true },
    })
    const ids = orgs.map((o) => o.id)
    await prisma.userRole.deleteMany({ where: { bodySeatId: { not: null }, userId: { in: base.userIds } } })
    await prisma.bodySeat.deleteMany({ where: { OR: [{ fromOrganisationId: { in: ids } }, { toOrganisationId: { in: ids } }] } })
    await prisma.organisationMember.deleteMany({ where: { organisationId: { in: ids } } })
    await prisma.approvalTask.deleteMany({ where: { organisationId: { in: ids } } })
    await prisma.auditLog.deleteMany({ where: { entityId: { in: ids } } })
    await prisma.organisation.deleteMany({ where: { id: { in: ids } } })
    const root = path.resolve(process.env.UPLOAD_DIR || 'uploads')
    for (const o of orgs) if (o.certificateKey) await fs.rm(path.join(root, o.certificateKey), { force: true })
    await base.cleanup()
  }
  return { ...base, cleanup }
}
