/**
 * Central login (bkesari.com) for LadWani: the middleware's decisions,
 * introspection, the bridge into a local account, role sync, and the local
 * password login being switched off when central login is enforced.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { prisma } from '@/lib/prisma'
import { decide, introspect, readSsoToken, ssoConfig, type SsoIdentity, type SsoConfig } from '@/lib/bkesari-sso'
import { provisionFromSso, bridgedRoles, SSO_GRANTOR } from '@/lib/bkesari-sso-server'
import { authOptions, validateLogin } from '@/lib/auth'
import { POST as register } from '@/app/api/auth/register/route'

const cfg: SsoConfig = {
  introspectUrl: 'https://dev.bkesari.com/auth/api/introspect',
  clientId: 'ladwani-dev',
  clientSecret: 's3cret',
  hubUrl: 'https://dev.bkesari.com',
  enforce: false,
  cookieNames: ['__Host-bk_sso', 'bk_sso'],
}

function identity(over: Partial<SsoIdentity> & { email?: string } = {}): SsoIdentity {
  const email = over.email ?? 'sso.person@example.test'
  return {
    active: true,
    sid: 'sid-1',
    user: { id: `central-${email}`, email, name: 'Sso Person', email_verified: true },
    roles: ['USER'],
    moderator_of: [],
    features: ['LADWANI'],
    permissions: ['ladwani.view', 'ladwani.edit_tree'],
    mfa: false,
    ...over,
  }
}

const base = { search: '', isApi: false, localToken: false, localSub: null, cfg, basePath: '/ladwani' }

describe('middleware decisions', () => {
  it('lets machine paths, next-auth and the bridge through untouched', () => {
    for (const path of ['/api/cron/daily', '/api/invitations/x', '/claim/abc', '/api/auth/session', '/sso', '/sso/signout']) {
      expect(decide({ ...base, path, identity: null, cfg: { ...cfg, enforce: true } })).toEqual({ action: 'next' })
    }
  })

  it('an entitled central user without a local session is bridged, keeping the destination', () => {
    expect(decide({ ...base, path: '/families/1', search: '?tab=tree', identity: identity() }))
      .toEqual({ action: 'redirect', to: `/sso?callbackUrl=${encodeURIComponent('/families/1?tab=tree')}` })
    expect(decide({ ...base, path: '/login', identity: identity() }))
      .toEqual({ action: 'redirect', to: `/sso?callbackUrl=${encodeURIComponent('/dashboard')}` })
    expect(decide({ ...base, path: '/api/members', isApi: true, identity: identity() }))
      .toMatchObject({ action: 'json', status: 401 })
  })

  it('a local session minted for this central user passes', () => {
    const id = identity()
    expect(decide({ ...base, path: '/dashboard', identity: id, localToken: true, localSub: id.user.id })).toEqual({ action: 'next' })
  })

  it('a local session for someone else is replaced by a fresh bridge', () => {
    expect(decide({ ...base, path: '/dashboard', identity: identity(), localToken: true, localSub: 'another-central-user' }))
      .toMatchObject({ action: 'redirect', to: expect.stringMatching(/^\/sso\?/) })
  })

  it('without the LADWANI subscription: pages go to the subscribe page, APIs get 403', () => {
    const id = identity({ features: ['EDUCATION'] })
    expect(decide({ ...base, path: '/dashboard', identity: id, localToken: true, localSub: id.user.id }))
      .toEqual({ action: 'redirect', to: 'https://dev.bkesari.com/auth/subscribe/ladwani', external: true })
    const api = decide({ ...base, path: '/api/families', isApi: true, identity: id })
    expect(api).toMatchObject({ action: 'json', status: 403, body: { error: 'subscription_required' } })
    expect(decide({ ...base, path: '/privacy', identity: id })).toEqual({ action: 'next' })
  })

  it('when the central session ends, a bridged local session is ended too (single logout)', () => {
    expect(decide({ ...base, path: '/dashboard', identity: null, localToken: true, localSub: 'central-x' }))
      .toEqual({ action: 'redirect', to: `/sso/signout?next=${encodeURIComponent('/dashboard')}` })
    expect(decide({ ...base, path: '/api/members', isApi: true, identity: null, localToken: true, localSub: 'central-x' }))
      .toMatchObject({ action: 'json', status: 401 })
  })

  it('not enforced: no central session leaves the existing local login alone', () => {
    expect(decide({ ...base, path: '/dashboard', identity: null, localToken: true })).toEqual({ action: 'next' })
    expect(decide({ ...base, path: '/login', identity: null })).toEqual({ action: 'next' })
  })

  it('enforced: local login pages and local-only sessions lead to the central login', () => {
    const enforced = { ...cfg, enforce: true }
    const login = decide({ ...base, cfg: enforced, path: '/login', identity: null })
    expect(login).toEqual({
      action: 'redirect', external: true,
      to: `https://dev.bkesari.com/auth/login?return_to=${encodeURIComponent(`/ladwani/sso?callbackUrl=${encodeURIComponent('/dashboard')}`)}`,
    })
    expect(decide({ ...base, cfg: enforced, path: '/dashboard', identity: null, localToken: true }))
      .toMatchObject({ action: 'redirect', to: expect.stringMatching(/^\/sso\/signout/) })
    expect(decide({ ...base, cfg: enforced, path: '/api/x', isApi: true, identity: null })).toMatchObject({ action: 'json', status: 401 })
    expect(decide({ ...base, cfg: enforced, path: '/', identity: null })).toEqual({ action: 'next' })
  })
})

describe('introspection', () => {
  it('reads the central cookie, prefixed name first', () => {
    expect(readSsoToken('a=1; bk_sso=plain; __Host-bk_sso=secure', cfg.cookieNames)).toBe('secure')
    expect(readSsoToken('bk_sso=plain', cfg.cookieNames)).toBe('plain')
    expect(readSsoToken('other=1', cfg.cookieNames)).toBeNull()
  })

  it('authenticates as the client, caches for a while, and fails closed', async () => {
    const fetchImpl = vi.fn(async (_url: any, init: any) => {
      expect(init.headers.authorization).toBe('Basic ' + btoa('ladwani-dev:s3cret'))
      expect(JSON.parse(init.body)).toEqual({ token: 'tok-cache' })
      return new Response(JSON.stringify(identity()), { status: 200 })
    }) as unknown as typeof fetch
    expect((await introspect('tok-cache', cfg, { fetchImpl }))?.user.email).toBe('sso.person@example.test')
    await introspect('tok-cache', cfg, { fetchImpl })
    expect(fetchImpl).toHaveBeenCalledTimes(1)
    await introspect('tok-cache', cfg, { fetchImpl, fresh: true })
    expect(fetchImpl).toHaveBeenCalledTimes(2)

    const down = vi.fn(async () => { throw new Error('ECONNREFUSED') }) as unknown as typeof fetch
    expect(await introspect('tok-down', cfg, { fetchImpl: down })).toBeNull()
    const inactive = vi.fn(async () => new Response(JSON.stringify({ active: false }))) as unknown as typeof fetch
    expect(await introspect('tok-inactive', cfg, { fetchImpl: inactive })).toBeNull()
    const refused = vi.fn(async () => new Response('{}', { status: 401 })) as unknown as typeof fetch
    expect(await introspect('tok-refused', cfg, { fetchImpl: refused })).toBeNull()
  })

  it('is off unless configured', () => {
    expect(ssoConfig({})).toBeNull()
    expect(ssoConfig({ BKESARI_SSO_INTROSPECT_URL: cfg.introspectUrl })?.hubUrl).toBe('https://dev.bkesari.com')
  })
})

describe('the bridge into a LadWani account', () => {
  const emails: string[] = []
  const id = (email: string, over: Partial<SsoIdentity> = {}) => { emails.push(email); return identity({ email, ...over }) }
  afterEach(async () => {
    await prisma.user.deleteMany({ where: { email: { in: emails } } }).catch(() => {})
  })

  it('creates a member account with an unusable password on first visit, then reuses it', async () => {
    const first = await provisionFromSso(id('sso.new@example.test'))
    expect(first.roles).toEqual(['MEMBER'])
    expect(first.memberId).toBeTruthy()
    expect(first.ssoSub).toBe('central-sso.new@example.test')
    const row = await prisma.user.findUniqueOrThrow({ where: { email: 'sso.new@example.test' }, include: { consentRecords: true } })
    expect(row.status).toBe('ACTIVE')
    expect(row.passwordHash).toMatch(/^\$2/)
    expect(row.consentRecords).toHaveLength(1)
    const again = await provisionFromSso(id('sso.new@example.test'))
    expect(again.id).toBe(first.id)
  })

  it('links an existing LadWani account by email', async () => {
    const existing = await prisma.user.findUniqueOrThrow({ where: { email: 'test.karta@example.test' } })
    const bridged = await provisionFromSso(identity({ email: 'test.karta@example.test' }))
    expect(bridged.id).toBe(existing.id)
    expect(bridged.roles).toContain('KARTA')
  })

  it('maps central ADMIN and LADWANI moderators, and removes only roles it granted', async () => {
    expect(bridgedRoles(identity({ roles: ['ADMIN'] }))).toEqual(['ADMIN'])
    expect(bridgedRoles(identity({ roles: ['SUPER_ADMIN'] }))).toEqual(['ADMIN'])
    expect(bridgedRoles(identity({ moderator_of: ['LADWANI'] }))).toEqual(['OPERATOR'])
    expect(bridgedRoles(identity({ moderator_of: ['EDUCATION'] }))).toEqual([])

    const email = 'sso.admin@example.test'
    let u = await provisionFromSso(id(email, { roles: ['USER', 'ADMIN'] }))
    expect(u.roles.sort()).toEqual(['ADMIN', 'MEMBER'])
    const granted = await prisma.userRole.findFirstOrThrow({ where: { userId: u.id, role: { code: 'ADMIN' } } })
    expect(granted.grantedBy).toBe(SSO_GRANTOR)
    u = await provisionFromSso(id(email, { roles: ['USER'] }))
    expect(u.roles).toEqual(['MEMBER'])

    // A role given inside LadWani stays, whatever the central account says.
    const karta = await provisionFromSso(identity({ email: 'test.karta@example.test', roles: ['USER'] }))
    expect(karta.roles).toContain('KARTA')
  })

  it('a LadWani-suspended account is not let in through the bridge', async () => {
    const email = 'sso.suspended@example.test'
    const u = await provisionFromSso(id(email))
    await prisma.user.update({ where: { id: u.id }, data: { status: 'SUSPENDED' } })
    await expect(provisionFromSso(id(email))).rejects.toThrow('ACCOUNT_SUSPENDED')
  })
})

describe('next-auth provider and enforcement', () => {
  const saved = { ...process.env }
  beforeEach(() => {
    process.env.BKESARI_SSO_INTROSPECT_URL = cfg.introspectUrl
    process.env.BKESARI_SSO_CLIENT_ID = cfg.clientId
    process.env.BKESARI_SSO_CLIENT_SECRET = cfg.clientSecret
  })
  afterEach(async () => {
    process.env = { ...saved }
    vi.unstubAllGlobals()
    await prisma.user.deleteMany({ where: { email: 'sso.provider@example.test' } }).catch(() => {})
  })

  const provider = () => (authOptions.providers.find((p: any) => (p.options?.id ?? p.id) === 'bkesari-sso') as any).options

  it('the bkesari-sso provider signs in an entitled central user from the cookie alone', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(identity({ email: 'sso.provider@example.test' })))))
    const user = await provider().authorize({}, { headers: { cookie: '__Host-bk_sso=tok-provider-1' } })
    expect(user.email).toBe('sso.provider@example.test')
    expect(user.ssoSub).toBe('central-sso.provider@example.test')
  })

  it('refuses without a cookie, and without the LADWANI feature', async () => {
    const f = vi.fn(async () => new Response(JSON.stringify(identity({ email: 'sso.provider@example.test', features: [] }))))
    vi.stubGlobal('fetch', f)
    expect(await provider().authorize({}, { headers: {} })).toBeNull()
    expect(f).not.toHaveBeenCalled()
    expect(await provider().authorize({}, { headers: { cookie: 'bk_sso=tok-provider-2' } })).toBeNull()
    expect(await prisma.user.findUnique({ where: { email: 'sso.provider@example.test' } })).toBeNull()
  })

  it('enforced: LadWani passwords and registration are switched off', async () => {
    process.env.BKESARI_SSO_ENFORCE = '1'
    expect(await validateLogin('test.member@example.test', 'anything-at-all')).toEqual({ ok: false, code: 'SSO_REQUIRED' })
    const res = await register(new Request('http://x/api/auth/register', { method: 'POST', body: JSON.stringify({}) }))
    expect(res.status).toBe(403)
  })
})
