import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import Link from 'next/link'
import { Users, Search, CheckCircle2, XCircle, Clock } from 'lucide-react'
import { formatDate, getInitials } from '@/lib/utils'

export default async function UsersPage() {
  const session = await getServerSession(authOptions)
  const roles = (session?.user as any)?.roles as string[] ?? []
  if (!roles.includes('ADMIN')) redirect('/dashboard')

  const users = await prisma.user.findMany({
    where: { deletedAt: null },
    include: {
      member: { select: { firstName: true, lastName: true, memberNumber: true } },
      userRoles: { include: { role: { select: { code: true, label: true } } } },
    },
    orderBy: { createdAt: 'desc' },
    take: 100,
  })

  const STATUS_ICONS: Record<string, any> = {
    ACTIVE: { icon: CheckCircle2, color: 'text-green-500' },
    PENDING: { icon: Clock, color: 'text-amber-500' },
    SUSPENDED: { icon: XCircle, color: 'text-red-500' },
    BLOCKED: { icon: XCircle, color: 'text-red-600' },
  }

  return (
    <div className="max-w-6xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 font-display flex items-center gap-2">
            <Users className="w-5 h-5 text-blue-600" /> User Management
          </h1>
          <p className="text-gray-500 text-sm">{users.length} total users</p>
        </div>
      </div>

      <div className="card">
        <div className="flex gap-3 mb-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input type="search" placeholder="Search by name, email, mobile..."
              className="form-input pl-9" />
          </div>
          <select className="form-input w-auto">
            <option value="">All Statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="PENDING">Pending</option>
            <option value="SUSPENDED">Suspended</option>
          </select>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left border-b border-gray-100">
                <th className="pb-3 pr-4 font-semibold text-gray-700">User</th>
                <th className="pb-3 pr-4 font-semibold text-gray-700">Contact</th>
                <th className="pb-3 pr-4 font-semibold text-gray-700">Roles</th>
                <th className="pb-3 pr-4 font-semibold text-gray-700">Status</th>
                <th className="pb-3 pr-4 font-semibold text-gray-700">Joined</th>
                <th className="pb-3 font-semibold text-gray-700">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {users.map((user: any) => {
                const name = user.member
                  ? `${user.member.firstName} ${user.member.lastName ?? ''}`
                  : user.email ?? user.mobile ?? 'Unknown'
                const statusCfg = STATUS_ICONS[user.status] ?? STATUS_ICONS.PENDING
                const StatusIcon = statusCfg.icon

                return (
                  <tr key={user.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="py-3 pr-4">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 bg-saffron-600 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                          {getInitials(name)}
                        </div>
                        <div>
                          <p className="font-medium text-gray-900 truncate max-w-[150px]">{name}</p>
                          {user.member?.memberNumber && (
                            <p className="text-xs text-gray-400">{user.member.memberNumber}</p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="py-3 pr-4 text-gray-600">
                      <div>{user.email ?? '—'}</div>
                      {user.mobile && <div className="text-xs text-gray-400">{user.mobile}</div>}
                    </td>
                    <td className="py-3 pr-4">
                      <div className="flex flex-wrap gap-1">
                        {user.userRoles.map((ur: any) => (
                          <span key={ur.role.code} className={`badge text-xs ${
                            ur.role.code === 'ADMIN' ? 'badge-red' :
                            ur.role.code === 'OPERATOR' ? 'badge-blue' :
                            ur.role.code === 'KARTA' ? 'badge-orange' :
                            'badge-gray'
                          }`}>{ur.role.code}</span>
                        ))}
                      </div>
                    </td>
                    <td className="py-3 pr-4">
                      <span className={`flex items-center gap-1 text-xs font-medium ${statusCfg.color}`}>
                        <StatusIcon className="w-3.5 h-3.5" />
                        {user.status}
                      </span>
                    </td>
                    <td className="py-3 pr-4 text-gray-500 text-xs">{formatDate(user.createdAt)}</td>
                    <td className="py-3">
                      <Link href={`/admin/users/${user.id}`}
                        className="text-saffron-600 hover:text-saffron-700 font-medium text-xs">
                        Manage →
                      </Link>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
