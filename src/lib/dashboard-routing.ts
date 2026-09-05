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
