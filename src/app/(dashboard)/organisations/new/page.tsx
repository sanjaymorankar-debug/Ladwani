'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import AreaCascadePicker from '@/components/shared/AreaCascadePicker'
import MemberPicker from '@/components/organisations/MemberPicker'

type Pick = { id: string; name: string } | null

/** F26 — register a social organisation. Two Operators verify it; the office bearers accept. */
export default function NewOrganisationPage() {
  const router = useRouter()
  const [form, setForm] = useState({ name: '', registrationNumber: '', addressLine: '', purpose: '' })
  const [district, setDistrict] = useState('')
  const [officers, setOfficers] = useState<Record<string, Pick>>({ president: null, secretary: null, treasurer: null })
  const [file, setFile] = useState<File | null>(null)
  const [busy, setBusy] = useState(false)
  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }))

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    const fd = new FormData()
    Object.entries(form).forEach(([k, v]) => fd.append(k, v))
    fd.append('districtAreaId', district)
    Object.entries(officers).forEach(([k, v]) => fd.append(`${k}MemberId`, v?.id ?? ''))
    if (file) fd.append('certificate', file)
    setBusy(true)
    try {
      const res = await fetch('/api/organisations', { method: 'POST', body: fd })
      const json = await res.json()
      if (!res.ok) return void toast.error(json.message)
      toast.success(json.message)
      router.push(`/organisations/${json.organisationId}`)
    } finally { setBusy(false) }
  }

  return (
    <form onSubmit={submit} className="max-w-2xl mx-auto space-y-4">
      <h1 className="text-xl font-bold text-gray-900">Register an organisation</h1>
      <div className="card space-y-3">
        <label className="form-label">Name<input className="form-input" value={form.name} onChange={(e) => set('name', e.target.value)} required /></label>
        <label className="form-label">Registration number<input className="form-input" value={form.registrationNumber} onChange={(e) => set('registrationNumber', e.target.value)} /></label>
        <label className="form-label">Address<textarea className="form-input" rows={2} value={form.addressLine} onChange={(e) => set('addressLine', e.target.value)} /></label>
        <AreaCascadePicker onChange={setDistrict} idPrefix="orgdistrict" upTo="DISTRICT" />
        <label className="form-label">Purpose<textarea className="form-input" rows={3} value={form.purpose} onChange={(e) => set('purpose', e.target.value)} required /></label>
        <label className="form-label">Registration certificate (PDF or image, up to 5 MB)
          <input type="file" accept="application/pdf,image/*" className="form-input" onChange={(e) => setFile(e.target.files?.[0] ?? null)} required />
        </label>
      </div>
      <div className="card space-y-3">
        <h2 className="font-semibold text-gray-900">Office bearers</h2>
        <p className="text-xs text-gray-500">Three different registered, active members. Each is asked to accept.</p>
        {(['president', 'secretary', 'treasurer'] as const).map((k) => (
          <MemberPicker key={k} label={k[0].toUpperCase() + k.slice(1)} value={officers[k]} onPick={(m) => setOfficers((o) => ({ ...o, [k]: m }))} />
        ))}
      </div>
      <button type="submit" className="btn-primary w-full" disabled={busy || !district}>Submit for verification</button>
    </form>
  )
}
