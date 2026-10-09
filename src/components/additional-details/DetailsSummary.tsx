import Link from 'next/link'
import { headers } from 'next/headers'
import { Session } from 'next-auth'
import { ClipboardList } from 'lucide-react'
import { prisma } from '@/lib/prisma'
import { canViewSection, getDetailsContext } from '@/lib/additional-details/access'
import { getOptionLists, loadDetails, presentSection } from '@/lib/additional-details/server'
import { applicableSections, completenessScore, VISIBILITY_LABELS, type FieldDef, type Visibility } from '@/lib/additional-details/sections'
import { optionLabel, type OptionLists } from '@/lib/additional-details/options'
import { BASE_PATH } from '@/lib/api-path'

/**
 * Read-only Additional Details on a member's profile page. Each section is
 * shown only if its visibility includes the viewer (checked here on the
 * server, not just hidden in the page), and viewing someone else's details is
 * audit-logged (rule 7).
 */
export default async function DetailsSummary({ session, memberId }: { session: Session; memberId: string }) {
  const ctx = await getDetailsContext(session, memberId)
  if (!ctx.exists) return null
  const applicable = applicableSections(ctx.applicability)
  const data = await loadDetails(memberId)
  const visible = applicable.filter((s) => data.settings[s.key]?.answer === 'YES' && (ctx.canEdit || canViewSection(ctx, data.settings[s.key]?.visibility)))
  const answered = Object.entries(data.settings).filter(([, s]) => s.answer).map(([k]) => k)
  if (!ctx.canEdit && !visible.length) return null

  if (!ctx.canEdit) {
    const h = headers()
    await prisma.auditLog.create({
      data: {
        actorId: session.user!.id as string,
        actorRole: (((session.user as any).roles ?? []) as string[])[0] ?? 'MEMBER',
        action: 'additional_details.view', entityType: 'member', entityId: memberId,
        ipAddress: h.get('x-forwarded-for')?.split(',')[0].trim() ?? null,
        userAgent: h.get('user-agent')?.slice(0, 500) ?? null,
        metadata: { sections: visible.map((s) => s.key), what: 'profile-page', viewerLevel: ctx.viewerLevel },
      },
    })
  }
  const lists = await getOptionLists()

  return (
    <div className="card space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-gray-900 flex items-center gap-2"><ClipboardList className="w-4 h-4 text-saffron-600" /> Additional Details</h3>
        {ctx.canEdit && (
          <Link href={`/members/${memberId}/additional-details`} className="btn-primary text-sm">
            {answered.length ? 'Update' : 'Add details'} · {completenessScore(applicable.map((s) => s.key), answered)}%
          </Link>
        )}
      </div>
      {ctx.canEdit && !visible.length && <p className="text-sm text-gray-500">Optional details that help the community support you and connect you with people who share your interests.</p>}
      {visible.map((s) => {
        const p = presentSection(s, data, ctx.canEdit)
        const fields = (s.fields ?? []).filter((f) => f.key in p.values && hasValue(p.values[f.key]))
        return (
          <div key={s.key} className="border-t border-gray-100 pt-3">
            <div className="flex items-center justify-between mb-1">
              <p className="text-sm font-semibold text-gray-800">{s.title}</p>
              {ctx.canEdit && <span className="text-xs text-gray-400">{VISIBILITY_LABELS[p.visibility as Visibility]}</span>}
            </div>
            <dl className="grid sm:grid-cols-2 gap-x-4 gap-y-1 text-sm">
              {fields.map((f) => (
                <div key={f.key} className="flex gap-2"><dt className="text-gray-500">{f.label}</dt><dd className="text-gray-900">{display(f, p.values[f.key], lists)}</dd></div>
              ))}
            </dl>
            {p.rows.map((r, i) => (
              <dl key={String(r.id ?? i)} className="mt-1 rounded bg-gray-50 p-2 grid sm:grid-cols-2 gap-x-4 gap-y-0.5 text-sm">
                {(s.row?.fields ?? []).filter((f) => hasValue(r[f.key])).map((f) => (
                  <div key={f.key} className="flex gap-2">
                    <dt className="text-gray-500">{f.label}</dt>
                    <dd className="text-gray-900">{f.type === 'interest' ? String(r.interestName ?? '') : f.type === 'file' ? <a className="underline" href={`${BASE_PATH}/api/member-files/${r[f.key]}`}>View</a> : display(f, r[f.key], lists)}</dd>
                  </div>
                ))}
              </dl>
            ))}
          </div>
        )
      })}
    </div>
  )
}

const hasValue = (v: unknown) => v !== null && v !== undefined && v !== '' && !(Array.isArray(v) && v.length === 0)

function display(f: FieldDef, v: unknown, lists: OptionLists): string {
  if (f.type === 'bool') return v ? 'Yes' : 'No'
  if (f.type === 'multi') return (v as string[]).map((x) => optionLabel(lists, f.list!, x)).join(', ')
  if (f.type === 'tags') return (v as string[]).join(', ')
  if ((f.type === 'select' || f.type === 'monthNum') && f.list) return optionLabel(lists, f.list, v)
  if (f.type === 'familyMember' || f.type === 'district') return 'Linked'
  return String(v)
}
