import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, MapPin, UsersRound, Clock, AlertTriangle } from 'lucide-react'
import { formatDate } from '@/lib/utils'
import GroupRosterManager from '@/components/groups/GroupRosterManager'

export default async function GroupDetailPage({ params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return null

  const roles = ((session.user as any).roles ?? []) as string[]
  const memberId = (session.user as any).memberId as string | null
  const isStaff = roles.includes('ADMIN') || roles.includes('OPERATOR')

  const group = await prisma.communityGroup.findUnique({
    where: { id: params.id },
    include: {
      area: { select: { id: true, name: true, type: true } },
      convener: { select: { id: true, firstName: true, lastName: true } },
    },
  })

  if (!group || group.deletedAt) notFound()

  const isConvener = memberId === group.convenerMemberId
  const visible = group.status === 'ACTIVE' || isConvener || isStaff
  if (!visible) notFound()

  const canManage = isConvener || isStaff
  const reviewDue =
    !group.lastRosterReviewAt ||
    Date.now() - group.lastRosterReviewAt.getTime() > group.rosterReviewIntervalDays * 86400000

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      <Link href="/groups" className="btn-ghost p-2 -ml-2 inline-flex items-center gap-1 text-sm text-gray-500">
        <ArrowLeft className="w-4 h-4" /> All groups
      </Link>

      <div className="card">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 font-display">{group.name}</h1>
            <p className="text-gray-500 text-sm mt-0.5">{group.groupType.replace(/_/g, ' ')}</p>
          </div>
          <span className={`badge text-xs ${
            group.status === 'ACTIVE' ? 'badge-green'
              : group.status === 'PENDING_APPROVAL' ? 'badge-orange'
              : 'badge-gray'
          }`}>
            {group.status === 'PENDING_APPROVAL' ? 'Awaiting approval' : group.status}
          </span>
        </div>

        <div className="grid sm:grid-cols-2 gap-3 mt-4 text-sm">
          {group.area && (
            <div className="flex items-center gap-2 text-gray-600">
              <MapPin className="w-4 h-4 text-gray-400 flex-shrink-0" /> {group.area.name}
            </div>
          )}
          {group.meetingSchedule && (
            <div className="flex items-center gap-2 text-gray-600">
              <Clock className="w-4 h-4 text-gray-400 flex-shrink-0" /> {group.meetingSchedule}
            </div>
          )}
          <div className="text-gray-500">
            Convener: {group.convener ? `${group.convener.firstName} ${group.convener.lastName ?? ''}` : 'Unassigned'}
          </div>
          {canManage && (
            <div className="text-gray-500">
              Roster last confirmed: {group.lastRosterReviewAt ? formatDate(group.lastRosterReviewAt, 'dd MMM yyyy') : 'Never'}
            </div>
          )}
        </div>

        {group.description && (
          <p className="text-sm text-gray-600 mt-4 pt-4 border-t border-gray-100">{group.description}</p>
        )}

        {canManage && reviewDue && (
          <div className="mt-4 bg-amber-50 border border-amber-100 rounded-xl p-3 text-sm text-amber-800 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            It's been a while since this roster was confirmed — check the list below is still current.
          </div>
        )}
      </div>

      <GroupRosterManager
        groupId={group.id}
        canManage={canManage}
        maxMembers={group.maxMembers}
        reviewDue={reviewDue}
      />
    </div>
  )
}
