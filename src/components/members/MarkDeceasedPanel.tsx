'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { Flower2 } from 'lucide-react'

/** Records a death (§28). Goes to review unless staff do it; see /api/members/[id]/deceased. */
export default function MarkDeceasedPanel({ memberId, memberName }: { memberId: string; memberName: string }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [form, setForm] = useState({ deceasedAt: '', deceasedPlace: '', deceasedNotes: '' })

  const submit = async () => {
    if (!form.deceasedAt) return toast.error('Date of death is required')
    if (!confirm(`Record that ${memberName} has passed away? This deactivates any login and cannot be easily undone.`)) return
    setBusy(true)
    try {
      const res = await fetch(`/api/members/${memberId}/deceased`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.message)
      toast.success(json.message)
      setOpen(false)
      router.refresh()
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="card">
      <button type="button" onClick={() => setOpen(!open)} className="text-sm text-gray-600 hover:text-gray-900 flex items-center gap-2">
        <Flower2 className="w-4 h-4" /> Mark as deceased
      </button>
      {open && (
        <div className="mt-3 grid sm:grid-cols-2 gap-2">
          <input type="date" max={new Date().toISOString().split('T')[0]} value={form.deceasedAt}
            onChange={(e) => setForm({ ...form, deceasedAt: e.target.value })} className="form-input text-sm" />
          <input value={form.deceasedPlace} onChange={(e) => setForm({ ...form, deceasedPlace: e.target.value })}
            className="form-input text-sm" placeholder="Place (optional)" />
          <textarea value={form.deceasedNotes} onChange={(e) => setForm({ ...form, deceasedNotes: e.target.value })}
            className="form-input text-sm sm:col-span-2" rows={2} placeholder="Notes (optional)" />
          <button type="button" onClick={submit} disabled={busy} className="btn-primary text-sm sm:col-span-2 disabled:opacity-60">
            Submit
          </button>
        </div>
      )}
    </div>
  )
}
