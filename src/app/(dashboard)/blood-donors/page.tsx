'use client'
import { useState } from 'react'
import toast from 'react-hot-toast'
import { Droplet } from 'lucide-react'
import ContactRequests from '@/components/connect/ContactRequests'
import { BLOOD_GROUPS } from '@/lib/additional-details/sections'
import { BASE_PATH } from '@/lib/api-path'

/**
 * Blood donor finder (rule 10). Search needs both blood group and city; results
 * show a name and a "request contact" button. The donor's number is shared
 * only once they accept.
 */
export default function BloodDonorsPage() {
  const [bloodGroup, setBloodGroup] = useState('')
  const [city, setCity] = useState('')
  const [donors, setDonors] = useState<{ memberId: string; name: string; city: string | null }[] | null>(null)
  const [requested, setRequested] = useState<string[]>([])

  const search = async (e: React.FormEvent) => {
    e.preventDefault()
    const res = await fetch(`${BASE_PATH}/api/blood-donors?bloodGroup=${encodeURIComponent(bloodGroup)}&city=${encodeURIComponent(city)}`)
    const body = await res.json()
    if (!res.ok) return toast.error(body.message)
    setDonors(body.donors)
  }
  const request = async (memberId: string) => {
    const res = await fetch(`${BASE_PATH}/api/contact-requests`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ toMemberId: memberId, purpose: 'BLOOD_DONOR' }) })
    const body = await res.json()
    toast[res.ok ? 'success' : 'error'](body.message)
    if (res.ok) setRequested((r) => [...r, memberId])
  }

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <div>
        <h1 className="text-xl font-bold text-gray-900 font-display flex items-center gap-2"><Droplet className="w-5 h-5 text-red-600" /> Blood donor finder</h1>
        <p className="text-sm text-gray-500">Members who said they are willing to donate. Numbers are shared only when a donor accepts your request.</p>
      </div>
      <form onSubmit={search} className="card grid sm:grid-cols-3 gap-3 items-end">
        <div>
          <label className="form-label" htmlFor="bg">Blood group</label>
          <select id="bg" className="form-input" value={bloodGroup} onChange={(e) => setBloodGroup(e.target.value)} required>
            <option value="">Select…</option>
            {BLOOD_GROUPS.map((g) => <option key={g} value={g}>{g}</option>)}
          </select>
        </div>
        <div>
          <label className="form-label" htmlFor="city">City</label>
          <input id="city" className="form-input" value={city} onChange={(e) => setCity(e.target.value)} required minLength={2} />
        </div>
        <button className="btn-primary">Search</button>
      </form>
      {donors && (
        <div className="card divide-y divide-gray-50">
          {donors.length === 0 && <p className="text-sm text-gray-500">No willing donors found for this blood group and city.</p>}
          {donors.map((d) => (
            <div key={d.memberId} className="flex items-center justify-between py-2 text-sm">
              <span className="font-medium">{d.name}<span className="text-gray-500 font-normal"> · {d.city}</span></span>
              <button className="btn-secondary text-sm" disabled={requested.includes(d.memberId)} onClick={() => request(d.memberId)}>
                {requested.includes(d.memberId) ? 'Requested' : 'Request contact'}
              </button>
            </div>
          ))}
        </div>
      )}
      <ContactRequests />
    </div>
  )
}
