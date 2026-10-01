'use client'
import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { Plus, Trash2 } from 'lucide-react'

interface Skill {
  id: string
  name: string
  category: string | null
  isActive: boolean
  _count: { memberSkills: number }
}

/** Master list of skills members pick from (section 20). */
export default function SkillsAdmin() {
  const [skills, setSkills] = useState<Skill[]>([])
  const [name, setName] = useState('')
  const [category, setCategory] = useState('')
  const [filter, setFilter] = useState('')

  const load = () =>
    fetch('/api/admin/skills').then((r) => r.json()).then((d) => setSkills(d.skills ?? []))
  useEffect(() => { load() }, [])

  const call = async (url: string, init: RequestInit, ok?: string) => {
    const res = await fetch(url, { headers: { 'Content-Type': 'application/json' }, ...init })
    const json = await res.json().catch(() => ({}))
    if (!res.ok) { toast.error(json.message ?? 'Failed'); return false }
    if (ok) toast.success(ok)
    await load()
    return true
  }

  const add = async () => {
    if (await call('/api/admin/skills', { method: 'POST', body: JSON.stringify({ name, category }) }, 'Skill added')) {
      setName(''); setCategory('')
    }
  }

  const shown = skills.filter((s) => s.name.toLowerCase().includes(filter.toLowerCase()))

  return (
    <div className="space-y-4">
      <div className="card grid sm:grid-cols-[1fr_1fr_auto] gap-2">
        <input value={name} onChange={(e) => setName(e.target.value)} className="form-input text-sm" placeholder="New skill name" />
        <input value={category} onChange={(e) => setCategory(e.target.value)} className="form-input text-sm" placeholder="Category (optional)" />
        <button type="button" onClick={add} className="btn-primary text-sm flex items-center gap-1.5"><Plus className="w-4 h-4" /> Add</button>
      </div>

      <input value={filter} onChange={(e) => setFilter(e.target.value)} className="form-input text-sm" placeholder="Search skills..." />

      <div className="card divide-y divide-gray-100 p-0">
        {shown.length === 0 && <p className="p-4 text-sm text-gray-500">No skills yet.</p>}
        {shown.map((s) => (
          <div key={s.id} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
            <div className="min-w-0">
              <span className={s.isActive ? 'text-gray-900' : 'text-gray-400 line-through'}>{s.name}</span>
              {s.category && <span className="ml-2 text-xs text-gray-500">{s.category}</span>}
              <span className="ml-2 text-xs text-gray-400">{s._count.memberSkills} member(s)</span>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <button type="button" className="text-xs text-gray-600 hover:text-gray-900"
                onClick={() => call(`/api/admin/skills/${s.id}`, { method: 'PATCH', body: JSON.stringify({ isActive: !s.isActive }) })}>
                {s.isActive ? 'Deactivate' : 'Activate'}
              </button>
              <button type="button" className="text-gray-400 hover:text-red-500"
                onClick={() => confirm(`Delete "${s.name}"?`) && call(`/api/admin/skills/${s.id}`, { method: 'DELETE' }, 'Deleted')}>
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
