'use client'
import { useState } from 'react'
import toast from 'react-hot-toast'
import type { FieldDef } from '@/lib/additional-details/sections'
import type { OptionLists } from '@/lib/additional-details/options'
import { BASE_PATH } from '@/lib/api-path'

export interface PickerData {
  lists: OptionLists
  interests: Record<string, { id: string; name: string }[]>
  sports: Record<string, { id: string; name: string }[]>
  familyMembers: { id: string; name: string }[]
  districts: { id: string; name: string }[]
  memberId: string
}

/** One input for one field definition (shared by single-row fields, rows and child rows). */
export default function FieldInput({
  field, value, onChange, data, idPrefix, rowLabel,
}: {
  field: FieldDef
  value: unknown
  onChange: (v: unknown) => void
  data: PickerData
  idPrefix: string
  rowLabel?: string
}) {
  const id = `${idPrefix}-${field.key}`
  const list = field.list ? data.lists[field.list] ?? [] : []
  const str = value === null || value === undefined ? '' : String(value)
  const label = (
    <label htmlFor={id} className="form-label">
      {field.label}
      {field.help && <span className="block text-xs font-normal text-gray-500">{field.help}</span>}
    </label>
  )

  switch (field.type) {
    case 'textarea':
      return <div className="sm:col-span-2">{label}<textarea id={id} rows={2} maxLength={field.max ?? 1000} className="form-input" value={str} onChange={(e) => onChange(e.target.value)} /></div>
    case 'select':
    case 'monthNum':
      return (
        <div>{label}
          <select id={id} className="form-input" value={str} onChange={(e) => onChange(e.target.value || null)}>
            <option value="">Select…</option>
            {list.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
      )
    case 'multi': {
      const selected = Array.isArray(value) ? (value as string[]) : []
      const toggle = (v: string) => onChange(selected.includes(v) ? selected.filter((x) => x !== v) : [...selected, v])
      return (
        <fieldset className="sm:col-span-2">
          <legend className="form-label">{field.label}</legend>
          <div className="flex flex-wrap gap-2">
            {list.map((o) => (
              <label key={o.value} className={`cursor-pointer rounded-full border px-3 py-1 text-sm ${selected.includes(o.value) ? 'border-saffron-500 bg-saffron-50 text-saffron-800' : 'border-gray-300 text-gray-700'}`}>
                <input type="checkbox" className="sr-only" checked={selected.includes(o.value)} onChange={() => toggle(o.value)} />
                {o.label}
              </label>
            ))}
          </div>
        </fieldset>
      )
    }
    case 'bool':
      return (
        <fieldset>
          <legend className="form-label">{field.label}</legend>
          {field.help && <p className="text-xs text-gray-500 -mt-1 mb-1">{field.help}</p>}
          <div className="flex gap-2">
            {[{ v: true, l: 'Yes' }, { v: false, l: 'No' }].map((o) => (
              <label key={o.l} className={`cursor-pointer rounded-lg border px-4 py-1.5 text-sm ${value === o.v ? 'border-saffron-500 bg-saffron-50 text-saffron-800 font-medium' : 'border-gray-300 text-gray-700'}`}>
                <input type="radio" name={id} className="sr-only" checked={value === o.v} onChange={() => onChange(o.v)} />
                {o.l}
              </label>
            ))}
          </div>
        </fieldset>
      )
    case 'month':
      return <div>{label}<input id={id} type="month" className="form-input" value={str} onChange={(e) => onChange(e.target.value || null)} /></div>
    case 'year':
      return <div>{label}<input id={id} type="number" inputMode="numeric" min={1940} max={new Date().getFullYear() + 1} className="form-input" value={str} onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)} /></div>
    case 'number':
      return <div>{label}<input id={id} type="number" step="0.01" min={0} className="form-input" value={str} onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)} /></div>
    case 'tags':
      return <TagsInput id={id} label={label} value={Array.isArray(value) ? (value as string[]) : []} onChange={onChange} />
    case 'interest':
      return <InterestPicker id={id} label={label} field={field} value={str} onChange={onChange} data={data} />
    case 'familyMember':
      return (
        <div>{label}
          <select id={id} className="form-input" value={str} onChange={(e) => onChange(e.target.value || null)}>
            <option value="">Select a family member…</option>
            {data.familyMembers.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
        </div>
      )
    case 'district':
      return (
        <div>{label}
          <select id={id} className="form-input" value={str} onChange={(e) => onChange(e.target.value || null)}>
            <option value="">Select district…</option>
            {data.districts.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </div>
      )
    case 'file':
      return <FileInput id={id} label={label} field={field} value={str} onChange={onChange} memberId={data.memberId} rowLabel={rowLabel} />
    default:
      return <div>{label}<input id={id} className="form-input" maxLength={field.max ?? 191} value={str} onChange={(e) => onChange(e.target.value)} /></div>
  }
}

function TagsInput({ id, label, value, onChange }: { id: string; label: React.ReactNode; value: string[]; onChange: (v: unknown) => void }) {
  const [draft, setDraft] = useState('')
  const add = () => {
    const parts = draft.split(',').map((t) => t.trim()).filter(Boolean)
    if (parts.length) onChange(Array.from(new Set([...value, ...parts])))
    setDraft('')
  }
  return (
    <div className="sm:col-span-2">{label}
      <div className="flex flex-wrap gap-1.5 mb-1.5">
        {value.map((t) => (
          <span key={t} className="badge bg-amber-50 text-amber-800">
            {t}
            <button type="button" aria-label={`Remove ${t}`} className="ml-1 text-amber-600" onClick={() => onChange(value.filter((x) => x !== t))}>×</button>
          </span>
        ))}
      </div>
      <div className="flex gap-2">
        <input id={id} className="form-input" placeholder="Type and press Add (comma-separated is fine)" value={draft}
          onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add() } }} />
        <button type="button" className="btn-secondary text-sm" onClick={add}>Add</button>
      </div>
    </div>
  )
}

function InterestPicker({ id, label, field, value, onChange, data }: {
  id: string; label: React.ReactNode; field: FieldDef; value: string; onChange: (v: unknown) => void; data: PickerData
}) {
  const groups = field.sportsOnly ? data.sports : data.interests
  const isNew = value.startsWith('NEW:')
  const known = Object.values(groups).flat().some((i) => i.id === value)
  return (
    <div>{label}
      <select id={id} className="form-input" value={isNew ? '__OTHER' : value}
        onChange={(e) => onChange(e.target.value === '__OTHER' ? 'NEW:' : e.target.value || null)}>
        <option value="">Select…</option>
        {Object.entries(groups).map(([cat, items]) => (
          <optgroup key={cat} label={cat}>
            {items.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
          </optgroup>
        ))}
        {!known && value && !isNew && <option value={value}>Waiting for Admin approval</option>}
        {!field.sportsOnly && <option value="__OTHER">Other (type it — Admin will review)</option>}
      </select>
      {isNew && (
        <input className="form-input mt-1.5" placeholder="Name of the hobby" maxLength={60} value={value.slice(4)}
          onChange={(e) => onChange(`NEW:${e.target.value}`)} aria-label="Other hobby name" />
      )}
    </div>
  )
}

function FileInput({ id, label, field, value, onChange, memberId, rowLabel }: {
  id: string; label: React.ReactNode; field: FieldDef; value: string; onChange: (v: unknown) => void; memberId: string; rowLabel?: string
}) {
  const [busy, setBusy] = useState(false)
  const upload = async (file: File) => {
    if (file.size > 5 * 1024 * 1024) return toast.error('File is too large (maximum 5 MB)')
    setBusy(true)
    try {
      const fd = new FormData()
      fd.set('file', file)
      fd.set('purpose', field.filePurpose ?? 'MARKSHEET')
      const res = await fetch(`${BASE_PATH}/api/members/${memberId}/additional-details/files`, { method: 'POST', body: fd })
      const body = await res.json()
      if (!res.ok) throw new Error(body.message)
      onChange(body.fileId)
      toast.success('Uploaded — remember to save this step')
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className="sm:col-span-2">{label}
      {value ? (
        <div className="flex items-center gap-3 text-sm">
          <a href={`${BASE_PATH}/api/member-files/${value}`} target="_blank" rel="noreferrer" className="text-saffron-700 underline">View uploaded file</a>
          <button type="button" className="text-red-600" onClick={() => onChange(null)}>Remove</button>
        </div>
      ) : (
        <input id={id} type="file" accept="application/pdf,image/jpeg,image/png" disabled={busy}
          aria-label={`${field.label}${rowLabel ? ` for ${rowLabel}` : ''}`}
          onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} className="text-sm" />
      )}
    </div>
  )
}
