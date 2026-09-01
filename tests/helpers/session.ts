import { vi } from 'vitest'
import { getServerSession } from 'next-auth'

export interface MockUser {
  id: string
  roles: string[]
  memberId: string | null
  status: string
  name?: string
  email?: string | null
}

/**
 * next-auth's getServerSession is mocked module-wide (see authorization.test.ts's
 * vi.mock('next-auth', ...)); this just shapes what it resolves to for the
 * duration of one test. Imported via ESM (not require()) so it resolves to
 * the same mocked module instance vi.mock intercepted.
 */
export function mockSessionAs(user: MockUser | null) {
  ;(getServerSession as ReturnType<typeof vi.fn>).mockResolvedValue(
    user
      ? {
          user: { ...user, email: user.email ?? null },
          expires: new Date(Date.now() + 86400000).toISOString(),
        }
      : null
  )
}
