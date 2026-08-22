'use client'
import { Bell, Search, Menu } from 'lucide-react'
import Link from 'next/link'
import { getInitials } from '@/lib/utils'

interface TopbarProps {
  user: { name?: string | null; email?: string | null } | undefined
}

export default function Topbar({ user }: TopbarProps) {
  const name = user?.name ?? 'User'
  return (
    <header className="h-16 bg-white border-b border-gray-100 flex items-center px-4 gap-4 sticky top-0 z-30">
      <button className="md:hidden p-2 text-gray-500 hover:text-gray-700 rounded-lg hover:bg-gray-50">
        <Menu className="w-5 h-5" />
      </button>
      <div className="flex-1 max-w-md">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input type="search" placeholder="Search members, families..."
            className="w-full pl-9 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-saffron-500 focus:border-transparent" />
        </div>
      </div>
      <div className="flex items-center gap-3 ml-auto">
        <Link href="/dashboard/notifications" className="relative p-2 text-gray-500 hover:text-gray-700 rounded-lg hover:bg-gray-50 transition-colors">
          <Bell className="w-5 h-5" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-saffron-500 rounded-full" />
        </Link>
        <Link href="/dashboard/profile" className="flex items-center gap-2">
          <div className="w-8 h-8 bg-saffron-600 rounded-full flex items-center justify-center text-white text-sm font-semibold">
            {getInitials(name)}
          </div>
          <span className="hidden md:block text-sm font-medium text-gray-700 max-w-[120px] truncate">{name}</span>
        </Link>
      </div>
    </header>
  )
}
