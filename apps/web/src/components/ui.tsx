'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState, type ReactNode } from 'react'
import { useAuth } from '../lib/auth-context'
import { api } from '../lib/api-client'

export function Shell({ children }: { children: ReactNode }) {
  return <div className="shell">{children}</div>
}

export function TopBar() {
  const { user, logout } = useAuth()
  const router = useRouter()
  const [unreadCount, setUnreadCount] = useState(0)

  useEffect(() => {
    if (!user) return
    api
      .get<unknown[]>('/notifications?unread=true')
      .then((rows) => setUnreadCount(rows.length))
      .catch(() => undefined)
  }, [user])

  async function handleLogout() {
    await logout()
    router.push('/login')
  }

  return (
    <div className="topbar">
      <Link href="/dashboard" style={{ fontFamily: 'var(--font-display), serif', fontSize: 20, fontWeight: 600, textDecoration: 'none', color: 'var(--ink)' }}>
        Mi Samaj
      </Link>
      {user && (
        <nav>
          <Link href="/dashboard">Dashboard</Link>
          <Link href="/community">Feed</Link>
          <Link href="/matrimony">Matrimony</Link>
          <Link href="/members/search">Directory</Link>
          <Link href="/approvals">Approvals</Link>
          <Link href="/notifications" style={{ position: 'relative' }}>
            Notifications
            {unreadCount > 0 && (
              <span
                className="pill pill-danger"
                style={{ position: 'absolute', top: -10, right: -18, padding: '0 6px', fontSize: 10, lineHeight: '16px' }}
              >
                {unreadCount}
              </span>
            )}
          </Link>
          <button className="btn btn-outline" onClick={handleLogout} style={{ padding: '4px 12px' }}>
            Log out
          </button>
        </nav>
      )}
    </div>
  )
}

export function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth()
  const router = useRouter()

  if (loading) return <Shell>Loading…</Shell>
  if (!user) {
    if (typeof window !== 'undefined') router.replace('/login')
    return null
  }
  return <>{children}</>
}

export function ErrorBanner({ message }: { message: string | null }) {
  if (!message) return null
  return <div className="error-banner">{message}</div>
}

export function StatusPill({ status }: { status: string }) {
  const tone =
    status === 'ACTIVE' || status === 'VERIFIED' || status === 'APPROVED' || status === 'MARRIED'
      ? 'success'
      : status === 'PENDING' || status === 'SUBMITTED' || status === 'UNDER_REVIEW'
        ? 'warning'
        : status === 'REJECTED' || status === 'DECEASED' || status === 'DECLINED' || status === 'INACTIVE'
          ? 'danger'
          : 'neutral'
  return <span className={`pill pill-${tone}`}>{status.replace(/_/g, ' ')}</span>
}

export function Avatar({ name, deceased }: { name: string; deceased?: boolean }) {
  const initials = name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('')
  return <div className={`avatar${deceased ? ' deceased' : ''}`}>{initials || '?'}</div>
}
