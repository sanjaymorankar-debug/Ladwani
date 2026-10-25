// @ts-check

// P6 Content-Security-Policy for pages. Next.js 14 writes small inline
// scripts and styles into every page, so 'unsafe-inline' stays (a per-request
// nonce would make every page dynamic); the policy still blocks scripts,
// frames and plugins from other sites, <base> hijacks, forms posting
// elsewhere and framing by other sites. The dev server also needs 'unsafe-eval'.
// Build with CSP_REPORT_ONLY=true to only report violations (rollback switch).
const isDev = process.env.NODE_ENV !== 'production'
const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ''}`,
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' data: https://fonts.gstatic.com",
  // Map tiles (profile location) and the image hosts allowed below.
  "img-src 'self' data: blob: https://*.tile.openstreetmap.org https://agtci.com https://*.agtci.com https://*.amazonaws.com https://*.r2.cloudflarestorage.com",
  "connect-src 'self'",
  "media-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join('; ')
/**
 * The path prefix this app is served under.
 *
 * On bkesari.com the hub forwards /ladwani/ to this app and does NOT strip the
 * prefix, so the app has to own it. `basePath` is what makes Next emit
 * /ladwani/_next/... for assets and /ladwani/families for links.
 *
 * It must be set in TWO places: in the build, because Next inlines it into the
 * client bundles, and at runtime, because `next start` evaluates this file
 * again to decide how to route. Empty by default, so `npm run dev` and any
 * direct visit to this app's own hostname work exactly as before.
 *
 * NEXT_PUBLIC_BASE_PATH carries the same value to the browser, where
 * src/lib/api-path.ts uses it. `basePath` does NOT rewrite fetch() arguments —
 * only Next's own links, router and assets — so the app's own API calls need
 * the prefix applying themselves.
 */
function readBasePath() {
  const raw = (process.env.BASE_PATH ?? '').trim()
  if (!raw) return ''
  if (!raw.startsWith('/')) {
    throw new Error(`BASE_PATH must start with "/" (got ${JSON.stringify(raw)})`)
  }
  if (raw === '/') {
    throw new Error('BASE_PATH must not be "/" — leave it unset to serve from the root')
  }
  if (raw.endsWith('/')) {
    throw new Error(`BASE_PATH must not end with "/" (got ${JSON.stringify(raw)})`)
  }
  if (!/^(\/[A-Za-z0-9._~-]+)+$/.test(raw)) {
    throw new Error(`BASE_PATH is not a plain URL path (got ${JSON.stringify(raw)})`)
  }
  return raw
}

const basePath = readBasePath()

/**
 * NEXTAUTH_URL may be the site's origin (https://bkesari.com) or the full URL
 * of this app's auth API (https://bkesari.com/ladwani/api/auth). Any other
 * path is refused, because next-auth's middleware skips every request whose
 * path starts with NEXTAUTH_URL's path: set to .../ladwani, it would stop
 * protecting every page of the app, and nothing else would look wrong.
 */
function checkNextAuthUrl() {
  const raw = (process.env.NEXTAUTH_URL ?? '').trim()
  if (!raw) return
  let path
  try {
    path = new URL(raw.startsWith('http') ? raw : `https://${raw}`).pathname.replace(/\/$/, '')
  } catch {
    throw new Error(`NEXTAUTH_URL is not a URL (got ${JSON.stringify(raw)})`)
  }
  if (path && path !== `${basePath}/api/auth`) {
    throw new Error(
      `NEXTAUTH_URL must be the site's origin or end in ${basePath}/api/auth (got ${JSON.stringify(raw)}). ` +
        "With any other path next-auth's middleware stops protecting the app's pages."
    )
  }
}
checkNextAuthUrl()

/** @type {import('next').NextConfig} */
const nextConfig = {
  ...(basePath ? { basePath } : {}),
  env: {
    // Inlined for the browser, so client components can prefix their own
    // fetches with the same value the server routes on.
    NEXT_PUBLIC_BASE_PATH: basePath,
  },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'agtci.com' },
      { protocol: 'https', hostname: '*.agtci.com' },
      { protocol: 'https', hostname: '**.amazonaws.com' },
      { protocol: 'https', hostname: '**.r2.cloudflarestorage.com' },
    ],
    unoptimized: false,
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          // P6 hardening: browsers keep to HTTPS for a year (ignored on plain-HTTP localhost).
          { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-XSS-Protection', value: '1; mode=block' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(self)' },
        ],
      },
      {
        // Pages only: API routes return JSON or files (ID proofs and
        // certificates open inline, and a PDF viewer must not be blocked).
        source: '/((?!api/).*)',
        headers: [
          { key: process.env.CSP_REPORT_ONLY === 'true' ? 'Content-Security-Policy-Report-Only' : 'Content-Security-Policy', value: contentSecurityPolicy },
        ],
      },
    ]
  },
}

module.exports = nextConfig
