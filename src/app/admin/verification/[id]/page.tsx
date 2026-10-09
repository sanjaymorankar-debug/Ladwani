'use client'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { ArrowLeft, Loader2 } from 'lucide-react'

/** F05 — one task: profile, ID proof and self-signed copy, checklist, decision (final once submitted). */
export default function VerificationTaskPage() {
  const params = useParams()
  const router = useRouter()
  const [data, setData] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)
  const [checklist, setChecklist] = useState<Record<string, boolean>>({})
  const [remarks, setRemarks] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    fetch(`/api/verification/tasks/${params.id}`).then(async (r) => {
      const j = await r.json()
      if (!r.ok) setError(j.message); else setData(j)
    })
  }, [params.id])

  const submit = async (decision: string) => {
    if (!window.confirm('A decision cannot be changed after you submit it. Continue?')) return
    setBusy(true)
    const res = await fetch(`/api/verification/tasks/${params.id}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ decision, checklist, remarks }),
    })
    const j = await res.json()
    setBusy(false)
    if (!res.ok) return toast.error(j.message)
    toast.success(j.message)
    router.push('/admin/verification')
  }

  if (error) return <p className="text-gray-500">{error}</p>
  if (!data) return <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-saffron-500" /></div>
  const { task, subject: s } = data
  const open = ['OPEN', 'ESCALATED'].includes(task.status) && !task.superseded
  const field = (label: string, value: any) => (
    <div><span className="text-gray-500">{label}</span> <span className="font-medium ml-1">{value ?? '—'}</span></div>
  )

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      <div className="flex items-center gap-3">
        <Link href="/admin/verification" className="btn-ghost p-2"><ArrowLeft className="w-4 h-4" /></Link>
        <h1 className="text-xl font-bold text-gray-900">{task.kind === 'REGISTRATION' ? 'Registration' : 'Profile change'} — {s.firstName} {s.lastName}</h1>
      </div>

      <div className="card grid sm:grid-cols-2 gap-2 text-sm">
        {field('Person ID', s.memberNumber)}
        {field('Name', [s.firstName, s.middleName, s.lastName].filter(Boolean).join(' '))}
        {field('Gender', s.gender?.toLowerCase())}
        {field('Date of birth', s.dateOfBirth ? new Date(s.dateOfBirth).toLocaleDateString() : null)}
        {field('Age', s.age)}
        {field('Marital status', s.maritalStatus?.toLowerCase())}
        {field('Mobile', s.mobile)}
        {field('Email', s.email)}
        {field('Mul Gaon', s.mulGaon ? [s.mulGaon.village, s.mulGaon.taluka, s.mulGaon.district, s.mulGaon.state].filter(Boolean).join(', ') : null)}
        {field('Social status', s.socialStatus)}
        {s.addresses.map((a: any) => (
          <div key={a.id} className="sm:col-span-2">{field(`${a.addressType.toLowerCase()} address`, [a.line1, a.line2, a.city, a.taluka, a.district, a.state, a.pincode].filter(Boolean).join(', '))}</div>
        ))}
      </div>

      {data.change && (
        <div className="card text-sm">
          <h2 className="font-semibold mb-2">Requested change</h2>
          <ul className="space-y-1">
            {Object.entries(data.change.changes as Record<string, any>).map(([k, v]) => (
              <li key={k}><span className="text-gray-500">{k}:</span> <s className="text-gray-400">{String(v.old ?? '—')}</s> → <strong>{String(v.new ?? '—')}</strong></li>
            ))}
          </ul>
        </div>
      )}

      <div className="card text-sm space-y-2">
        <h2 className="font-semibold">ID proof</h2>
        {data.idProofs.map((p: any) => (
          <div key={p.id} className="flex items-center justify-between">
            <span>{p.idType.replace('_', ' ')} · {p.masked}{p.status === 'PENDING_CHANGE' ? ' (new)' : ''}</span>
            {p.files && <span className="flex gap-3">
              <a href={p.files.proof} target="_blank" rel="noreferrer" className="text-saffron-600">Open proof</a>
              <a href={p.files.selfSigned} target="_blank" rel="noreferrer" className="text-saffron-600">Open self-signed copy</a>
            </span>}
          </div>
        ))}
        <p className="text-xs text-gray-400">Every time a proof is opened it is recorded in the audit log.</p>
      </div>

      <div className="card space-y-3">
        <h2 className="font-semibold">Verification checklist</h2>
        {data.checklistItems.map((c: any) => (
          <label key={c.key} className="flex items-center gap-2 text-sm">
            <input type="checkbox" disabled={!open} className="accent-saffron-600"
              checked={open ? !!checklist[c.key] : !!task.checklist?.[c.key]}
              onChange={(e) => setChecklist((x) => ({ ...x, [c.key]: e.target.checked }))} />
            {c.label}
          </label>
        ))}
        <textarea className="form-input" rows={3} disabled={!open} placeholder="Remarks (required to reject or send back)"
          value={open ? remarks : task.remarks ?? ''} onChange={(e) => setRemarks(e.target.value)} />
        {open ? (
          <div className="flex flex-wrap gap-2">
            <button className="btn-primary text-sm" disabled={busy} onClick={() => submit('APPROVED')}>Approve</button>
            <button className="btn-secondary text-sm" disabled={busy} onClick={() => submit('SENT_BACK')}>Send back for correction</button>
            <button className="text-sm px-4 py-2 rounded-lg border border-red-200 text-red-700 hover:bg-red-50" disabled={busy} onClick={() => submit('REJECTED')}>Reject</button>
          </div>
        ) : (
          <p className="text-sm text-gray-600">Your decision: <strong>{task.status.replace('_', ' ').toLowerCase()}</strong>{task.decidedAt ? ` on ${new Date(task.decidedAt).toLocaleString()}` : ''}. Only an Admin can reopen it.</p>
        )}
      </div>
    </div>
  )
}
