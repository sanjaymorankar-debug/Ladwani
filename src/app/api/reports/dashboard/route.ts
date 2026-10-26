import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getViewerScope } from '@/lib/scope'
import { recordAudit } from '@/lib/audit'
import { districtCounts, ageDistribution, educationDistribution, operatorSla, toCsv } from '@/lib/dashboard'

const REPORTS = ['districts', 'age', 'education', 'sla'] as const

/**
 * F39 dashboards and reports, within the viewer's scope (Admin / National:
 * all; State team: own state; District team: own district). The Operator SLA
 * report is Admin only. `?export=<report>` downloads a CSV (Excel) — Admin,
 * or a team member granted DATA_EXPORT; every export is audited.
 */
export async function GET(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
  const scope = await getViewerScope(session.user.id)
  if (scope.level === 'NONE') return NextResponse.json({ message: 'Reports are for Admins and the District, State and National teams' }, { status: 403 })

  const exportName = new URL(req.url).searchParams.get('export')
  if (exportName) {
    if (!(REPORTS as readonly string[]).includes(exportName)) return NextResponse.json({ message: 'Unknown report' }, { status: 400 })
    if (!scope.canExport) return NextResponse.json({ message: 'Export needs Admin permission' }, { status: 403 })
    if (exportName === 'sla' && !scope.isAdmin) return NextResponse.json({ message: 'The Operator SLA report is for Admins' }, { status: 403 })
    const rows: Record<string, unknown>[] = exportName === 'districts' ? (await districtCounts(scope)).map(({ stateId, districtId, ...r }) => r)
      : exportName === 'age' ? await ageDistribution(scope)
      : exportName === 'education' ? await educationDistribution(scope)
      : (await operatorSla()).map(({ operatorUserId, ...r }) => r)
    await recordAudit({ actorId: session.user.id, action: 'report.export', entityType: 'report', metadata: { report: exportName, rows: rows.length, scope: scope.level } }, req)
    return new NextResponse(toCsv(rows), {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="ladwani-${exportName}-${new Date().toISOString().slice(0, 10)}.csv"`,
        'Cache-Control': 'no-store',
      },
    })
  }

  const [districts, age, education, sla] = await Promise.all([
    districtCounts(scope), ageDistribution(scope), educationDistribution(scope), scope.isAdmin ? operatorSla() : Promise.resolve(null),
  ])
  const totals = districts.reduce((t, r) => ({
    families: t.families + r.families, members: t.members + r.members, pendingApprovals: t.pendingApprovals + r.pendingApprovals, organisations: t.organisations + r.organisations,
  }), { families: 0, members: 0, pendingApprovals: 0, organisations: 0 })
  return NextResponse.json({ scope: scope.level, canExport: scope.canExport, isAdmin: scope.isAdmin, totals, districts, age, education, sla })
}
