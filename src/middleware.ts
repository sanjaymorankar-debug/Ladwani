import { withAuth } from 'next-auth/middleware'
import { NextResponse } from 'next/server'

export default withAuth(
  function middleware(req) {
    const token = req.nextauth.token
    const { pathname } = req.nextUrl

    if (pathname.startsWith('/admin')) {
      const roles = (token as any)?.roles as string[] ?? []
      if (!roles.includes('ADMIN') && !roles.includes('OPERATOR')) {
        // req.nextUrl knows the basePath (/ladwani on bkesari.com) and puts it
        // back when serialised; `new URL('/dashboard', req.url)` would drop it
        // and send the user to the hub's own /dashboard.
        const url = req.nextUrl.clone()
        url.pathname = '/dashboard'
        url.search = ''
        return NextResponse.redirect(url)
      }
    }
    return NextResponse.next()
  },
  {
    // Without this, next-auth sends anonymous visitors to /api/auth/signin,
    // which then redirects to authOptions.pages.signIn. Naming the page here
    // goes there directly; withAuth adds the basePath itself, so this must
    // NOT carry it (src/lib/auth.ts's pages must, see there).
    pages: { signIn: '/login' },
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
          // Location master read for the registration form (F01), and the
          // cron endpoint, which authenticates with CRON_SECRET (F06).
          pathname === '/api/areas' ||
          pathname.startsWith('/api/cron/') ||
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

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|images|icons).*)'],
}
