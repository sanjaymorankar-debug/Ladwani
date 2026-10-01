'use client'
import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { Building2, Plus, Trash2, Globe } from 'lucide-react'

interface BusinessRecord {
  id: string
  businessName: string
  businessType: string | null
  industry: string | null
  city: string | null
  country: string | null
  description: string | null
  website: string | null
  establishedYear: number | null
  isActive: boolean
}

const TYPES = ['PROPRIETORSHIP', 'PARTNERSHIP', 'PRIVATE_LIMITED', 'LLP', 'FREELANCE', 'OTHER']
const EMPTY = {
  businessName: '', businessType: '', industry: '', city: '', country: 'India',
  website: '', establishedYear: '', description: '', isActive: true,
}

export default function BusinessManager({ memberId }: { memberId: string }) {
  const [records, setRecords] = useState<BusinessRecord[]>([])
  const [busy, setBusy] = useState(false)
  const [form, setForm] = useState(EMPTY)

  const load = () =>
    fetch(`/api/members/${memberId}`)
      .then((r) => r.json())
      .then((d) => setRecords(d.businesses ?? []))

  useEffect(() => { load() }, [memberId])

  const set = (k: keyof typeof EMPTY, v: string | boolean) => setForm((f) => ({ ...f, [k]: v }))

  const add = async () => {
    if (!form.businessName.trim()) return toast.error('Business name is required')
    setBusy(true)
    try {
      const res = await fetch(`/api/members/${memberId}/business`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (!res.ok) throw new Error((await res.json()).message)
      setForm(EMPTY)
      await load()
      toast.success('Business added')
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setBusy(false)
    }
  }

  const toggleActive = async (r: BusinessRecord) => {
    const res = await fetch(`/api/members/${memberId}/business/${r.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive: !r.isActive }),
    })
    if (res.ok) load()
    else toast.error((await res.json()).message)
  }

  const remove = async (id: string) => {
    await fetch(`/api/members/${memberId}/business/${id}`, { method: 'DELETE' })
    setRecords((r) => r.filter((x) => x.id !== id))
  }

  return (
    <div className="card space-y-3">
      <h3 className="font-semibold text-gray-900 border-b border-gray-100 pb-2 flex items-center gap-2">
        <Building2 className="w-4 h-4 text-saffron-600" /> Business Details
      </h3>
      {records.map((r) => (
        <div key={r.id} className="flex items-start justify-between p-2.5 bg-gray-50 rounded-lg text-sm">
          <div className="min-w-0">
            <div className="font-medium text-gray-900">
              {r.businessName}
              <span className={`ml-2 text-xs ${r.isActive ? 'badge-green' : 'badge-gray'}`}>{r.isActive ? 'Active' : 'Closed'}</span>
            </div>
            <div className="text-xs text-gray-500">
              {[r.industry, r.businessType?.replace(/_/g, ' '), [r.city, r.country].filter(Boolean).join(', '), r.establishedYear && `Est. ${r.establishedYear}`].filter(Boolean).join(' · ')}
            </div>
            {r.website && (
              <a href={r.website} target="_blank" rel="noopener noreferrer" className="text-xs text-saffron-700 inline-flex items-center gap-1">
                <Globe className="w-3 h-3" /> {r.website}
              </a>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button type="button" onClick={() => toggleActive(r)} className="text-xs text-gray-500 hover:text-gray-800">
              {r.isActive ? 'Mark closed' : 'Reopen'}
            </button>
            <button type="button" onClick={() => remove(r.id)} className="text-gray-400 hover:text-red-500">
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      ))}
      <div className="grid grid-cols-2 gap-2">
        <input value={form.businessName} onChange={(e) => set('businessName', e.target.value)}
          className="form-input text-sm col-span-2" placeholder="Business name *" />
        <select value={form.businessType} onChange={(e) => set('businessType', e.target.value)} className="form-input text-sm">
          <option value="">Type</option>
          {TYPES.map((t) => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
        </select>
        <input value={form.industry} onChange={(e) => set('industry', e.target.value)} className="form-input text-sm" placeholder="Industry" />
        <input value={form.city} onChange={(e) => set('city', e.target.value)} className="form-input text-sm" placeholder="City" />
        <input value={form.establishedYear} onChange={(e) => set('establishedYear', e.target.value)}
          type="number" className="form-input text-sm" placeholder="Established year" />
        <input value={form.website} onChange={(e) => set('website', e.target.value)} className="form-input text-sm col-span-2" placeholder="Website (https://...)" />
        <textarea value={form.description} onChange={(e) => set('description', e.target.value)}
          className="form-input text-sm col-span-2" rows={2} placeholder="What does the business do?" />
      </div>
      <button type="button" onClick={add} disabled={busy} className="btn-secondary text-sm w-full flex items-center justify-center gap-1.5 disabled:opacity-60">
        <Plus className="w-4 h-4" /> Add Business
      </button>
    </div>
  )
}
