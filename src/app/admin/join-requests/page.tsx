import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import Link from 'next/link'
import { Users2 } from 'lucide-react'
import { timeAgo } from '@/lib/utils'
import JoinRequestRowActions from '@/components/admin/JoinRequestRowActions'

const STATUS_BADGE: Record<string, string> = {
  PENDING: 'badge-orange',
  APPROVED: 'badge-green',
  DECLINED: 'badge-red',
}

export default async function AdminJoinRequestsPage({ searchParams }: { searchParams: { status?: string } }) {
  const session = await getServerSession(authOptions)
  const roles = (session?.user as any)?.roles as string[] ?? []
  if (!roles.includes('ADMIN') && !roles.includes('OPERATOR')) redirect('/dashboard')

  const statusFilter = searchParams.status
  const where: any = statusFilter ? { status: statusFilter } : {}

  const requests = await prisma.familyJoinRequest.findMany({
    where,
    include: {
      family: { select: { id: true, name: true } },
      member: { select: { id: true, firstName: true, lastName: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: 100,
  })

  const tabs = [
    { label: 'Pending', value: 'PENDING' },
    { label: 'Approved', value: 'APPROVED' },
    { label: 'Declined', value: 'DECLINED' },
    { label: 'All', value: '' },
  ]

  return (
    <div className="max-w-5xl mx-auto space-y-5">
      <div>
        <h1 className="text-xl font-bold text-gray-900 font-display flex items-center gap-2">
          <Users2 className="w-5 h-5 text-saffron-600" /> Family Join Requests
        </h1>
        <p className="text-gray-500 text-sm mt-0.5">Review, reject, or delete pending family membership requests.</p>
      </div>

      <div className="flex gap-2">
        {tabs.map((t) => (
          <Link key={t.value} href={`/admin/join-requests${t.value ? `?status=${t.value}` : ''}`}
            className={`text-sm px-3 py-1.5 rounded-lg font-medium transition-colors ${
              (statusFilter ?? '') === t.value ? 'bg-saffron-100 text-saffron-700' : 'text-gray-500 hover:bg-gray-100'
            }`}>
            {t.label}
          </Link>
        ))}
      </div>

      {requests.length === 0 ? (
        <div className="card text-center py-16">
          <Users2 className="w-10 h-10 text-gray-300 mx-auto mb-2" />
          <p className="text-gray-500">No join requests here.</p>
        </div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 border-b border-gray-100">
                <th className="pb-2 font-medium">Member</th>
                <th className="pb-2 font-medium">Family</th>
                <th className="pb-2 font-medium">Relationship</th>
                <th className="pb-2 font-medium">Status</th>
                <th className="pb-2 font-medium">Requested</th>
                <th className="pb-2 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {requests.map((r: any) => (
                <tr key={r.id} className="border-b border-gray-50 last:border-0">
                  <td className="py-3">
                    <Link href={`/members/${r.member.id}`} className="font-medium text-gray-900 hover:text-saffron-600">
                      {r.member.firstName} {r.member.lastName ?? ''}
                    </Link>
                  </td>
                  <td className="py-3 text-gray-600">{r.family.name}</td>
                  <td className="py-3 text-gray-600">{r.relationshipTypeCode}</td>
                  <td className="py-3">
                    <span className={`badge text-xs ${STATUS_BADGE[r.status] ?? 'badge-gray'}`}>{r.status}</span>
                  </td>
                  <td className="py-3 text-gray-400 text-xs">{timeAgo(r.createdAt)}</td>
                  <td className="py-3">
                    <JoinRequestRowActions id={r.id} status={r.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
