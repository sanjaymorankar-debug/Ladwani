'use client'
import { BASE_PATH } from '@/lib/api-path'
import { useCallback, useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { Activity, Loader2 } from 'lucide-react'

/** F07 — Approval Monitor: Admin (all) and State team (own state). Admin can reassign or reopen. */
export default function ApprovalMonitorPage() {
  const [data, setData] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)
  const [filters, setFilters] = useState({ status: '', minAgeDays: '', operatorId: '' })
  const [assignTo, setAssignTo] = useState<Record<string, string>>({})

  const load = useCallback(() => {
    const q = new URLSearchParams(Object.entries(filters).filter(([, v]) => v) as [string, string][])
    fetch(`${BASE_PATH}/api/approval-monitor?${q}`).then(async (r) => {
      const j = await r.json()
      if (!r.ok) setError(j.message); else setData(j)
    })
  }, [filters])
  useEffect(() => { load() }, [load])

  const act = async (taskId: string, body: object) => {
    const res = await fetch(`${BASE_PATH}/api/approval-monitor/tasks/${taskId}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    const j = await res.json()
    if (!res.ok) return toast.error(j.message)
    toast.success(j.message); load()
  }

  if (error) return <p className="text-gray-500">{error}</p>
  if (!data) return <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-saffron-500" /></div>

  return (
    <div className="max-w-6xl mx-auto space-y-5">
      <h1 className="text-xl font-bold text-gray-900 font-display flex items-center gap-2"><Activity className="w-5 h-5" /> Approval Monitor</h1>
      <div className="card flex flex-wrap gap-3 text-sm">
        <select className="form-input w-auto" value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })}>
          <option value="">Live tasks</option>
          {['OPEN', 'ESCALATED', 'APPROVED', 'REJECTED', 'SENT_BACK', 'REASSIGNED'].map((s) => <option key={s} value={s}>{s.replace('_', ' ').toLowerCase()}</option>)}
        </select>
        <select className="form-input w-auto" value={filters.minAgeDays} onChange={(e) => setFilters({ ...filters, minAgeDays: e.target.value })}>
          <option value="">Any age</option><option value="3">Older than 3 days</option><option value="7">Older than 7 days</option>
        </select>
        {data.canManage && (
          <select className="form-input w-auto" value={filters.operatorId} onChange={(e) => setFilters({ ...filters, operatorId: e.target.value })}>
            <option value="">All operators</option>
            {data.operators.map((o: any) => <option key={o.id} value={o.id}>{o.name}</option>)}
          </select>
        )}
      </div>
      <div className="card overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left"><tr>
            {['Person', 'District', 'Kind', 'Round / slot', 'Operator', 'Status', 'Created', 'Decided', ''].map((h) => <th key={h} className="px-3 py-2 font-semibold text-gray-700">{h}</th>)}
          </tr></thead>
          <tbody className="divide-y divide-gray-50">
            {data.tasks.length === 0 && <tr><td colSpan={9} className="px-3 py-6 text-center text-gray-500">No tasks.</td></tr>}
            {data.tasks.map((t: any) => (
              <tr key={t.id}>
                <td className="px-3 py-2">{t.subject.name}<div className="text-xs text-gray-400">{t.subject.memberNumber} · {t.subject.accountStatus}</div></td>
                <td className="px-3 py-2">{t.district ?? '—'}</td>
                <td className="px-3 py-2">{t.kind === 'REGISTRATION' ? 'Registration' : 'Change'}</td>
                <td className="px-3 py-2">{t.round} / {t.slot}</td>
                <td className="px-3 py-2">{t.operator?.name ?? <span className="text-amber-600">unassigned</span>}</td>
                <td className="px-3 py-2">{t.status.replace('_', ' ').toLowerCase()}{t.remarks ? <div className="text-xs text-gray-500 max-w-xs truncate" title={t.remarks}>{t.remarks}</div> : null}</td>
                <td className="px-3 py-2 text-xs">{new Date(t.createdAt).toLocaleDateString()} ({t.ageDays}d)</td>
                <td className="px-3 py-2 text-xs">{t.decidedAt ? new Date(t.decidedAt).toLocaleString() : '—'}</td>
                <td className="px-3 py-2">
                  {data.canManage && t.live && (['OPEN', 'ESCALATED'].includes(t.status) ? (
                    <span className="flex gap-1">
                      <select className="form-input text-xs py-1 w-32" value={assignTo[t.id] ?? ''} onChange={(e) => setAssignTo({ ...assignTo, [t.id]: e.target.value })}>
                        <option value="">Reassign to…</option>
                        {data.operators.map((o: any) => <option key={o.id} value={o.id}>{o.name}</option>)}
                      </select>
                      <button className="text-xs text-saffron-600" disabled={!assignTo[t.id]} onClick={() => act(t.id, { action: 'reassign', operatorUserId: assignTo[t.id] })}>Go</button>
                    </span>
                  ) : (
                    <button className="text-xs text-saffron-600" onClick={() => act(t.id, { action: 'reopen' })}>Reopen</button>
                  ))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
