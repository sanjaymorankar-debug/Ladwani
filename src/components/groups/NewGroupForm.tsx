'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { ArrowLeft, Loader2, UsersRound } from 'lucide-react'

const GROUP_TYPES = ['MANDAL', 'YUVAK_MANDAL', 'MAHILA_MANDAL', 'BHAJAN_MANDAL', 'SENIOR', 'YOUTH', 'OTHER']

export default function NewGroupForm({ areas }: { areas: { id: string; name: string; type: string }[] }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [form, setForm] = useState({
    name: '', groupType: 'MANDAL', description: '', areaId: '',
    meetingSchedule: '', maxMembers: '25', rosterReviewIntervalDays: '180',
  })

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }))

  const submit = async () => {
    if (!form.name.trim()) return toast.error('Give the group a name')
    setBusy(true)
    try {
      const res = await fetch('/api/groups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, areaId: form.areaId || null }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.message ?? 'Could not register the group')
      toast.success(json.message)
      router.push('/groups')
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/groups" className="btn-ghost p-2"><ArrowLeft className="w-4 h-4" /></Link>
        <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <UsersRound className="w-5 h-5 text-saffron-600" /> Register a Community Group
        </h1>
      </div>

      <div className="space-y-4">
        <div className="card space-y-3">
          <h2 className="font-semibold text-gray-900 border-b border-gray-100 pb-2">Group details</h2>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="form-label">Name *</label>
              <input value={form.name} onChange={(e) => set('name', e.target.value)}
                className="form-input" placeholder="e.g. Kothrud Yuvak Mandal" />
            </div>
            <div>
              <label className="form-label">Type *</label>
              <select value={form.groupType} onChange={(e) => set('groupType', e.target.value)} className="form-input">
                {GROUP_TYPES.map((t) => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="form-label">Description</label>
            <textarea value={form.description} onChange={(e) => set('description', e.target.value)}
              className="form-input min-h-[80px]" placeholder="What does this group do, who is it for?" />
          </div>
          <div>
            <label className="form-label">Area</label>
            <select value={form.areaId} onChange={(e) => set('areaId', e.target.value)} className="form-input">
              <option value="">Not tied to a specific area</option>
              {areas.map((a) => <option key={a.id} value={a.id}>{a.name} ({a.type})</option>)}
            </select>
          </div>
        </div>

        <div className="card space-y-3">
          <h2 className="font-semibold text-gray-900 border-b border-gray-100 pb-2">Meetings & roster</h2>
          <div>
            <label className="form-label">Meeting schedule</label>
            <input value={form.meetingSchedule} onChange={(e) => set('meetingSchedule', e.target.value)}
              className="form-input" placeholder="e.g. Second Sunday, 6pm" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="form-label">Target roster size</label>
              <input type="number" value={form.maxMembers} onChange={(e) => set('maxMembers', e.target.value)}
                className="form-input" placeholder="25" />
              <p className="text-xs text-gray-400 mt-1">Typically 20–25 members</p>
            </div>
            <div>
              <label className="form-label">Review roster every (days)</label>
              <input type="number" value={form.rosterReviewIntervalDays} onChange={(e) => set('rosterReviewIntervalDays', e.target.value)}
                className="form-input" placeholder="180" />
              <p className="text-xs text-gray-400 mt-1">You'll be reminded to confirm the list is current</p>
            </div>
          </div>
        </div>

        <div className="bg-amber-50 border border-amber-100 rounded-xl p-4 text-sm text-amber-800">
          Your group is reviewed by a community operator before it's visible to others. You're added as its convener automatically.
        </div>

        <button onClick={submit} disabled={busy}
          className="btn-primary w-full py-3 flex items-center justify-center gap-2 disabled:opacity-70">
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
          {busy ? 'Submitting...' : 'Submit for approval'}
        </button>
      </div>
    </div>
  )
}
