'use client'
import { BASE_PATH } from '@/lib/api-path'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { Flower2 } from 'lucide-react'

/** Records a death (§28). Goes to review unless staff do it; see /api/members/[id]/deceased. */
export default function MarkDeceasedPanel({ memberId, memberName }: { memberId: string; memberName: string }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [form, setForm] = useState({ deceasedAt: '', deceasedPlace: '', deceasedNotes: '' })
  const [certificate, setCertificate] = useState<File | null>(null)
  const [certRequired, setCertRequired] = useState(false)

  useEffect(() => {
    if (!open) return
    fetch(`${BASE_PATH}/api/members/${memberId}/deceased`).then((r) => r.json()).then((j) => setCertRequired(!!j.certificateRequired)).catch(() => {})
  }, [open, memberId])

  const submit = async () => {
    if (!form.deceasedAt) return toast.error('Date of death is required')
    if (certRequired && !certificate) return toast.error('Attach the death certificate')
    if (!confirm(`Record that ${memberName} has passed away? This deactivates any login and cannot be easily undone.`)) return
    setBusy(true)
    try {
      const fd = new FormData()
      Object.entries(form).forEach(([k, v]) => fd.append(k, v))
      if (certificate) fd.append('certificate', certificate)
      const res = await fetch(`${BASE_PATH}/api/members/${memberId}/deceased`, { method: 'POST', body: fd })
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
          <label className="text-sm text-gray-600 sm:col-span-2">
            Death certificate {certRequired ? '(required)' : '(optional)'} — JPG, PNG, WebP or PDF, up to 5 MB
            <input type="file" accept="image/jpeg,image/png,image/webp,application/pdf"
              onChange={(e) => setCertificate(e.target.files?.[0] ?? null)} className="block mt-1 text-sm" />
          </label>
          <button type="button" onClick={submit} disabled={busy} className="btn-primary text-sm sm:col-span-2 disabled:opacity-60">
            Submit
          </button>
        </div>
      )}
    </div>
  )
}
