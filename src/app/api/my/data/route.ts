import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { exportOwnData } from '@/lib/data-rights'
import { recordAudit } from '@/lib/audit'

/** F40 step 2: download my own data (JSON). Audited. */
export async function GET(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
  const data = await exportOwnData(session.user.id)
  await recordAudit({ actorId: session.user.id, action: 'data.export.self', entityType: 'user', entityId: session.user.id }, req)
  return new NextResponse(JSON.stringify(data, (_k, v) => (typeof v === 'bigint' ? Number(v) : v), 2), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="my-ladwani-data-${new Date().toISOString().slice(0, 10)}.json"`,
      'Cache-Control': 'no-store',
    },
  })
}
