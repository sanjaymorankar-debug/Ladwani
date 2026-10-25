#!/usr/bin/env node
/**
 * Neon parity check: Prisma through a transaction-mode PgBouncer, without
 * `pgbouncer=true`.
 *
 * Neon's pooled endpoint is PgBouncer in transaction mode with
 * protocol-level prepared statements supported (max_prepared_statements).
 * Prisma caches named prepared statements per connection. This opens three
 * clients of 20 connections each (60 client connections) and runs a mix of
 * model queries, raw queries and transactions on all of them at once, so
 * that statements prepared by different clients land on the same server
 * connection. A pooler without prepared-statement support fails that with
 * 42P05 "prepared statement already exists" or 26000 "does not exist".
 *
 * Usage (a seeded database: `npm run db:seed` has run on it):
 *   DATABASE_URL='postgresql://<role>:<pw>@127.0.0.1:6432/<db>?sslmode=require' \
 *     node scripts/neon-parity-pool.js [rounds]
 *
 * Refuses any host but this machine: tests never reach a hosted database.
 * Exit code 0 when every query succeeded, 1 otherwise.
 */
const { PrismaClient } = require('@prisma/client')

const base = process.env.DATABASE_URL
if (!base) {
  console.error('Set DATABASE_URL to the pooled (PgBouncer) URL of a local scratch database.')
  process.exit(2)
}
let host
try {
  host = new URL(base).hostname
} catch {
  console.error('DATABASE_URL is not a URL.')
  process.exit(2)
}
if (!['127.0.0.1', 'localhost', '::1', '[::1]'].includes(host)) {
  console.error(`Refusing ${host}: this check only runs against a database on this machine.`)
  process.exit(2)
}

const rounds = Number(process.argv[2] || 25)
const url = `${base}${base.includes('?') ? '&' : '?'}connection_limit=20&pool_timeout=30`
const clients = [0, 1, 2].map(() => new PrismaClient({ datasourceUrl: url }))

const ops = [
  (p) => p.user.findMany({ take: 5, include: { userRoles: { include: { role: true } } } }),
  (p) => p.role.findMany(),
  (p) => p.member.count({ where: { status: 'ACTIVE' } }),
  (p) => p.area.findMany({ where: { name: { contains: 'a', mode: 'insensitive' } }, take: 3 }),
  (p) => p.family.findMany({ take: 3, include: { members: true } }),
  (p, i) => p.$queryRaw`select ${i}::int + 1 as n`,
  (p, i) => p.$queryRawUnsafe(`select $1::int * ${i % 7} as n`, i),
  (p) =>
    p.$transaction(async (tx) => {
      const r = await tx.role.findFirstOrThrow({ where: { code: 'MEMBER' } })
      await tx.$executeRaw`select id from roles where id = ${r.id} for update`
      return tx.permission.count()
    }),
  (p) => p.$transaction([p.role.count(), p.relationshipType.count()]),
]

async function main() {
  let ok = 0
  const errors = new Map()
  const started = Date.now()
  for (let r = 0; r < rounds; r++) {
    const jobs = []
    for (let i = 0; i < 90; i++) {
      const p = clients[i % clients.length]
      jobs.push(
        ops[(i + r) % ops.length](p, i).then(
          () => { ok++ },
          (e) => {
            const last = String(e.message).split('\n').filter(Boolean).slice(-1)[0] ?? ''
            const key = `${e.code ?? ''} ${last.slice(0, 160)}`.trim()
            errors.set(key, (errors.get(key) ?? 0) + 1)
          },
        ),
      )
    }
    await Promise.all(jobs)
  }
  const failed = [...errors.values()].reduce((a, b) => a + b, 0)
  console.log(`${ok} queries ok, ${failed} failed, ${rounds} rounds, ${Date.now() - started} ms`)
  for (const [k, n] of errors) console.log(`  ${n} x ${k}`)
  await Promise.all(clients.map((c) => c.$disconnect()))
  process.exit(failed ? 1 : 0)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
