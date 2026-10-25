'use client'
import { BASE_PATH } from '@/lib/api-path'
import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'

const name = (m: any) => [m?.firstName, m?.lastName].filter(Boolean).join(' ')

function Contact({ c }: { c: any }) {
  if (!c) return null
  return (
    <div className="text-xs text-green-800 bg-green-50 rounded p-2 mt-1">
      {c.person && <p>{c.person.name}: {[c.person.mobile, c.person.email].filter(Boolean).join(' · ') || '—'}</p>}
      {c.karta && <p>Karta {c.karta.name}: {[c.karta.mobile, c.karta.email].filter(Boolean).join(' · ') || '—'}</p>}
    </div>
  )
}

/** F38 interests — received (accept / decline, also as Karta), sent (withdraw); contact shown once accepted. */
export default function InterestsPanel() {
  const [data, setData] = useState<{ sent: any[]; received: any[] } | null>(null)
  const load = () => fetch(`${BASE_PATH}/api/matrimony/interests`).then((r) => r.json()).then(setData)
  useEffect(() => { load() }, [])
  const act = async (id: string, action: string) => {
    const res = await fetch(`${BASE_PATH}/api/matrimony/interests/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action }) })
    const json = await res.json()
    if (!res.ok) return toast.error(json.message)
    toast.success(action === 'accept' ? 'Accepted — contact details are shared' : 'Done'); load()
  }
  if (!data || (!data.sent.length && !data.received.length)) return null
  return (
    <div className="card grid sm:grid-cols-2 gap-4 text-sm">
      <div>
        <h2 className="font-semibold text-gray-900 mb-2">Interests received</h2>
        {data.received.map((i) => (
          <div key={i.id} className="py-1.5 border-b border-gray-50">
            <div className="flex items-center justify-between">
              <span>{name(i.fromMember)} → {name(i.toMember)} <span className="text-gray-400">· {i.status.toLowerCase()}</span></span>
              {i.status === 'PENDING' && <span className="flex gap-2 text-xs">
                <button className="text-green-700" onClick={() => act(i.id, 'accept')}>Accept</button>
                <button className="text-gray-500" onClick={() => act(i.id, 'decline')}>Decline</button>
              </span>}
            </div>
            <Contact c={i.contact} />
          </div>
        ))}
      </div>
      <div>
        <h2 className="font-semibold text-gray-900 mb-2">Interests sent</h2>
        {data.sent.map((i) => (
          <div key={i.id} className="py-1.5 border-b border-gray-50">
            <div className="flex items-center justify-between">
              <span>{name(i.fromMember)} → {name(i.toMember)} <span className="text-gray-400">· {i.status.toLowerCase()}</span></span>
              {i.status === 'PENDING' && <button className="text-xs text-gray-500" onClick={() => act(i.id, 'withdraw')}>Withdraw</button>}
            </div>
            <Contact c={i.contact} />
          </div>
        ))}
      </div>
    </div>
  )
}
