'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ClipboardCheck, Loader2 } from 'lucide-react'
import VacancyConfirmList from '@/components/family/VacancyConfirmList'
import TreeLinksInbox from '@/components/family/TreeLinksInbox'

/** F05 — the signed-in Operator's own verification queue (nobody else's tasks appear here). */
export default function VerificationQueuePage() {
  const [tasks, setTasks] = useState<any[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    fetch('/api/verification/tasks').then(async (r) => {
      const j = await r.json()
      if (!r.ok) setError(j.message ?? 'Not available'); else setTasks(j.tasks)
    })
  }, [])

  if (error) return <p className="text-gray-500">{error}</p>
  if (!tasks) return <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-saffron-500" /></div>
  const open = tasks.filter((t) => ['OPEN', 'ESCALATED'].includes(t.status))
  const done = tasks.filter((t) => !['OPEN', 'ESCALATED'].includes(t.status))

  const row = (t: any) => (
    <Link key={t.id} href={`/admin/verification/${t.id}`} className="flex items-center justify-between px-4 py-3 hover:bg-gray-50 text-sm">
      <span>
        <span className="font-medium text-gray-900">{t.organisationName ?? t.subjectName}</span>
        <span className="text-gray-400 ml-2">{t.memberNumber}</span>
        <span className="ml-2 badge-gray">{t.kind === 'REGISTRATION' ? 'Registration' : t.kind === 'ORGANISATION' ? 'Organisation' : 'Profile change'}</span>
      </span>
      <span className="text-xs text-gray-500">
        {['OPEN', 'ESCALATED'].includes(t.status) ? `Due ${new Date(t.dueAt).toLocaleDateString()}` : `${t.status.replace('_', ' ').toLowerCase()} ${new Date(t.decidedAt).toLocaleDateString()}`}
      </span>
    </Link>
  )

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      <h1 className="text-xl font-bold text-gray-900 font-display flex items-center gap-2"><ClipboardCheck className="w-5 h-5" /> My verification tasks</h1>
      <VacancyConfirmList />
      <TreeLinksInbox />
      <p className="text-sm text-gray-500">Each task is yours alone. Another operator checks the same person independently; you never see their task or decision.</p>
      <div className="card p-0 divide-y divide-gray-100">
        <h2 className="px-4 py-2 text-sm font-semibold text-gray-700">Open ({open.length})</h2>
        {open.length ? open.map(row) : <p className="px-4 py-3 text-sm text-gray-500">Nothing waiting.</p>}
      </div>
      {done.length > 0 && (
        <div className="card p-0 divide-y divide-gray-100">
          <h2 className="px-4 py-2 text-sm font-semibold text-gray-700">Decided</h2>
          {done.map(row)}
        </div>
      )}
    </div>
  )
}
