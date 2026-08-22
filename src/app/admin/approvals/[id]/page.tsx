'use client'
import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, CheckCircle2, XCircle, RotateCcw, ArrowUpRight, Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { timeAgo } from '@/lib/utils'

export default function ApprovalDetailPage() {
  const router = useRouter()
  const params = useParams()
  const [approval, setApproval] = useState<any>(null)
  const [note, setNote] = useState('')
  const [isLoading, setIsLoading] = useState<string | null>(null)

  useEffect(() => {
    fetch(`/ladwani/api/approvals/${params.id}`)
      .then((r) => r.json())
      .then(setApproval)
  }, [params.id])

  const act = async (action: string) => {
    setIsLoading(action)
    try {
      const res = await fetch(`/ladwani/api/approvals/${params.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, note }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.message)
      toast.success(`Request ${action}d successfully`)
      router.push('/admin/approvals')
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setIsLoading(null)
    }
  }

  if (!approval) return (
    <div className="flex items-center justify-center h-64">
      <Loader2 className="w-8 h-8 animate-spin text-saffron-500" />
    </div>
  )

  const submitterName = approval.submitter?.member
    ? `${approval.submitter.member.firstName} ${approval.submitter.member.lastName ?? ''}`
    : approval.submitter?.email ?? 'Unknown'

  const isPending = ['SUBMITTED', 'UNDER_REVIEW'].includes(approval.status)

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      <div className="flex items-center gap-3">
        <Link href="/admin/approvals" className="btn-ghost p-2"><ArrowLeft className="w-4 h-4" /></Link>
        <h1 className="text-xl font-bold text-gray-900">Review Request</h1>
      </div>

      {/* Request details */}
      <div className="card space-y-4">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="font-semibold text-gray-900">{approval.actionCode}</h2>
            <p className="text-sm text-gray-500 mt-0.5">
              Submitted by <strong>{submitterName}</strong> · {timeAgo(approval.submittedAt)}
            </p>
          </div>
          <span className={`badge text-sm px-3 py-1 ${
            approval.status === 'SUBMITTED' ? 'badge-orange' :
            approval.status === 'APPROVED' ? 'badge-green' :
            approval.status === 'REJECTED' ? 'badge-red' : 'badge-blue'
          }`}>{approval.status}</span>
        </div>

        {approval.reason && (
          <div className="bg-gray-50 rounded-lg p-3">
            <p className="text-xs font-medium text-gray-500 mb-1">REASON GIVEN</p>
            <p className="text-sm text-gray-700">{approval.reason}</p>
          </div>
        )}

        {approval.entityType && (
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-xs text-gray-500 font-medium mb-0.5">ENTITY TYPE</p>
              <p className="text-gray-900">{approval.entityType}</p>
            </div>
            {approval.fieldName && (
              <div>
                <p className="text-xs text-gray-500 font-medium mb-0.5">FIELD</p>
                <p className="text-gray-900">{approval.fieldName}</p>
              </div>
            )}
          </div>
        )}

        {(approval.oldValue || approval.newValue) && (
          <div className="space-y-2">
            <p className="text-xs text-gray-500 font-medium">CHANGE DETAILS</p>
            <div className="grid grid-cols-2 gap-3">
              {approval.oldValue && (
                <div className="bg-red-50 rounded-lg p-3">
                  <p className="text-xs font-medium text-red-600 mb-1">BEFORE</p>
                  <pre className="text-xs text-red-800 whitespace-pre-wrap font-mono">
                    {JSON.stringify(approval.oldValue, null, 2)}
                  </pre>
                </div>
              )}
              {approval.newValue && (
                <div className="bg-green-50 rounded-lg p-3">
                  <p className="text-xs font-medium text-green-600 mb-1">AFTER</p>
                  <pre className="text-xs text-green-800 whitespace-pre-wrap font-mono">
                    {JSON.stringify(approval.newValue, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {isPending && (
        <div className="card space-y-4">
          <h3 className="font-semibold text-gray-900">Review Action</h3>
          <div>
            <label className="form-label">Note / Reason (optional)</label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="form-input min-h-[80px]"
              placeholder="Add a note for the submitter..."
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <button onClick={() => act('approve')} disabled={!!isLoading}
              className="bg-green-600 hover:bg-green-700 text-white font-medium py-2.5 rounded-lg flex items-center justify-center gap-2 transition-colors disabled:opacity-60">
              {isLoading === 'approve' ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              Approve
            </button>
            <button onClick={() => act('reject')} disabled={!!isLoading}
              className="bg-red-600 hover:bg-red-700 text-white font-medium py-2.5 rounded-lg flex items-center justify-center gap-2 transition-colors disabled:opacity-60">
              {isLoading === 'reject' ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
              Reject
            </button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <button onClick={() => act('return')} disabled={!!isLoading}
              className="btn-secondary py-2.5 flex items-center justify-center gap-2">
              {isLoading === 'return' ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />}
              Return for Correction
            </button>
            <button onClick={() => act('escalate')} disabled={!!isLoading}
              className="btn-ghost py-2.5 flex items-center justify-center gap-2 text-orange-600">
              {isLoading === 'escalate' ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowUpRight className="w-4 h-4" />}
              Escalate to Admin
            </button>
          </div>
        </div>
      )}

      {approval.reviewNote && (
        <div className="card">
          <p className="text-xs text-gray-500 font-medium mb-1">REVIEW NOTE</p>
          <p className="text-sm text-gray-700">{approval.reviewNote}</p>
        </div>
      )}
    </div>
  )
}
