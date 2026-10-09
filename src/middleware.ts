import { withAuth } from 'next-auth/middleware'
import { getToken } from 'next-auth/jwt'
import { NextResponse, type NextFetchEvent, type NextRequest } from 'next/server'
import { ssoConfig, readSsoToken, introspect, decide } from '@/lib/bkesari-sso'

const legacy = withAuth(
  function middleware(req) {
    const token = req.nextauth.token
    const { pathname } = req.nextUrl

    if (pathname.startsWith('/admin')) {
      const roles = (token as any)?.roles as string[] ?? []
      if (!roles.includes('ADMIN') && !roles.includes('OPERATOR')) {
        return NextResponse.redirect(new URL('/dashboard', req.url))
      }
    }
    return NextResponse.next()
  },
  {
    callbacks: {
      authorized: ({ token, req }) => {
        const { pathname } = req.nextUrl
        if (
          pathname === '/' ||
          pathname.startsWith('/login') ||
          pathname.startsWith('/register') ||
          pathname.startsWith('/forgot-password') ||
          pathname.startsWith('/privacy') ||
          pathname.startsWith('/terms') ||
          pathname.startsWith('/api/auth') ||
          // The bridge from the central bkesari.com login (src/lib/bkesari-sso.ts).
          pathname.startsWith('/sso') ||
          // Claiming an invited profile happens before the person has any
          // account at all — the single-use token in the URL is the
          // credential, checked server-side by the route itself.
          pathname.startsWith('/claim/') ||
          pathname.startsWith('/api/invitations/') ||
          // Scheduled jobs carry no session; each checks CRON_SECRET itself.
          pathname.startsWith('/api/cron/')
        ) return true
        return !!token
      },
    },
  }
)

/**
 * Central login first (when configured), then the existing next-auth rules.
 *
 * The central check decides only whether the request may go on; everything
 * the app already enforced (the /admin role check, the authorized() list)
 * still runs after it, unchanged.
 */
export default async function middleware(req: NextRequest, event: NextFetchEvent) {
  const cfg = ssoConfig()
  if (cfg) {
    const { pathname, search } = req.nextUrl
    const identity = await introspect(readSsoToken(req.headers.get('cookie'), cfg.cookieNames), cfg)
    const local = await getToken({ req, secret: process.env.NEXTAUTH_SECRET })
    const decision = decide({
      path: pathname,
      search,
      isApi: pathname.startsWith('/api/'),
      localToken: Boolean(local),
      localSub: (local?.ssoSub as string | null | undefined) ?? null,
      identity,
      cfg,
      basePath: req.nextUrl.basePath,
    })
    if (decision.action === 'json') return NextResponse.json(decision.body, { status: decision.status })
    if (decision.action === 'redirect') {
      if (decision.external) return NextResponse.redirect(decision.to)
      const url = req.nextUrl.clone()
      const [p, q] = decision.to.split('?')
      url.pathname = p
      url.search = q ? `?${q}` : ''
      return NextResponse.redirect(url)
    }
  }
  return (legacy as any)(req, event)
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|images|icons).*)'],
}
