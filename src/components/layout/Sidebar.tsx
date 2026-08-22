'use client'
import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Home, Users, Heart, Bell, Search,
  Settings, LogOut, ChevronLeft, ChevronRight,
  Building2, Newspaper, UserCircle, ShieldCheck
} from 'lucide-react'
import { signOut, useSession } from 'next-auth/react'
import { cn } from '@/lib/utils'

const nav = [
  { href: '/dashboard', icon: Home, label: 'Dashboard', exact: true },
  { href: '/family', icon: Building2, label: 'My Family' },
  { href: '/members', icon: Users, label: 'Directory' },
  { href: '/matrimony', icon: Heart, label: 'Matrimony' },
  { href: '/community', icon: Newspaper, label: 'Community' },
  { href: '/search', icon: Search, label: 'Search' },
  { href: '/profile', icon: UserCircle, label: 'My Profile' },
  { href: '/notifications', icon: Bell, label: 'Notifications' },
]

export default function Sidebar() {
  const [collapsed, setCollapsed] = useState(false)
  const pathname = usePathname()
  const { data: session } = useSession()
  const isAdmin = (session?.user as any)?.roles?.includes('ADMIN')
  const isOperator = (session?.user as any)?.roles?.includes('OPERATOR')
  const isActive = (href: string, exact?: boolean) =>
    exact ? pathname === href : pathname.startsWith(href)

  return (
    <aside className={cn('hidden md:flex flex-col bg-white border-r border-gray-100 transition-all duration-300 shadow-sm',
      collapsed ? 'w-16' : 'w-60')}>
      <div className="h-16 flex items-center px-4 border-b border-gray-100">
        {!collapsed ? (
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-gradient-to-br from-saffron-500 to-saffron-700 rounded-lg flex items-center justify-center flex-shrink-0">
              <span className="text-white font-bold text-sm">म</span>
            </div>
            <div>
              <div className="font-bold text-gray-900 text-sm">Mi Ladwani</div>
              <div className="text-xs text-gray-400">Ladwani Samaj</div>
            </div>
          </div>
        ) : (
          <div className="w-8 h-8 bg-gradient-to-br from-saffron-500 to-saffron-700 rounded-lg flex items-center justify-center mx-auto">
            <span className="text-white font-bold text-sm">म</span>
          </div>
        )}
      </div>

      <nav className="flex-1 py-4 px-2 space-y-0.5 overflow-y-auto">
        {nav.map((item) => (
          <Link key={item.href} href={item.href} title={collapsed ? item.label : undefined}
            className={cn('flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
              isActive(item.href, item.exact)
                ? 'bg-saffron-50 text-saffron-700 border border-saffron-100'
                : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900')}>
            <item.icon className="w-5 h-5 flex-shrink-0" />
            {!collapsed && <span className="truncate">{item.label}</span>}
          </Link>
        ))}
        {(isAdmin || isOperator) && (
          <Link href="/admin" className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-600 hover:bg-blue-50 hover:text-blue-700 transition-colors mt-2">
            <ShieldCheck className="w-5 h-5 flex-shrink-0" />
            {!collapsed && <span>Admin Panel</span>}
          </Link>
        )}
      </nav>

      <div className="border-t border-gray-100 p-2 space-y-0.5">
        <Link href="/settings" className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors">
          <Settings className="w-5 h-5 flex-shrink-0" />
          {!collapsed && <span>Settings</span>}
        </Link>
        <button onClick={() => signOut({ callbackUrl: '/login' })}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-red-500 hover:bg-red-50 transition-colors">
          <LogOut className="w-5 h-5 flex-shrink-0" />
          {!collapsed && <span>Sign Out</span>}
        </button>
        <button onClick={() => setCollapsed(!collapsed)}
          className="w-full flex items-center justify-center p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-50 transition-colors">
          {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </div>
    </aside>
  )
}
