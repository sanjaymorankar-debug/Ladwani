import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getTeamScope } from '@/lib/additional-details/access'
import { json } from '@/lib/additional-details/http'
import { groupReport, supportReport } from '@/lib/community-connect'

/** Dashboard counts, scoped to the caller's role. Counts only — never names. */
export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return json({ message: 'Unauthorized' }, 401)
  const scope = await getTeamScope(session)
  if (!scope.any) return json({ message: 'Forbidden' }, 403)
  const [support, groups] = await Promise.all([supportReport(scope), groupReport()])
  return json({ support, groups })
}
