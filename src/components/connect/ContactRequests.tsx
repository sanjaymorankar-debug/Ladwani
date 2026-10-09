'use client'
import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { Phone } from 'lucide-react'
import { BASE_PATH } from '@/lib/api-path'

/** Incoming and outgoing "request contact" items. A phone number appears only after the other person accepts. */
export default function ContactRequests() {
  const [data, setData] = useState<{ incoming: any[]; outgoing: any[] } | null>(null)
  const load = () => fetch(`${BASE_PATH}/api/contact-requests`).then((r) => r.json()).then(setData)
  useEffect(() => { load() }, [])
  if (!data || (!data.incoming.length && !data.outgoing.length)) return null

  const answer = async (id: string, action: 'accept' | 'decline') => {
    const res = await fetch(`${BASE_PATH}/api/contact-requests/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action }) })
    toast[res.ok ? 'success' : 'error']((await res.json()).message)
    load()
  }
  return (
    <div className="card space-y-3 text-sm">
      <h3 className="font-semibold text-gray-900 flex items-center gap-2"><Phone className="w-4 h-4" /> Contact requests</h3>
      {data.incoming.filter((r) => r.status === 'PENDING').map((r) => (
        <div key={r.id} className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-50 pb-2">
          <span>
            <strong>{r.from.name}</strong>{r.from.city ? ` (${r.from.city})` : ''} {r.purpose === 'BLOOD_DONOR' ? 'needs blood' : 'would like to connect'}
            {r.message ? ` — “${r.message}”` : ''}
          </span>
          <span className="flex gap-2">
            <button className="btn-primary text-xs" onClick={() => answer(r.id, 'accept')}>Share my number</button>
            <button className="btn-secondary text-xs" onClick={() => answer(r.id, 'decline')}>Decline</button>
          </span>
        </div>
      ))}
      {data.outgoing.slice(0, 10).map((r) => (
        <div key={r.id} className="flex justify-between text-gray-600">
          <span>You asked {r.to.name}</span>
          <span>{r.status === 'ACCEPTED' ? <a className="text-green-700 font-medium" href={`tel:${r.to.phone}`}>{r.to.phone ?? 'Accepted'}</a> : r.status.toLowerCase()}</span>
        </div>
      ))}
    </div>
  )
}
