'use client'
import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { GraduationCap, Plus, Trash2 } from 'lucide-react'

interface EducationRecord {
  id: string
  level: string | null
  qualification: string | null
  institution: string | null
  yearCompleted: number | null
  isHighest: boolean
}

const LEVELS = ['SCHOOL', 'DIPLOMA', 'ITI', 'UG', 'PG', 'DOCTORATE', 'PROFESSIONAL', 'OTHER']

export default function EducationManager({ memberId }: { memberId: string }) {
  const [records, setRecords] = useState<EducationRecord[]>([])
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState({ level: '', qualification: '', institution: '', yearCompleted: '' })

  const load = () =>
    fetch(`/api/members/${memberId}`)
      .then((r) => r.json())
      .then((d) => setRecords(d.education ?? []))

  useEffect(() => { load() }, [memberId])

  const add = async () => {
    if (!form.qualification && !form.level) {
      toast.error('Enter a qualification or level')
      return
    }
    setAdding(true)
    try {
      const res = await fetch(`/api/members/${memberId}/education`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, isHighest: records.length === 0 }),
      })
      if (!res.ok) throw new Error((await res.json()).message)
      setForm({ level: '', qualification: '', institution: '', yearCompleted: '' })
      await load()
      toast.success('Education record added')
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setAdding(false)
    }
  }

  const remove = async (id: string) => {
    await fetch(`/api/members/${memberId}/education/${id}`, { method: 'DELETE' })
    setRecords((r) => r.filter((x) => x.id !== id))
  }

  return (
    <div className="card space-y-3">
      <h3 className="font-semibold text-gray-900 border-b border-gray-100 pb-2 flex items-center gap-2">
        <GraduationCap className="w-4 h-4 text-saffron-600" /> Education
      </h3>
      {records.map((r) => (
        <div key={r.id} className="flex items-center justify-between p-2.5 bg-gray-50 rounded-lg text-sm">
          <div>
            <span className="font-medium text-gray-900">{r.qualification || r.level}</span>
            {r.institution && <span className="text-gray-500"> — {r.institution}</span>}
            {r.yearCompleted && <span className="text-gray-400"> ({r.yearCompleted})</span>}
            {r.isHighest && <span className="badge-orange text-xs ml-2">Highest</span>}
          </div>
          <button onClick={() => remove(r.id)} className="text-gray-400 hover:text-red-500">
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      ))}
      <div className="grid grid-cols-2 gap-2">
        <select value={form.level} onChange={(e) => setForm({ ...form, level: e.target.value })} className="form-input text-sm">
          <option value="">Level</option>
          {LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}
        </select>
        <input value={form.qualification} onChange={(e) => setForm({ ...form, qualification: e.target.value })}
          className="form-input text-sm" placeholder="Qualification (e.g. B.E. Computer Engineering)" />
        <input value={form.institution} onChange={(e) => setForm({ ...form, institution: e.target.value })}
          className="form-input text-sm" placeholder="Institution" />
        <input value={form.yearCompleted} onChange={(e) => setForm({ ...form, yearCompleted: e.target.value })}
          type="number" className="form-input text-sm" placeholder="Year completed" />
      </div>
      <button type="button" onClick={add} disabled={adding} className="btn-secondary text-sm w-full flex items-center justify-center gap-1.5 disabled:opacity-60">
        <Plus className="w-4 h-4" /> Add Education Record
      </button>
    </div>
  )
}
