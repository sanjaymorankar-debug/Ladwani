import { NextResponse } from 'next/server'

/**
 * In-memory sliding-window rate limiter. Per-process only — resets on
 * deploy/restart and isn't shared across instances. On Hostinger the app runs
 * as a single `next start` process (P6 runbook), so one map covers every
 * request. Good enough as a first line of defense on top of the per-account
 * 5-attempt lock in validateLogin() and the 5-try burn on OTPs; swap for a
 * Redis-backed limiter if the app ever runs as several processes.
 */

const hits = new Map<string, number[]>()
const LONGEST_WINDOW_MS = 60 * 60 * 1000
let lastSweep = Date.now()

/** Drops keys with no hit inside the longest window, so the map can't grow without bound. */
function sweep(now: number) {
  if (now - lastSweep < 10 * 60 * 1000) return
  lastSweep = now
  hits.forEach((times, key) => {
    if (now - times[times.length - 1] >= LONGEST_WINDOW_MS) hits.delete(key)
  })
}

export function checkRateLimit(
  key: string,
  windowMs = 15 * 60 * 1000,
  maxHits = 10
): { allowed: boolean; retryAfter: number } {
  const now = Date.now()
  sweep(now)
  const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs)

  if (recent.length >= maxHits) {
    hits.set(key, recent)
    return { allowed: false, retryAfter: Math.max(1, Math.ceil((recent[0] + windowMs - now) / 1000)) }
  }

  recent.push(now)
  hits.set(key, recent)
  return { allowed: true, retryAfter: 0 }
}

/** P6 limits. Keyed on the account where there is one, so changing IP doesn't help. */
export const LIMITS = {
  /** Sign-ups from one address (generous: mobile networks share addresses). */
  register: { windowMs: 60 * 60 * 1000, max: 20 },
  /** Guesses at a sign-up code, per account. */
  otpVerify: { windowMs: 15 * 60 * 1000, max: 10 },
  /** Password-reset codes sent, per account and per address. */
  resetRequest: { windowMs: 60 * 60 * 1000, max: 5 },
  resetRequestIp: { windowMs: 60 * 60 * 1000, max: 20 },
  /** Guesses at a password-reset code, per account. */
  resetConfirm: { windowMs: 15 * 60 * 1000, max: 5 },
  /** Member search, directory and bureau listings, per signed-in user. */
  search: { windowMs: 60 * 1000, max: 60 },
} as const

export type Limit = { windowMs: number; max: number }

/** Records a hit on each key; returns a 429 response if any is over its limit, else null. */
export function tooManyRequests(...checks: [key: string, limit: Limit][]): NextResponse | null {
  let retryAfter = 0
  for (const [key, limit] of checks) {
    const r = checkRateLimit(key, limit.windowMs, limit.max)
    if (!r.allowed) retryAfter = Math.max(retryAfter, r.retryAfter)
  }
  if (!retryAfter) return null
  return NextResponse.json(
    { message: 'Too many requests. Please wait a few minutes and try again.' },
    { status: 429, headers: { 'Retry-After': String(retryAfter) } }
  )
}

/** Tests only: start from an empty map. */
export function resetRateLimits() {
  hits.clear()
}
