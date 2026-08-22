import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import Link from 'next/link'
import { Settings, ChevronRight, Users2, TreePine, Globe, Heart, Shield, Bell } from 'lucide-react'

export default async function AdminSettingsPage() {
  const session = await getServerSession(authOptions)
  const roles = (session?.user as any)?.roles as string[] ?? []
  if (!roles.includes('ADMIN')) redirect('/dashboard')

  const settings = await prisma.setting.findMany({ orderBy: { key: 'asc' } })
  const settingMap = Object.fromEntries(settings.map((s: any) => [s.key, s.value]))

  const configSections = [
    {
      title: 'Relationship Types', href: '/admin/config/relationships',
      icon: TreePine, desc: 'Manage family relationship types and their inverses',
    },
    {
      title: 'Community Areas', href: '/admin/areas',
      icon: Globe, desc: 'Set up geographic community groups and areas',
    },
    {
      title: 'Matrimony Settings', href: '/admin/matrimony',
      icon: Heart, desc: 'Configure matrimonial module visibility and contact rules',
    },
    {
      title: 'Approval Rules', href: '/admin/approval-rules',
      icon: Shield, desc: 'Define which actions require approval and from whom',
    },
    {
      title: 'User Roles', href: '/admin/roles',
      icon: Users2, desc: 'Manage role permissions and assign operators',
    },
    {
      title: 'Notification Templates', href: '/admin/notifications',
      icon: Bell, desc: 'Customise email and notification templates',
    },
  ]

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900 font-display flex items-center gap-2">
          <Settings className="w-5 h-5" /> System Settings
        </h1>
        <p className="text-gray-500 text-sm">Configure the Mi Ladwani platform</p>
      </div>

      {/* Community Info */}
      <div className="card space-y-4">
        <h2 className="font-semibold text-gray-900 border-b border-gray-100 pb-2">Community Information</h2>
        {[
          { key: 'community.name', label: 'Community Name' },
          { key: 'community.tagline', label: 'Tagline' },
        ].map(({ key, label }) => (
          <div key={key} className="flex items-center justify-between gap-4">
            <label className="text-sm font-medium text-gray-700">{label}</label>
            <input
              defaultValue={String(settingMap[key] ?? '').replace(/^"|"$/g, '')}
              className="form-input w-64 text-sm"
            />
          </div>
        ))}
      </div>

      {/* Config sections */}
      <div>
        <h2 className="font-semibold text-gray-700 text-sm uppercase tracking-wider mb-3">Configuration Modules</h2>
        <div className="grid sm:grid-cols-2 gap-3">
          {configSections.map((s: any) => (
            <Link key={s.href} href={s.href} className="card-hover flex items-center gap-3">
              <div className="w-10 h-10 bg-gray-100 rounded-xl flex items-center justify-center flex-shrink-0">
                <s.icon className="w-5 h-5 text-gray-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-gray-900 text-sm">{s.title}</p>
                <p className="text-xs text-gray-500 truncate">{s.desc}</p>
              </div>
              <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0" />
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
