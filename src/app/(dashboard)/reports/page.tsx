'use client'
import { useEffect, useState } from 'react'
import { BarChart3, Download } from 'lucide-react'

/** F39 — counts by state / district, age and education, Operator SLA (Admin); CSV (Excel) export. */
export default function ReportsPage() {
  const [d, setD] = useState<any>(null)
  useEffect(() => { fetch('/api/reports/dashboard').then(async (r) => setD(r.ok ? await r.json() : { error: (await r.json()).message })) }, [])
  if (!d) return null
  if (d.error) return <p className="text-center text-gray-500 py-10">{d.error}</p>
  const Export = ({ name }: { name: string }) => d.canExport
    ? <a href={`/api/reports/dashboard?export=${name}`} className="text-xs text-saffron-700 flex items-center gap-1"><Download className="w-3.5 h-3.5" /> Excel (CSV)</a> : null
  const Table = ({ cols, rows }: { cols: [string, string][]; rows: any[] }) => (
    <div className="overflow-x-auto"><table className="w-full text-sm">
      <thead><tr className="text-left text-gray-500 border-b">{cols.map(([, l]) => <th key={l} className="py-1.5 pr-3 font-medium">{l}</th>)}</tr></thead>
      <tbody>{rows.map((r, i) => <tr key={i} className="border-b border-gray-50">{cols.map(([k]) => <td key={k} className="py-1.5 pr-3">{r[k] ?? '—'}</td>)}</tr>)}</tbody>
    </table></div>
  )
  return (
    <div className="max-w-6xl mx-auto space-y-5">
      <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2"><BarChart3 className="w-5 h-5 text-saffron-600" /> Reports</h1>
      <p className="text-sm text-gray-500">{d.scope === 'ALL' ? 'All states and districts' : 'Your area only'}</p>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[['Families', d.totals.families], ['Members', d.totals.members], ['Pending approvals', d.totals.pendingApprovals], ['Organisations', d.totals.organisations]].map(([l, v]) => (
          <div key={l} className="card text-center"><p className="text-2xl font-bold text-gray-900">{v}</p><p className="text-xs text-gray-500">{l}</p></div>
        ))}
      </div>
      <div className="card space-y-2">
        <div className="flex justify-between"><h2 className="font-semibold">By state and district</h2><Export name="districts" /></div>
        <Table cols={[['state', 'State'], ['district', 'District'], ['families', 'Families'], ['members', 'Members'], ['pendingApprovals', 'Pending approvals'], ['organisations', 'Organisations']]} rows={d.districts} />
      </div>
      <div className="grid sm:grid-cols-2 gap-5">
        <div className="card space-y-2">
          <div className="flex justify-between"><h2 className="font-semibold">Age</h2><Export name="age" /></div>
          <Table cols={[['band', 'Age'], ['members', 'Members']]} rows={d.age} />
        </div>
        <div className="card space-y-2">
          <div className="flex justify-between"><h2 className="font-semibold">Education (highest)</h2><Export name="education" /></div>
          <Table cols={[['level', 'Level'], ['members', 'Members']]} rows={d.education} />
        </div>
      </div>
      {d.sla && (
        <div className="card space-y-2">
          <div className="flex justify-between"><h2 className="font-semibold">Operator SLA</h2><Export name="sla" /></div>
          <Table cols={[['operator', 'Operator'], ['open', 'Open'], ['overdue', 'Overdue'], ['decided', 'Decided'], ['escalated', 'Escalated'], ['avgDecisionHours', 'Avg. hours to decide']]} rows={d.sla} />
        </div>
      )}
    </div>
  )
}
