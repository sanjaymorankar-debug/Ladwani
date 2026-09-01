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
    env[key] = value
  }
} else {
  console.error(`env file not found: ${envPath}`)
  process.exit(1)
}

const result = spawnSync(command, args, { stdio: 'inherit', env, shell: process.platform === 'win32' })
process.exit(result.status ?? 1)
