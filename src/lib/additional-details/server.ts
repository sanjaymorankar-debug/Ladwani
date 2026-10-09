import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { deletePhotoObjects } from '@/lib/storage'
import { DEFAULT_OPTIONS, type OptionLists } from './options'
import { type DetailsContext, familyMemberIds } from './access'
import { type ParsedRow, type ParsedSection, SectionInputError, maskValue } from './parse'
import { type SectionDef, type SupportDef, SECTIONS, SECTION_BY_KEY } from './sections'
import { slugify } from '@/lib/interest-master'

type Db = Prisma.TransactionClient | typeof prisma

// ── Option lists (rule 11) ─────────────────────────────────────────

/** Defaults overlaid with any Admin-edited lists from option_masters. */
export async function getOptionLists(): Promise<OptionLists> {
  const rows = await prisma.optionMaster.findMany({ orderBy: [{ listKey: 'asc' }, { sortOrder: 'asc' }] })
  const lists: OptionLists = { ...DEFAULT_OPTIONS }
  const byList = new Map<string, { value: string; label: string }[]>()
  for (const r of rows) {
    if (r.isActive === false) continue
    if (!byList.has(r.listKey)) byList.set(r.listKey, [])
    byList.get(r.listKey)!.push({ value: r.value, label: r.label })
  }
  // A list with only inactive rows falls back to defaults rather than empty.
  for (const [k, v] of Array.from(byList.entries())) if (v.length) lists[k] = v
  return lists
}

// ── Consent (rule 4) ────────────────────────────────────────────────

export const CONSENT_TYPE = 'ADDITIONAL_DETAILS'
export const MINOR_GROUP_CONSENT_TYPE = 'MINOR_GROUPS'
export const CONSENT_VERSION = '2026-10-v1'
export const CONSENT_TEXT = [
  'What we collect: optional details you choose to add — insurance and doctor contacts, vehicles, loan and banking needs, farm land, house, marks, sports, hobbies, career, business, skills, wellness, family-support needs, government-document needs, housing, travel, language and culture preferences, marriage-support needs and emergency readiness.',
  'Why: so the community can support you when you ask for help, and so you can connect with members who share your interests.',
  'What we never collect: policy, bank account, card or PAN numbers, CIBIL scores, 7/12 or survey numbers, document numbers or copies, or any illness, diagnosis, medicine or disability detail. Amounts are recorded as ranges only.',
  'Who sees it: you choose for each section (Only me, My Karta, My family, Community bodies, or the whole community). Loans, insurance, investment and doctor details can never be shared wider than your Karta.',
  'Help requests reach the District team only if you say yes to sharing each one, and you can withdraw them at any time.',
  'You can delete any section at any time; the data is removed, not hidden. Hobbies and similar answers may add you to community interest groups, which you can leave or switch off.',
].join('\n\n')

export async function hasConsent(memberId: string): Promise<boolean> {
  const rec = await prisma.consentRecord.findFirst({
    where: { memberId, consentType: CONSENT_TYPE, version: CONSENT_VERSION, granted: true, revokedAt: null },
  })
  return !!rec
}

export async function hasMinorGroupConsent(memberId: string): Promise<boolean> {
  const rec = await prisma.consentRecord.findFirst({
    where: { memberId, consentType: MINOR_GROUP_CONSENT_TYPE, granted: true, revokedAt: null },
  })
  return !!rec
}

export function requestMeta(req: Request) {
  const fwd = req.headers.get('x-forwarded-for')
  return {
    ipAddress: (fwd ? fwd.split(',')[0].trim() : req.headers.get('x-real-ip')) || null,
    userAgent: req.headers.get('user-agent')?.slice(0, 500) || null,
  }
}

// ── Row storage ────────────────────────────────────────────────────

interface RowAdapter {
  model: string
  /** Rows already belong to the core profile; "clearing" nulls only the extension columns. */
  extensionColumns?: string[]
  include?: Record<string, unknown>
  orderBy?: Record<string, unknown> | Record<string, unknown>[]
}

const ROW_ADAPTERS: Record<string, RowAdapter> = {
  insurance: { model: 'memberInsurance', orderBy: { createdAt: 'asc' } },
  vehicles: { model: 'memberVehicle', orderBy: { createdAt: 'asc' } },
  banking: { model: 'memberLoanNeed', orderBy: { createdAt: 'asc' } },
  farm: { model: 'memberFarmHolding', orderBy: { createdAt: 'asc' } },
  sports: {
    model: 'memberSport', orderBy: { createdAt: 'asc' },
    include: { interest: { select: { id: true, name: true } }, achievements: { orderBy: { createdAt: 'asc' } } },
  },
  hobbies: {
    model: 'memberHobby', orderBy: { createdAt: 'asc' },
    include: { interest: { select: { id: true, name: true, category: true, status: true } } },
  },
  education: {
    model: 'educationRecord',
    orderBy: [{ isHighest: 'desc' }, { yearCompleted: 'desc' }],
    extensionColumns: ['marksType', 'marksValue', 'marksScale', 'boardUniversity', 'marksheetFileId'],
  },
  business: {
    model: 'business', orderBy: { createdAt: 'asc' },
    extensionColumns: ['contact', 'showInDirectory', 'supportNeeds'],
  },
}

const delegate = (db: Db, model: string) => (db as any)[model]

/** Single-row columns owned by a section (on member_additional_details). */
export function detailColumns(section: SectionDef): string[] {
  return (section.fields ?? []).filter((f) => !f.memberColumn).map((f) => f.key)
}

// ── Loading & presenting ──────────────────────────────────────────

export interface LoadedDetails {
  settings: Record<string, { answer: string | null; visibility: string | null; enteredByUserId: string | null; entryNote: string | null; updatedAt: Date }>
  detail: Record<string, any> | null
  member: { bloodGroup: string | null; languages: unknown }
  rows: Record<string, Record<string, any>[]>
  openSupport: { id: string; sourceKey: string; category: string; status: string | null; createdAt: Date }[]
}

export async function loadDetails(memberId: string, onlySections?: string[]): Promise<LoadedDetails> {
  const want = (k: string) => !onlySections || onlySections.includes(k)
  const [settings, detail, member, openSupport] = await Promise.all([
    prisma.memberSectionSetting.findMany({ where: { memberId } }),
    prisma.memberAdditionalDetail.findUnique({ where: { memberId } }),
    prisma.member.findUnique({ where: { id: memberId }, select: { bloodGroup: true, languages: true } }),
    prisma.supportRequest.findMany({
      where: { memberId, status: 'OPEN' },
      select: { id: true, sourceKey: true, category: true, status: true, createdAt: true },
    }),
  ])
  const rows: Record<string, Record<string, any>[]> = {}
  await Promise.all(
    Object.entries(ROW_ADAPTERS).filter(([k]) => want(k)).map(async ([key, a]) => {
      rows[key] = await delegate(prisma, a.model).findMany({
        where: { memberId, ...(key === 'business' ? { isActive: true } : {}) },
        ...(a.include ? { include: a.include } : {}),
        ...(a.orderBy ? { orderBy: a.orderBy } : {}),
      })
    })
  )
  return {
    settings: Object.fromEntries(settings.map((s) => [s.sectionKey, s])),
    detail,
    member: member ?? { bloodGroup: null, languages: null },
    rows,
    openSupport,
  }
}

export interface PresentedSection {
  key: string
  number: number
  title: string
  answer: string | null
  visibility: string
  values: Record<string, unknown>
  rows: Record<string, unknown>[]
  /** Editor only: support requests currently shared, keyed by field or row id. */
  shared?: Record<string, boolean>
  enteredByUserId?: string | null
  entryNote?: string | null
}

export function supportSourceKey(section: SectionDef, def: SupportDef, rowId?: string) {
  return def.row ? `${section.key}:${rowId}` : `${section.key}.${def.field}`
}

export function presentSection(section: SectionDef, data: LoadedDetails, forEditor: boolean): PresentedSection {
  const setting = data.settings[section.key]
  const values: Record<string, unknown> = {}
  for (const f of section.fields ?? []) {
    if (!forEditor && f.editorOnly) continue
    let v = f.memberColumn ? (data.member as any)[f.key] : data.detail?.[f.key]
    if (v === undefined) v = null
    values[f.key] = !forEditor && f.masked ? maskValue(v) : v
  }

  const rowFields = section.row?.fields ?? []
  const rows = (data.rows[section.key] ?? []).map((r) => {
    const out: Record<string, unknown> = { id: r.id }
    for (const f of rowFields) {
      if (!forEditor && f.editorOnly) continue
      const v = r[f.key] ?? null
      out[f.key] = !forEditor && f.masked ? maskValue(v) : v
    }
    if (r.interest) out.interestName = r.interest.name
    if (r.interest?.status && r.interest.status !== 'APPROVED') out.interestStatus = r.interest.status
    if (section.key === 'education') out.level = r.level
    if (section.row?.children && Array.isArray(r[section.row.children.key])) {
      out[section.row.children.key] = r[section.row.children.key].map((c: any) => {
        const child: Record<string, unknown> = { id: c.id }
        for (const f of section.row!.children!.fields) child[f.key] = c[f.key] ?? null
        return child
      })
    }
    return out
  })

  const presented: PresentedSection = {
    key: section.key,
    number: section.number,
    title: section.title,
    answer: setting?.answer ?? null,
    visibility: setting?.visibility ?? section.defaultVisibility,
    values,
    rows,
  }
  if (forEditor) {
    const shared: Record<string, boolean> = {}
    for (const req of data.openSupport) {
      for (const def of section.support ?? []) {
        if (def.row && req.sourceKey.startsWith(`${section.key}:`)) shared[req.sourceKey.slice(section.key.length + 1)] = true
        if (!def.row && req.sourceKey === supportSourceKey(section, def)) shared[def.field] = true
      }
    }
    presented.shared = shared
    presented.enteredByUserId = setting?.enteredByUserId ?? null
    presented.entryNote = setting?.entryNote ?? null
  }
  return presented
}

// ── Saving ─────────────────────────────────────────────────────────

/**
 * Resolves the database-backed field types in place (interests, family
 * members, files, districts) and rejects anything that doesn't belong to this
 * member. Creates a PENDING master entry for a new "Other" hobby.
 */
async function resolveReferences(section: SectionDef, parsed: ParsedSection, ctx: DetailsContext) {
  const memberId = ctx.member!.id
  const familyIds = await familyMemberIds(ctx.familyIds)

  for (const f of section.fields ?? []) {
    const v = parsed.values[f.key]
    if (v === null) continue
    if (f.type === 'familyMember' && (v === memberId || !familyIds.has(v as string))) {
      throw new SectionInputError(`${f.label}: choose someone from your family`)
    }
  }

  const checkFile = async (id: string, purpose: string | undefined, label: string) => {
    const file = await prisma.memberFile.findUnique({ where: { id } })
    if (!file || file.memberId !== memberId || file.purpose !== purpose) throw new SectionInputError(`${label}: upload not found`)
  }

  const seenInterests = new Set<string>()
  for (const row of parsed.rows) {
    for (const f of section.row?.fields ?? []) {
      const v = row.values[f.key]
      if (v === null) continue
      if (f.type === 'file') await checkFile(v as string, f.filePurpose, f.label)
      if (f.type === 'district') {
        const area = await prisma.area.findFirst({ where: { id: v as string, type: 'DISTRICT', isActive: true } })
        if (!area) throw new SectionInputError(`${f.label}: choose a district from the list`)
        row.values.district = area.name
      }
      if (f.type === 'interest') {
        row.values[f.key] = await resolveInterest(v as string, !!f.sportsOnly, memberId)
      }
    }
    for (const child of row.children ?? []) {
      for (const f of section.row?.children?.fields ?? []) {
        if (f.type === 'file' && child.values[f.key]) await checkFile(child.values[f.key] as string, f.filePurpose, f.label)
      }
    }
    if (section.key === 'hobbies' || section.key === 'sports') {
      const iid = row.values.interestId as string | null
      if (!iid) throw new SectionInputError(`Choose a ${section.key === 'sports' ? 'sport' : 'hobby'} for each entry`)
      if (section.key === 'hobbies' && seenInterests.has(iid)) row.values.__duplicate = true
      seenInterests.add(iid)
    }
  }
  if (section.key === 'hobbies') parsed.rows = parsed.rows.filter((r) => !r.values.__duplicate)
}

/** "NEW:Warli art" → a PENDING master entry for Admin; otherwise an existing usable id. */
async function resolveInterest(value: string, sportsOnly: boolean, memberId: string): Promise<string> {
  if (value.startsWith('NEW:')) {
    if (sportsOnly) throw new SectionInputError('Pick a sport from the list (or "Other sports")')
    const name = value.slice(4).trim().replace(/\s+/g, ' ')
    if (name.length < 2 || name.length > 60) throw new SectionInputError('Other hobby: enter a name of 2–60 characters')
    const slug = slugify(name)
    if (!slug) throw new SectionInputError('Other hobby: enter a valid name')
    const existing = await prisma.interest.findUnique({ where: { slug } })
    if (existing) {
      if (existing.status === 'MERGED' && existing.mergedIntoId) return existing.mergedIntoId
      if (existing.status === 'REJECTED') throw new SectionInputError(`"${name}" is not available as a hobby — please pick from the list`)
      return existing.id
    }
    const created = await prisma.interest.create({
      data: { name, slug, category: 'Other', status: 'PENDING', suggestedByMemberId: memberId, isChildSafe: false },
    })
    return created.id
  }
  const interest = await prisma.interest.findUnique({ where: { id: value } })
  if (!interest || interest.isActive === false || interest.status === 'REJECTED') throw new SectionInputError('Choose an option from the list')
  if (interest.status === 'MERGED' && interest.mergedIntoId) return interest.mergedIntoId
  if (sportsOnly && (!interest.isSport || interest.status !== 'APPROVED')) throw new SectionInputError('Choose a sport from the list')
  return interest.id
}

function rowData(section: SectionDef, row: ParsedRow) {
  const data: Record<string, unknown> = {}
  for (const f of section.row?.fields ?? []) {
    let v = row.values[f.key]
    if (f.type === 'multi' && v === null) v = Prisma.DbNull
    data[f.key] = v
  }
  if (section.key === 'farm') data.district = row.values.district ?? null
  return data
}

/** Replace-all for a section's rows; returns the ids now stored, in order. */
async function writeRows(tx: Prisma.TransactionClient, section: SectionDef, memberId: string, rows: ParsedRow[]): Promise<string[]> {
  const a = ROW_ADAPTERS[section.key]
  const d = delegate(tx, a.model)
  const existing: { id: string }[] = await d.findMany({
    where: { memberId, ...(section.key === 'business' ? { isActive: true } : {}) },
    select: { id: true },
  })
  const existingIds = new Set(existing.map((e) => e.id))
  const kept = new Set<string>()
  const ids: string[] = []

  // Hobbies are unique per interest: a hobby removed and re-added in the
  // same save reuses its stored row instead of colliding with it.
  if (section.key === 'hobbies') {
    const stored: { id: string; interestId: string }[] = await d.findMany({ where: { memberId }, select: { id: true, interestId: true } })
    const claimed = new Set<string>()
    for (const row of rows) {
      if (row.id && existingIds.has(row.id) && !claimed.has(row.id)) { claimed.add(row.id); continue }
      const match = stored.find((e) => e.interestId === row.values.interestId && !claimed.has(e.id))
      row.id = match?.id
      if (match) claimed.add(match.id)
    }
  }

  // Delete dropped rows first so their unique slots are free for the updates.
  const keepIds = new Set(rows.map((r) => r.id).filter((id): id is string => !!id && existingIds.has(id)))
  const removed = Array.from(existingIds).filter((id) => !keepIds.has(id))
  if (removed.length) await d.deleteMany({ where: { id: { in: removed } } })

  for (const row of rows) {
    const data = rowData(section, row)
    let id: string
    if (row.id && keepIds.has(row.id) && !kept.has(row.id)) {
      await d.update({ where: { id: row.id }, data })
      id = row.id
    } else {
      const extra = section.key === 'education' ? { level: null, isHighest: false } : {}
      id = (await d.create({ data: { memberId, ...extra, ...data } })).id
    }
    kept.add(id)
    ids.push(id)
    if (section.key === 'sports') {
      await tx.memberSportAchievement.deleteMany({ where: { sportId: id } })
      for (const c of row.children ?? []) {
        await tx.memberSportAchievement.create({ data: { sportId: id, ...(c.values as any) } })
      }
    }
  }

  return ids
}

/** Answer isn't Yes, or the section is being deleted: drop or blank its rows. */
async function clearRows(tx: Prisma.TransactionClient, section: SectionDef, memberId: string) {
  const a = ROW_ADAPTERS[section.key]
  if (!a) return
  const d = delegate(tx, a.model)
  if (a.extensionColumns) {
    const blank: Record<string, unknown> = {}
    for (const c of a.extensionColumns) blank[c] = c === 'supportNeeds' ? Prisma.DbNull : c === 'showInDirectory' ? false : null
    await d.updateMany({ where: { memberId }, data: blank })
  } else {
    await d.deleteMany({ where: { memberId } })
  }
}

function detailData(section: SectionDef, values: Record<string, unknown> | null) {
  const data: Record<string, unknown> = {}
  for (const f of section.fields ?? []) {
    if (f.memberColumn) continue
    let v = values ? values[f.key] : null
    if ((f.type === 'multi' || f.type === 'tags') && (v === null || v === undefined)) v = Prisma.DbNull
    data[f.key] = v === undefined ? null : v
  }
  return data
}

/** Files of this purpose no longer referenced by any row are deleted (record and object). */
async function pruneFiles(memberId: string) {
  const [edu, ach, files] = await Promise.all([
    prisma.educationRecord.findMany({ where: { memberId }, select: { marksheetFileId: true } }),
    prisma.memberSportAchievement.findMany({ where: { sport: { memberId } }, select: { certificateFileId: true } }),
    prisma.memberFile.findMany({ where: { memberId } }),
  ])
  const used = new Set([...edu.map((e) => e.marksheetFileId), ...ach.map((a) => a.certificateFileId)].filter(Boolean))
  // Uploads less than an hour old may belong to a form still being filled in.
  const cutoff = Date.now() - 60 * 60 * 1000
  const orphans = files.filter((f) => !used.has(f.id) && f.createdAt.getTime() < cutoff)
  return removeFiles(orphans)
}

export async function removeFiles(files: { id: string; storageKey: string }[]) {
  if (!files.length) return
  await prisma.memberFile.deleteMany({ where: { id: { in: files.map((f) => f.id) } } })
  await deletePhotoObjects(files.map((f) => f.storageKey)).catch(() => undefined)
}

interface SupportOutcome {
  opened: { sourceKey: string; category: string }[]
  withdrawn: string[]
  /** "Needs help" answered Yes with no decision yet about sharing. */
  askToShare: { key: string; category: string }[]
}

/** Rule 3: a request reaches the support list only after an explicit Yes to sharing. */
async function syncSupport(
  tx: Prisma.TransactionClient, section: SectionDef, parsed: ParsedSection, rowIds: string[],
  ctx: DetailsContext, actorUserId: string,
): Promise<SupportOutcome> {
  const memberId = ctx.member!.id
  const outcome: SupportOutcome = { opened: [], withdrawn: [], askToShare: [] }
  const open = await tx.supportRequest.findMany({
    where: { memberId, status: 'OPEN', OR: [{ sourceKey: { startsWith: `${section.key}.` } }, { sourceKey: { startsWith: `${section.key}:` } }] },
  })
  const openByKey = new Map(open.map((r) => [r.sourceKey, r]))
  const touched = new Set<string>()

  const needs = (def: SupportDef, vals: Record<string, unknown>) => {
    if (def.kind === 'answer') return parsed.answer === 'YES' && parsed.rows.length > 0
    const v = vals[def.field]
    return def.kind === 'multi' ? Array.isArray(v) && v.length > 0 : v === true
  }

  const apply = async (key: string, shareKey: string, def: SupportDef, need: boolean, share: boolean | undefined, note: unknown) => {
    touched.add(key)
    const existing = openByKey.get(key)
    if (need && share === true) {
      if (existing) {
        await tx.supportRequest.update({ where: { id: existing.id }, data: { note: (note as string) ?? null } })
      } else {
        await tx.supportRequest.create({
          data: { memberId, sourceKey: key, category: def.category, district: ctx.district, note: (note as string) ?? null, createdByUserId: actorUserId },
        })
        outcome.opened.push({ sourceKey: key, category: def.category })
      }
    } else if (existing && (!need || share === false)) {
      await tx.supportRequest.update({ where: { id: existing.id }, data: { status: 'WITHDRAWN', withdrawnAt: new Date() } })
      outcome.withdrawn.push(key)
    } else if (need && share === undefined && !existing) {
      outcome.askToShare.push({ key: shareKey, category: def.category })
    }
  }

  for (const def of section.support ?? []) {
    if (def.row) {
      for (const [i, row] of parsed.rows.entries()) {
        const id = rowIds[i]
        await apply(supportSourceKey(section, def, id), id, def, needs(def, row.values), row.share, def.noteField ? row.values[def.noteField] : null)
      }
    } else {
      await apply(supportSourceKey(section, def), def.field, def, needs(def, parsed.values), parsed.share[def.field], def.noteField ? parsed.values[def.noteField] : null)
    }
  }
  // Rows that were removed take their open requests with them.
  for (const r of open) {
    if (!touched.has(r.sourceKey)) {
      await tx.supportRequest.update({ where: { id: r.id }, data: { status: 'WITHDRAWN', withdrawnAt: new Date() } })
      outcome.withdrawn.push(r.sourceKey)
    }
  }
  return outcome
}

export async function saveSection(
  ctx: DetailsContext, section: SectionDef, parsed: ParsedSection, rawValues: Record<string, unknown>,
  actor: { userId: string; role: string; ipAddress: string | null; userAgent: string | null },
) {
  const memberId = ctx.member!.id
  await resolveReferences(section, parsed, ctx)
  const previous = await prisma.memberSectionSetting.findUnique({ where: { memberId_sectionKey: { memberId, sectionKey: section.key } } })

  const result = await prisma.$transaction(async (tx) => {
    await tx.memberSectionSetting.upsert({
      where: { memberId_sectionKey: { memberId, sectionKey: section.key } },
      update: { answer: parsed.answer, visibility: parsed.visibility, enteredByUserId: actor.userId, entryNote: parsed.entryNote },
      create: { memberId, sectionKey: section.key, answer: parsed.answer, visibility: parsed.visibility, enteredByUserId: actor.userId, entryNote: parsed.entryNote },
    })

    if (section.fields?.some((f) => !f.memberColumn)) {
      const data = detailData(section, parsed.values)
      await tx.memberAdditionalDetail.upsert({ where: { memberId }, update: data, create: { memberId, ...data } })
    }
    // Existing profile columns (blood group, languages) are only written when
    // the section is answered Yes and the field was actually sent.
    const memberData: Record<string, unknown> = {}
    for (const f of section.fields ?? []) {
      if (f.memberColumn && parsed.answer === 'YES' && f.key in rawValues) {
        memberData[f.key] = f.type === 'tags' ? (parsed.values[f.key] ?? []) : parsed.values[f.key]
      }
    }
    if (Object.keys(memberData).length) await tx.member.update({ where: { id: memberId }, data: { ...memberData, updatedBy: actor.userId } })

    let rowIds: string[] = []
    if (section.row) {
      if (parsed.answer === 'YES') rowIds = await writeRows(tx, section, memberId, parsed.rows)
      else await clearRows(tx, section, memberId)
    }

    const support = await syncSupport(tx, section, parsed, rowIds, ctx, actor.userId)

    // Rule 7. Field names and counts only — never the values, so deleting a
    // section really removes the data instead of leaving a copy in the log.
    await tx.auditLog.create({
      data: {
        actorId: actor.userId,
        actorRole: actor.role,
        action: previous ? 'additional_details.section.update' : 'additional_details.section.create',
        entityType: 'member',
        entityId: memberId,
        fieldName: section.key,
        oldValue: previous ? { answer: previous.answer, visibility: previous.visibility } : Prisma.DbNull,
        newValue: { answer: parsed.answer, visibility: parsed.visibility },
        ipAddress: actor.ipAddress,
        userAgent: actor.userAgent,
        metadata: {
          enteredBy: ctx.editorKind,
          entryNote: parsed.entryNote,
          rows: parsed.rows.length,
          fieldsSet: Object.entries(parsed.values).filter(([, v]) => v !== null).map(([k]) => k),
          supportOpened: support.opened.map((o) => o.category),
          supportWithdrawn: support.withdrawn.length,
        },
      },
    })
    return { support, rowIds }
  })

  if (section.key === 'education' || section.key === 'sports') await pruneFiles(memberId)
  return result
}

export async function deleteSection(
  ctx: DetailsContext, section: SectionDef,
  actor: { userId: string; role: string; ipAddress: string | null; userAgent: string | null },
) {
  const memberId = ctx.member!.id
  await prisma.$transaction(async (tx) => {
    if (section.row) await clearRows(tx, section, memberId)
    if (section.fields?.some((f) => !f.memberColumn)) {
      await tx.memberAdditionalDetail.updateMany({ where: { memberId }, data: detailData(section, null) })
    }
    await tx.memberSectionSetting.deleteMany({ where: { memberId, sectionKey: section.key } })
    // Removed, not hidden (rule 4) — including any support requests it raised.
    await tx.supportRequest.deleteMany({
      where: { memberId, OR: [{ sourceKey: { startsWith: `${section.key}.` } }, { sourceKey: { startsWith: `${section.key}:` } }] },
    })
    await tx.auditLog.create({
      data: {
        actorId: actor.userId, actorRole: actor.role, action: 'additional_details.section.delete',
        entityType: 'member', entityId: memberId, fieldName: section.key,
        ipAddress: actor.ipAddress, userAgent: actor.userAgent, metadata: { enteredBy: ctx.editorKind },
      },
    })
  })
  if (section.key === 'education' || section.key === 'sports') {
    const files = await prisma.memberFile.findMany({ where: { memberId, purpose: section.key === 'education' ? 'MARKSHEET' : 'CERTIFICATE' } })
    await removeFiles(files)
  }
}

export { SECTIONS, SECTION_BY_KEY }
