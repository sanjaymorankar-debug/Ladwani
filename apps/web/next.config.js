/**
 * BASE_PATH serves the app under a path prefix, e.g. BASE_PATH=/ladwani so the
 * bkesari.com hub can forward /ladwani/ here with the prefix intact (the hub's
 * DEPLOY.md, Part 7). Unset, the app is at the root as before.
 *
 * It is read at build time AND when `next start` runs, so set it in both
 * places. Next applies it to <Link>, router.push, assets and the rewrite below,
 * but not to fetch() -- hence NEXT_PUBLIC_BASE_PATH for src/lib/api-client.ts.
 */
const basePath = process.env.BASE_PATH || ''
if (basePath && (!basePath.startsWith('/') || basePath.endsWith('/'))) {
  throw new Error(`BASE_PATH must start with "/" and not end with one (got "${basePath}")`)
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  basePath,
  env: { NEXT_PUBLIC_BASE_PATH: basePath },
  async rewrites() {
    return [
      {
        source: '/api/v1/:path*',
        destination: `${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'}/api/v1/:path*`,
      },
    ]
  },
}

module.exports = nextConfig
