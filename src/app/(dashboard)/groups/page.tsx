import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import Link from 'next/link'
import { UsersRound, MapPin, Plus, Clock, AlertTriangle } from 'lucide-react'

export default async function GroupsPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return null

  const memberId = (session.user as any).memberId as string | null

  const [groups, myGroups] = await Promise.all([
    prisma.communityGroup.findMany({
      where: { status: 'ACTIVE', isActive: true, deletedAt: null },
      include: {
        area: { select: { name: true } },
        convener: { select: { firstName: true, lastName: true } },
        _count: { select: { members: { where: { leftAt: null } } } },
      },
      orderBy: { createdAt: 'desc' },
    }),
    memberId
      ? prisma.communityGroup.findMany({
          where: { convenerMemberId: memberId, deletedAt: null },
          include: { _count: { select: { members: { where: { leftAt: null } } } } },
          orderBy: { createdAt: 'desc' },
        })
      : [],
  ])

  const reviewDue = (g: { lastRosterReviewAt: Date | null; rosterReviewIntervalDays: number }) =>
    !g.lastRosterReviewAt || Date.now() - g.lastRosterReviewAt.getTime() > g.rosterReviewIntervalDays * 86400000

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 font-display flex items-center gap-2">
            <UsersRound className="w-6 h-6 text-saffron-600" /> Community Groups
          </h1>
          <p className="text-gray-500 text-sm mt-0.5">Small local groups — mandals, yuvak mandals and more</p>
        </div>
        <Link href="/groups/new" className="btn-primary flex items-center gap-2 text-sm">
          <Plus className="w-4 h-4" /> Register a Group
        </Link>
      </div>

      {myGroups.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wider mb-3">Groups I Convene</h2>
          <div className="space-y-2">
            {myGroups.map((g) => (
              <Link key={g.id} href={`/groups/${g.id}`} className="card flex items-center justify-between hover:border-saffron-200">
                <div>
                  <p className="font-medium text-gray-900">{g.name}</p>
                  <p className="text-xs text-gray-500">{g.groupType} · {g._count.members} member{g._count.members === 1 ? '' : 's'}</p>
                </div>
                <div className="flex items-center gap-2">
                  {reviewDue(g) && (
                    <span className="badge bg-amber-50 text-amber-700 text-xs flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3" /> Roster review due
                    </span>
                  )}
                  <span className={`badge text-xs ${
                    g.status === 'ACTIVE' ? 'badge-green'
                      : g.status === 'PENDING_APPROVAL' ? 'badge-orange'
                      : 'badge-gray'
                  }`}>
                    {g.status === 'PENDING_APPROVAL' ? 'Awaiting approval' : g.status}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {groups.length === 0 ? (
        <div className="card text-center py-16">
          <UsersRound className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">No community groups yet.</p>
          <Link href="/groups/new" className="text-saffron-600 text-sm font-medium mt-2 inline-block hover:text-saffron-700">
            Register the first one →
          </Link>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {groups.map((g) => (
            <Link key={g.id} href={`/groups/${g.id}`} className="card-hover block">
              <div className="flex items-start justify-between gap-2 mb-2">
                <h3 className="font-semibold text-gray-900">{g.name}</h3>
              </div>
              <p className="text-xs text-gray-500 mb-3">{g.groupType}</p>

              <div className="space-y-1.5 text-sm text-gray-600">
                {g.area && (
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-gray-400 flex-shrink-0" /> {g.area.name}
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <UsersRound className="w-4 h-4 text-gray-400 flex-shrink-0" />
                  {g._count.members} member{g._count.members === 1 ? '' : 's'}
                  {g.maxMembers ? ` of ${g.maxMembers}` : ''}
                </div>
                {g.meetingSchedule && (
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-gray-400 flex-shrink-0" /> {g.meetingSchedule}
                  </div>
                )}
              </div>

              <div className="mt-3 pt-3 border-t border-gray-100 text-xs text-gray-500">
                Convened by {g.convener ? `${g.convener.firstName} ${g.convener.lastName ?? ''}` : 'Unassigned'}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
