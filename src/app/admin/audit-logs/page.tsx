import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { FileText } from 'lucide-react'
import { formatDate, timeAgo } from '@/lib/utils'

export default async function AuditLogsPage() {
  const session = await getServerSession(authOptions)
  const roles = (session?.user as any)?.roles as string[] ?? []
  if (!roles.includes('ADMIN')) redirect('/dashboard')

  const logs = await prisma.auditLog.findMany({
    include: {
      actor: { include: { member: { select: { firstName: true, lastName: true } } } },
    },
    orderBy: { createdAt: 'desc' },
    take: 100,
  })

  const ACTION_COLOR: Record<string, string> = {
    'family.member.add': 'badge-orange',
    'member.profile.update': 'badge-blue',
    'approval.approve': 'badge-green',
    'approval.reject': 'badge-red',
    'approval.escalate': 'badge bg-orange-100 text-orange-700',
  }

  return (
    <div className="max-w-5xl mx-auto space-y-5">
      <div>
        <h1 className="text-xl font-bold text-gray-900 font-display flex items-center gap-2">
          <FileText className="w-5 h-5 text-gray-600" /> Audit Logs
        </h1>
        <p className="text-gray-500 text-sm">Immutable record of all significant platform actions</p>
      </div>

      <div className="card p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr className="text-left">
                <th className="px-4 py-3 font-semibold text-gray-700">When</th>
                <th className="px-4 py-3 font-semibold text-gray-700">Actor</th>
                <th className="px-4 py-3 font-semibold text-gray-700">Action</th>
                <th className="px-4 py-3 font-semibold text-gray-700">Entity</th>
                <th className="px-4 py-3 font-semibold text-gray-700">IP</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {logs.map((log: any) => {
                const actorName = log.actor.member
                  ? `${log.actor.member.firstName} ${log.actor.member.lastName ?? ''}`
                  : log.actor.email ?? 'Unknown'

                return (
                  <tr key={log.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-4 py-3 text-gray-500 whitespace-nowrap text-xs">
                      <div title={formatDate(log.createdAt, 'dd MMM yyyy HH:mm:ss')}>
                        {timeAgo(log.createdAt)}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900 text-xs">{actorName}</div>
                      <div className="text-xs text-gray-400">{log.actorRole}</div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`badge text-xs ${ACTION_COLOR[log.action] ?? 'badge-gray'}`}>
                        {log.action}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs">
                      {log.entityType && <div>{log.entityType}</div>}
                      {log.entityId && <div className="font-mono text-[10px] text-gray-400 truncate max-w-[100px]">{log.entityId}</div>}
                    </td>
                    <td className="px-4 py-3 text-gray-400 text-xs font-mono">{log.ipAddress ?? '—'}</td>
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
