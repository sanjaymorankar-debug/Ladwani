import { type OptionLists, DEFAULT_OPTIONS } from './options'
import {
  type Answer, type FieldDef, type SectionDef, type Visibility, ANSWERS, VISIBILITY_LEVELS, VISIBILITY_LABELS,
  fieldVisible, maxVisibilityFor, rowFieldVisible, visibilityRank,
} from './sections'

/**
 * Pure validation and normalisation of one section's submission. Database
 * look-ups (interest ids, family members, files, districts) happen in
 * store.ts afterwards; everything here can be unit-tested without a DB.
 *
 * Output values are already in storage shape: hidden fields are null, empty
 * strings are null, multi-selects are arrays or null, ints are ints.
 */

/** Select fields whose column is an INT. */
const INT_SELECTS = new Set(['renewalMonth', 'marksScale'])
const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/

export interface ParsedRow {
  id?: string
  values: Record<string, unknown>
  share?: boolean
  children?: ParsedRow[]
}

export interface ParsedSection {
  answer: Answer
  visibility: Visibility
  values: Record<string, unknown>
  rows: ParsedRow[]
  share: Record<string, boolean | undefined>
  entryNote: string | null
}

export class SectionInputError extends Error {}

function fail(msg: string): never {
  throw new SectionInputError(msg)
}

export function coerceField(field: FieldDef, raw: unknown, lists: OptionLists): unknown {
  if (raw === undefined || raw === null || raw === '') return null
  const listValues = () => (lists[field.list!] ?? DEFAULT_OPTIONS[field.list!] ?? []).map((x) => x.value)
  const nowYear = new Date().getFullYear()
  switch (field.type) {
    case 'text':
    case 'textarea': {
      if (typeof raw !== 'string') fail(`${field.label}: must be text`)
      const v = raw.trim()
      const max = field.max ?? (field.type === 'textarea' ? 1000 : 191)
      if (v.length > max) fail(`${field.label}: keep it under ${max} characters`)
      return v || null
    }
    case 'select':
    case 'monthNum': {
      const v = String(raw)
      if (!listValues().includes(v)) fail(`${field.label}: choose an option from the list`)
      return INT_SELECTS.has(field.key) || field.type === 'monthNum' ? parseInt(v, 10) : v
    }
    case 'multi': {
      if (!Array.isArray(raw)) fail(`${field.label}: must be a list`)
      const allowed = listValues()
      const vals = Array.from(new Set((raw as unknown[]).map(String)))
      if (vals.some((v) => !allowed.includes(v))) fail(`${field.label}: choose options from the list`)
      return vals.length ? vals : null
    }
    case 'bool':
      if (typeof raw !== 'boolean') fail(`${field.label}: answer Yes or No`)
      return raw
    case 'month':
      if (typeof raw !== 'string' || !MONTH_RE.test(raw)) fail(`${field.label}: enter a month as YYYY-MM`)
      return raw
    case 'year': {
      const y = Number(raw)
      if (!Number.isInteger(y) || y < 1940 || y > nowYear + 1) fail(`${field.label}: enter a year between 1940 and ${nowYear + 1}`)
      return y
    }
    case 'number': {
      const n = Number(raw)
      if (!Number.isFinite(n) || n <= 0 || n > 100000) fail(`${field.label}: enter a number greater than 0`)
      return Math.round(n * 100) / 100
    }
    case 'tags': {
      if (!Array.isArray(raw)) fail(`${field.label}: must be a list`)
      const vals = Array.from(new Set((raw as unknown[]).map((t) => String(t).trim()).filter(Boolean)))
      if (vals.some((t) => t.length > 40)) fail(`${field.label}: keep each entry under 40 characters`)
      if (vals.length > (field.max ?? 15)) fail(`${field.label}: up to ${field.max ?? 15} entries`)
      return vals.length ? vals : null
    }
    case 'interest':
    case 'familyMember':
    case 'file':
    case 'district':
      if (typeof raw !== 'string' || raw.length > 191) fail(`${field.label}: invalid selection`)
      return raw
  }
}

/** Values for one row (or the single-row fields) with hidden fields dropped. */
function parseValues(fields: FieldDef[], input: Record<string, unknown>, lists: OptionLists, visible: (f: FieldDef, v: Record<string, unknown>) => boolean) {
  const out: Record<string, unknown> = {}
  for (const f of fields) out[f.key] = coerceField(f, input[f.key], lists)
  // Resolve visibility against coerced values, parents before children (fields
  // are declared in that order), so a cleared parent clears its dependants.
  for (const f of fields) if (!visible(f, out)) out[f.key] = null
  return out
}

export function parseSectionInput(section: SectionDef, body: unknown, lists: OptionLists): ParsedSection {
  if (!body || typeof body !== 'object') fail('Invalid submission')
  const b = body as Record<string, unknown>

  const answer = b.answer as Answer
  if (!ANSWERS.some((a) => a.value === answer)) fail('Please answer Yes, No or Prefer not to say')

  const visibility = (b.visibility ?? section.defaultVisibility) as Visibility
  if (!(VISIBILITY_LEVELS as readonly string[]).includes(visibility)) fail('Choose who can see this section')
  const cap = maxVisibilityFor(section.key)
  if (visibilityRank(visibility) > visibilityRank(cap)) {
    fail(`${section.title} can never be shared wider than "${VISIBILITY_LABELS[cap]}"`)
  }

  const valuesIn = (b.values && typeof b.values === 'object' ? b.values : {}) as Record<string, unknown>
  const values = parseValues(section.fields ?? [], valuesIn, lists, (f, v) => fieldVisible(f, answer, v))

  const rows: ParsedRow[] = []
  if (section.row && answer === 'YES') {
    const rowsIn = Array.isArray(b.rows) ? (b.rows as unknown[]) : []
    if (rowsIn.length > (section.row.max ?? 20)) fail(`Up to ${section.row.max ?? 20} entries`)
    for (const r of rowsIn) {
      if (!r || typeof r !== 'object') fail('Invalid entry')
      const row = r as Record<string, unknown>
      const parsed: ParsedRow = {
        id: typeof row.id === 'string' ? row.id : undefined,
        values: parseValues(section.row.fields, row, lists, (f, v) => rowFieldVisible(f, v)),
        share: typeof row._share === 'boolean' ? row._share : undefined,
      }
      if (section.row.children) {
        const kids = Array.isArray(row[section.row.children.key]) ? (row[section.row.children.key] as unknown[]) : []
        if (kids.length > 20) fail('Up to 20 medals or certificates per sport')
        parsed.children = kids.map((k) => ({
          id: typeof (k as any)?.id === 'string' ? (k as any).id : undefined,
          values: parseValues(section.row!.children!.fields, (k ?? {}) as Record<string, unknown>, lists, () => true),
        }))
      }
      // A row with nothing filled in is ignored rather than stored empty.
      const hasValue = Object.values(parsed.values).some((v) => v !== null && v !== false) || (parsed.children?.length ?? 0) > 0
      if (hasValue) rows.push(parsed)
    }
  }

  const share: Record<string, boolean | undefined> = {}
  if (b.share && typeof b.share === 'object') {
    for (const [k, v] of Object.entries(b.share as Record<string, unknown>)) if (typeof v === 'boolean') share[k] = v
  }

  let entryNote: string | null = null
  if (typeof b.entryNote === 'string' && b.entryNote.trim()) {
    if (b.entryNote.length > 500) fail('Entry note: keep it under 500 characters')
    entryNote = b.entryNote.trim()
  }

  return { answer, visibility, values, rows, share, entryNote }
}

/** "MH12AB1234" → "••••1234" for anyone but the editor. */
export function maskValue(v: unknown): unknown {
  if (typeof v !== 'string' || !v) return v
  return v.length <= 4 ? '••••' : `••••${v.slice(-4)}`
}
