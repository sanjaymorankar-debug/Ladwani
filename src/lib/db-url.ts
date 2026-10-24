/**
 * Connection-string defaults the app adds to DATABASE_URL at runtime, for
 * Neon. Each one is added only when the URL does not set it already.
 *
 * - connect_timeout: Neon suspends an idle compute, and the first connection
 *   after that has to wake it, which takes longer than an ordinary connect.
 *   Prisma's own default is 5 s.
 * - max_idle_connection_lifetime: a suspend also drops every open connection
 *   from the server side. Prisma does not notice until it uses one: each dead
 *   connection in its pool fails one query with P1017 ("Server has closed the
 *   connection"). Retiring connections that have sat idle longer than this
 *   means none survives to the next request, since Neon only suspends after
 *   minutes without activity.
 *
 * Everything else in the URL is left exactly as written: `sslmode`,
 * `channel_binding` and any other parameter go through untouched, and the
 * string is not re-encoded, so a password with special characters survives.
 */
export const CONNECTION_DEFAULTS = {
  connect_timeout: 15, // seconds
  max_idle_connection_lifetime: 30, // seconds
} as const

export function withConnectionDefaults(url: string | undefined): string | undefined {
  if (!url) return url
  const [base, ...fragment] = url.split('#')
  const missing = Object.entries(CONNECTION_DEFAULTS).filter(
    ([key]) => !new RegExp(`[?&]${key}=`).test(base),
  )
  if (!missing.length) return url
  const params = missing.map(([key, value]) => `${key}=${value}`).join('&')
  const sep = !base.includes('?') ? '?' : base.endsWith('?') || base.endsWith('&') ? '' : '&'
  return `${base}${sep}${params}${fragment.length ? `#${fragment.join('#')}` : ''}`
}
