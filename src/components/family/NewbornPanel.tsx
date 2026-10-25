'use client'
import { BASE_PATH } from '@/lib/api-path'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { Baby } from 'lucide-react'

/** F13 — the Karta adds a new-born (no login, no ID proof; linked to both parents). */
export default function NewbornPanel({ familyId, fathers, mothers }: {
  familyId: string; fathers: { id: string; name: string }[]; mothers: { id: string; name: string }[]
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  // No preselected parents: the first man and woman listed are often not a couple.
  const [form, setForm] = useState({ fatherId: '', motherId: '', firstName: '', gender: 'MALE', dateOfBirth: '' })
  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }))

  const save = async () => {
    const res = await fetch(`${BASE_PATH}/api/families/${familyId}/newborn`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
    const json = await res.json()
    if (!res.ok) return toast.error(json.message)
    toast.success(`${json.name} added`); setOpen(false); router.refresh()
  }

  if (!fathers.length || !mothers.length) return null
  return (
    <div className="card">
      <button type="button" onClick={() => setOpen(!open)} className="font-semibold text-gray-900 flex items-center gap-2">
        <Baby className="w-4 h-4 text-saffron-600" /> Add new-born
      </button>
      {open && (
        <div className="grid sm:grid-cols-2 gap-2 mt-3 text-sm">
          <label className="form-label">Father
            <select className="form-input" value={form.fatherId} onChange={(e) => set('fatherId', e.target.value)}>
              <option value="">Choose…</option>
              {fathers.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </label>
          <label className="form-label">Mother
            <select className="form-input" value={form.motherId} onChange={(e) => set('motherId', e.target.value)}>
              <option value="">Choose…</option>
              {mothers.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </label>
          <label className="form-label">Name (optional)
            <input className="form-input" placeholder="Leave empty for “Baby of …”" value={form.firstName} onChange={(e) => set('firstName', e.target.value)} />
          </label>
          <label className="form-label">Gender
            <select className="form-input" value={form.gender} onChange={(e) => set('gender', e.target.value)}>
              <option value="MALE">Boy</option><option value="FEMALE">Girl</option><option value="OTHER">Other</option>
            </select>
          </label>
          <label className="form-label">Birth date
            <input type="date" className="form-input" max={new Date().toISOString().slice(0, 10)} value={form.dateOfBirth} onChange={(e) => set('dateOfBirth', e.target.value)} />
          </label>
          <div className="sm:col-span-2 flex items-center justify-between">
            <p className="text-xs text-gray-500">Recorded with your consent as parent / Karta. No login or ID proof for a child.</p>
            <button type="button" className="btn-primary text-sm" disabled={!form.dateOfBirth || !form.fatherId || !form.motherId} onClick={save}>Add</button>
          </div>
        </div>
      )}
    </div>
  )
}
