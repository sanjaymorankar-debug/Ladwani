#!/usr/bin/env node
// Cross-platform "run this command with vars from an env file" — avoids
// shell-specific env-var syntax (VAR=x cmd works in bash, not cmd.exe) and
// avoids depending on Node's --env-file flag composing with npx/prisma.
const fs = require('fs')
const path = require('path')
const { spawnSync } = require('child_process')

const [, , envFile, command, ...args] = process.argv

if (!envFile || !command) {
  console.error('Usage: node scripts/with-env.js <envFile> <command> [args...]')
  process.exit(1)
}

const envPath = path.resolve(process.cwd(), envFile)
const env = { ...process.env }

if (fs.existsSync(envPath)) {
  const content = fs.readFileSync(envPath, 'utf-8')
  for (const rawLine of content.split('\n')) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) continue
    const eq = line.indexOf('=')
    if (eq === -1) continue
    const key = line.slice(0, eq).trim()
    let value = line.slice(eq + 1).trim()
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1)
    }
    // ${NAME} refers to a variable defined earlier (or already in the
    // environment), as in Prisma's and Next's own .env loading, so a file
    // copied from .env.example means the same thing here.
    value = value.replace(/\$\{([A-Za-z_][A-Za-z0-9_]*)\}/g, (_, name) => env[name] ?? '')
    env[key] = value
  }
} else {
  console.error(`env file not found: ${envPath}`)
  process.exit(1)
}

// prisma/schema.prisma reads the direct (unpooled) URL for the CLI from
// DATABASE_URL_UNPOOLED. With a single database, as in local tests and CI,
// that is the same URL, so one variable is enough.
if (!env.DATABASE_URL_UNPOOLED && env.DATABASE_URL) {
  env.DATABASE_URL_UNPOOLED = env.DATABASE_URL
}

const result = spawnSync(command, args, { stdio: 'inherit', env, shell: process.platform === 'win32' })
process.exit(result.status ?? 1)
