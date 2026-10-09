import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getViewerScope } from '@/lib/scope'
import { queryDirectory } from '@/lib/directory'

/**
 * F33 — scoped member directory. Admin and National team see everyone,
 * State team their state, District team their district; everyone else gets
 * 403. Scope comes from the database on every request (src/lib/scope.ts).
 */
export async function GET(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })

  const scope = await getViewerScope(session.user.id)
  const url = new URL(req.url)
  const result = await queryDirectory(scope, {
    q: url.searchParams.get('q'),
    areaId: url.searchParams.get('areaId'),
    page: parseInt(url.searchParams.get('page') ?? '1', 10) || 1,
  })
  if (!result.ok) return NextResponse.json({ message: result.message }, { status: result.status })

  return NextResponse.json({
    members: result.rows,
    total: result.total,
    page: result.page,
    pageSize: result.pageSize,
    scope: { level: scope.level, canExport: scope.canExport, canSeeApprovalStatus: scope.canSeeApprovalStatus },
  })
}
