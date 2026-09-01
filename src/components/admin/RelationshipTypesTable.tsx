'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { Plus, X } from 'lucide-react'

interface RelationshipType {
  id: string
  code: string
  label: string
  inverseCode: string | null
  genderApplicable: string | null
  isSpouse: boolean
  isActive: boolean
}

export default function RelationshipTypesTable({ initialTypes }: { initialTypes: RelationshipType[] }) {
  const router = useRouter()
  const [types, setTypes] = useState(initialTypes)
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState({ code: '', label: '', inverseCode: '', genderApplicable: '', isSpouse: false })
  const [busy, setBusy] = useState(false)

  const submit = async () => {
    if (!form.code.trim() || !form.label.trim()) {
      toast.error('Code and label are required')
      return
    }
    setBusy(true)
    try {
      const res = await fetch('/api/relationship-types', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          inverseCode: form.inverseCode || null,
          genderApplicable: form.genderApplicable || null,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.message)
      toast.success('Relationship type added')
      setAdding(false)
      setForm({ code: '', label: '', inverseCode: '', genderApplicable: '', isSpouse: false })
      router.refresh()
      setTypes((t) => [...t, json.type])
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setBusy(false)
    }
  }

  const toggleActive = async (id: string, isActive: boolean) => {
    setTypes((t) => t.map((rt) => (rt.id === id ? { ...rt, isActive } : rt)))
    await fetch(`/api/relationship-types/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive }),
    })
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button onClick={() => setAdding((a) => !a)} className="btn-primary text-sm flex items-center gap-1.5">
          {adding ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />} {adding ? 'Cancel' : 'Add Type'}
        </button>
      </div>

      {adding && (
        <div className="card grid sm:grid-cols-2 gap-3">
          <input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} className="form-input text-sm" placeholder="code (e.g. uncle)" />
          <input value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} className="form-input text-sm" placeholder="Label (e.g. Uncle)" />
          <input value={form.inverseCode} onChange={(e) => setForm({ ...form, inverseCode: e.target.value })} className="form-input text-sm" placeholder="Inverse code (optional)" />
          <select value={form.genderApplicable} onChange={(e) => setForm({ ...form, genderApplicable: e.target.value })} className="form-input text-sm">
            <option value="">Any gender</option>
            <option value="MALE">Male</option>
            <option value="FEMALE">Female</option>
          </select>
          <label className="flex items-center gap-2 text-sm text-gray-600">
            <input type="checkbox" checked={form.isSpouse} onChange={(e) => setForm({ ...form, isSpouse: e.target.checked })} />
            This is a spouse relationship
          </label>
          <button onClick={submit} disabled={busy} className="btn-primary text-sm disabled:opacity-60">
            {busy ? 'Saving...' : 'Save Type'}
          </button>
        </div>
      )}

      <div className="card p-0 overflow-hidden overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              <th className="px-4 py-3 text-left font-semibold text-gray-700">Code</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-700">Label</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-700">Inverse</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-700">Gender</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-700">Spouse?</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-700">Active</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {types.map((rt) => (
              <tr key={rt.id} className="hover:bg-gray-50/50 transition-colors">
                <td className="px-4 py-3 font-mono text-xs text-gray-600">{rt.code}</td>
                <td className="px-4 py-3 font-medium text-gray-900">{rt.label}</td>
                <td className="px-4 py-3 text-gray-500 font-mono text-xs">{rt.inverseCode ?? '—'}</td>
                <td className="px-4 py-3">
                  <span className={`badge text-xs ${
                    rt.genderApplicable === 'MALE' ? 'badge-blue' :
                    rt.genderApplicable === 'FEMALE' ? 'badge bg-pink-100 text-pink-700' :
                    'badge-gray'
                  }`}>{rt.genderApplicable ?? 'ANY'}</span>
                </td>
                <td className="px-4 py-3">
                  {rt.isSpouse ? <span className="badge bg-pink-100 text-pink-700 text-xs">Yes</span> : <span className="text-gray-400 text-xs">No</span>}
                </td>
                <td className="px-4 py-3">
                  <button onClick={() => toggleActive(rt.id, !rt.isActive)}>
                    <span className={`w-2 h-2 rounded-full inline-block ${rt.isActive ? 'bg-green-500' : 'bg-gray-300'}`} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
