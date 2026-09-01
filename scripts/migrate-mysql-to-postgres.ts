/**
 * One-time data migration: legacy MySQL (the live Hostinger DB referenced by
 * ladwani/env1 and env2) -> the PostgreSQL database this app now targets.
 *
 * IMPORTANT — read MIGRATION.md before running this. In particular:
 *   - This machine (wherever Claude ran) could NOT reach the MySQL host
 *     (bound to "localhost" on Hostinger's side) — this script has never
 *     been executed against real data. Run --dry-run first, always.
 *   - Column names are assumed to match schema.prisma's field names exactly
 *     (camelCase, no @map on individual fields — only @@map for table
 *     names), which matches the legacy create_tables.sql. If the live DB
 *     has drifted from that (manual edits, an older schema version), some
 *     rows will fail and get reported, not silently dropped or corrupted.
 *   - Tables are processed in FK-safe order (parents before children).
 *   - Existing rows in the Postgres destination are left alone; matching
 *     primary keys are skipped (skipDuplicates), so this is safe to re-run.
 *
 * Usage:
 *   MYSQL_URL="mysql://user:pass@host:3306/dbname" npx ts-node scripts/migrate-mysql-to-postgres.ts --dry-run
 *   MYSQL_URL="..." npx ts-node scripts/migrate-mysql-to-postgres.ts --only=users,members
 *   MYSQL_URL="..." npx ts-node scripts/migrate-mysql-to-postgres.ts            # full run
 */
import mysql from 'mysql2/promise'
import { PrismaClient, Prisma } from '@prisma/client'
import fs from 'fs'
import path from 'path'

const prisma = new PrismaClient()

const BATCH_SIZE = 500

// Table (MySQL) -> Prisma model delegate name, in FK-safe dependency order.
// Kept in sync with schema.prisma's declaration order, which is already
// roughly dependency-ordered (parents defined before children).
const TABLES: { table: string; model: keyof PrismaClient; booleanFields?: string[]; bigIntFields?: string[]; jsonFields?: string[] }[] = [
  { table: 'users', model: 'user', booleanFields: ['emailVerified', 'mobileVerified'] },
  { table: 'roles', model: 'role', booleanFields: ['isSystem'] },
  { table: 'permissions', model: 'permission' },
  { table: 'role_permissions', model: 'rolePermission' },
  { table: 'user_roles', model: 'userRole' },
  { table: 'verification_tokens', model: 'verificationToken' },
  { table: 'refresh_tokens', model: 'refreshToken' },
  { table: 'consent_records', model: 'consentRecord', booleanFields: ['granted'] },
  { table: 'families', model: 'family' },
  { table: 'members', model: 'member', booleanFields: ['dateOfBirthApprox'] },
  { table: 'family_members', model: 'familyMember', booleanFields: ['isKarta'] },
  { table: 'family_join_requests', model: 'familyJoinRequest' },
  { table: 'relationship_types', model: 'relationshipType', booleanFields: ['isSpouse', 'isActive'] },
  { table: 'member_relationships', model: 'memberRelationship', booleanFields: ['isActive'] },
  { table: 'marital_status_history', model: 'maritalStatusHistory' },
  { table: 'marriage_records', model: 'marriageRecord', jsonFields: ['externalSpouseInfo'] },
  { table: 'education_records', model: 'educationRecord', booleanFields: ['isHighest', 'isOngoing'] },
  { table: 'income_ranges', model: 'incomeRange', bigIntFields: ['minValue', 'maxValue'], booleanFields: ['isActive'] },
  { table: 'employment_records', model: 'employmentRecord', booleanFields: ['isCurrent'] },
  { table: 'businesses', model: 'business', booleanFields: ['isActive'] },
  { table: 'skills', model: 'skill', booleanFields: ['isActive'] },
  { table: 'member_skills', model: 'memberSkill' },
  { table: 'addresses', model: 'address', booleanFields: ['isPrimary'] },
  { table: 'matrimonial_profiles', model: 'matrimonialProfile', booleanFields: ['isVisible'], jsonFields: ['languages'] },
  { table: 'matrimonial_preferences', model: 'matrimonialPreference', jsonFields: ['preferredLocations', 'maritalStatusPref', 'otherPreferences'] },
  { table: 'matrimonial_interests', model: 'matrimonialInterest' },
  { table: 'matrimonial_saves', model: 'matrimonialSave' },
  { table: 'areas', model: 'area', booleanFields: ['isActive'] },
  { table: 'member_areas', model: 'memberArea', booleanFields: ['isPrimary'] },
  { table: 'family_areas', model: 'familyArea', booleanFields: ['isPrimary'] },
  { table: 'post_types', model: 'postType', booleanFields: ['requiresApproval', 'isActive'] },
  { table: 'posts', model: 'post', booleanFields: ['isPinned', 'isAnnouncement'] },
  { table: 'comments', model: 'comment' },
  { table: 'reactions', model: 'reaction' },
  { table: 'reports', model: 'report' },
  { table: 'photos', model: 'photo', booleanFields: ['isProfilePhoto'], bigIntFields: ['fileSizeBytes'] },
  { table: 'approval_rules', model: 'approvalRule', booleanFields: ['requiresApproval', 'isActive'] },
  { table: 'approvals', model: 'approval', jsonFields: ['oldValue', 'newValue'] },
  { table: 'audit_logs', model: 'auditLog', jsonFields: ['oldValue', 'newValue', 'metadata'] },
  { table: 'notifications', model: 'notification', booleanFields: ['isRead', 'emailSent', 'smsSent'], jsonFields: ['data'] },
  { table: 'settings', model: 'setting', jsonFields: ['value'] },
  { table: 'field_visibility_defaults', model: 'fieldVisibilityDefault', booleanFields: ['isUserConfigurable'] },
  { table: 'member_field_visibility', model: 'memberFieldVisibility' },
  { table: 'blocked_users', model: 'blockedUser' },
]

function coerceRow(row: Record<string, any>, spec: (typeof TABLES)[number]): Record<string, any> {
  const out: Record<string, any> = {}
  for (const [key, value] of Object.entries(row)) {
    if (value === null || value === undefined) {
      out[key] = null
    } else if (spec.booleanFields?.includes(key)) {
      out[key] = value === 1 || value === true || value === '1'
    } else if (spec.bigIntFields?.includes(key)) {
      out[key] = value === null ? null : BigInt(value as any)
    } else if (spec.jsonFields?.includes(key) && typeof value === 'string') {
      try {
        out[key] = JSON.parse(value)
      } catch {
        out[key] = value // leave as-is; report will flag if Prisma rejects it
      }
    } else {
      out[key] = value
    }
  }
  return out
}

interface TableReport {
  table: string
  mysqlRowCount: number
  attempted: number
  inserted: number
  failedBatches: { error: string; sampleRow?: unknown }[]
  skippedNoMysqlTable?: boolean
}

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

  console.log(`\n${dryRun ? '[DRY RUN] ' : ''}Connecting to source MySQL database...`)
  const conn = await mysql.createConnection(mysqlUrl)

  const report: TableReport[] = []

  for (const spec of TABLES) {
    if (only && !only.includes(spec.table)) continue

    const tr: TableReport = { table: spec.table, mysqlRowCount: 0, attempted: 0, inserted: 0, failedBatches: [] }
    report.push(tr)

    try {
      const [countRows] = await conn.query<mysql.RowDataPacket[]>(`SELECT COUNT(*) as c FROM \`${spec.table}\``)
      tr.mysqlRowCount = Number(countRows[0]?.c ?? 0)
    } catch (e: any) {
      tr.skippedNoMysqlTable = true
      console.log(`  ⚠ ${spec.table}: not found in source DB (or query failed: ${e.message}) - skipping`)
      continue
    }

    console.log(`\n${spec.table}: ${tr.mysqlRowCount} rows in MySQL`)
    if (tr.mysqlRowCount === 0) continue
    if (dryRun) continue

    let offset = 0
    while (offset < tr.mysqlRowCount) {
      const [rows] = await conn.query<mysql.RowDataPacket[]>(
        `SELECT * FROM \`${spec.table}\` LIMIT ${BATCH_SIZE} OFFSET ${offset}`
      )
      const data = rows.map((r) => coerceRow(r, spec))
      tr.attempted += data.length

      try {
        const delegate = prisma[spec.model] as any
        const result = await delegate.createMany({ data, skipDuplicates: true })
        tr.inserted += result.count
      } catch (e: any) {
        tr.failedBatches.push({ error: e.message, sampleRow: data[0] })
        console.error(`  ✗ batch at offset ${offset} failed: ${e.message}`)
      }

      offset += BATCH_SIZE
      process.stdout.write(`  ${Math.min(offset, tr.mysqlRowCount)}/${tr.mysqlRowCount}\r`)
    }
    console.log(`  ✓ ${tr.inserted}/${tr.mysqlRowCount} inserted (${tr.failedBatches.length} batch failures)`)
  }

  await conn.end()
  await prisma.$disconnect()

  const reportPath = path.join(process.cwd(), `migration-report-${Date.now()}.json`)
  fs.writeFileSync(reportPath, JSON.stringify(report, (_, v) => (typeof v === 'bigint' ? v.toString() : v), 2))

  console.log(`\n${dryRun ? '[DRY RUN] ' : ''}Done. Full report written to ${reportPath}`)
  const failed = report.filter((r) => r.failedBatches.length > 0)
  if (failed.length > 0) {
    console.log(`\n⚠ ${failed.length} table(s) had failures - review the report before trusting this migration.`)
    process.exitCode = 1
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
