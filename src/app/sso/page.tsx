'use client'
import { Suspense, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { signIn } from 'next-auth/react'
import { BASE_PATH } from '@/lib/api-path'

/**
 * The bridge from the central bkesari.com login: exchanges the central
 * session (its cookie travels with this request) for a LadWani session via
 * the `bkesari-sso` provider, then continues to where the visitor was going.
 */
export default function SsoPage() {
  return (
    <Suspense fallback={null}>
      <Bridge />
    </Suspense>
  )
}

function safePath(value: string | null): string {
  const v = value ?? ''
  return v.startsWith('/') && !v.startsWith('//') && !v.startsWith('/\\') ? v : '/dashboard'
}

function Bridge() {
  const params = useSearchParams()
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    const target = `${BASE_PATH}${safePath(params.get('callbackUrl'))}`
    signIn('bkesari-sso', { redirect: false, callbackUrl: target }).then((res) => {
      if (res?.ok && !res.error) window.location.replace(target)
      else setFailed(true)
    })
  }, [params])
  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="max-w-md text-center space-y-3">
        {failed ? (
          <>
            <h1 className="text-xl font-semibold">Could not sign you in</h1>
            <p className="text-gray-600">Your bkesari.com session has ended, or your account does not include LadWani.</p>
            <a className="text-orange-700 underline" href="/auth/login">Sign in at bkesari.com</a>
          </>
        ) : (
          <p className="text-gray-600">Signing you in…</p>
        )}
      </div>
    </main>
  )
}
