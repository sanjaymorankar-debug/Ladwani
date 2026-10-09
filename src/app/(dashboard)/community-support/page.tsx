import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { authOptions } from '@/lib/auth'
import { getTeamScope } from '@/lib/additional-details/access'
import CommunitySupportView from '@/components/connect/CommunitySupportView'

/** District / State / National team page: support requests and group activity, scoped by role. */
export default async function CommunitySupportPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) redirect('/login')
  const scope = await getTeamScope(session)
  if (!scope.any) redirect('/dashboard')
  return <CommunitySupportView canSeeNames={scope.districts.length > 0} />
}
