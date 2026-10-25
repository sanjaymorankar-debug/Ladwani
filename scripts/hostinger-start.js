/**
 * Both processes of the rebuild for a single Hostinger Node.js site.
 *
 * The API (NestJS) runs as a CHILD process on 127.0.0.1:API_PORT (default 4001)
 * and the web app (Next.js standalone, built by `npm run build:hostinger`) in
 * this process on the site's PORT. The web app reaches the API through its own
 * /api/v1 rewrite, so build it with NEXT_PUBLIC_API_URL=http://127.0.0.1:<API_PORT>
 * (and BASE_PATH, e.g. /ladwani). Nothing reaches the API from outside.
 *
 * A child, not a second require(): Hostinger's launcher hooks http.Server.listen
 * in the process it starts and lets only the first call through ("listen() was
 * called more than once, ignore"), so an in-process API never got its port. The
 * child is started with the launcher's preload stripped, so its listen is real.
 */
const path = require('path')
const { fork } = require('child_process')

process.env.API_PORT = process.env.API_PORT || '4001'

function startApi() {
  const env = { ...process.env }
  delete env.NODE_OPTIONS
  delete env.PORT
  const child = fork(path.join(__dirname, '..', 'apps', 'api', 'dist', 'main.js'), [], { env, execArgv: [] })
  child.on('exit', (code, signal) => {
    console.error(`API process exited (${signal || code}); restarting in 2 s`)
    setTimeout(startApi, 2000)
  })
  return child
}

const api = startApi()
for (const sig of ['SIGTERM', 'SIGINT']) {
  process.on(sig, () => { api.removeAllListeners('exit'); api.kill(sig); process.exit(0) })
}

require(path.join(__dirname, '..', 'apps', 'web', '.next', 'standalone', 'apps', 'web', 'server.js'))
