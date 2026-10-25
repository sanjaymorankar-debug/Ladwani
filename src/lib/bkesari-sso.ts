/**
 * Central login (bkesari.com) for LadWani. Edge-safe: used by the middleware
 * as well as by the server, so no Node-only imports here.
 *
 * Off unless BKESARI_SSO_INTROSPECT_URL is set. When on, the bkesari.com
 * session cookie is validated against the central auth service (introspection,
 * cached for at most 30 s), the LADWANI feature is required, and the result
 * is bridged into this app's own next-auth session by the `bkesari-sso`
 * provider (src/lib/auth.ts), so every existing getServerSession() call keeps
 * working unchanged.
 *
 * With BKESARI_SSO_ENFORCE=1 the local password login is switched off: the
 * login and register pages send people to the central login instead.
 *
 * Environment (needed at build time AND at runtime, like BASE_PATH):
 *   BKESARI_SSO_INTROSPECT_URL   https://dev.bkesari.com/auth/api/introspect
 *   BKESARI_SSO_CLIENT_ID        an `internal` client registered on the hub
 *   BKESARI_SSO_CLIENT_SECRET
 *   BKESARI_SSO_URL              the hub's origin, https://dev.bkesari.com
 *   BKESARI_SSO_ENFORCE          1 to turn local password login off
 *   BKESARI_SSO_COOKIE           cookie names to read, default "__Host-bk_sso,bk_sso"
 */

export const FEATURE = 'LADWANI'

export interface SsoIdentity {
  active: true
  sid: string
  user: { id: string; email: string; name: string | null; email_verified: boolean }
  roles: string[]
  moderator_of: string[]
  features: string[]
  permissions: string[]
  mfa: boolean
}

export interface SsoConfig {
  introspectUrl: string
  clientId: string
  clientSecret: string
  hubUrl: string
  enforce: boolean
  cookieNames: string[]
}

export function ssoConfig(env: Record<string, string | undefined> = process.env): SsoConfig | null {
  const introspectUrl = (env.BKESARI_SSO_INTROSPECT_URL ?? '').trim()
  if (!introspectUrl) return null
  let hubUrl = (env.BKESARI_SSO_URL ?? '').trim().replace(/\/+$/, '')
  if (!hubUrl) hubUrl = new URL(introspectUrl).origin
  return {
    introspectUrl,
    clientId: env.BKESARI_SSO_CLIENT_ID ?? '',
    clientSecret: env.BKESARI_SSO_CLIENT_SECRET ?? '',
    hubUrl,
    enforce: /^(1|true|yes|on)$/i.test(env.BKESARI_SSO_ENFORCE ?? ''),
    cookieNames: (env.BKESARI_SSO_COOKIE ?? '__Host-bk_sso,bk_sso').split(',').map((s) => s.trim()).filter(Boolean),
  }
}

/** The central session token from a Cookie header, or null. */
export function readSsoToken(cookieHeader: string | null | undefined, names: string[]): string | null {
  const jar = new Map<string, string>()
  for (const part of String(cookieHeader ?? '').split(';')) {
    const i = part.indexOf('=')
    if (i < 0) continue
    const k = part.slice(0, i).trim()
    if (!jar.has(k)) jar.set(k, part.slice(i + 1).trim())
  }
  for (const n of names) {
    const v = jar.get(n)
    if (v) return decodeURIComponent(v)
  }
  return null
}

const cache = new Map<string, { at: number; value: SsoIdentity | null }>()
const TTL_MS = 30_000

async function cacheKey(token: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token))
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('')
}

/**
 * Asks the central service who is behind `token`. null when nobody is (or the
 * service cannot be reached: failing closed, a project never invents a user).
 */
export async function introspect(
  token: string | null,
  cfg: SsoConfig,
  { fresh = false, fetchImpl = fetch }: { fresh?: boolean; fetchImpl?: typeof fetch } = {},
): Promise<SsoIdentity | null> {
  if (!token) return null
  const key = await cacheKey(token)
  const hit = cache.get(key)
  if (!fresh && hit && Date.now() - hit.at < TTL_MS) return hit.value
  let value: SsoIdentity | null = null
  try {
    const res = await fetchImpl(cfg.introspectUrl, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: 'Basic ' + btoa(`${encodeURIComponent(cfg.clientId)}:${encodeURIComponent(cfg.clientSecret)}`),
      },
      body: JSON.stringify({ token }),
      cache: 'no-store',
    })
    if (res.ok) {
      const body = await res.json()
      if (body && body.active === true && body.user && body.user.id) value = body as SsoIdentity
    } else {
      console.error(`[bkesari-sso] introspection answered ${res.status}`)
    }
  } catch (err) {
    console.error('[bkesari-sso] introspection failed:', (err as Error).message)
  }
  if (cache.size > 5000) cache.clear()
  cache.set(key, { at: Date.now(), value })
  return value
}

export function entitled(identity: SsoIdentity | null): boolean {
  return Boolean(identity && identity.features.includes(FEATURE))
}

/** Where to send someone to sign in centrally, coming back to `callbackPath`. */
export function centralLoginUrl(cfg: SsoConfig, basePath: string, callbackPath: string): string {
  const back = `${basePath}/sso?callbackUrl=${encodeURIComponent(callbackPath)}`
  return `${cfg.hubUrl}/auth/login?return_to=${encodeURIComponent(back)}`
}

export function subscribeUrl(cfg: SsoConfig): string {
  return `${cfg.hubUrl}/auth/subscribe/${FEATURE.toLowerCase()}`
}

/** Paths that never need a session (they carry their own credential, or are public pages). */
const MACHINE = ['/api/cron/', '/api/invitations/', '/claim/']
const PUBLIC_PAGES = ['/', '/privacy', '/terms']
const LOCAL_LOGIN = ['/login', '/register', '/forgot-password']

export type Decision =
  | { action: 'next' }
  | { action: 'redirect'; to: string; external?: boolean }
  | { action: 'json'; status: number; body: Record<string, unknown> }

/**
 * What the middleware should do with a request, given the central identity
 * and the local next-auth token. Pure, so every branch is unit-tested.
 *
 *   path        pathname without the basePath (as Next's middleware sees it)
 *   localSub    the central user id a local token was minted for, if any
 *   localToken  whether there is a local next-auth token at all
 */
export function decide(input: {
  path: string
  search: string
  isApi: boolean
  localToken: boolean
  localSub: string | null
  identity: SsoIdentity | null
  cfg: SsoConfig
  basePath: string
}): Decision {
  const { path, search, isApi, localToken, localSub, identity, cfg, basePath } = input
  if (path.startsWith('/sso') || path.startsWith('/api/auth/') || MACHINE.some((p) => path.startsWith(p))) return { action: 'next' }
  const isPublic = PUBLIC_PAGES.includes(path)
  const isLocalLogin = LOCAL_LOGIN.some((p) => path === p || path.startsWith(`${p}/`))
  const here = `${path}${search}`

  if (identity) {
    if (!entitled(identity)) {
      if (isPublic) return { action: 'next' }
      if (isApi) return { action: 'json', status: 403, body: { error: 'subscription_required', feature: FEATURE, subscribe: subscribeUrl(cfg) } }
      return { action: 'redirect', to: subscribeUrl(cfg), external: true }
    }
    // Entitled: the local session must be the one minted for this central user.
    if (localToken && localSub === identity.user.id) return { action: 'next' }
    if (isApi) return { action: 'json', status: 401, body: { error: 'session_bridge_required' } }
    if (path === '/') return { action: 'redirect', to: `/sso?callbackUrl=${encodeURIComponent('/dashboard')}` }
    if (isPublic) return { action: 'next' }
    return { action: 'redirect', to: `/sso?callbackUrl=${encodeURIComponent(isLocalLogin ? '/dashboard' : here)}` }
  }

  // No central session.
  if (localSub) {
    // This local session came from the central login, which has since ended:
    // single logout reaches LadWani here.
    if (isApi) return { action: 'json', status: 401, body: { error: 'login_required' } }
    return { action: 'redirect', to: `/sso/signout?next=${encodeURIComponent(isPublic ? path : here)}` }
  }
  if (!cfg.enforce) return { action: 'next' }
  if (isPublic) return { action: 'next' }
  if (isApi) return { action: 'json', status: 401, body: { error: 'login_required', login: `${cfg.hubUrl}/auth/login` } }
  if (localToken) return { action: 'redirect', to: `/sso/signout?next=${encodeURIComponent(here)}` }
  return { action: 'redirect', to: centralLoginUrl(cfg, basePath, isLocalLogin ? '/dashboard' : here), external: true }
}
