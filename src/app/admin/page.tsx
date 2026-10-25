import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { isActiveAdmin } from '@/lib/scope'
import { getTeamScope } from '@/lib/additional-details/access'
import { groupReport, supportReport } from '@/lib/community-connect'
import { GroupStats, SupportCounts } from '@/components/connect/CommunitySupportView'
import {
  Users, Building2, Heart, Bell, ShieldCheck,
  CheckCircle2, Clock, AlertTriangle, TrendingUp, UserCheck
} from 'lucide-react'

export default async function AdminDashboardPage() {
  const session = await getServerSession(authOptions)
  const roles = (session?.user as any)?.roles as string[] ?? []
  if (!roles.includes('ADMIN') && !roles.includes('OPERATOR')) redirect('/dashboard')
  // Global counts are Admin only (owner's decision; checked against the
  // database). Operators get the same page without them: their own work is
  // in My Verification Tasks.
  const isAdmin = !!session?.user?.id && (await isActiveAdmin(session.user.id))

  const [
    totalFamilies, totalMembers, maleMembers, femaleMembers,
    marriedMembers, unmarriedMembers, deceasedMembers, matrimonialProfiles,
    pendingApprovals, totalPosts, pendingFamilies
  ] = !isAdmin ? Array(11).fill(0) as number[] : await Promise.all([
    prisma.family.count({ where: { status: 'ACTIVE' } }),
    prisma.member.count({ where: { status: 'ACTIVE' } }),
    prisma.member.count({ where: { status: 'ACTIVE', gender: 'MALE' } }),
    prisma.member.count({ where: { status: 'ACTIVE', gender: 'FEMALE' } }),
    prisma.member.count({ where: { maritalStatus: 'MARRIED' } }),
    prisma.member.count({ where: { maritalStatus: 'UNMARRIED' } }),
    prisma.member.count({ where: { status: 'DECEASED' } }),
    prisma.matrimonialProfile.count({ where: { isVisible: true } }),
    prisma.approval.count({ where: { status: 'SUBMITTED' } }),
    prisma.post.count({ where: { status: 'PUBLISHED', deletedAt: null } }),
    prisma.family.count({ where: { status: 'PENDING' } }),
  ])

  // Additional Details reports — counts only, scoped to this user's role.
  const scope = await getTeamScope(session)
  const [support, groups] = await Promise.all([supportReport(scope), groupReport()])

  const statCards = [
    { label: 'Total Families', value: totalFamilies, icon: Building2, color: 'bg-orange-50 text-orange-600', sub: `${pendingFamilies} pending` },
    { label: 'Total Members', value: totalMembers, icon: Users, color: 'bg-blue-50 text-blue-600', sub: `${maleMembers}M / ${femaleMembers}F` },
    { label: 'Married', value: marriedMembers, icon: Heart, color: 'bg-pink-50 text-pink-600', sub: `${unmarriedMembers} unmarried` },
    { label: 'Matrimonial', value: matrimonialProfiles, icon: UserCheck, color: 'bg-purple-50 text-purple-600', sub: 'active profiles' },
    { label: 'Deceased', value: deceasedMembers, icon: Bell, color: 'bg-gray-50 text-gray-600', sub: 'in records' },
    { label: 'Community Posts', value: totalPosts, icon: TrendingUp, color: 'bg-green-50 text-green-600', sub: 'published' },
  ]

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 font-display flex items-center gap-2">
            <ShieldCheck className="w-6 h-6 text-blue-600" />
            {isAdmin ? 'Admin Dashboard' : 'Operator Dashboard'}
          </h1>
          <p className="text-gray-500 text-sm mt-0.5">Community platform management</p>
        </div>
        {isAdmin && pendingApprovals > 0 && (
          <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 text-amber-800 px-4 py-2 rounded-lg text-sm font-medium">
            <Clock className="w-4 h-4" />
            {pendingApprovals} pending approval{pendingApprovals !== 1 ? 's' : ''}
          </div>
        )}
      </div>

      {/* Stats grid (Admin only) */}
      {isAdmin && <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {statCards.map((s) => (
          <div key={s.label} className="card">
            <div className={`w-10 h-10 ${s.color} rounded-xl flex items-center justify-center mb-3`}>
              <s.icon className="w-5 h-5" />
            </div>
            <div className="text-2xl font-bold text-gray-900">{s.value.toLocaleString()}</div>
            <div className="text-xs font-medium text-gray-700 mt-0.5">{s.label}</div>
            <div className="text-xs text-gray-400 mt-0.5">{s.sub}</div>
          </div>
        ))}
      </div>}

      {/* Community support & interest groups (counts only) */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-gray-900">Community support &amp; interest groups</h2>
        <SupportCounts support={support} />
        <GroupStats groups={groups} />
      </div>

      {/* Quick actions */}
      <div className="grid md:grid-cols-3 gap-4">
        {isAdmin && <div className="card">
          <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <Clock className="w-4 h-4 text-amber-500" /> Pending Actions
          </h3>
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm py-2 border-b border-gray-50">
              <span className="text-gray-600">Family approvals</span>
              <span className="font-medium text-amber-600">{pendingFamilies}</span>
            </div>
            <div className="flex items-center justify-between text-sm py-2">
              <span className="text-gray-600">Change requests</span>
              <span className="font-medium text-amber-600">{pendingApprovals}</span>
            </div>
          </div>
        </div>}

        <div className="card">
          <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-green-500" /> Quick Actions
          </h3>
          <div className="space-y-2">
            {[
              { href: '/admin/approvals', label: 'Review Approvals' },
              { href: '/admin/moderation', label: 'Review Reported Content' },
            ].map((a) => (
              <a key={a.href} href={a.href} className="flex items-center justify-between text-sm py-2 text-saffron-600 hover:text-saffron-700 border-b border-gray-50 last:border-0">
                {a.label}
                <span>→</span>
              </a>
            ))}
          </div>
        </div>

        {isAdmin && (
          <div className="card">
            <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-500" /> Admin Only
            </h3>
            <div className="space-y-2">
              {[
                { href: '/admin/users', label: 'User Management' },
                { href: '/admin/audit-logs', label: 'Audit Logs' },
                { href: '/admin/data-requests', label: 'Data Requests & Consents' },
                { href: '/reports', label: 'Reports' },
                { href: '/admin/interests', label: 'Hobby Master & Approvals' },
                { href: '/admin/config/options', label: 'Additional Details Dropdowns' },
                { href: '/admin/settings', label: 'System Settings' },
              ].map((a) => (
                <a key={a.href} href={a.href} className="flex items-center justify-between text-sm py-2 text-blue-600 hover:text-blue-700 border-b border-gray-50 last:border-0">
                  {a.label}
                  <span>→</span>
                </a>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
