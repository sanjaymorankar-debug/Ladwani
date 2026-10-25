import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { isActiveAdmin } from '@/lib/scope'
import { planGroupConversion, applyGroupConversion, undoGroupConversion } from '@/lib/group-conversion'

/** P4 follow-up: preview copying community groups into local organisations (Admin only). */
export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
  if (!(await isActiveAdmin(session.user.id))) return NextResponse.json({ message: 'Forbidden' }, { status: 403 })
  return NextResponse.json(await planGroupConversion())
}

/** POST {action: 'apply' | 'undo'} — copy the ready groups, or remove copies not yet active. */
export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
  if (!(await isActiveAdmin(session.user.id))) return NextResponse.json({ message: 'Forbidden' }, { status: 403 })
  const { action } = await req.json().catch(() => ({}))
  if (action === 'apply') {
    const created = await applyGroupConversion(session.user.id, req)
    return NextResponse.json({ message: `${created.length} group(s) copied. Each now waits for its members to accept and two Operators to verify it.`, created })
  }
  if (action === 'undo') {
    const { removed, kept } = await undoGroupConversion(session.user.id, req)
    return NextResponse.json({ message: `${removed.length} copy(ies) removed${kept.length ? `; ${kept.length} already active and kept` : ''}.`, removed, kept })
  }
  return NextResponse.json({ message: 'Unknown action' }, { status: 400 })
}
