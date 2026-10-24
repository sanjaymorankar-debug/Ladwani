'use client'
import { useState } from 'react'
import toast from 'react-hot-toast'

interface Rule {
  id: string
  actionCode: string
  requiresApproval: boolean
  approverRole: string | null
  autoApproveRole: string | null
  isActive: boolean
}

/** §28 approval rules: one switch per action. */
export default function ApprovalRulesAdmin({ initialRules }: { initialRules: Rule[] }) {
  const [rules, setRules] = useState(initialRules)
  const [saving, setSaving] = useState<string | null>(null)

  const toggle = async (r: Rule) => {
    setSaving(r.id)
    const res = await fetch(`/api/admin/approval-rules/${r.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ requiresApproval: !r.requiresApproval }),
    })
    const json = await res.json().catch(() => ({}))
    setSaving(null)
    if (!res.ok) { toast.error(json.message ?? 'Failed'); return }
    setRules((rs) => rs.map((x) => (x.id === r.id ? { ...x, ...json.rule } : x)))
    toast.success(json.rule.requiresApproval ? `${r.actionCode} now needs approval` : `${r.actionCode} now applies at once`)
  }

  if (!rules.length) return <div className="card text-sm text-gray-500">No approval rules are configured.</div>

  return (
    <div className="card divide-y divide-gray-100 p-0">
      {rules.map((r) => (
        <div key={r.id} className="flex items-center justify-between gap-4 px-4 py-3">
          <div className="min-w-0">
            <p className="font-mono text-sm text-gray-900">{r.actionCode}</p>
            <p className="text-xs text-gray-500">
              {!r.isActive
                ? 'Inactive — always needs approval'
                : r.requiresApproval
                  ? `Reviewed by ${r.approverRole ?? 'Operator or Admin'}`
                  : 'Applies at once, no review'}
            </p>
          </div>
          <label className="flex items-center gap-2 text-sm text-gray-700 shrink-0">
            <input
              type="checkbox"
              checked={!r.isActive || r.requiresApproval}
              disabled={!r.isActive || saving === r.id}
              onChange={() => toggle(r)}
              className="w-4 h-4"
            />
            Needs approval
          </label>
        </div>
      ))}
    </div>
  )
}
