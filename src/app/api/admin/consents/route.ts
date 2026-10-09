import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { isActiveAdmin } from '@/lib/scope'
import { recordAudit } from '@/lib/audit'
import { toCsv } from '@/lib/dashboard'

/** F40 step 4: search consent records (name, email, Person ID, type, dates); CSV export. Admin only. */
export async function GET(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id || !(await isActiveAdmin(session.user.id))) return NextResponse.json({ message: 'Forbidden' }, { status: 403 })
  const p = new URL(req.url).searchParams
  const q = (p.get('q') ?? '').trim()
  const where: any = {}
  if (p.get('type')) where.consentType = p.get('type')
  if (p.get('from') || p.get('to')) where.grantedAt = { ...(p.get('from') ? { gte: new Date(p.get('from')!) } : {}), ...(p.get('to') ? { lte: new Date(`${p.get('to')}T23:59:59`) } : {}) }
  if (q) where.user = { OR: [{ email: { contains: q } }, { mobile: { contains: q } }, { member: { OR: [{ firstName: { contains: q } }, { lastName: { contains: q } }, { memberNumber: { contains: q } }] } }] }
  const rows = await prisma.consentRecord.findMany({
    where, orderBy: { grantedAt: 'desc' }, take: 500,
    select: {
      id: true, consentType: true, granted: true, version: true, grantedAt: true, revokedAt: true, ipAddress: true, otpReference: true,
      user: { select: { email: true, member: { select: { firstName: true, lastName: true, memberNumber: true } } } },
    },
  })
  const flat = rows.map((r) => ({
    when: r.grantedAt.toISOString(), person: r.user.member ? [r.user.member.firstName, r.user.member.lastName].filter(Boolean).join(' ') : '',
    personId: r.user.member?.memberNumber ?? '', email: r.user.email ?? '', type: r.consentType, granted: r.granted, version: r.version ?? '',
    revokedAt: r.revokedAt?.toISOString() ?? '', ip: r.ipAddress ?? '', otpReference: r.otpReference ?? '',
  }))
  if (p.get('export') === 'csv') {
    await recordAudit({ actorId: session.user.id, action: 'consent.export', entityType: 'consent_record', metadata: { rows: flat.length, q, type: p.get('type') } }, req)
    return new NextResponse(toCsv(flat), { headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': 'attachment; filename="ladwani-consents.csv"', 'Cache-Control': 'no-store' } })
  }
  return NextResponse.json({ consents: flat })
}
