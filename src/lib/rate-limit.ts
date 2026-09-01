/**
 * In-memory sliding-window rate limiter. Per-process only — resets on
 * deploy/restart and isn't shared across serverless instances. Good enough
 * as a first line of brute-force defense on top of the per-account 5-attempt
 * lock in validateLogin(); swap for a Redis-backed limiter if/when Redis is
 * actually provisioned for this deployment.
 */

const hits = new Map<string, number[]>()

export function checkRateLimit(
  key: string,
  windowMs = 15 * 60 * 1000,
  maxHits = 10
): { allowed: boolean } {
  const now = Date.now()
  const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs)

  if (recent.length >= maxHits) {
    hits.set(key, recent)
    return { allowed: false }
  }

  recent.push(now)
  hits.set(key, recent)
  return { allowed: true }
}
