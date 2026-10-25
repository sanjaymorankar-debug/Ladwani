/**
 * One-time data migration: the legacy MySQL database (the live Hostinger DB
 * referenced by ladwani/env1 and env2, or any database built by the MySQL
 * migrations this repo used from Sep to Oct 2026) -> the PostgreSQL database
 * this app targets.
 *
 * READ MIGRATION.md BEFORE RUNNING THIS. In short:
 *   - Build the destination first, empty: `npx prisma migrate deploy` against
 *     DATABASE_URL (or scripts/postgres/01-schema.sql). Do NOT seed it — the
 *     reference data (roles, permissions, ...) comes across from MySQL with
 *     the ids the migrated rows point at.
 *   - Run --dry-run first, always. It reads MySQL, writes nothing, and
 *     reports row counts and every column mismatch between the live tables
 *     and prisma/schema.prisma.
 *
 * What it does:
 *   - Reads the table list, column types and foreign keys from the Prisma
 *     schema itself (Prisma.dmmf), so it covers every model the schema has
 *     and stays in line with it as models are added.
 *   - Copies tables parents-first. Foreign keys that form a cycle (members <->
 *     photos, families -> members) or point at their own table (areas,
 *     comments, community groups, interests) are inserted as NULL first and
 *     filled in once every table is copied.
 *   - Converts MySQL types to what Postgres expects: TINYINT(1)/BIT -> boolean,
 *     JSON (MySQL JSON or MariaDB LONGTEXT) -> jsonb, BIGINT -> BigInt,
 *     DATETIME(3) -> timestamp, read as UTC (Prisma writes UTC).
 *   - Re-runnable: rows whose primary key already exists in Postgres are
 *     skipped, so a failed run can be re-run after fixing the cause.
 *   - Every row that did not arrive is retried on its own and reported by
 *     primary key with the database's reason (an enum value the schema no
 *     longer has, a unique clash, an overlapping booking the Postgres
 *     exclusion constraint refuses), without blocking the rest of its table.
 *   - Writes migration-report-<timestamp>.json: per table, MySQL rows,
 *     inserted, Postgres rows afterwards, failed rows (primary key + error
 *     only, never the row's personal data), and columns that exist on one
 *     side only. Exit code 1 if anything failed or counts don't match.
 *
 * Needs the `mysql2` and `ts-node` devDependencies, so run it from a full
 * `npm ci` checkout (not the server's `npm ci --omit=dev` install).
 *
 * Usage:
 *   MYSQL_URL="mysql://user:pass@host:3306/dbname" DATABASE_URL="postgresql://..." \
 *     npm run migrate:mysql-to-postgres -- --dry-run
 *   ... npm run migrate:mysql-to-postgres -- --only=users,members
 *   ... npm run migrate:mysql-to-postgres            # full run
 *   Options: --dry-run, --only=<table,...>, --batch-size=<n> (default 500)
 */
import mysql from 'mysql2/promise'
import { PrismaClient, Prisma } from '@prisma/client'
import fs from 'fs'
import path from 'path'

type DmmfModel = (typeof Prisma.dmmf.datamodel.models)[number]
type DmmfField = DmmfModel['fields'][number]

interface Table {
  model: DmmfModel
  table: string
  delegate: string
  /** Scalar/enum fields by column name. */
  columns: Map<string, DmmfField>
  pk: string[]
  /** FK fields inserted as NULL first and filled in afterwards. */
  deferred: Set<string>
}

interface TableReport {
  table: string
  mysqlRowCount: number
  inserted: number
  skippedExisting: number
  postgresRowCount?: number
  deferredFieldsUpdated: number
  failedRows: { key: Record<string, unknown>; error: string }[]
  failedRowCount: number
  columnsOnlyInMysql: string[]
  requiredColumnsMissingInMysql: string[]
  skippedNoMysqlTable?: boolean
}

const MAX_FAILURES_LISTED = 50

const columnName = (f: DmmfField) => ((f as any).dbName as string | undefined) ?? f.name
const isColumn = (f: DmmfField) => f.kind === 'scalar' || f.kind === 'enum'
const delegateName = (model: string) => model.charAt(0).toLowerCase() + model.slice(1)
const shortError = (e: unknown) => String((e as any)?.message ?? e).split('\n').filter(Boolean).slice(-3).join(' ').slice(0, 500)

/** Tables in an order where every row's foreign keys point at rows already copied. */
function planTables(): Table[] {
  const models = Prisma.dmmf.datamodel.models
  const tables = new Map<string, Table>()
  for (const model of models) {
    const columns = new Map<string, DmmfField>()
    for (const f of model.fields) if (isColumn(f)) columns.set(columnName(f), f)
    const pk = model.primaryKey?.fields.length
      ? [...model.primaryKey.fields]
      : model.fields.filter((f) => f.isId).map((f) => f.name)
    tables.set(model.name, { model, table: model.dbName ?? model.name, delegate: delegateName(model.name), columns, pk, deferred: new Set() })
  }

  // edges: model -> models it references, with the FK fields carrying each reference
  const edges = new Map<string, { target: string; fields: string[]; optional: boolean }[]>()
  for (const model of models) {
    const list: { target: string; fields: string[]; optional: boolean }[] = []
    for (const f of model.fields) {
      if (f.kind !== 'object' || !f.relationFromFields?.length) continue
      const fields = [...f.relationFromFields]
      const optional = fields.every((name) => !model.fields.find((x) => x.name === name)!.isRequired)
      if (f.type === model.name) {
        if (!optional) throw new Error(`${model.name}.${f.name} is a required self-reference; cannot order it`)
        fields.forEach((x) => tables.get(model.name)!.deferred.add(x))
        continue
      }
      list.push({ target: f.type, fields, optional })
    }
    edges.set(model.name, list)
  }

  const ordered: Table[] = []
  const done = new Set<string>()
  while (done.size < tables.size) {
    const ready = [...tables.keys()].filter(
      (name) => !done.has(name) && edges.get(name)!.every((e) => done.has(e.target))
    )
    if (ready.length) {
      // Keep schema declaration order among the ready ones, for a readable log.
      for (const name of ready) { done.add(name); ordered.push(tables.get(name)!) }
      continue
    }
    // A cycle: defer one optional reference that points at an unfinished table.
    const breakable = [...tables.keys()]
      .filter((name) => !done.has(name))
      .flatMap((name) => edges.get(name)!.filter((e) => !done.has(e.target) && e.optional).map((e) => ({ name, e })))[0]
    if (!breakable) throw new Error('Foreign keys form a cycle of required references; cannot order tables')
    breakable.e.fields.forEach((x) => tables.get(breakable.name)!.deferred.add(x))
    edges.set(breakable.name, edges.get(breakable.name)!.filter((e) => e !== breakable.e))
  }
  return ordered
}

/** One MySQL value -> what Prisma expects for this field. `undefined` means "leave out". */
function coerce(value: unknown, f: DmmfField): unknown {
  if (value === null || value === undefined) {
    return f.type === 'Json' ? Prisma.DbNull : null
  }
  if (f.kind === 'enum') return String(value)
  switch (f.type) {
    case 'Boolean':
      if (Buffer.isBuffer(value)) return value.length > 0 && value[0] !== 0 // BIT(1)
      return value === true || value === 1 || value === '1' || value === 1n
    case 'Int':
      return Number(value)
    case 'BigInt':
      return BigInt(String(value))
    case 'Float':
      return Number(value)
    case 'Decimal':
      return new Prisma.Decimal(String(value))
    case 'DateTime': {
      const d = value instanceof Date ? value : new Date(String(value).replace(' ', 'T') + 'Z')
      // MySQL "zero dates" (0000-00-00) arrive as invalid dates.
      if (isNaN(d.getTime())) return f.isRequired ? value : null
      return d
    }
    case 'Json': {
      // The connection hands every JSON value over as text (jsonStrings), so
      // parse exactly once.
      const parsed = typeof value === 'string' ? JSON.parse(value) : value
      return parsed === null ? Prisma.JsonNull : parsed
    }
    case 'Bytes':
      return Buffer.isBuffer(value) ? value : Buffer.from(String(value))
    default: // String
      return Buffer.isBuffer(value) ? value.toString('utf8') : String(value)
  }
}

function keyOf(row: Record<string, unknown>, t: Table) {
  return Object.fromEntries(t.pk.map((k) => [k, row[k]]))
}

function whereByPk(row: Record<string, unknown>, t: Table) {
  if (t.pk.length === 1) return { [t.pk[0]]: row[t.pk[0]] }
  return { [t.pk.join('_')]: keyOf(row, t) }
}

/**
 * Inserts a batch, then accounts for every row individually. createMany's
 * skipDuplicates is ON CONFLICT DO NOTHING, which in Postgres also swallows
 * rows refused by a unique index on another column or by the bookings
 * exclusion constraint, so "not inserted" is never taken to mean "already
 * there": rows absent by primary key are retried one by one to surface the
 * real error.
 */
async function insertBatch(delegate: any, data: Record<string, unknown>[], t: Table, tr: TableReport) {
  if (!data.length) return
  let inserted = 0
  try {
    inserted = (await delegate.createMany({ data, skipDuplicates: true })).count
  } catch {
    inserted = 0 // one statement: nothing from this batch was written
  }
  tr.inserted += inserted
  if (inserted === data.length) return

  const present = await delegate.findMany({
    where: { OR: data.map((row) => keyOf(row, t)) },
    select: Object.fromEntries(t.pk.map((k) => [k, true])),
  })
  const presentKeys = new Set(present.map((row: Record<string, unknown>) => JSON.stringify(keyOf(row, t))))
  tr.skippedExisting += presentKeys.size - inserted
  for (const row of data) {
    if (presentKeys.has(JSON.stringify(keyOf(row, t)))) continue
    try {
      await delegate.create({ data: row, select: Object.fromEntries(t.pk.map((k) => [k, true])) })
      tr.inserted++
    } catch (e) {
      tr.failedRowCount++
      if (tr.failedRows.length < MAX_FAILURES_LISTED) tr.failedRows.push({ key: keyOf(row, t), error: shortError(e) })
    }
  }
}

async function main() {
  const args = process.argv.slice(2)
  const dryRun = args.includes('--dry-run')
  const onlyArg = args.find((a) => a.startsWith('--only='))
  const only = onlyArg ? onlyArg.replace('--only=', '').split(',').map((s) => s.trim()) : null
  const batchArg = args.find((a) => a.startsWith('--batch-size='))
  const batchSize = batchArg ? Math.max(1, parseInt(batchArg.split('=')[1], 10)) : 500

  const mysqlUrl = process.env.MYSQL_URL
  if (!mysqlUrl) {
    console.error('MYSQL_URL environment variable is required (see MIGRATION.md).')
    process.exit(1)
  }
  const pgUrl = process.env.DATABASE_URL ?? ''
  if (!/^postgres(ql)?:\/\//.test(pgUrl)) {
    console.error('DATABASE_URL must be the destination postgresql:// URL (see MIGRATION.md).')
    process.exit(1)
  }
  const safeUrl = (u: string) => { try { const x = new URL(u); return `${x.protocol}//${x.hostname}:${x.port}${x.pathname}` } catch { return '(unparseable URL)' } }

  const tables = planTables()
  const prisma = new PrismaClient()

  console.log(`\n${dryRun ? '[DRY RUN] ' : ''}Source MySQL: ${safeUrl(mysqlUrl)}`)
  console.log(`Destination PostgreSQL: ${safeUrl(pgUrl)}`)
  const conn = await mysql.createConnection({
    uri: mysqlUrl,
    // Prisma stores DATETIME values in UTC; read them back as UTC, not as the
    // local time of whichever machine runs this.
    timezone: 'Z',
    dateStrings: false,
    supportBigNumbers: true,
    bigNumberStrings: true,
    // Hand every JSON value over as its JSON text, unparsed — MySQL's JSON
    // type and MariaDB's LONGTEXT-with-json-format alike — so coerce() parses
    // it exactly once and a JSON string such as "123" stays a string.
    jsonStrings: true,
  })

  const report: TableReport[] = []
  const [tableRows] = await conn.query<mysql.RowDataPacket[]>('SHOW TABLES')
  const mysqlTables = new Set(tableRows.map((r) => String(Object.values(r)[0])))
  const schemaTables = new Set(tables.map((t) => t.table))
  const unmappedMysqlTables = [...mysqlTables].filter((t) => !schemaTables.has(t) && t !== '_prisma_migrations')
  if (unmappedMysqlTables.length) {
    console.log(`\n⚠ MySQL tables with no model in schema.prisma (NOT copied): ${unmappedMysqlTables.join(', ')}`)
  }

  /** Rows whose deferred FK values still need writing, per table. */
  const pendingDeferred = new Map<Table, Record<string, unknown>[]>()

  for (const t of tables) {
    if (only && !only.includes(t.table)) continue
    const tr: TableReport = {
      table: t.table, mysqlRowCount: 0, inserted: 0, skippedExisting: 0, deferredFieldsUpdated: 0,
      failedRows: [], failedRowCount: 0, columnsOnlyInMysql: [], requiredColumnsMissingInMysql: [],
    }
    report.push(tr)

    if (!mysqlTables.has(t.table)) {
      tr.skippedNoMysqlTable = true
      console.log(`\n${t.table}: not in the MySQL database — skipped`)
      continue
    }

    const [cols] = await conn.query<mysql.RowDataPacket[]>(`SHOW COLUMNS FROM \`${t.table}\``)
    const mysqlCols = cols.map((c) => String(c.Field))
    tr.columnsOnlyInMysql = mysqlCols.filter((c) => !t.columns.has(c))
    tr.requiredColumnsMissingInMysql = [...t.columns.entries()]
      .filter(([c, f]) => !mysqlCols.includes(c) && f.isRequired && !f.hasDefaultValue && !f.isUpdatedAt)
      .map(([c]) => c)

    const [countRows] = await conn.query<mysql.RowDataPacket[]>(`SELECT COUNT(*) AS c FROM \`${t.table}\``)
    tr.mysqlRowCount = Number(countRows[0]?.c ?? 0)

    const notes = [
      tr.columnsOnlyInMysql.length ? `columns only in MySQL (dropped): ${tr.columnsOnlyInMysql.join(', ')}` : '',
      tr.requiredColumnsMissingInMysql.length ? `required columns missing in MySQL: ${tr.requiredColumnsMissingInMysql.join(', ')}` : '',
    ].filter(Boolean)
    console.log(`\n${t.table}: ${tr.mysqlRowCount} rows in MySQL${notes.length ? `\n  ⚠ ${notes.join('\n  ⚠ ')}` : ''}`)
    if (tr.mysqlRowCount === 0 || dryRun) continue

    const delegate = (prisma as any)[t.delegate]
    const pkCols = t.pk.map((name) => columnName(t.model.fields.find((f) => f.name === name)!))
    const orderBy = pkCols.map((c) => `\`${c}\``).join(', ')
    const deferredRows: Record<string, unknown>[] = []

    for (let offset = 0; offset < tr.mysqlRowCount; offset += batchSize) {
      const [rows] = await conn.query<mysql.RowDataPacket[]>(
        `SELECT * FROM \`${t.table}\` ORDER BY ${orderBy} LIMIT ${batchSize} OFFSET ${offset}`
      )
      const data: Record<string, unknown>[] = []
      for (const raw of rows) {
        const row: Record<string, unknown> = {}
        const later: Record<string, unknown> = {}
        try {
          for (const [col, value] of Object.entries(raw)) {
            const f = t.columns.get(col)
            if (!f) continue // reported above as columnsOnlyInMysql
            const v = coerce(value, f)
            if (t.deferred.has(f.name) && v !== null) {
              later[f.name] = v
              row[f.name] = null
            } else {
              row[f.name] = v
            }
          }
        } catch (e) {
          tr.failedRowCount++
          if (tr.failedRows.length < MAX_FAILURES_LISTED) tr.failedRows.push({ key: keyOf(raw, t), error: `conversion: ${shortError(e)}` })
          continue
        }
        data.push(row)
        if (Object.keys(later).length) {
          // Carry @updatedAt along, or Prisma would stamp "now" on the second pass.
          for (const f of t.model.fields) if (f.isUpdatedAt) later[f.name] = row[f.name]
          deferredRows.push({ ...keyOf(row, t), ...later })
        }
      }

      await insertBatch(delegate, data, t, tr)
      process.stdout.write(`  ${Math.min(offset + batchSize, tr.mysqlRowCount)}/${tr.mysqlRowCount}\r`)
    }
    if (deferredRows.length) pendingDeferred.set(t, deferredRows)
    console.log(`  ✓ ${tr.inserted} inserted, ${tr.skippedExisting} already present, ${tr.failedRowCount} failed`)
  }

  // Second pass: the foreign keys that had to wait for their targets.
  for (const [t, rows] of pendingDeferred) {
    const tr = report.find((r) => r.table === t.table)!
    const delegate = (prisma as any)[t.delegate]
    for (const row of rows) {
      const fields = [...t.deferred, ...t.model.fields.filter((f) => f.isUpdatedAt).map((f) => f.name)]
      const data = Object.fromEntries(fields.filter((k) => k in row).map((k) => [k, row[k]]))
      try {
        await delegate.update({ where: whereByPk(row, t), data })
        tr.deferredFieldsUpdated++
      } catch (e) {
        tr.failedRowCount++
        if (tr.failedRows.length < MAX_FAILURES_LISTED) tr.failedRows.push({ key: keyOf(row, t), error: `setting ${[...t.deferred].filter((k) => k in row).join(', ')}: ${shortError(e)}` })
      }
    }
    if (rows.length) console.log(`${t.table}: filled in ${[...t.deferred].join(', ')} on ${tr.deferredFieldsUpdated}/${rows.length} rows`)
  }

  if (!dryRun) {
    for (const tr of report) {
      if (tr.skippedNoMysqlTable) continue
      const t = tables.find((x) => x.table === tr.table)!
      tr.postgresRowCount = await (prisma as any)[t.delegate].count()
    }
  }

  await conn.end()
  await prisma.$disconnect()

  const reportPath = path.join(process.cwd(), `migration-report-${Date.now()}.json`)
  fs.writeFileSync(
    reportPath,
    JSON.stringify({ dryRun, unmappedMysqlTables, tables: report }, (_, v) => (typeof v === 'bigint' ? v.toString() : v), 2)
  )

  console.log(`\n${dryRun ? '[DRY RUN] ' : ''}Done. Full report written to ${reportPath}`)
  const failed = report.filter((r) => r.failedRowCount > 0)
  const mismatched = report.filter((r) => r.postgresRowCount !== undefined && r.postgresRowCount < r.mysqlRowCount)
  const schemaGaps = report.filter((r) => r.columnsOnlyInMysql.length || r.requiredColumnsMissingInMysql.length)
  if (schemaGaps.length) console.log(`⚠ ${schemaGaps.length} table(s) differ in columns from schema.prisma: ${schemaGaps.map((r) => r.table).join(', ')}`)
  if (unmappedMysqlTables.length) console.log(`⚠ ${unmappedMysqlTables.length} MySQL table(s) were not copied: ${unmappedMysqlTables.join(', ')}`)
  if (failed.length) console.log(`⚠ ${failed.length} table(s) had failed rows: ${failed.map((r) => `${r.table} (${r.failedRowCount})`).join(', ')}`)
  if (mismatched.length) console.log(`⚠ ${mismatched.length} table(s) have fewer rows in Postgres than in MySQL: ${mismatched.map((r) => r.table).join(', ')}`)
  if (failed.length || mismatched.length || (dryRun && (schemaGaps.length || unmappedMysqlTables.length))) {
    console.log('Review the report before trusting this migration.')
    process.exitCode = 1
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
