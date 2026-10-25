/**
 * Spec §35: after login, route the user to the dashboard matching their role.
 *
 * Roles are ranked most-privileged first, so a user holding several roles
 * lands on the highest one by default. ADMIN and OPERATOR share /admin (that
 * page already renders itself as "Admin Dashboard" or "Operator Dashboard"
 * based on the role), while KARTA, ASSET_OWNER and MEMBER all use the member
 * dashboard, which adapts its cards to what the user actually has.
 */
export const ROLE_DASHBOARDS: { role: string; path: string; label: string }[] = [
  { role: 'ADMIN', path: '/admin', label: 'Admin Dashboard' },
  { role: 'OPERATOR', path: '/admin', label: 'Operator Dashboard' },
  { role: 'ASSET_OWNER', path: '/dashboard', label: 'Asset Owner Dashboard' },
  { role: 'KARTA', path: '/dashboard', label: 'Karta Dashboard' },
  { role: 'MEMBER', path: '/dashboard', label: 'Member Dashboard' },
]

export function resolveDashboardPath(roles: string[] | undefined | null): string {
  const held = roles ?? []
  return ROLE_DASHBOARDS.find((r) => held.includes(r.role))?.path ?? '/dashboard'
}

export function resolveDashboardLabel(roles: string[] | undefined | null): string {
  const held = roles ?? []
  return ROLE_DASHBOARDS.find((r) => held.includes(r.role))?.label ?? 'Member Dashboard'
}

/**
 * Where a freshly-verified user should go before they have a family:
 * straight into the flow they picked at registration.
 */
export function resolveOnboardingPath(joinIntent: string | null | undefined): string | null {
  if (joinIntent === 'KARTA') return '/family/setup?mode=register'
  if (joinIntent === 'JOIN_EXISTING') return '/family/setup?mode=search'
  return null
}

/**
 * The page to open after sign-in, from the login page's ?callbackUrl=.
 *
 * Returned without the basePath, which is the form router.push() takes (Next
 * adds the prefix itself, so a prefixed path would become /ladwani/ladwani/...).
 * The value arrives in both forms: the middleware builds it with the basePath
 * (/ladwani/dashboard), the register page without it (/family/setup?...).
 * Anything that is not a path on this site, such as another origin or a
 * protocol-relative //host, gives null, so the parameter cannot send someone
 * who has just signed in to another site.
 */
export function resolveCallbackPath(
  raw: string | null | undefined,
  basePath: string,
  origin?: string,
): string | null {
  if (!raw) return null
  let path = raw.trim()
  if (origin && (path === origin || path.startsWith(`${origin}/`) || path.startsWith(`${origin}?`))) {
    path = path.slice(origin.length) || '/'
  }
  if (!path.startsWith('/') || path.startsWith('//') || path.startsWith('/\\')) return null
  if (basePath && (path === basePath || path.startsWith(`${basePath}/`) || path.startsWith(`${basePath}?`))) {
    path = path.slice(basePath.length)
    if (!path.startsWith('/')) path = `/${path}`
  }
  return path
}
