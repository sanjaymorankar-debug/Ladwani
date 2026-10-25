/**
 * Both processes of the rebuild in one, for a single Hostinger Node.js site.
 *
 * The API (NestJS) listens on 127.0.0.1:API_PORT (default 4001) and the web app
 * (Next.js standalone, built by `npm run build:hostinger`) on the site's PORT.
 * The web app reaches the API through its own /api/v1 rewrite, so build it with
 * NEXT_PUBLIC_API_URL=http://127.0.0.1:<API_PORT> (and BASE_PATH, e.g. /ladwani).
 * Nothing reaches the API from outside: the browser only ever talks to the web app.
 */
process.env.API_PORT = process.env.API_PORT || '4001'
const path = require('path')
require(path.join(__dirname, '..', 'apps', 'api', 'dist', 'main.js'))
require(path.join(__dirname, '..', 'apps', 'web', '.next', 'standalone', 'apps', 'web', 'server.js'))
