'use client'
import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'

interface List { listKey: string; options: { value: string; label: string }[]; customised: boolean }

const pretty = (k: string) => k.charAt(0) + k.slice(1).toLowerCase().replace(/_/g, ' ')

export default function OptionsAdmin() {
  const [lists, setLists] = useState<List[]>([])
  const [open, setOpen] = useState<string | null>(null)
  const [draft, setDraft] = useState<{ value: string; label: string }[]>([])
  const load = () => fetch('/api/admin/options').then((r) => r.json()).then((d) => setLists(d.lists ?? []))
  useEffect(() => { load() }, [])

  const edit = (l: List) => { setOpen(l.listKey); setDraft(l.options.map((o) => ({ ...o }))) }
  const save = async (body: Record<string, unknown>) => {
    const res = await fetch('/api/admin/options', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ listKey: open, ...body }) })
    toast[res.ok ? 'success' : 'error']((await res.json()).message)
    if (res.ok) { setOpen(null); load() }
  }

  return (
    <div className="card divide-y divide-gray-50">
      {lists.map((l) => (
        <div key={l.listKey} className="py-2">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium">{pretty(l.listKey)} {l.customised && <span className="badge-blue text-xs ml-1">edited</span>}</span>
            <button className="text-saffron-700 text-sm" onClick={() => (open === l.listKey ? setOpen(null) : edit(l))}>{open === l.listKey ? 'Close' : 'Edit'}</button>
          </div>
          {open !== l.listKey && <p className="text-xs text-gray-500 truncate">{l.options.map((o) => o.label).join(' · ')}</p>}
          {open === l.listKey && (
            <div className="space-y-2 mt-2">
              {draft.map((o, i) => (
                <div key={i} className="flex gap-2">
                  <input className="form-input text-sm w-40" value={o.value} placeholder="CODE" aria-label="Code" onChange={(e) => setDraft(draft.map((x, j) => (j === i ? { ...x, value: e.target.value } : x)))} />
                  <input className="form-input text-sm" value={o.label} placeholder="Label" aria-label="Label" onChange={(e) => setDraft(draft.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))} />
                  <button className="text-red-600 text-sm" onClick={() => setDraft(draft.filter((_, j) => j !== i))} aria-label="Remove option">×</button>
                </div>
              ))}
              <div className="flex gap-2">
                <button className="btn-secondary text-sm" onClick={() => setDraft([...draft, { value: '', label: '' }])}>+ Option</button>
                <button className="btn-primary text-sm" onClick={() => save({ options: draft })}>Save</button>
                {l.customised && <button className="btn-ghost text-sm" onClick={() => save({ reset: true })}>Reset to defaults</button>}
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
