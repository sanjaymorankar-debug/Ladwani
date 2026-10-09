'use client'
import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'

/** F40 — account deletion requests and consent-record search (Admin). */
export default function DataRequestsPage() {
  const [requests, setRequests] = useState<any[]>([])
  const [consents, setConsents] = useState<any[]>([])
  const [f, setF] = useState({ q: '', type: '', from: '', to: '' })
  const load = () => fetch('/api/admin/deletion-requests').then(async (r) => r.ok && setRequests((await r.json()).requests))
  const qs = () => new URLSearchParams(Object.entries(f).filter(([, v]) => v) as [string, string][]).toString()
  const search = () => fetch(`/api/admin/consents?${qs()}`).then(async (r) => r.ok && setConsents((await r.json()).consents))
  useEffect(() => { load(); search() }, []) // eslint-disable-line react-hooks/exhaustive-deps
  const act = async (id: string, action: string) => {
    const body: any = { action }
    if (action === 'reject') { body.note = window.prompt('Reason for rejecting')?.trim(); if (!body.note) return }
    else if (!window.confirm('Anonymise this person and close the login? This cannot be undone.')) return
    const res = await fetch(`/api/admin/deletion-requests/${id}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    const json = await res.json()
    res.ok ? toast.success(json.message) : toast.error(json.message)
    load()
  }
  return (
    <div className="max-w-5xl mx-auto space-y-5">
      <h1 className="text-xl font-bold text-gray-900">Data requests</h1>
      <div className="card space-y-2 text-sm">
        <h2 className="font-semibold">Account deletion</h2>
        {!requests.length && <p className="text-gray-500">No requests.</p>}
        {requests.map((r) => (
          <div key={r.id} className="flex items-center justify-between border-b border-gray-50 py-1.5">
            <span><strong>{r.person}</strong> · {new Date(r.createdAt).toLocaleDateString('en-IN')} · {r.status.toLowerCase()}{r.reason ? ` · “${r.reason}”` : ''}</span>
            {r.status === 'PENDING' && <span className="flex gap-2">
              <button className="btn-primary text-xs" onClick={() => act(r.id, 'complete')}>Anonymise</button>
              <button className="btn-secondary text-xs" onClick={() => act(r.id, 'reject')}>Reject</button>
            </span>}
          </div>
        ))}
      </div>
      <div className="card space-y-2 text-sm">
        <h2 className="font-semibold">Consent records</h2>
        <div className="grid sm:grid-cols-5 gap-2">
          <input className="form-input" placeholder="Name, email, mobile or Person ID" value={f.q} onChange={(e) => setF({ ...f, q: e.target.value })} />
          <input className="form-input" placeholder="Type (e.g. DECLARATION)" value={f.type} onChange={(e) => setF({ ...f, type: e.target.value })} />
          <input className="form-input" type="date" value={f.from} onChange={(e) => setF({ ...f, from: e.target.value })} />
          <input className="form-input" type="date" value={f.to} onChange={(e) => setF({ ...f, to: e.target.value })} />
          <span className="flex gap-2"><button className="btn-secondary text-xs" onClick={search}>Search</button><a className="btn-ghost text-xs" href={`/api/admin/consents?${qs()}&export=csv`}>CSV</a></span>
        </div>
        <div className="overflow-x-auto"><table className="w-full">
          <thead><tr className="text-left text-gray-500 border-b">{['When', 'Person', 'Person ID', 'Type', 'Granted', 'Version', 'IP'].map((h) => <th key={h} className="py-1 pr-3 font-medium">{h}</th>)}</tr></thead>
          <tbody>{consents.map((c, i) => (
            <tr key={i} className="border-b border-gray-50"><td className="py-1 pr-3">{c.when.slice(0, 16).replace('T', ' ')}</td><td className="pr-3">{c.person}</td><td className="pr-3">{c.personId}</td><td className="pr-3">{c.type}</td><td className="pr-3">{c.granted ? 'yes' : 'no'}{c.revokedAt ? ' (revoked)' : ''}</td><td className="pr-3">{c.version}</td><td>{c.ip}</td></tr>
          ))}</tbody>
        </table></div>
      </div>
    </div>
  )
}
