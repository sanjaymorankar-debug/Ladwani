'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import toast from 'react-hot-toast'

const OFFICE_LABEL: Record<string, string> = { PRESIDENT: 'President', SECRETARY: 'Secretary', CHAIRMAN: 'Chairman' }
const STATUS_LABEL: Record<string, string> = { READY: 'Ready', NEEDS_TALUKA: 'Needs a taluka', NO_MEMBERS: 'No registered members', CONVERTED: 'Copied' }

/** P4 follow-up — copy community groups into local organisations (Admin). */
export default function GroupConversionPage() {
  const [data, setData] = useState<{ groups: any[]; notActive: number } | null>(null)
  const [busy, setBusy] = useState(false)
  const load = () => fetch('/api/admin/group-conversion').then(async (r) => (r.ok ? setData(await r.json()) : toast.error((await r.json()).message)))
  useEffect(() => { load() }, [])
  const run = async (action: 'apply' | 'undo') => {
    const ask = action === 'apply'
      ? 'Copy every ready group into a local organisation? The groups stay as they are. Members are invited and two Operators verify each one.'
      : 'Remove the copies that are not active yet (with their invitations and verification tasks)? Active ones are kept.'
    if (!window.confirm(ask)) return
    setBusy(true)
    const res = await fetch('/api/admin/group-conversion', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action }) })
    const json = await res.json()
    res.ok ? toast.success(json.message) : toast.error(json.message)
    setBusy(false)
    load()
  }
  const ready = data?.groups.filter((g) => g.status === 'READY').length ?? 0
  const copied = data?.groups.filter((g) => g.status === 'CONVERTED').length ?? 0
  return (
    <div className="max-w-5xl mx-auto space-y-5">
      <h1 className="text-xl font-bold text-gray-900">Convert community groups to organisations</h1>
      <div className="card text-sm text-gray-600 space-y-1">
        <p>Each active group is copied into a local organisation at its taluka. The group itself is not changed.</p>
        <p>Convener → President, Secretary → Secretary, Treasurer → Chairman, others → Member. A missing post stays vacant; you (or the organisation&apos;s President / Secretary) fill it later by hand-over.</p>
        <p>The start date is the date the group was created. Only registered members are carried over; they are invited and accept, and two Operators verify each organisation as usual.</p>
      </div>
      {!data && <p className="text-sm text-gray-500">Loading…</p>}
      {data && (
        <>
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <span><strong>{ready}</strong> ready · <strong>{copied}</strong> copied · <strong>{data.groups.length - ready - copied}</strong> need attention · {data.notActive} not active (not copied)</span>
            <button className="btn-primary text-sm disabled:opacity-60" disabled={busy || !ready} onClick={() => run('apply')}>Copy {ready} ready group(s)</button>
            <button className="btn-secondary text-sm disabled:opacity-60" disabled={busy || !copied} onClick={() => run('undo')}>Undo copies not yet active</button>
          </div>
          {!data.groups.length && <p className="text-sm text-gray-500">No active community groups.</p>}
          {data.groups.map((g) => (
            <div key={g.groupId} className="card text-sm space-y-1">
              <div className="flex items-center justify-between gap-3">
                <strong className="text-gray-900">{g.name}</strong>
                <span className={`badge ${g.status === 'READY' ? 'bg-green-50 text-green-700' : g.status === 'CONVERTED' ? 'bg-blue-50 text-blue-700' : 'bg-amber-50 text-amber-700'}`}>{STATUS_LABEL[g.status]}</span>
              </div>
              {g.reason && <p className="text-amber-700">{g.reason}</p>}
              {g.taluka && <p className="text-gray-600">Taluka: {g.taluka} · Town: {g.town} · Start date: {g.startedOn}</p>}
              <p className="text-gray-600">
                {Object.entries(g.offices).map(([o, p]: [string, any]) => `${OFFICE_LABEL[o]}: ${p ? p.name : 'vacant'}`).join(' · ')}
                {g.members.length ? ` · ${g.members.length} member(s)` : ''}
              </p>
              {g.skipped.length > 0 && <p className="text-gray-500">Not carried over: {g.skipped.map((s: any) => `${s.name} (${s.reason.toLowerCase()})`).join(', ')}</p>}
              {g.organisationId && <Link href={`/organisations/${g.organisationId}`} className="text-saffron-600 hover:underline">Open the organisation</Link>}
            </div>
          ))}
        </>
      )}
    </div>
  )
}
