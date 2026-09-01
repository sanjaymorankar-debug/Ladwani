'use client'
import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { Briefcase, Plus, Trash2 } from 'lucide-react'

interface EmploymentRecord {
  id: string
  employmentType: string | null
  employerName: string | null
  designation: string | null
  isCurrent: boolean
}

const TYPES = ['JOB', 'BUSINESS', 'PROFESSION', 'AGRICULTURE', 'OTHER']

export default function EmploymentManager({ memberId }: { memberId: string }) {
  const [records, setRecords] = useState<EmploymentRecord[]>([])
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState({ employmentType: '', employerName: '', designation: '', isCurrent: true })

  const load = () =>
    fetch(`/api/members/${memberId}`)
      .then((r) => r.json())
      .then((d) => setRecords(d.employment ?? []))

  useEffect(() => { load() }, [memberId])

  const add = async () => {
    setAdding(true)
    try {
      const res = await fetch(`/api/members/${memberId}/employment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (!res.ok) throw new Error((await res.json()).message)
      setForm({ employmentType: '', employerName: '', designation: '', isCurrent: true })
      await load()
      toast.success('Employment record added')
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setAdding(false)
    }
  }

  const remove = async (id: string) => {
    await fetch(`/api/members/${memberId}/employment/${id}`, { method: 'DELETE' })
    setRecords((r) => r.filter((x) => x.id !== id))
  }

  return (
    <div className="card space-y-3">
      <h3 className="font-semibold text-gray-900 border-b border-gray-100 pb-2 flex items-center gap-2">
        <Briefcase className="w-4 h-4 text-saffron-600" /> Employment / Business
      </h3>
      {records.map((r) => (
        <div key={r.id} className="flex items-center justify-between p-2.5 bg-gray-50 rounded-lg text-sm">
          <div>
            <span className="font-medium text-gray-900">{r.designation || r.employmentType}</span>
            {r.employerName && <span className="text-gray-500"> — {r.employerName}</span>}
            {r.isCurrent && <span className="badge-green text-xs ml-2">Current</span>}
          </div>
          <button onClick={() => remove(r.id)} className="text-gray-400 hover:text-red-500">
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      ))}
      <div className="grid grid-cols-2 gap-2">
        <select value={form.employmentType} onChange={(e) => setForm({ ...form, employmentType: e.target.value })} className="form-input text-sm">
          <option value="">Type</option>
          {TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <input value={form.designation} onChange={(e) => setForm({ ...form, designation: e.target.value })}
          className="form-input text-sm" placeholder="Designation" />
        <input value={form.employerName} onChange={(e) => setForm({ ...form, employerName: e.target.value })}
          className="form-input text-sm col-span-2" placeholder="Employer / company name" />
      </div>
      <button type="button" onClick={add} disabled={adding} className="btn-secondary text-sm w-full flex items-center justify-center gap-1.5 disabled:opacity-60">
        <Plus className="w-4 h-4" /> Add Employment Record
      </button>
    </div>
  )
}
