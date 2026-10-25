import { describe, it, expect, beforeAll, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { encode } from 'next-auth/jwt'

/**
 * On bkesari.com this app is served under /ladwani and the hub does not strip
 * the prefix. Every redirect the app issues must therefore keep it, or the
 * browser lands on the hub's own /login or /dashboard instead of this app's.
 *
 * The middleware is exercised the way Next runs it: a NextRequest that knows
 * the basePath, so req.nextUrl.pathname has the prefix removed.
 */
const SECRET = process.env.NEXTAUTH_SECRET ?? 'test-secret'
const SECURE = (process.env.NEXTAUTH_URL ?? '').startsWith('https://')
const COOKIE = `${SECURE ? '__Secure-' : ''}next-auth.session-token`

let middleware: (req: NextRequest, ev: unknown) => Promise<Response | undefined>

beforeAll(async () => {
  process.env.NEXTAUTH_SECRET = SECRET
  middleware = (await import('@/middleware')).default as any
})

async function request(path: string, basePath: string, roles?: string[]) {
  const headers = new Headers()
  if (roles) {
    const token = await encode({ token: { id: 'u1', roles, memberId: null, status: 'ACTIVE' }, secret: SECRET })
    headers.set('cookie', `${COOKIE}=${token}`)
  }
  const req = new NextRequest(`http://localhost${basePath}${path}`, { headers, nextConfig: { basePath } })
  return middleware(req, {})
}

function location(res: Response | undefined) {
  const loc = res?.headers.get('location')
  return loc ? new URL(loc) : null
}

describe.each([
  { basePath: '/ladwani' },
  { basePath: '' },
])('middleware redirects keep the basePath ("$basePath")', ({ basePath }) => {
  it('sends an anonymous visitor straight to this app\'s /login, with a callbackUrl back to the page', async () => {
    const loc = location(await request('/dashboard', basePath))
    expect(loc?.pathname).toBe(`${basePath}/login`)
    expect(loc?.searchParams.get('callbackUrl')).toBe(`${basePath}/dashboard`)
  })

  it('sends a signed-in non-staff user who opens /admin to this app\'s /dashboard', async () => {
    const loc = location(await request('/admin', basePath, ['MEMBER']))
    expect(loc?.pathname).toBe(`${basePath}/dashboard`)
  })

  it('lets staff through to /admin and anonymous visitors through to public pages', async () => {
    expect(location(await request('/admin', basePath, ['OPERATOR']))).toBeNull()
    expect(location(await request('/login', basePath))).toBeNull()
    expect(location(await request('/claim/abc', basePath))).toBeNull()
    expect(location(await request('/api/cron/group-digest', basePath))).toBeNull()
  })
})

describe('NextAuth pages carry the basePath', () => {
  it('points signIn and error at <basePath>/login, because next-auth redirects to them verbatim', async () => {
    vi.resetModules()
    const before = process.env.NEXT_PUBLIC_BASE_PATH
    process.env.NEXT_PUBLIC_BASE_PATH = '/ladwani'
    try {
      const { authOptions } = await import('@/lib/auth')
      expect(authOptions.pages?.signIn).toBe('/ladwani/login')
      expect(authOptions.pages?.error).toBe('/ladwani/login')
    } finally {
      if (before === undefined) delete process.env.NEXT_PUBLIC_BASE_PATH
      else process.env.NEXT_PUBLIC_BASE_PATH = before
      vi.resetModules()
    }
  })
})

describe('resolveCallbackPath: where the login page goes after sign-in', () => {
  // router.push() adds the basePath itself, so the result must not carry it.
  it('strips the basePath the middleware put in, so the user does not land on /ladwani/ladwani/...', async () => {
    const { resolveCallbackPath } = await import('@/lib/dashboard-routing')
    expect(resolveCallbackPath('/ladwani/dashboard', '/ladwani')).toBe('/dashboard')
    expect(resolveCallbackPath('/ladwani/families/abc?tab=tree', '/ladwani')).toBe('/families/abc?tab=tree')
    expect(resolveCallbackPath('/ladwani', '/ladwani')).toBe('/')
    expect(resolveCallbackPath('/ladwani?x=1', '/ladwani')).toBe('/?x=1')
  })

  it('keeps an app-relative path as it is (the register page sends those)', async () => {
    const { resolveCallbackPath } = await import('@/lib/dashboard-routing')
    expect(resolveCallbackPath('/family/setup?mode=register', '/ladwani')).toBe('/family/setup?mode=register')
    expect(resolveCallbackPath('/ladwanix/page', '/ladwani')).toBe('/ladwanix/page')
    expect(resolveCallbackPath('/dashboard', '')).toBe('/dashboard')
  })

  it('accepts an absolute URL on this origin and refuses every other site', async () => {
    const { resolveCallbackPath } = await import('@/lib/dashboard-routing')
    const origin = 'https://bkesari.com'
    expect(resolveCallbackPath('https://bkesari.com/ladwani/profile', '/ladwani', origin)).toBe('/profile')
    expect(resolveCallbackPath('https://evil.example/ladwani/profile', '/ladwani', origin)).toBeNull()
    expect(resolveCallbackPath('https://bkesari.com.evil.example/x', '/ladwani', origin)).toBeNull()
    expect(resolveCallbackPath('//evil.example/x', '/ladwani', origin)).toBeNull()
    expect(resolveCallbackPath('/\\evil.example/x', '/ladwani', origin)).toBeNull()
    expect(resolveCallbackPath('javascript:alert(1)', '/ladwani', origin)).toBeNull()
    expect(resolveCallbackPath('', '/ladwani', origin)).toBeNull()
    expect(resolveCallbackPath(null, '/ladwani', origin)).toBeNull()
  })
})
