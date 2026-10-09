'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Landmark, Plus } from 'lucide-react'

const KIND: Record<string, string> = { LOCAL: 'Organisation', DISTRICT_BODY: 'District body', STATE_BODY: 'State body', NATIONAL_BODY: 'National body' }
const STATUS: Record<string, string> = { PENDING_APPROVAL: 'Being verified', CORRECTION_REQUIRED: 'Correction needed', REJECTED: 'Not approved', ACTIVE: 'Active', INACTIVE: 'Inactive' }

/** F26–F31 — my organisations and bodies, and the active ones to browse and join. */
export default function OrganisationsPage() {
  const [data, setData] = useState<{ mine: any[]; organisations: any[] } | null>(null)
  const [q, setQ] = useState('')
  const load = (query = '') => fetch(`/api/organisations?q=${encodeURIComponent(query)}`).then((r) => r.json()).then(setData)
  useEffect(() => { load() }, [])

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2"><Landmark className="w-5 h-5 text-saffron-600" /> Organisations</h1>
        <Link href="/organisations/new" className="btn-primary text-sm flex items-center gap-1.5"><Plus className="w-4 h-4" /> Register organisation</Link>
      </div>

      {data?.mine.length ? (
        <div className="card">
          <h2 className="font-semibold text-gray-900 mb-2">Mine</h2>
          <div className="divide-y divide-gray-100">
            {data.mine.map((o) => (
              <Link key={o.id} href={`/organisations/${o.id}`} className="flex items-center justify-between py-2 text-sm hover:bg-gray-50">
                <span><strong>{o.name}</strong> <span className="text-gray-500">· {KIND[o.kind]}{o.area ? ` · ${o.area}` : ''}</span></span>
                <span className="text-xs text-gray-500">
                  {o.membership?.status === 'INVITED' ? <span className="text-saffron-700 font-medium">Invitation — answer</span>
                    : o.membership?.pendingDesignation ? <span className="text-saffron-700 font-medium">Post offered — answer</span>
                    : o.membership?.status === 'REQUESTED' ? 'Request sent'
                    : o.membership ? `${o.membership.designation.toLowerCase()} · ${STATUS[o.status] ?? o.status}` : STATUS[o.status] ?? o.status}
                </span>
              </Link>
            ))}
          </div>
        </div>
      ) : null}

      <div className="card">
        <div className="flex items-center justify-between mb-2">
          <h2 className="font-semibold text-gray-900">All organisations and LadWani bodies</h2>
          <div className="flex gap-2">
            <input className="form-input text-sm" placeholder="Search" value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && load(q)} />
          </div>
        </div>
        <div className="divide-y divide-gray-100">
          {(data?.organisations ?? []).map((o) => (
            <Link key={o.id} href={`/organisations/${o.id}`} className="block py-2 text-sm hover:bg-gray-50">
              <strong>{o.name}</strong> <span className="text-gray-500">· {KIND[o.kind]}{o.area ? ` · ${o.area}` : ''}</span>
              {o.purpose && <p className="text-xs text-gray-500 truncate">{o.purpose}</p>}
            </Link>
          ))}
          {data && !data.organisations.length && <p className="text-sm text-gray-500 py-2">None yet.</p>}
        </div>
      </div>
    </div>
  )
}
