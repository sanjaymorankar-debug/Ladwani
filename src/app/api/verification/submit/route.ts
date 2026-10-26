import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { submitRegistration } from '@/lib/registration'

/** F03 step 5 / F06 step 3: submit (or, after a send-back, resubmit) for two-operator approval. */
export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
  const result = await submitRegistration(session.user.id, req)
  if (!result.ok) return NextResponse.json({ message: result.message, missing: result.missing }, { status: result.status })
  return NextResponse.json({ message: 'Submitted for verification.', status: result.status })
}
