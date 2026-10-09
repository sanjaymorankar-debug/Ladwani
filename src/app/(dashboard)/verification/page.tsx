'use client'
import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { ShieldCheck, CheckCircle2, Circle, Upload, Loader2, FileText, AlertTriangle } from 'lucide-react'
import { useSession } from 'next-auth/react'

/**
 * F02/F03/F06 — the applicant's own page: profile completeness, ID proof and
 * self-signed copy, the declaration confirmed by OTP, and the result. It
 * shows the final status and combined reason only — never who reviewed.
 */
const STATUS_TEXT: Record<string, { title: string; tone: string; body: string }> = {
  DRAFT: { title: 'Complete your registration', tone: 'bg-amber-50 border-amber-200 text-amber-800', body: 'Fill in the required profile items, upload your ID proof, then agree to the declaration to submit.' },
  PENDING_APPROVAL: { title: 'Being verified', tone: 'bg-blue-50 border-blue-200 text-blue-800', body: 'Two community operators are checking your details independently. You will be told the result.' },
  CORRECTION_REQUIRED: { title: 'A correction is needed', tone: 'bg-orange-50 border-orange-200 text-orange-800', body: 'Update the items below, agree to the declaration again and resubmit.' },
  REJECTED: { title: 'Registration not approved', tone: 'bg-red-50 border-red-200 text-red-800', body: 'Contact the community administrator if you believe this is a mistake.' },
  ACTIVE: { title: 'Your account is verified', tone: 'bg-green-50 border-green-200 text-green-800', body: 'Changes to your name, date of birth, gender, Mul Gaon or ID proof are verified again by two operators.' },
}

export default function VerificationPage() {
  const { data: session } = useSession()
  const memberId = (session?.user as any)?.memberId as string | undefined
  const [data, setData] = useState<any>(null)
  const [busy, setBusy] = useState(false)
  const [idType, setIdType] = useState('AADHAAR')
  const [idNumber, setIdNumber] = useState('')
  const [proof, setProof] = useState<File | null>(null)
  const [signed, setSigned] = useState<File | null>(null)
  const [agree, setAgree] = useState(false)
  const [otp, setOtp] = useState('')
  const [codeSent, setCodeSent] = useState(false)

  const load = useCallback(() => fetch('/api/verification').then((r) => r.json()).then(setData), [])
  useEffect(() => { load() }, [load])

  const call = async (url: string, init: RequestInit) => {
    setBusy(true)
    try {
      const res = await fetch(url, init)
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(json.missing?.length ? `${json.message} Missing: ${json.missing.join(', ')}` : json.message ?? 'Something went wrong')
        return null
      }
      toast.success(json.message ?? 'Saved')
      await load()
      return json
    } finally { setBusy(false) }
  }

  const uploadProof = async () => {
    if (!proof || !signed) return toast.error('Choose both files')
    const form = new FormData()
    form.set('idType', idType); form.set('idNumber', idNumber); form.set('proof', proof); form.set('selfSigned', signed)
    if (await call('/api/verification/id-proof', { method: 'POST', body: form })) { setIdNumber(''); setProof(null); setSigned(null) }
  }
  const sendCode = async () => {
    if (await call('/api/verification/declaration', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'send-otp' }) })) setCodeSent(true)
  }
  const agreeAndSubmit = () =>
    call('/api/verification/declaration', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'agree', agree, otp }) })

  if (!data) return <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-saffron-500" /></div>
  const s = STATUS_TEXT[data.status] ?? STATUS_TEXT.DRAFT
  const editable = ['DRAFT', 'CORRECTION_REQUIRED'].includes(data.status)

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      <h1 className="text-xl font-bold text-gray-900 font-display flex items-center gap-2"><ShieldCheck className="w-5 h-5 text-saffron-600" /> Verification</h1>

      <div className={`rounded-xl border p-4 ${s.tone}`}>
        <p className="font-semibold">{s.title}</p>
        <p className="text-sm mt-1">{s.body}</p>
        {data.note && (data.status === 'CORRECTION_REQUIRED' || data.status === 'REJECTED') && (
          <pre className="text-sm mt-3 whitespace-pre-wrap font-sans bg-white/60 rounded-lg p-3">{data.note}</pre>
        )}
      </div>

      <div className="card space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-gray-900">Profile {data.completeness.percent}% complete</h2>
          {memberId && <Link href={`/members/${memberId}/edit`} className="text-sm text-saffron-600 font-medium">Edit profile →</Link>}
        </div>
        <div className="h-2 bg-gray-100 rounded-full overflow-hidden"><div className="h-full bg-saffron-500" style={{ width: `${data.completeness.percent}%` }} /></div>
        <ul className="grid sm:grid-cols-2 gap-1.5 text-sm">
          {data.completeness.items.map((i: any) => (
            <li key={i.key} className="flex items-center gap-2">
              {i.done ? <CheckCircle2 className="w-4 h-4 text-green-500" /> : <Circle className={`w-4 h-4 ${i.mandatory ? 'text-amber-500' : 'text-gray-300'}`} />}
              <span className={i.done ? 'text-gray-600' : 'text-gray-900'}>{i.label}{i.mandatory ? '' : ' (optional)'}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="card space-y-3">
        <h2 className="font-semibold text-gray-900 flex items-center gap-2"><FileText className="w-4 h-4" /> ID proof</h2>
        {data.idProofs.length > 0 && (
          <ul className="text-sm space-y-1">
            {data.idProofs.map((p: any) => (
              <li key={p.id} className="flex items-center justify-between">
                <span>{p.idType.replace('_', ' ')} · {p.masked}{p.status === 'PENDING_CHANGE' ? ' (new — awaiting verification)' : ''}</span>
                <span className="flex gap-3">
                  <a className="text-saffron-600" href={`/api/id-proofs/${p.id}/file?kind=proof`} target="_blank" rel="noreferrer">Proof</a>
                  <a className="text-saffron-600" href={`/api/id-proofs/${p.id}/file?kind=selfSigned`} target="_blank" rel="noreferrer">Self-signed</a>
                </span>
              </li>
            ))}
          </ul>
        )}
        {(editable || data.status === 'ACTIVE') && (
          <div className="space-y-3 border-t border-gray-100 pt-3">
            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <label className="form-label" htmlFor="idType">Type of ID</label>
                <select id="idType" className="form-input" value={idType} onChange={(e) => setIdType(e.target.value)}>
                  {data.idTypes.map((t: any) => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
              <div>
                <label className="form-label" htmlFor="idNumber">ID number</label>
                <input id="idNumber" className="form-input" value={idNumber} onChange={(e) => setIdNumber(e.target.value)}
                  placeholder={idType === 'AADHAAR' ? 'Last 4 digits are enough' : ''} autoComplete="off" />
              </div>
            </div>
            {idType === 'AADHAAR' && (
              <p className="text-xs text-gray-500 flex gap-1.5"><AlertTriangle className="w-3.5 h-3.5 text-amber-500 flex-shrink-0 mt-0.5" />
                Upload a <strong>masked Aadhaar</strong> (only the last 4 digits visible). Only the last 4 digits of the number are kept.</p>
            )}
            <div className="grid sm:grid-cols-2 gap-3 text-sm">
              <label className="form-label">ID proof (image or PDF, max 5 MB)
                <input type="file" accept="image/jpeg,image/png,image/webp,application/pdf" className="block mt-1 text-sm" onChange={(e) => setProof(e.target.files?.[0] ?? null)} />
              </label>
              <label className="form-label">Self-signed copy of the proof
                <input type="file" accept="image/jpeg,image/png,image/webp,application/pdf" className="block mt-1 text-sm" onChange={(e) => setSigned(e.target.files?.[0] ?? null)} />
              </label>
            </div>
            <button type="button" className="btn-secondary text-sm flex items-center gap-1.5" disabled={busy} onClick={uploadProof}>
              <Upload className="w-4 h-4" /> {data.status === 'ACTIVE' ? 'Send new proof for verification' : 'Save ID proof'}
            </button>
          </div>
        )}
      </div>

      {editable && (
        <div className="card space-y-3">
          <h2 className="font-semibold text-gray-900">Declaration</h2>
          <pre className="text-sm whitespace-pre-wrap font-sans bg-gray-50 rounded-lg p-3 text-gray-700">{data.declaration.text}</pre>
          <p className="text-xs text-gray-400">Version {data.declaration.version}</p>
          <label className="flex items-center gap-2 text-sm font-medium">
            <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} className="accent-saffron-600" /> I Agree
          </label>
          <div className="flex flex-col sm:flex-row gap-2">
            <button type="button" className="btn-secondary text-sm" disabled={busy || !agree} onClick={sendCode}>{codeSent ? 'Resend code' : 'Send confirmation code'}</button>
            <input className="form-input sm:w-40 tracking-widest" value={otp} inputMode="numeric" placeholder="6-digit code"
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))} />
            <button type="button" className="btn-primary text-sm" disabled={busy || !agree || otp.length !== 6} onClick={agreeAndSubmit}>
              {data.status === 'CORRECTION_REQUIRED' ? 'Agree and resubmit' : 'Agree and submit'}
            </button>
          </div>
          {data.declaration.agreed && <p className="text-xs text-gray-500">Last agreed {new Date(data.declaration.agreed.grantedAt).toLocaleString()}.</p>}
        </div>
      )}

      {data.latestChangeRequest && (
        <div className="card text-sm">
          <h2 className="font-semibold text-gray-900 mb-1">Latest change to verified details</h2>
          <p>{data.latestChangeRequest.changes.join(', ')} — <strong>{data.latestChangeRequest.status.toLowerCase()}</strong></p>
          {data.latestChangeRequest.reason && <pre className="whitespace-pre-wrap font-sans text-gray-600 mt-1">{data.latestChangeRequest.reason}</pre>}
        </div>
      )}
    </div>
  )
}
