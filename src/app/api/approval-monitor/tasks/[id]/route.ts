import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { isActiveAdmin } from '@/lib/scope'
import { reassignTask, reopenTask } from '@/lib/verification'

/** F07 step 4 — Admin only: { action: 'reassign', operatorUserId } or { action: 'reopen' }. */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id || !(await isActiveAdmin(session.user.id))) {
    return NextResponse.json({ message: 'Forbidden' }, { status: 403 })
  }
  const body = await req.json().catch(() => ({}))
  const result = body.action === 'reassign'
    ? await reassignTask(params.id, String(body.operatorUserId ?? ''), session.user.id, req)
    : body.action === 'reopen'
      ? await reopenTask(params.id, session.user.id, req)
      : { ok: false as const, status: 400, message: 'Unknown action' }
  if (!result.ok) return NextResponse.json({ message: result.message }, { status: result.status })
  return NextResponse.json({ message: result.outcome === 'REASSIGNED' ? 'Task reassigned' : 'Task reopened' })
}
