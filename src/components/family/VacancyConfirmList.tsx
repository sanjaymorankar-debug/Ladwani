'use client'
import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { Crown } from 'lucide-react'

/**
 * F16 — for an Operator / Admin: families of their districts left without a
 * Karta, with the suggested eldest adult to confirm. For anyone: Karta
 * nominations waiting for their answer.
 */
export default function VacancyConfirmList() {
  const [data, setData] = useState<{ nominations: any[]; vacancies: any[] } | null>(null)
  const load = () => fetch('/api/karta-transfers').then((r) => r.json()).then(setData).catch(() => {})
  useEffect(() => { load() }, [])
  const act = async (id: string, body: object) => {
    const res = await fetch(`/api/karta-transfers/${id}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    const json = await res.json()
    if (!res.ok) return toast.error(json.message)
    toast.success(json.message); load()
  }
  if (!data || (!data.nominations.length && !data.vacancies.length)) return null
  return (
    <div className="card space-y-3 border-2 border-saffron-200">
      <h2 className="font-semibold text-gray-900 flex items-center gap-2"><Crown className="w-4 h-4 text-saffron-600" /> Karta hand-over</h2>
      {data.nominations.map((n) => (
        <div key={n.id} className="flex items-center justify-between text-sm bg-gray-50 rounded-lg p-3">
          <span>{n.from ?? 'The Karta'} nominated you as Karta of the <strong>{n.family?.name}</strong> family.</span>
          <span className="flex gap-2">
            <button className="btn-primary text-xs" onClick={() => act(n.id, { action: 'accept' })}>Accept</button>
            <button className="btn-secondary text-xs" onClick={() => act(n.id, { action: 'decline' })}>Decline</button>
          </span>
        </div>
      ))}
      {data.vacancies.map((v) => (
        <div key={v.id} className="flex items-center justify-between text-sm bg-gray-50 rounded-lg p-3">
          <span><strong>{v.family?.name}</strong> ({v.family?.registrationNumber}) has no Karta. Suggested: {v.suggested?.name ?? 'no eligible adult'}</span>
          {v.suggested && <button className="btn-primary text-xs" onClick={() => act(v.id, { action: 'confirm' })}>Confirm {v.suggested.name}</button>}
        </div>
      ))}
    </div>
  )
}
