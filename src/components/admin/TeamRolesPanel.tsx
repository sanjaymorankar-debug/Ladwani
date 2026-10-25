'use client'
import { useState } from 'react'
import toast from 'react-hot-toast'
import { HeartHandshake } from 'lucide-react'
import { BASE_PATH } from '@/lib/api-path'

const TEAM_ROLES = [
  { code: 'DISTRICT_TEAM', label: 'District team', areaType: 'DISTRICT', note: 'Sees named support requests for this district.' },
  { code: 'STATE_TEAM', label: 'State team', areaType: 'STATE', note: 'Counts only.' },
  { code: 'NATIONAL_TEAM', label: 'National team', areaType: null, note: 'Counts only.' },
] as const

/** Community-team roles for Additional Details support requests, scoped to a district or state. */
export default function TeamRolesPanel({ userId, user, onChange }: { userId: string; user: any; onChange: (u: any) => void }) {
  const [areaId, setAreaId] = useState<Record<string, string>>({})
  const toggle = async (code: string, area: string | null) => {
    const res = await fetch(`${BASE_PATH}/api/admin/users/${userId}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ toggleRole: code, areaId: area }),
    })
    const body = await res.json()
    if (!res.ok) return toast.error(body.message)
    toast.success('Updated')
    onChange(await fetch(`${BASE_PATH}/api/admin/users/${userId}`).then((r) => r.json()))
  }
  const held = (code: string) => (user?.userRoles ?? []).filter((ur: any) => ur.role.code === code)
  return (
    <div className="card space-y-3">
      <h3 className="font-semibold text-gray-900 flex items-center gap-2"><HeartHandshake className="w-4 h-4" /> Community teams</h3>
      {TEAM_ROLES.map((r) => (
        <div key={r.code} className="text-sm space-y-1.5">
          <p className="font-medium">{r.label} <span className="text-gray-500 font-normal">— {r.note}</span></p>
          <div className="flex flex-wrap gap-2">
            {held(r.code).map((ur: any) => (
              <button key={ur.id} className="badge-orange" onClick={() => toggle(r.code, ur.areaId)} title="Remove">{ur.area?.name ?? 'All'} ×</button>
            ))}
          </div>
          {r.areaType ? (
            <div className="flex gap-2">
              <select className="form-input text-sm" value={areaId[r.code] ?? ''} onChange={(e) => setAreaId({ ...areaId, [r.code]: e.target.value })} aria-label={`${r.label} area`}>
                <option value="">Choose {r.areaType.toLowerCase()}…</option>
                {(user?.teamAreas ?? []).filter((a: any) => a.type === r.areaType).map((a: any) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
              <button className="btn-secondary text-sm" disabled={!areaId[r.code]} onClick={() => toggle(r.code, areaId[r.code])}>Add</button>
            </div>
          ) : (
            !held(r.code).length && <button className="btn-secondary text-sm" onClick={() => toggle(r.code, null)}>Add</button>
          )}
        </div>
      ))}
    </div>
  )
}
