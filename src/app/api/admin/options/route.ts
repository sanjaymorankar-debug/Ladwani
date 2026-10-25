import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { json } from '@/lib/additional-details/http'
import { getOptionLists } from '@/lib/additional-details/server'
import { DEFAULT_OPTIONS, EDITABLE_LIST_KEYS } from '@/lib/additional-details/options'

/** Rule 11: Admin edits dropdown values without a code change. */
export async function GET() {
  const session = await getServerSession(authOptions)
  if (!(((session?.user as any)?.roles ?? []) as string[]).includes('ADMIN')) return json({ message: 'Forbidden' }, 403)
  const lists = await getOptionLists()
  const customised = new Set((await prisma.optionMaster.findMany({ select: { listKey: true }, distinct: ['listKey'] })).map((r) => r.listKey))
  return json({ lists: EDITABLE_LIST_KEYS.map((k) => ({ listKey: k, options: lists[k], customised: customised.has(k) })) })
}

/**
 * Replaces one list. body: { listKey, options: [{ value, label, isActive? }] } or { listKey, reset: true }.
 * Values already stored by members keep working: removing an option only
 * deactivates it, so it can't be picked again but existing answers still show.
 */
export async function PUT(req: Request) {
  const session = await getServerSession(authOptions)
  if (!(((session?.user as any)?.roles ?? []) as string[]).includes('ADMIN')) return json({ message: 'Forbidden' }, 403)
  const body = await req.json().catch(() => ({}))
  const listKey = String(body.listKey ?? '')
  if (!EDITABLE_LIST_KEYS.includes(listKey)) return json({ message: 'Unknown list' }, 400)

  if (body.reset === true) {
    await prisma.optionMaster.deleteMany({ where: { listKey } })
  } else {
    if (!Array.isArray(body.options) || !body.options.length) return json({ message: 'A list needs at least one option' }, 400)
    const seen = new Set<string>()
    for (const o of body.options) {
      const value = String(o?.value ?? '').trim().toUpperCase().replace(/[^A-Z0-9_]/g, '_')
      const label = String(o?.label ?? '').trim()
      if (!value || !label || label.length > 191 || seen.has(value)) return json({ message: 'Each option needs a unique code and a label' }, 400)
      seen.add(value)
      o.value = value
      o.label = label
    }
    // Keep removed defaults as inactive rows so stored answers keep their labels.
    const removed = (DEFAULT_OPTIONS[listKey] ?? []).filter((d) => !seen.has(d.value))
    await prisma.$transaction(async (tx) => {
      await tx.optionMaster.deleteMany({ where: { listKey } })
      let i = 0
      for (const o of body.options) {
        await tx.optionMaster.create({ data: { listKey, value: o.value, label: o.label, sortOrder: i++, isActive: o.isActive !== false } })
      }
      for (const d of removed) await tx.optionMaster.create({ data: { listKey, value: d.value, label: d.label, sortOrder: i++, isActive: false } })
    })
  }
  await prisma.auditLog.create({
    data: { actorId: session!.user!.id as string, actorRole: 'ADMIN', action: 'options.update', entityType: 'option_list', entityId: listKey },
  })
  return json({ message: 'Saved', options: (await getOptionLists())[listKey] })
}
