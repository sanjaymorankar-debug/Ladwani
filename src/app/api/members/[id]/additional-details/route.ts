import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getDetailsContext, canViewSection } from '@/lib/additional-details/access'
import {
  CONSENT_TEXT, CONSENT_VERSION, getOptionLists, hasConsent, hasMinorGroupConsent, loadDetails, presentSection,
} from '@/lib/additional-details/server'
import { applicableSections, completenessScore } from '@/lib/additional-details/sections'
import { auditView, json } from '@/lib/additional-details/http'

/**
 * Additional Details overview. The editor (the member, or the parent/Karta who
 * maintains the profile) gets every applicable section plus what the wizard
 * needs. Anyone else gets only the sections whose visibility includes them,
 * and the view is audit-logged.
 */
export async function GET(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return json({ message: 'Unauthorized' }, 401)
  const ctx = await getDetailsContext(session, params.id)
  if (!ctx.exists) return json({ message: 'Not found' }, 404)

  const applicable = applicableSections(ctx.applicability)
  const data = await loadDetails(params.id)
  const answered = Object.entries(data.settings).filter(([, s]) => s.answer).map(([k]) => k)

  if (!ctx.canEdit) {
    const visible = applicable
      .filter((s) => data.settings[s.key]?.answer === 'YES' && canViewSection(ctx, data.settings[s.key]?.visibility))
      .map((s) => presentSection(s, data, false))
    await auditView(ctx, session, req, visible.map((s) => s.key))
    return json({
      member: { id: ctx.member!.id, name: `${ctx.member!.firstName} ${ctx.member!.lastName ?? ''}`.trim() },
      canEdit: false,
      sections: visible,
      options: await getOptionLists(),
    })
  }

  const [consentGiven, minorConsent, familyRows, districts, currentAddress] = await Promise.all([
    hasConsent(params.id),
    ctx.isMinor ? hasMinorGroupConsent(params.id) : Promise.resolve(true),
    prisma.familyMember.findMany({
      where: { familyId: { in: ctx.familyIds }, leftAt: null, memberId: { not: params.id } },
      include: { member: { select: { id: true, firstName: true, lastName: true } } },
    }),
    prisma.area.findMany({ where: { type: 'DISTRICT', isActive: true }, select: { id: true, name: true }, orderBy: { name: 'asc' } }),
    prisma.address.findFirst({
      where: { memberId: params.id, addressType: 'CURRENT' },
      select: { line1: true, city: true, district: true, state: true, pincode: true },
    }),
  ])

  return json({
    member: {
      id: ctx.member!.id,
      name: `${ctx.member!.firstName} ${ctx.member!.lastName ?? ''}`.trim(),
      age: ctx.age,
      isMinor: ctx.isMinor,
      hasLogin: !!ctx.member!.userId,
    },
    canEdit: true,
    editorKind: ctx.editorKind,
    consent: { given: consentGiven, version: CONSENT_VERSION, text: CONSENT_TEXT },
    applicable: applicable.map((s) => s.key),
    completeness: completenessScore(applicable.map((s) => s.key), answered),
    sections: applicable.map((s) => presentSection(s, data, true)),
    groups: { autoAdd: data.detail?.autoAddToGroups !== false, minorConsent },
    familyMembers: Array.from(new Map(familyRows.map((f) => [f.member.id, { id: f.member.id, name: `${f.member.firstName} ${f.member.lastName ?? ''}`.trim() }])).values()),
    districts,
    currentAddress,
    options: await getOptionLists(),
  })
}
