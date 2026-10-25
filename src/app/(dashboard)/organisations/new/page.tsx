'use client'
import { BASE_PATH } from '@/lib/api-path'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import AreaCascadePicker from '@/components/shared/AreaCascadePicker'
import MemberPicker from '@/components/organisations/MemberPicker'

type Pick = { id: string; name: string } | null

/**
 * F26 — create a local (taluka) organisation: name, start date, taluka and
 * town, and its management body (President, Secretary, Chairman and other
 * members — all registered members, who each accept). Two Operators verify
 * it; once active, its three office bearers sit on the District body.
 */
export default function NewOrganisationPage() {
  const router = useRouter()
  const [form, setForm] = useState({ name: '', startedOn: '', town: '', registrationNumber: '', addressLine: '', purpose: '' })
  const [taluka, setTaluka] = useState('')
  const [officers, setOfficers] = useState<Record<string, Pick>>({ president: null, secretary: null, chairman: null })
  const [bodyMembers, setBodyMembers] = useState<{ id: string; name: string }[]>([])
  const [nextMember, setNextMember] = useState<Pick>(null)
  const [file, setFile] = useState<File | null>(null)
  const [busy, setBusy] = useState(false)
  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }))

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    const fd = new FormData()
    Object.entries(form).forEach(([k, v]) => fd.append(k, v))
    fd.append('talukaAreaId', taluka)
    Object.entries(officers).forEach(([k, v]) => fd.append(`${k}MemberId`, v?.id ?? ''))
    bodyMembers.forEach((m) => fd.append('bodyMemberIds', m.id))
    if (file) fd.append('certificate', file)
    setBusy(true)
    try {
      const res = await fetch(`${BASE_PATH}/api/organisations`, { method: 'POST', body: fd })
      const json = await res.json()
      if (!res.ok) return void toast.error(json.message)
      toast.success(json.message)
      router.push(`/organisations/${json.organisationId}`)
    } finally { setBusy(false) }
  }

  return (
    <form onSubmit={submit} className="max-w-2xl mx-auto space-y-4">
      <h1 className="text-xl font-bold text-gray-900">Create a local organisation</h1>
      <div className="card space-y-3">
        <label className="form-label">Organisation name<input className="form-input" value={form.name} onChange={(e) => set('name', e.target.value)} required /></label>
        <label className="form-label">Start date<input type="date" className="form-input" value={form.startedOn} max={new Date().toISOString().slice(0, 10)} onChange={(e) => set('startedOn', e.target.value)} required /></label>
        <AreaCascadePicker onChange={setTaluka} idPrefix="orgtaluka" upTo="TALUKA" />
        <label className="form-label">City / town<input className="form-input" value={form.town} onChange={(e) => set('town', e.target.value)} required /></label>
      </div>
      <div className="card space-y-3">
        <h2 className="font-semibold text-gray-900">Current management body</h2>
        <p className="text-xs text-gray-500">Registered, active members. Each is asked to accept. The President, Secretary and Chairman also represent the organisation on the District body.</p>
        {(['president', 'secretary', 'chairman'] as const).map((k) => (
          <MemberPicker key={k} label={k[0].toUpperCase() + k.slice(1)} value={officers[k]} onPick={(m) => setOfficers((o) => ({ ...o, [k]: m }))} />
        ))}
        <div className="space-y-1">
          <p className="text-sm font-medium text-gray-700">Other body members</p>
          {bodyMembers.map((m) => (
            <div key={m.id} className="flex items-center justify-between text-sm">
              <span>{m.name}</span>
              <button type="button" className="text-xs text-red-600" onClick={() => setBodyMembers((b) => b.filter((x) => x.id !== m.id))}>Remove</button>
            </div>
          ))}
          <div className="flex items-end gap-2">
            <div className="flex-1"><MemberPicker label="Add a member" value={nextMember} onPick={setNextMember} /></div>
            <button type="button" className="btn-secondary text-sm" disabled={!nextMember}
              onClick={() => { if (nextMember && !bodyMembers.some((b) => b.id === nextMember.id)) setBodyMembers((b) => [...b, nextMember]); setNextMember(null) }}>Add</button>
          </div>
        </div>
      </div>
      <details className="card">
        <summary className="text-sm font-medium text-gray-700 cursor-pointer">Optional: registration details</summary>
        <div className="space-y-3 pt-3">
          <label className="form-label">Registration number<input className="form-input" value={form.registrationNumber} onChange={(e) => set('registrationNumber', e.target.value)} /></label>
          <label className="form-label">Address<textarea className="form-input" rows={2} value={form.addressLine} onChange={(e) => set('addressLine', e.target.value)} /></label>
          <label className="form-label">Purpose<textarea className="form-input" rows={3} value={form.purpose} onChange={(e) => set('purpose', e.target.value)} /></label>
          <label className="form-label">Registration certificate (PDF or image, up to 5 MB)
            <input type="file" accept="application/pdf,image/*" className="form-input" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          </label>
        </div>
      </details>
      <button type="submit" className="btn-primary w-full" disabled={busy || !taluka}>Submit for verification</button>
    </form>
  )
}
