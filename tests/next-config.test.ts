import { describe, it, expect, afterEach } from 'vitest'
import { createRequire } from 'module'
import path from 'path'

// next.config.js is evaluated by `next build` and again by `next start`; a
// bad BASE_PATH or NEXTAUTH_URL must stop the app there rather than serve it
// half-working under /ladwani.
const require = createRequire(import.meta.url)
const CONFIG = path.resolve(__dirname, '../next.config.js')
const saved = { BASE_PATH: process.env.BASE_PATH, NEXTAUTH_URL: process.env.NEXTAUTH_URL }

function load(env: { BASE_PATH?: string; NEXTAUTH_URL?: string }) {
  for (const [k, v] of Object.entries(env)) {
    if (v === undefined) delete process.env[k]
    else process.env[k] = v
  }
  delete require.cache[CONFIG]
  return require(CONFIG)
}

afterEach(() => {
  for (const [k, v] of Object.entries(saved)) {
    if (v === undefined) delete process.env[k]
    else process.env[k] = v
  }
  delete require.cache[CONFIG]
})

describe('next.config.js', () => {
  it('serves under BASE_PATH and hands the same value to the browser', () => {
    const cfg = load({ BASE_PATH: '/ladwani', NEXTAUTH_URL: 'https://bkesari.com/ladwani/api/auth' })
    expect(cfg.basePath).toBe('/ladwani')
    expect(cfg.env.NEXT_PUBLIC_BASE_PATH).toBe('/ladwani')
  })

  it('serves from the root when BASE_PATH is unset', () => {
    const cfg = load({ BASE_PATH: undefined, NEXTAUTH_URL: 'http://localhost:3000' })
    expect(cfg.basePath).toBeUndefined()
    expect(cfg.env.NEXT_PUBLIC_BASE_PATH).toBe('')
  })

  it.each(['ladwani', '/', '/ladwani/', '/la dwani'])('refuses BASE_PATH=%j', (bp) => {
    expect(() => load({ BASE_PATH: bp, NEXTAUTH_URL: undefined })).toThrow(/BASE_PATH/)
  })

  it.each([
    'https://bkesari.com',
    'https://bkesari.com/',
    'https://bkesari.com/ladwani/api/auth',
    'https://bkesari.com/ladwani/api/auth/',
  ])('accepts NEXTAUTH_URL=%s under /ladwani', (url) => {
    expect(() => load({ BASE_PATH: '/ladwani', NEXTAUTH_URL: url })).not.toThrow()
  })

  // next-auth's middleware skips any request whose path starts with
  // NEXTAUTH_URL's path, so ".../ladwani" would switch off route protection.
  it.each([
    'https://bkesari.com/ladwani',
    'https://bkesari.com/ladwani/',
    'https://bkesari.com/api/auth',
    'https://bkesari.com/ladwani/api',
  ])('refuses NEXTAUTH_URL=%s under /ladwani', (url) => {
    expect(() => load({ BASE_PATH: '/ladwani', NEXTAUTH_URL: url })).toThrow(/NEXTAUTH_URL/)
  })

  it('accepts the plain /api/auth path when served from the root', () => {
    expect(() => load({ BASE_PATH: undefined, NEXTAUTH_URL: 'http://localhost:3000/api/auth' })).not.toThrow()
  })
})
