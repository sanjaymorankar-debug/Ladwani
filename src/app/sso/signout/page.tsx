'use client'
import { Suspense, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { signOut } from 'next-auth/react'
import { BASE_PATH } from '@/lib/api-path'

/**
 * Ends the LadWani session after the central bkesari.com session has ended
 * (single logout), then continues to where the visitor was going; the
 * middleware sends them on to the central login from there if needed.
 */
export default function SsoSignOutPage() {
  return (
    <Suspense fallback={null}>
      <SignOut />
    </Suspense>
  )
}

function SignOut() {
  const params = useSearchParams()
  useEffect(() => {
    const next = params.get('next') ?? '/'
    const safe = next.startsWith('/') && !next.startsWith('//') ? next : '/'
    signOut({ redirect: false }).then(() => window.location.replace(`${BASE_PATH}${safe}`))
  }, [params])
  return <main className="min-h-screen flex items-center justify-center p-6"><p className="text-gray-600">Signing you out…</p></main>
}
