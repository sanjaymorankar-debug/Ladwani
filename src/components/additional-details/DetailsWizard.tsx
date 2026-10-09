'use client'
import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { ChevronLeft, ChevronRight, Plus, Trash2, ShieldCheck, Users, HeartHandshake } from 'lucide-react'
import RadioGroup from '@/components/ui/RadioGroup'
import FieldInput, { type PickerData } from './FieldInput'
import {
  ANSWERS, SECTION_BY_KEY, VISIBILITY_LABELS, VISIBILITY_LEVELS, completenessScore, fieldVisible, maxVisibilityFor,
  rowFieldVisible, visibilityRank, type SectionDef, type SupportDef,
} from '@/lib/additional-details/sections'

type Row = Record<string, any>
interface Draft {
  answer: string | null
  visibility: string
  values: Record<string, unknown>
  rows: Row[]
  share: Record<string, boolean | undefined>
  entryNote: string
}
interface GroupRef { id: string; name: string }

/**
 * Additional Details as a step-by-step wizard (rule 9): one section per
 * step, a progress bar, every step skippable, sections that don't apply are
 * never shown. The server re-applies every rule shown here.
 */
export default function DetailsWizard({ memberId }: { memberId: string }) {
  const [data, setData] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)
  const [step, setStep] = useState(0)
  const [drafts, setDrafts] = useState<Record<string, Draft>>({})
  const [agree, setAgree] = useState(false)
  const [saving, setSaving] = useState(false)
  const [added, setAdded] = useState<GroupRef[]>([])
  const [removable, setRemovable] = useState<GroupRef[]>([])
  const [suggested, setSuggested] = useState<GroupRef[]>([])
  const [picker, setPicker] = useState<PickerData | null>(null)
  // Sections with a saved answer — drives the completeness score and "Delete section".
  const [saved, setSaved] = useState<Set<string>>(new Set())

  const load = async () => {
    const res = await fetch(`/api/members/${memberId}/additional-details`)
    const body = await res.json()
    if (!res.ok) return setError(body.message ?? 'Could not load')
    if (!body.canEdit) return setError('Only the member — or the parent/Karta for children and members without a login — can fill in these details.')
    setData(body)
    const d: Record<string, Draft> = {}
    for (const s of body.sections) d[s.key] = toDraft(s)
    setDrafts(d)
    setSaved(new Set(body.sections.filter((s: any) => s.answer).map((s: any) => s.key)))
    const [all, sports] = await Promise.all([
      fetch('/api/interests').then((r) => r.json()),
      fetch('/api/interests?sports=true').then((r) => r.json()),
    ])
    setPicker({
      lists: body.options, interests: all.categories ?? {}, sports: sports.categories ?? {},
      familyMembers: body.familyMembers ?? [], districts: body.districts ?? [], memberId,
    })
  }
  useEffect(() => { load() }, [memberId]) // eslint-disable-line react-hooks/exhaustive-deps

  const steps: SectionDef[] = useMemo(() => (data?.applicable ?? []).map((k: string) => SECTION_BY_KEY[k]).filter(Boolean), [data])
  const score = completenessScore(steps.map((s) => s.key), Array.from(saved))

  if (error) return <div className="card text-sm text-gray-700">{error}</div>
  if (!data || !picker) return <div className="card text-sm text-gray-500">Loading…</div>

  if (!data.consent.given) {
    const giveConsent = async () => {
      const res = await fetch(`/api/members/${memberId}/additional-details/consent`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agree: true, version: data.consent.version }),
      })
      if (!res.ok) return toast.error((await res.json()).message)
      await load()
    }
    return (
      <div className="card space-y-4">
        <h2 className="font-semibold text-gray-900 flex items-center gap-2"><ShieldCheck className="w-5 h-5 text-saffron-600" /> Before you start</h2>
        {data.editorKind !== 'SELF' && (
          <p className="text-sm bg-amber-50 border border-amber-200 rounded-lg p-3 text-amber-900">
            You are entering details for <strong>{data.member.name}</strong> as their {data.editorKind === 'PARENT' ? 'parent' : 'Karta'}, and consenting on their behalf.
          </p>
        )}
        <div className="text-sm text-gray-700 whitespace-pre-line leading-relaxed">{data.consent.text}</div>
        <label className="flex items-start gap-2 text-sm font-medium">
          <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} className="mt-0.5" />
          I agree (notice version {data.consent.version})
        </label>
        <button className="btn-primary" disabled={!agree} onClick={giveConsent}>Continue</button>
      </div>
    )
  }

  const section = steps[Math.min(step, steps.length - 1)]
  const draft = drafts[section.key]
  const setDraft = (patch: Partial<Draft>) => setDrafts((d) => ({ ...d, [section.key]: { ...d[section.key], ...patch } }))
  const setValue = (k: string, v: unknown) => setDraft({ values: { ...draft.values, [k]: v } })
  const cap = maxVisibilityFor(section.key)
  const visibleFields = (section.fields ?? []).filter((f) => fieldVisible(f, draft.answer, draft.values))

  const save = async (advance: boolean) => {
    if (!draft.answer) {
      if (advance) setStep((s) => Math.min(s + 1, steps.length - 1))
      return
    }
    setSaving(true)
    try {
      const res = await fetch(`/api/members/${memberId}/additional-details/${section.key}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          answer: draft.answer, visibility: draft.visibility, values: draft.values,
          rows: draft.rows, share: draft.share, entryNote: draft.entryNote || undefined,
        }),
      })
      const body = await res.json()
      if (!res.ok) throw new Error(body.message)
      setDrafts((d) => ({ ...d, [section.key]: toDraft(body.section) }))
      setSaved((s) => new Set(s).add(section.key))
      if (body.support?.askToShare?.length) toast('Please say whether to share your help request with the support team.', { icon: '🤝' })
      if (body.groups?.added?.length) setAdded(body.groups.added)
      if (body.groups?.removable?.length) setRemovable(body.groups.removable)
      if (body.suggestedGroups?.length) setSuggested(body.suggestedGroups)
      toast.success('Saved')
      if (advance && !body.support?.askToShare?.length) setStep((s) => Math.min(s + 1, steps.length - 1))
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setSaving(false)
    }
  }

  const deleteSection = async () => {
    if (!confirm(`Delete everything saved in "${section.title}"? This removes the data permanently.`)) return
    const res = await fetch(`/api/members/${memberId}/additional-details/${section.key}`, { method: 'DELETE' })
    const body = await res.json()
    if (!res.ok) return toast.error(body.message)
    const fresh = await fetch(`/api/members/${memberId}/additional-details/${section.key}`).then((r) => r.json())
    setDrafts((d) => ({ ...d, [section.key]: toDraft(fresh.section) }))
    setSaved((s) => { const n = new Set(s); n.delete(section.key); return n })
    if (body.groups?.removable?.length) setRemovable(body.groups.removable)
    toast.success(body.message)
  }

  const leave = async (g: GroupRef) => {
    const res = await fetch(`/api/interest-groups/${g.id}/membership`, { method: 'DELETE' })
    if (res.ok) {
      setAdded((a) => a.filter((x) => x.id !== g.id))
      toast.success(`You left ${g.name}`)
    }
  }
  const confirmRemoval = async () => {
    const res = await fetch('/api/interest-groups/leave-unmatched', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ memberId, groupIds: removable.map((g) => g.id) }),
    })
    if (res.ok) toast.success('Removed from those groups')
    setRemovable([])
  }
  const joinSuggested = async (g: GroupRef) => {
    const res = await fetch(`/api/interest-groups/${g.id}/membership`, { method: 'POST' })
    toast[res.ok ? 'success' : 'error']((await res.json()).message)
    setSuggested((s) => s.filter((x) => x.id !== g.id))
  }

  return (
    <div className="space-y-4">
      <div className="card space-y-3">
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium text-gray-700">Step {step + 1} of {steps.length}</span>
          <span className="text-gray-500">Profile completeness {score}% — every step is optional</span>
        </div>
        <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden" role="progressbar" aria-valuenow={step + 1} aria-valuemin={1} aria-valuemax={steps.length}>
          <div className="h-full bg-saffron-500 transition-all" style={{ width: `${((step + 1) / steps.length) * 100}%` }} />
        </div>
        <div className="flex gap-1.5 overflow-x-auto pb-1">
          {steps.map((s, i) => (
            <button key={s.key} onClick={() => setStep(i)} title={s.title}
              className={`flex-shrink-0 rounded-full w-7 h-7 text-xs font-medium border ${i === step ? 'bg-saffron-600 text-white border-saffron-600' : saved.has(s.key) ? 'bg-green-50 text-green-700 border-green-200' : 'bg-white text-gray-500 border-gray-200'}`}>
              {i + 1}
            </button>
          ))}
        </div>
      </div>

      {added.length > 0 && (
        <div className="card border-green-200 bg-green-50 space-y-2">
          <p className="font-medium text-green-900 flex items-center gap-2"><Users className="w-4 h-4" /> You have been added to these groups</p>
          {added.map((g) => (
            <div key={g.id} className="flex items-center justify-between text-sm">
              <Link href={`/interest-groups/${g.id}`} className="text-green-900 underline">{g.name}</Link>
              <button className="btn-ghost text-sm text-red-600" onClick={() => leave(g)}>Leave</button>
            </div>
          ))}
          <button className="text-xs text-green-800" onClick={() => setAdded([])}>Dismiss</button>
        </div>
      )}
      {removable.length > 0 && (
        <div className="card border-amber-200 bg-amber-50 space-y-2 text-sm">
          <p className="font-medium text-amber-900">These groups no longer match your profile. Remove you from them?</p>
          <ul className="list-disc ml-5">{removable.map((g) => <li key={g.id}>{g.name}</li>)}</ul>
          <div className="flex gap-2">
            <button className="btn-primary text-sm" onClick={confirmRemoval}>Yes, remove me</button>
            <button className="btn-secondary text-sm" onClick={() => setRemovable([])}>Keep me in them</button>
          </div>
        </div>
      )}
      {suggested.length > 0 && (
        <div className="card text-sm space-y-2">
          <p className="font-medium">You asked for a group — would you like to join?</p>
          {suggested.map((g) => <button key={g.id} className="btn-secondary text-sm" onClick={() => joinSuggested(g)}>Join {g.name}</button>)}
        </div>
      )}

      <div className="card space-y-4">
        <div>
          <p className="text-xs text-gray-400">Section {section.number}</p>
          <h2 className="text-lg font-semibold text-gray-900">{section.title}</h2>
          {section.intro && <p className="text-sm text-gray-600 mt-1">{section.intro}</p>}
          {section.neverCollect && <p className="text-xs text-gray-500 mt-1 flex items-center gap-1"><ShieldCheck className="w-3.5 h-3.5" /> {section.neverCollect}</p>}
          {section.key === 'house' && data.currentAddress && (
            <p className="text-xs text-gray-500 mt-1">Current address: {[data.currentAddress.line1, data.currentAddress.city, data.currentAddress.district].filter(Boolean).join(', ')}</p>
          )}
        </div>

        <div>
          <p className="form-label">{section.gateQuestion}</p>
          <RadioGroup name={`gate-${section.key}`} value={draft.answer ?? ''} options={ANSWERS} ariaLabel={section.gateQuestion}
            onChange={(v) => setDraft({ answer: v })} />
        </div>

        {draft.answer === 'YES' && section.row && (
          <RowsEditor section={section} rows={draft.rows} onChange={(rows) => setDraft({ rows })} data={picker} shared={draft.share} />
        )}

        {visibleFields.length > 0 && (
          <div className="grid sm:grid-cols-2 gap-3">
            {visibleFields.map((f) => (
              <FieldInput key={f.key} field={f} value={draft.values[f.key]} onChange={(v) => setValue(f.key, v)} data={picker} idPrefix={section.key} />
            ))}
          </div>
        )}

        {draft.answer && draft.answer !== 'PREFER_NOT' && (section.support ?? []).filter((d) => !d.row).map((def) =>
          needsHelp(def, draft) ? (
            <SharePrompt key={def.field} value={draft.share[def.field]} onChange={(v) => setDraft({ share: { ...draft.share, [def.field]: v } })} />
          ) : null
        )}

        {draft.answer && draft.answer !== 'PREFER_NOT' && (
          <div className="grid sm:grid-cols-2 gap-3 pt-3 border-t border-gray-100">
            <div>
              <label className="form-label" htmlFor="vis">Who can see this section?</label>
              <select id="vis" className="form-input" value={draft.visibility} onChange={(e) => setDraft({ visibility: e.target.value })}>
                {VISIBILITY_LEVELS.filter((v) => visibilityRank(v) <= visibilityRank(cap)).map((v) => <option key={v} value={v}>{VISIBILITY_LABELS[v]}</option>)}
              </select>
              {cap !== 'COMMUNITY' && <p className="text-xs text-gray-500 mt-1">Kept private: never wider than {VISIBILITY_LABELS[cap]}.</p>}
            </div>
            {data.editorKind !== 'SELF' && (
              <div>
                <label className="form-label" htmlFor="note">Note (who entered this and why)</label>
                <input id="note" className="form-input" maxLength={500} value={draft.entryNote} onChange={(e) => setDraft({ entryNote: e.target.value })} />
              </div>
            )}
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
          <div className="flex gap-2">
            <button className="btn-secondary text-sm flex items-center gap-1" disabled={step === 0} onClick={() => setStep((s) => Math.max(0, s - 1))}>
              <ChevronLeft className="w-4 h-4" /> Back
            </button>
            <button className="btn-ghost text-sm" onClick={() => setStep((s) => Math.min(s + 1, steps.length - 1))}>Skip</button>
          </div>
          <div className="flex gap-2">
            {saved.has(section.key) && (
              <button className="btn-ghost text-sm text-red-600 flex items-center gap-1" onClick={deleteSection}><Trash2 className="w-4 h-4" /> Delete section</button>
            )}
            <button className="btn-primary text-sm flex items-center gap-1" disabled={saving} onClick={() => save(true)}>
              {step === steps.length - 1 ? 'Save' : 'Save & next'} <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      <GroupPreferences memberId={memberId} initial={data.groups} isMinor={data.member.isMinor} />
    </div>
  )
}

function toDraft(s: any): Draft {
  const share: Record<string, boolean | undefined> = {}
  for (const [k, v] of Object.entries(s.shared ?? {})) if (!k.includes(':')) share[k] = v as boolean
  return {
    answer: s.answer,
    visibility: s.visibility,
    values: { ...s.values },
    rows: (s.rows ?? []).map((r: Row) => ({ ...r, _share: s.shared?.[r.id] ? true : undefined })),
    share,
    entryNote: s.entryNote ?? '',
  }
}

function needsHelp(def: SupportDef, d: { answer: string | null; values: Record<string, unknown>; rows: Row[] }, row?: Row) {
  if (def.kind === 'answer') return d.answer === 'YES' && d.rows.length > 0
  const v = row ? row[def.field] : d.values[def.field]
  return def.kind === 'multi' ? Array.isArray(v) && v.length > 0 : v === true
}

function SharePrompt({ value, onChange }: { value: boolean | undefined; onChange: (v: boolean) => void }) {
  return (
    <div className="rounded-lg bg-blue-50 border border-blue-100 p-3 text-sm">
      <p className="font-medium text-blue-900 flex items-center gap-2"><HeartHandshake className="w-4 h-4" /> Share this request with the community support team?</p>
      <p className="text-xs text-blue-800 mb-2">Only your District team sees your name. You can withdraw it at any time.</p>
      <div className="flex gap-2">
        {[{ v: true, l: 'Yes, share it' }, { v: false, l: 'No, keep it private' }].map((o) => (
          <label key={o.l} className={`cursor-pointer rounded-lg border px-3 py-1 ${value === o.v ? 'border-blue-500 bg-white font-medium' : 'border-blue-200'}`}>
            <input type="radio" className="sr-only" checked={value === o.v} onChange={() => onChange(o.v)} />{o.l}
          </label>
        ))}
      </div>
    </div>
  )
}

function RowsEditor({ section, rows, onChange, data, shared }: {
  section: SectionDef; rows: Row[]; onChange: (rows: Row[]) => void; data: PickerData; shared: Record<string, boolean | undefined>
}) {
  const def = section.row!
  const rowSupport = (section.support ?? []).filter((s) => s.row)
  const update = (i: number, patch: Row) => onChange(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)))
  return (
    <div className="space-y-3">
      {rows.map((row, i) => (
        <div key={row.id ?? `new-${i}`} className="rounded-lg border border-gray-200 p-3 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-700">
              {def.label} {i + 1}{row.interestName ? ` — ${row.interestName}` : ''}
              {row.interestStatus === 'PENDING' && <span className="badge-orange text-xs ml-2">Waiting for Admin approval</span>}
            </span>
            <button type="button" aria-label={`Remove ${def.label} ${i + 1}`} className="text-gray-400 hover:text-red-500" onClick={() => onChange(rows.filter((_, j) => j !== i))}>
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            {def.fields.filter((f) => rowFieldVisible(f, row)).map((f) => (
              <FieldInput key={f.key} field={f} value={row[f.key]} onChange={(v) => update(i, { [f.key]: v })} data={data} idPrefix={`${section.key}-${i}`} rowLabel={`${def.label} ${i + 1}`} />
            ))}
          </div>
          {def.children && (
            <div className="pl-3 border-l-2 border-saffron-100 space-y-2">
              <p className="text-sm font-medium text-gray-700">{def.children.label}</p>
              {(row[def.children.key] ?? []).map((child: Row, ci: number) => (
                <div key={child.id ?? ci} className="grid sm:grid-cols-2 gap-2 items-end">
                  {def.children!.fields.map((f) => (
                    <FieldInput key={f.key} field={f} value={child[f.key]} data={data} idPrefix={`${section.key}-${i}-c${ci}`}
                      onChange={(v) => update(i, { [def.children!.key]: row[def.children!.key].map((c: Row, k: number) => (k === ci ? { ...c, [f.key]: v } : c)) })} />
                  ))}
                  <button type="button" className="text-xs text-red-600 text-left" onClick={() => update(i, { [def.children!.key]: row[def.children!.key].filter((_: Row, k: number) => k !== ci) })}>Remove</button>
                </div>
              ))}
              <button type="button" className="text-sm text-saffron-700" onClick={() => update(i, { [def.children!.key]: [...(row[def.children!.key] ?? []), {}] })}>+ Add medal or certificate</button>
            </div>
          )}
          {rowSupport.map((s) => needsHelp(s, { answer: 'YES', values: {}, rows }, row) ? (
            <SharePrompt key={s.field} value={row._share ?? (row.id && shared[row.id]) ?? undefined} onChange={(v) => update(i, { _share: v })} />
          ) : null)}
        </div>
      ))}
      {rows.length < (def.max ?? 20) && (
        <button type="button" className="btn-secondary text-sm flex items-center gap-1.5" onClick={() => onChange([...rows, {}])}>
          <Plus className="w-4 h-4" /> Add {def.label.toLowerCase()}
        </button>
      )}
    </div>
  )
}

function GroupPreferences({ memberId, initial, isMinor }: { memberId: string; initial: { autoAdd: boolean; minorConsent: boolean }; isMinor: boolean }) {
  const [autoAdd, setAutoAdd] = useState(initial.autoAdd)
  const [minorConsent, setMinorConsent] = useState(initial.minorConsent)
  const toggle = async () => {
    const res = await fetch(`/api/members/${memberId}/group-settings`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ autoAddToGroups: !autoAdd }),
    })
    if (res.ok) setAutoAdd(!autoAdd)
  }
  const consent = async () => {
    const res = await fetch(`/api/members/${memberId}/additional-details/consent`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ agree: true, type: 'MINOR_GROUPS' }),
    })
    if (res.ok) { setMinorConsent(true); toast.success('Consent recorded — child-safe groups only') }
  }
  return (
    <div className="card text-sm space-y-3">
      <h3 className="font-semibold text-gray-900 flex items-center gap-2"><Users className="w-4 h-4" /> Interest groups</h3>
      <label className="flex items-center gap-2">
        <input type="checkbox" checked={!autoAdd} onChange={toggle} />
        Do not auto-add me to groups
      </label>
      {isMinor && !minorConsent && (
        <div className="rounded-lg bg-amber-50 border border-amber-200 p-3">
          <p>Members under 18 join only child-safe groups (studies, sports, arts, music), and only with a parent or Karta’s consent. Their district group membership is hidden from other members, and adults outside the family cannot contact them.</p>
          <button className="btn-secondary text-sm mt-2" onClick={consent}>I am the parent / Karta and I consent</button>
        </div>
      )}
      <Link href="/interest-groups" className="text-saffron-700 underline">See my groups</Link>
    </div>
  )
}
