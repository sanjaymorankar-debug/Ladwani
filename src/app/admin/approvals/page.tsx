import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import Link from 'next/link'
import { Clock, CheckCircle2, XCircle, RotateCcw, ArrowUpRight, Filter } from 'lucide-react'
import { formatDate, timeAgo } from '@/lib/utils'

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
  SUBMITTED: { label: 'Pending', color: 'badge-orange', icon: Clock },
  UNDER_REVIEW: { label: 'Under Review', color: 'badge-blue', icon: Clock },
  APPROVED: { label: 'Approved', color: 'badge-green', icon: CheckCircle2 },
  REJECTED: { label: 'Rejected', color: 'badge-red', icon: XCircle },
  RETURNED: { label: 'Returned', color: 'badge bg-purple-100 text-purple-700', icon: RotateCcw },
  ESCALATED: { label: 'Escalated', color: 'badge bg-red-100 text-red-700', icon: ArrowUpRight },
}

const ACTION_LABELS: Record<string, string> = {
  'family.create': 'New Family Registration',
  'family.member.add': 'Add Family Member',
  'member.marital_status.change': 'Marital Status Change',
  'member.mark_deceased': 'Mark as Deceased',
  'member.relationship.change': 'Relationship Change',
  'family.karta.change': 'Family Head Change',
  'family.merge': 'Merge Families',
}

export default async function ApprovalsPage({ searchParams }: { searchParams: { status?: string } }) {
  const session = await getServerSession(authOptions)
  const roles = (session?.user as any)?.roles as string[] ?? []
  if (!roles.includes('ADMIN') && !roles.includes('OPERATOR')) redirect('/dashboard')

  const statusFilter = searchParams.status
  const where: any = {}
  if (statusFilter) where.status = statusFilter
  else where.status = { in: ['SUBMITTED', 'UNDER_REVIEW', 'ESCALATED'] }

  const [approvals, counts] = await Promise.all([
    prisma.approval.findMany({
      where,
      include: {
        submitter: { include: { member: { select: { firstName: true, lastName: true } } } },
        reviewer: { include: { member: { select: { firstName: true, lastName: true } } } },
      },
      orderBy: { submittedAt: 'desc' },
      take: 50,
    }),
    prisma.$transaction([
      prisma.approval.count({ where: { status: 'SUBMITTED' } }),
      prisma.approval.count({ where: { status: 'UNDER_REVIEW' } }),
      prisma.approval.count({ where: { status: 'ESCALATED' } }),
      prisma.approval.count({ where: { status: 'APPROVED' } }),
    ]),
  ])

  const [pending, reviewing, escalated, approved] = counts

  const tabs = [
    { label: `Pending (${pending})`, value: '' },
    { label: `Reviewing (${reviewing})`, value: 'UNDER_REVIEW' },
    { label: `Escalated (${escalated})`, value: 'ESCALATED' },
    { label: `Approved (${approved})`, value: 'APPROVED' },
    { label: 'Rejected', value: 'REJECTED' },
    { label: 'All', value: 'ALL' },
  ]

  return (
    <div className="max-w-5xl mx-auto space-y-5">
      <div>
        <h1 className="text-xl font-bold text-gray-900 font-display">Approval Queue</h1>
        <p className="text-gray-500 text-sm">Review and process community change requests</p>
      </div>

      {/* Tab filter */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit overflow-x-auto">
        {tabs.map((tab) => (
          <Link
            key={tab.value}
            href={`/admin/approvals${tab.value && tab.value !== 'ALL' ? `?status=${tab.value}` : ''}`}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
              (tab.value === '' && !statusFilter) || statusFilter === tab.value
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab.label}
          </Link>
        ))}
      </div>

      {/* Approvals list */}
      {approvals.length === 0 ? (
        <div className="card text-center py-12">
          <CheckCircle2 className="w-10 h-10 text-green-400 mx-auto mb-2" />
          <p className="text-gray-500">No approvals in this category.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {approvals.map((approval: any) => {
            const cfg = STATUS_CONFIG[approval.status] ?? STATUS_CONFIG.SUBMITTED
            const submitterName = approval.submitter.member
              ? `${approval.submitter.member.firstName} ${approval.submitter.member.lastName ?? ''}`
              : approval.submitter.email ?? 'Unknown'
            return (
              <div key={approval.id} className="card-hover">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 bg-saffron-100 rounded-xl flex items-center justify-center flex-shrink-0">
                    <cfg.icon className="w-5 h-5 text-saffron-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold text-gray-900 text-sm">
                          {ACTION_LABELS[approval.actionCode] ?? approval.actionCode}
                        </p>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          <span className={cfg.color}>{cfg.label}</span>
                          {approval.entityType && (
                            <span className="text-xs text-gray-500">
                              {approval.entityType} {approval.fieldName ? `· ${approval.fieldName}` : ''}
                            </span>
                          )}
                        </div>
                      </div>
                      <Link href={`/admin/approvals/${approval.id}`}
                        className="btn-secondary text-xs px-3 py-1.5 flex-shrink-0">
                        Review →
                      </Link>
                    </div>
                    <div className="flex items-center gap-3 mt-2 text-xs text-gray-500 flex-wrap">
                      <span>By <strong>{submitterName}</strong></span>
                      <span>{timeAgo(approval.submittedAt)}</span>
                      {approval.reason && (
                        <span className="text-gray-400 truncate max-w-xs">"{approval.reason}"</span>
                      )}
                    </div>
                    {approval.oldValue && approval.newValue && (
                      <div className="mt-2 flex items-center gap-2 text-xs">
                        <span className="bg-red-50 text-red-700 px-2 py-0.5 rounded font-mono">
                          {JSON.stringify(approval.oldValue).slice(0, 40)}
                        </span>
                        <span className="text-gray-400">→</span>
                        <span className="bg-green-50 text-green-700 px-2 py-0.5 rounded font-mono">
                          {JSON.stringify(approval.newValue).slice(0, 40)}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
