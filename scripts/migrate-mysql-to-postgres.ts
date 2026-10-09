/**
 * One-time data copy: the earlier MySQL database -> the PostgreSQL database
 * this app now targets.
 *
 * IMPORTANT — read MIGRATION.md before running this. In particular:
 *   - Build the PostgreSQL schema FIRST (`npx prisma migrate deploy`, or the
 *     SQL files in scripts/postgres/). This script copies rows, not tables.
 *   - Run --dry-run first, always. It reads MySQL only and writes nothing.
 *   - The table and column list comes from prisma/schema.prisma, so every
 *     model is copied. A MySQL column the schema doesn't know is reported and
 *     left behind; a MySQL table that doesn't exist is reported and skipped.
 *   - Foreign keys: the schema has cycles (families <-> members, and
 *     self-references such as areas.parentId), so no table order satisfies
 *     every constraint. The script drops the PostgreSQL foreign keys, copies
 *     everything, then re-creates them — which re-validates every row. The
 *     definitions are saved to fk-backup-<timestamp>.sql first, so they can
 *     be restored by hand if the run is killed part-way.
 *   - Existing rows in PostgreSQL are left alone; matching primary keys are
 *     skipped (skipDuplicates), so this is safe to re-run.
 *   - The role in DATABASE_URL must own the tables (the role that ran
 *     `prisma migrate deploy` does) to drop and re-create foreign keys.
 *
 * Usage:
 *   MYSQL_URL="mysql://user:pass@host:3306/dbname" npm run migrate:mysql-to-postgres -- --dry-run
 *   MYSQL_URL="..." npm run migrate:mysql-to-postgres -- --only=users,members
 *   MYSQL_URL="..." npm run migrate:mysql-to-postgres            # full run
 */
import mysql from 'mysql2/promise'
import { PrismaClient, Prisma } from '@prisma/client'
import fs from 'fs'
import path from 'path'

const prisma = new PrismaClient()

const BATCH_SIZE = 500

interface Column {
  field: string // Prisma field name — what createMany expects
  type: string // Prisma scalar type, or the enum name
  kind: string // 'scalar' | 'enum'
}

interface TableSpec {
  table: string
  delegate: string
  columns: Map<string, Column> // keyed by database column name
}

// Every model in schema.prisma, with its table and column names.
const TABLES: TableSpec[] = Prisma.dmmf.datamodel.models.map((m) => ({
  table: m.dbName ?? m.name,
  delegate: m.name.charAt(0).toLowerCase() + m.name.slice(1),
  columns: new Map(
    m.fields
      .filter((f) => f.kind === 'scalar' || f.kind === 'enum')
      .map((f) => [f.dbName ?? f.name, { field: f.name, type: f.type, kind: f.kind }])
  ),
}))

function coerce(value: unknown, col: Column): unknown {
  if (value === null || value === undefined) {
    // A Json column needs an explicit database NULL; a bare null is rejected.
    return col.type === 'Json' ? Prisma.DbNull : null
  }
  switch (col.type) {
    case 'Boolean':
      // MySQL BOOLEAN is TINYINT(1), which arrives as 0/1.
      return value === true || value === 1 || value === '1'
    case 'BigInt':
      return BigInt(value as string | number)
    case 'Int':
      return typeof value === 'string' ? Number(value) : value
    case 'Float':
      return typeof value === 'string' ? Number(value) : value
    case 'Json':
      // mysql2 parses MySQL JSON columns already; MariaDB stores JSON as text.
      if (typeof value === 'string') {
        try {
          return JSON.parse(value)
        } catch {
          return value // stored as a JSON string; the report shows it if Prisma rejects it
        }
      }
      return value
    default:
      return value
  }
}

interface TableReport {
  table: string
  mysqlRowCount: number
  inserted: number
  skippedExisting: number
  unknownColumns: string[]
  failedBatches: { offset: number; error: string; sampleRow?: unknown }[]
  skippedNoMysqlTable?: boolean
}

interface ForeignKey {
  table: string
  name: string
  definition: string
}

const quoteIdent = (s: string) => `"${s.replace(/"/g, '""')}"`

async function loadForeignKeys(): Promise<ForeignKey[]> {
  return prisma.$queryRaw<ForeignKey[]>`
    SELECT c.relname AS "table", con.conname AS name, pg_get_constraintdef(con.oid) AS definition
    FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE con.contype = 'f' AND n.nspname = current_schema()
    ORDER BY c.relname, con.conname`
}

const addFkSql = (fk: ForeignKey) =>
  `ALTER TABLE ${quoteIdent(fk.table)} ADD CONSTRAINT ${quoteIdent(fk.name)} ${fk.definition};`

async function main() {
  const args = process.argv.slice(2)
  const dryRun = args.includes('--dry-run')
  const onlyArg = args.find((a) => a.startsWith('--only='))
  const only = onlyArg ? onlyArg.replace('--only=', '').split(',') : null

  const mysqlUrl = process.env.MYSQL_URL
  if (!mysqlUrl) {
    console.error('MYSQL_URL environment variable is required (see MIGRATION.md).')
    process.exit(1)
  }

  if (only) {
    const unknown = only.filter((t) => !TABLES.some((s) => s.table === t))
    if (unknown.length) {
      console.error(`Unknown table(s) in --only: ${unknown.join(', ')}`)
      process.exit(1)
    }
  }

  console.log(`\n${dryRun ? '[DRY RUN] ' : ''}Connecting to source MySQL database...`)
  const conn = await mysql.createConnection({
    uri: mysqlUrl,
    // Prisma writes MySQL DATETIME values in UTC. Without this, mysql2 reads
    // them as the local time of whatever machine runs the script.
    timezone: 'Z',
    supportBigNumbers: true,
    bigNumberStrings: true,
  })

  const report: TableReport[] = []
  const stamp = Date.now()

  // Read MySQL row counts and columns first: a dry run stops after this.
  const plan: { spec: TableSpec; tr: TableReport }[] = []
  for (const spec of TABLES) {
    if (only && !only.includes(spec.table)) continue
    const tr: TableReport = {
      table: spec.table, mysqlRowCount: 0, inserted: 0, skippedExisting: 0, unknownColumns: [], failedBatches: [],
    }
    report.push(tr)

    try {
      const [countRows] = await conn.query<mysql.RowDataPacket[]>(`SELECT COUNT(*) AS c FROM \`${spec.table}\``)
      tr.mysqlRowCount = Number(countRows[0]?.c ?? 0)
      const [cols] = await conn.query<mysql.RowDataPacket[]>(`SHOW COLUMNS FROM \`${spec.table}\``)
      tr.unknownColumns = cols.map((c) => String(c.Field)).filter((c) => !spec.columns.has(c))
    } catch (e: any) {
      tr.skippedNoMysqlTable = true
      console.log(`  ⚠ ${spec.table}: not found in source DB (or query failed: ${e.message}) - skipping`)
      continue
    }

    const extra = tr.unknownColumns.length ? ` — columns not in schema, NOT copied: ${tr.unknownColumns.join(', ')}` : ''
    console.log(`${spec.table}: ${tr.mysqlRowCount} rows in MySQL${extra}`)
    if (tr.mysqlRowCount > 0) plan.push({ spec, tr })
  }

  if (dryRun) {
    await finish(conn, report, stamp, true)
    return
  }

  // Drop foreign keys for the copy, after saving their definitions.
  const fks = await loadForeignKeys()
  const backupPath = path.join(process.cwd(), `fk-backup-${stamp}.sql`)
  fs.writeFileSync(backupPath, fks.map(addFkSql).join('\n') + '\n')
  console.log(`\nSaved ${fks.length} foreign key definitions to ${backupPath}; dropping them for the copy.`)
  for (const fk of fks) {
    await prisma.$executeRawUnsafe(`ALTER TABLE ${quoteIdent(fk.table)} DROP CONSTRAINT ${quoteIdent(fk.name)}`)
  }

  const fkFailures: { constraint: string; error: string }[] = []
  try {
    for (const { spec, tr } of plan) {
      console.log(`\n${spec.table}:`)
      const delegate = (prisma as any)[spec.delegate]
      // Ordered by primary key so OFFSET paging neither skips nor repeats rows.
      const [pkRows] = await conn.query<mysql.RowDataPacket[]>(`SHOW KEYS FROM \`${spec.table}\` WHERE Key_name = 'PRIMARY'`)
      const orderBy = pkRows.length ? pkRows.map((k) => `\`${k.Column_name}\``).join(', ') : '1'

      for (let offset = 0; offset < tr.mysqlRowCount; offset += BATCH_SIZE) {
        const [rows] = await conn.query<mysql.RowDataPacket[]>(
          `SELECT * FROM \`${spec.table}\` ORDER BY ${orderBy} LIMIT ${BATCH_SIZE} OFFSET ${offset}`
        )
        const data = rows.map((row) => {
          const out: Record<string, unknown> = {}
          for (const [column, col] of spec.columns) {
            if (column in row) out[col.field] = coerce(row[column], col)
          }
          return out
        })

        try {
          const result = await delegate.createMany({ data, skipDuplicates: true })
          tr.inserted += result.count
          tr.skippedExisting += data.length - result.count
        } catch (e: any) {
          tr.failedBatches.push({ offset, error: e.message, sampleRow: data[0] })
          console.error(`  ✗ batch at offset ${offset} failed: ${e.message.split('\n').slice(-3).join(' ')}`)
        }
        process.stdout.write(`  ${Math.min(offset + BATCH_SIZE, tr.mysqlRowCount)}/${tr.mysqlRowCount}\r`)
      }
      console.log(
        `  ✓ ${tr.inserted} inserted, ${tr.skippedExisting} already present, ${tr.failedBatches.length} batch failures`
      )
    }
  } finally {
    // Always put the constraints back — and with them, check every copied row.
    console.log(`\nRe-creating ${fks.length} foreign keys...`)
    for (const fk of fks) {
      try {
        await prisma.$executeRawUnsafe(addFkSql(fk))
      } catch (e: any) {
        fkFailures.push({ constraint: `${fk.table}.${fk.name}`, error: e.message })
        console.error(`  ✗ ${fk.table}.${fk.name}: ${e.message.split('\n').slice(-1)[0]}`)
      }
    }
  }

  if (fkFailures.length === 0) {
    fs.unlinkSync(backupPath)
    console.log('  ✓ all foreign keys re-created; every copied row satisfies them.')
  } else {
    console.log(
      `\n⚠ ${fkFailures.length} foreign key(s) could not be re-created — the copied data has rows that ` +
        `point at missing parents. Fix or delete those rows, then run the matching lines of ${backupPath}.`
    )
  }

  await finish(conn, report, stamp, false, fkFailures)
}

async function finish(
  conn: mysql.Connection,
  report: TableReport[],
  stamp: number,
  dryRun: boolean,
  fkFailures: { constraint: string; error: string }[] = []
) {
  await conn.end()
  await prisma.$disconnect()

  const reportPath = path.join(process.cwd(), `migration-report-${stamp}.json`)
  fs.writeFileSync(
    reportPath,
    JSON.stringify({ dryRun, tables: report, foreignKeyFailures: fkFailures }, (_, v) =>
      typeof v === 'bigint' ? v.toString() : v, 2)
  )

  console.log(`\n${dryRun ? '[DRY RUN] ' : ''}Done. Full report written to ${reportPath}`)
  const failed = report.filter((r) => r.failedBatches.length > 0)
  const dropped = report.filter((r) => r.unknownColumns.length > 0)
  if (dropped.length > 0) {
    console.log(`⚠ ${dropped.length} table(s) have MySQL columns the schema doesn't know; those values were not copied.`)
  }
  if (failed.length > 0) {
    console.log(`⚠ ${failed.length} table(s) had batch failures - review the report before trusting this migration.`)
  }
  if (failed.length > 0 || fkFailures.length > 0) process.exitCode = 1
}

main().catch(async (e) => {
  console.error(e)
  await prisma.$disconnect()
  process.exit(1)
})
