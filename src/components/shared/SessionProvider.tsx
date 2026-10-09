'use client'
import { SessionProvider as NextAuthSessionProvider } from 'next-auth/react'
import { BASE_PATH } from '@/lib/api-path'

export default function SessionProvider({ children }: { children: React.ReactNode }) {
  // NextAuth's client builds its own URLs from this, so it needs the prefix
  // the app is served under. Without it every session and sign-in call would
  // go to the hub's root instead of to this app.
  return (
    <NextAuthSessionProvider basePath={`${BASE_PATH}/api/auth`}>
      {children}
    </NextAuthSessionProvider>
  )
}
