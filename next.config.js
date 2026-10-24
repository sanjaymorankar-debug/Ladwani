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

/** @type {import('next').NextConfig} */
const nextConfig = {
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
