// @ts-check

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
  optimizeFonts: false,
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
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-XSS-Protection', value: '1; mode=block' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(self)' },
        ],
      },
    ]
  },
}

module.exports = nextConfig
