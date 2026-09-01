'use client'
import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { Sparkles, Plus, X } from 'lucide-react'

interface MemberSkill {
  skillId: string
  skill: { id: string; name: string }
}

export default function SkillsManager({ memberId }: { memberId: string }) {
  const [skills, setSkills] = useState<MemberSkill[]>([])
  const [name, setName] = useState('')
  const [adding, setAdding] = useState(false)

  const load = () =>
    fetch(`/api/members/${memberId}`)
      .then((r) => r.json())
      .then((d) => setSkills(d.skills ?? []))

  useEffect(() => { load() }, [memberId])

  const add = async () => {
    if (!name.trim()) return
    setAdding(true)
    try {
      const res = await fetch(`/api/members/${memberId}/skills`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      })
      if (!res.ok) throw new Error((await res.json()).message)
      setName('')
      await load()
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setAdding(false)
    }
  }

  const remove = async (skillId: string) => {
    await fetch(`/api/members/${memberId}/skills?skillId=${skillId}`, { method: 'DELETE' })
    setSkills((s) => s.filter((x) => x.skillId !== skillId))
  }

  return (
    <div className="card space-y-3">
      <h3 className="font-semibold text-gray-900 border-b border-gray-100 pb-2 flex items-center gap-2">
        <Sparkles className="w-4 h-4 text-saffron-600" /> Skills
      </h3>
      <div className="flex flex-wrap gap-2">
        {skills.map((s) => (
          <span key={s.skillId} className="badge bg-amber-50 text-amber-700 text-xs flex items-center gap-1">
            {s.skill.name}
            <button onClick={() => remove(s.skillId)}><X className="w-3 h-3" /></button>
          </span>
        ))}
      </div>
      <div className="flex gap-2">
        <input value={name} onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), add())}
          className="form-input text-sm flex-1" placeholder="e.g. Cooking, Public Speaking, Tailoring" />
        <button type="button" onClick={add} disabled={adding} className="btn-secondary px-3 disabled:opacity-60">
          <Plus className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}
