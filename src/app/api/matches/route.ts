import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { json } from '@/lib/additional-details/http'
import { getMatches } from '@/lib/community-connect'

/** Dashboard matching suggestions (Step 3 rule 12) for the signed-in member. */
export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return json({ message: 'Unauthorized' }, 401)
  const memberId = (session.user as any).memberId as string | null
  if (!memberId) return json({ matches: null })
  return json({ matches: await getMatches(memberId) })
}
