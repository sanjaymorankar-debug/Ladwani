import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { getDetailsContext, canViewSection } from '@/lib/additional-details/access'
import {
  SECTION_BY_KEY, deleteSection, getOptionLists, hasConsent, loadDetails, presentSection, saveSection,
} from '@/lib/additional-details/server'
import { SectionInputError, parseSectionInput } from '@/lib/additional-details/parse'
import { sectionApplies } from '@/lib/additional-details/sections'
import { actorFor, auditView, json } from '@/lib/additional-details/http'
import { syncMemberGroups, type SyncResult } from '@/lib/interest-groups'

async function setup(req: Request, params: { id: string; section: string }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return { error: json({ message: 'Unauthorized' }, 401) }
  const section = SECTION_BY_KEY[params.section]
  if (!section) return { error: json({ message: 'Unknown section' }, 404) }
  const ctx = await getDetailsContext(session, params.id)
  if (!ctx.exists) return { error: json({ message: 'Not found' }, 404) }
  return { session, section, ctx }
}

export async function GET(req: Request, { params }: { params: { id: string; section: string } }) {
  const s = await setup(req, params)
  if ('error' in s) return s.error
  const { session, section, ctx } = s
  const data = await loadDetails(params.id, [section.key])
  const setting = data.settings[section.key]
  if (!ctx.canEdit) {
    if (setting?.answer !== 'YES' || !canViewSection(ctx, setting.visibility) || !sectionApplies(section, ctx.applicability)) {
      return json({ message: 'Not found' }, 404) // never confirm that a hidden section exists
    }
    await auditView(ctx, session!, req, [section.key])
  }
  return json({ section: presentSection(section, data, ctx.canEdit) })
}

/** Saves one section (create or update). No operator approval is involved (rule 5). */
export async function PUT(req: Request, { params }: { params: { id: string; section: string } }) {
  const s = await setup(req, params)
  if ('error' in s) return s.error
  const { session, section, ctx } = s
  if (!ctx.canEdit) {
    return json({
      message: ctx.isMinor
        ? 'Details of members under 18 are entered by a parent or the family Karta.'
        : 'Only the member (or the Karta, for members without a login) can edit these details.',
    }, 403)
  }
  if (!sectionApplies(section, ctx.applicability)) return json({ message: `${section.title} does not apply to this profile` }, 400)
  if (!(await hasConsent(params.id))) {
    return json({ code: 'CONSENT_REQUIRED', message: 'Please read and agree to the consent notice before saving.' }, 412)
  }

  let body: any
  try {
    body = await req.json()
  } catch {
    return json({ message: 'Invalid JSON' }, 400)
  }
  const actor = actorFor(session!, req)
  let saved
  try {
    const parsed = parseSectionInput(section, body, await getOptionLists())
    saved = await saveSection(ctx, section, parsed, (body?.values ?? {}) as Record<string, unknown>, actor)
  } catch (e) {
    if (e instanceof SectionInputError) return json({ message: e.message }, 400)
    throw e
  }

  // Sensitive sections never feed groups (Step 3 rule 8).
  let groups: SyncResult = { added: [], removable: [] }
  if (!section.sensitive) groups = await syncMemberGroups(params.id, actor.userId)
  if (groups.added.length && ctx.member!.userId) {
    await prisma.notification.create({
      data: {
        recipientId: ctx.member!.userId, senderId: actor.userId, type: 'GROUP_ADDED',
        title: 'You have been added to these groups',
        body: groups.added.map((g) => g.name).join(', '),
        data: { groups: groups.added as unknown as Prisma.InputJsonValue },
      },
    })
  }

  // Wanting a fitness or yoga group is a suggestion only: wellness is a
  // health topic, so it never auto-joins anyone.
  let suggestedGroups: { id: string; name: string }[] = []
  const wants = Array.isArray(body?.values?.wellnessWants) ? (body.values.wellnessWants as string[]) : []
  if (section.key === 'wellness' && body?.answer === 'YES' && wants.some((w) => w === 'FITNESS_GROUP' || w === 'YOGA_GROUP')) {
    const g = await prisma.communityGroup.findUnique({ where: { autoKey: 'derived:FITNESS_YOGA|' }, select: { id: true, name: true } })
    if (g) suggestedGroups = [g]
  }

  const data = await loadDetails(params.id, [section.key])
  return json({
    message: 'Saved',
    section: presentSection(section, data, true),
    support: saved.support,
    groups,
    suggestedGroups,
  })
}

/** Deletes everything this section stored (rule 4: removed, not hidden). */
export async function DELETE(req: Request, { params }: { params: { id: string; section: string } }) {
  const s = await setup(req, params)
  if ('error' in s) return s.error
  const { session, section, ctx } = s
  if (!ctx.canEdit) return json({ message: 'Forbidden' }, 403)
  const actor = actorFor(session!, req)
  await deleteSection(ctx, section, actor)
  const groups = section.sensitive ? { added: [], removable: [] } : await syncMemberGroups(params.id, actor.userId)
  return json({ message: `${section.title} deleted`, groups })
}
