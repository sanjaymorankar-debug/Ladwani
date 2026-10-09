'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { HeartHandshake } from 'lucide-react'
import { SUPPORT_CATEGORY_LABELS, type SupportCategory } from '@/lib/additional-details/sections'
import { formatDate } from '@/lib/utils'

const label = (k: string) => SUPPORT_CATEGORY_LABELS[k as SupportCategory] ?? k

export default function CommunitySupportView({ canSeeNames }: { canSeeNames: boolean }) {
  const [data, setData] = useState<any>(null)
  const [reports, setReports] = useState<any>(null)
  const load = async () => {
    const [d, r] = await Promise.all([fetch('/api/support-requests').then((x) => x.json()), fetch('/api/reports/community-support').then((x) => x.json())])
    setData(d)
    setReports(r)
  }
  useEffect(() => { load() }, [])
  if (!data || !reports) return <div className="card text-sm text-gray-500">Loading…</div>

  const close = async (requestId: string) => {
    const res = await fetch('/api/support-requests', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ requestId }) })
    toast[res.ok ? 'success' : 'error']((await res.json()).message)
    load()
  }

  return (
    <div className="max-w-5xl mx-auto space-y-5">
      <div>
        <h1 className="text-xl font-bold text-gray-900 font-display flex items-center gap-2"><HeartHandshake className="w-5 h-5" /> Community support</h1>
        <p className="text-sm text-gray-500">
          {canSeeNames
            ? `Requests members chose to share with the District team for ${data.scope.districts.join(', ')}.`
            : 'Counts only — names are visible to the District team of each district.'}
        </p>
      </div>
      <SupportCounts support={reports.support} />
      {canSeeNames && (
        <div className="card overflow-x-auto">
          <h2 className="font-semibold mb-2">Open requests ({data.requests.length})</h2>
          <table className="w-full text-sm">
            <thead><tr className="text-left text-gray-500"><th className="py-1">Member</th><th>Type</th><th>District</th><th>Note</th><th>Since</th><th /></tr></thead>
            <tbody>
              {data.requests.map((r: any) => (
                <tr key={r.id} className="border-t border-gray-50">
                  <td className="py-1.5"><Link className="underline" href={`/members/${r.member.id}`}>{r.member.name}</Link></td>
                  <td>{label(r.category)}</td><td>{r.district}</td><td className="max-w-xs">{r.note}</td><td>{formatDate(r.createdAt)}</td>
                  <td><button className="text-xs text-green-700" onClick={() => close(r.id)}>Mark handled</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <GroupStats groups={reports.groups} />
    </div>
  )
}

export function SupportCounts({ support }: { support: any }) {
  return (
    <div className="grid md:grid-cols-2 gap-4">
      <div className="card">
        <h3 className="font-semibold text-sm mb-2">Open support requests by type ({support.total})</h3>
        {support.byCategory.length === 0 && <p className="text-sm text-gray-500">None open.</p>}
        {support.byCategory.map((c: any) => <div key={c.key} className="flex justify-between text-sm py-0.5"><span>{label(c.key)}</span><span className="font-medium">{c.count}</span></div>)}
      </div>
      <div className="card">
        <h3 className="font-semibold text-sm mb-2">By district</h3>
        {support.byDistrict.map((c: any) => <div key={c.key} className="flex justify-between text-sm py-0.5"><span>{c.key}</span><span className="font-medium">{c.count}</span></div>)}
      </div>
    </div>
  )
}

export function GroupStats({ groups }: { groups: any }) {
  return (
    <div className="grid md:grid-cols-3 gap-4">
      <div className="card text-sm space-y-1">
        <h3 className="font-semibold">Interest groups</h3>
        <p>{groups.groupCount} groups ({groups.subGroupCount} district groups)</p>
        <p>Problems raised: <strong>{groups.problems.raised}</strong> · solved: <strong>{groups.problems.solved}</strong></p>
        <h4 className="font-medium pt-2">Most active (30 days)</h4>
        {groups.mostActive.map((g: any) => <div key={g.id} className="flex justify-between"><span>{g.name}</span><span>{g.posts30d} posts</span></div>)}
      </div>
      <div className="card text-sm">
        <h3 className="font-semibold mb-1">Members per group</h3>
        <div className="max-h-56 overflow-y-auto">
          {groups.membersPerGroup.map((g: any) => <div key={g.id} className="flex justify-between py-0.5"><span>{g.name}</span><span>{g.members}</span></div>)}
        </div>
      </div>
      <div className="card text-sm">
        <h3 className="font-semibold mb-1">Offering to teach or mentor, by field</h3>
        <div className="max-h-56 overflow-y-auto">
          {groups.mentorsByField.map((m: any) => <div key={m.field} className="flex justify-between py-0.5"><span>{m.field}</span><span>{m.count}</span></div>)}
        </div>
      </div>
    </div>
  )
}
