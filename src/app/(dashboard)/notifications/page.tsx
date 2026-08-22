import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { Bell, Check } from 'lucide-react'
import { timeAgo } from '@/lib/utils'
import JoinRequestActions from '@/components/family/JoinRequestActions'

export default async function NotificationsPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return null

  const notifications = await prisma.notification.findMany({
    where: { recipientId: session.user.id as string },
    orderBy: { createdAt: 'desc' },
    take: 50,
  })

  const joinRequestIds = notifications
    .filter((n: any) => n.type === 'FAMILY_JOIN_REQUEST' && n.data?.joinRequestId)
    .map((n: any) => n.data.joinRequestId as string)
  const pendingJoinRequests = joinRequestIds.length
    ? await prisma.familyJoinRequest.findMany({
        where: { id: { in: joinRequestIds }, status: 'PENDING' },
        select: { id: true },
      })
    : []
  const pendingIds = new Set(pendingJoinRequests.map((r: any) => r.id))

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900 font-display flex items-center gap-2">
          <Bell className="w-5 h-5 text-saffron-600" /> Notifications
        </h1>
        {notifications.some((n: any) => !n.isRead) && (
          <form action={async () => {
            'use server'
          }}>
            <button className="btn-ghost text-sm flex items-center gap-1.5">
              <Check className="w-4 h-4" /> Mark all read
            </button>
          </form>
        )}
      </div>

      {notifications.length === 0 ? (
        <div className="card text-center py-12">
          <Bell className="w-10 h-10 text-gray-300 mx-auto mb-2" />
          <p className="text-gray-500">You're all caught up!</p>
          <p className="text-gray-400 text-sm mt-1">New notifications will appear here.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {notifications.map((n: any) => (
            <div key={n.id} className={`card ${!n.isRead ? 'border-l-4 border-l-saffron-400 bg-saffron-50/30' : ''}`}>
              <div className="flex items-start gap-3">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 text-lg ${
                  n.type === 'MATRIMONIAL_INTEREST' ? 'bg-pink-100' :
                  n.type === 'APPROVAL_STATUS' ? 'bg-blue-100' :
                  n.type === 'COMMUNITY_POST' ? 'bg-green-100' :
                  n.type === 'FAMILY_JOIN_REQUEST' ? 'bg-saffron-100' :
                  'bg-gray-100'
                }`}>
                  {n.type === 'MATRIMONIAL_INTEREST' ? '💌' :
                   n.type === 'APPROVAL_STATUS' ? '✅' :
                   n.type === 'COMMUNITY_POST' ? '📣' :
                   n.type === 'FAMILY_JOIN_REQUEST' ? '👪' : '🔔'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900 text-sm">{n.title}</p>
                  {n.body && <p className="text-gray-600 text-xs mt-0.5">{n.body}</p>}
                  <p className="text-gray-400 text-xs mt-1">{timeAgo(n.createdAt)}</p>
                  {n.type === 'FAMILY_JOIN_REQUEST' && n.data?.joinRequestId && pendingIds.has(n.data.joinRequestId) && (
                    <JoinRequestActions joinRequestId={n.data.joinRequestId} />
                  )}
                </div>
                {!n.isRead && <div className="w-2 h-2 bg-saffron-500 rounded-full flex-shrink-0 mt-1.5" />}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
