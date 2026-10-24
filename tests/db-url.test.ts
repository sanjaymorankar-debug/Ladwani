import { describe, it, expect } from 'vitest'
import { withConnectionDefaults, CONNECTION_DEFAULTS } from '@/lib/db-url'

// The URL the app connects with at runtime (src/lib/prisma.ts). Neon's
// connection strings end in ?sslmode=require&channel_binding=require; those
// must reach Prisma untouched, with only the two Neon defaults added.
describe('withConnectionDefaults', () => {
  const neonPooled =
    'postgresql://ladwani_app:p%40ss%2Fw0rd@ep-x-pooler.ap-southeast-1.aws.neon.tech/ladwani?sslmode=require&channel_binding=require'
  const defaults = `connect_timeout=${CONNECTION_DEFAULTS.connect_timeout}&max_idle_connection_lifetime=${CONNECTION_DEFAULTS.max_idle_connection_lifetime}`

  it('gives a cold start at least 10 s and retires idle connections well inside Neon\'s suspend delay', () => {
    expect(CONNECTION_DEFAULTS.connect_timeout).toBeGreaterThanOrEqual(10)
    // Neon suspends after 5 minutes idle by default, 1 minute at the least.
    expect(CONNECTION_DEFAULTS.max_idle_connection_lifetime).toBeLessThan(60)
  })

  it('adds both to a Neon URL and keeps every other parameter as written', () => {
    const out = withConnectionDefaults(neonPooled)!
    expect(out).toBe(`${neonPooled}&${defaults}`)
    expect(out).toContain('sslmode=require')
    expect(out).toContain('channel_binding=require')
    // the percent-encoded password is not decoded or re-encoded
    expect(out).toContain('ladwani_app:p%40ss%2Fw0rd@')
  })

  it('keeps values the URL already sets and adds only what is missing', () => {
    const both = 'postgresql://u:p@127.0.0.1:5432/db?connect_timeout=30&max_idle_connection_lifetime=5&sslmode=require'
    expect(withConnectionDefaults(both)).toBe(both)
    const one = 'postgresql://u:p@127.0.0.1:5432/db?connect_timeout=30'
    expect(withConnectionDefaults(one)).toBe(
      `${one}&max_idle_connection_lifetime=${CONNECTION_DEFAULTS.max_idle_connection_lifetime}`
    )
  })

  it('starts a query string when there is none', () => {
    expect(withConnectionDefaults('postgresql://u:p@localhost:5432/db')).toBe(
      `postgresql://u:p@localhost:5432/db?${defaults}`
    )
  })

  it('leaves an unset URL unset, so Prisma reports the missing DATABASE_URL itself', () => {
    expect(withConnectionDefaults(undefined)).toBeUndefined()
    expect(withConnectionDefaults('')).toBe('')
  })
})
