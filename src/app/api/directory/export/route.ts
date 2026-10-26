import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getViewerScope } from '@/lib/scope'
import { queryDirectory, directoryCsv } from '@/lib/directory'
import { recordAudit } from '@/lib/audit'

/**
 * F33 step 5 — export needs Admin permission: Admin, or a team member the
 * Admin has granted DATA_EXPORT. The export never leaves the viewer's scope,
 * and every export is audit-logged with its filters and row count.
 */
export async function GET(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })

  const scope = await getViewerScope(session.user.id)
  if (scope.level === 'NONE' || !scope.canExport) {
    return NextResponse.json({ message: 'Export needs Admin permission' }, { status: 403 })
  }

  const url = new URL(req.url)
  const filters = { q: url.searchParams.get('q'), areaId: url.searchParams.get('areaId') }
  const result = await queryDirectory(scope, filters, { all: true })
  if (!result.ok) return NextResponse.json({ message: result.message }, { status: result.status })

  await recordAudit({
    actorId: session.user.id,
    action: 'directory.export',
    entityType: 'member',
    metadata: { filters, rows: result.rows.length, scope: scope.level },
  }, req)

  const stamp = new Date().toISOString().slice(0, 10)
  return new NextResponse(directoryCsv(scope, result.rows), {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="ladwani-members-${stamp}.csv"`,
      'Cache-Control': 'no-store',
    },
  })
}
