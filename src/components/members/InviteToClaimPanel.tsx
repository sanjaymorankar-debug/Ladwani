'use client'
import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { Mail, Loader2, Send, X, CheckCircle2 } from 'lucide-react'
import { formatDate } from '@/lib/utils'

interface Invitation {
  id: string
  email: string | null
  status: string
  expiresAt: string
  acceptedAt: string | null
  createdAt: string
}

/**
 * Lets whoever maintains an account-less profile invite the real person to
 * take it over (§12, §34). Rendered only for profiles with no login of their
 * own — once claimed, the person manages themselves and this disappears.
 */
export default function InviteToClaimPanel({
  memberId,
  memberName,
  defaultEmail,
}: {
  memberId: string
  memberName: string
  defaultEmail?: string | null
}) {
  const [invitations, setInvitations] = useState<Invitation[]>([])
  const [email, setEmail] = useState(defaultEmail ?? '')
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(true)

  const load = () =>
    fetch(`/api/members/${memberId}/invite`)
      .then((r) => (r.ok ? r.json() : { invitations: [] }))
      .then((d) => setInvitations(d.invitations ?? []))
      .catch(() => {})
      .finally(() => setLoading(false))

  useEffect(() => { load() }, [memberId])

  const pending = invitations.find((i) => i.status === 'PENDING')
  const accepted = invitations.find((i) => i.status === 'ACCEPTED')

  const send = async () => {
    if (!email.trim()) return toast.error('Enter an email address')
    setBusy(true)
    try {
      const res = await fetch(`/api/members/${memberId}/invite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.message)
      // The API tells us whether the mail actually went out — don't claim it
      // was sent when SMTP is down.
      json.emailed ? toast.success(json.message) : toast(json.message, { icon: '⚠️' })
      await load()
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setBusy(false)
    }
  }

  const revoke = async () => {
    setBusy(true)
    try {
      const res = await fetch(`/api/members/${memberId}/invite`, { method: 'DELETE' })
      if (!res.ok) throw new Error((await res.json()).message)
      toast.success('Invitation cancelled')
      await load()
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setBusy(false)
    }
  }

  if (loading) return null

  if (accepted) {
    return (
      <div className="card">
        <p className="text-sm text-green-700 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
          {memberName} has claimed this profile and now manages it themselves.
        </p>
      </div>
    )
  }

  return (
    <div className="card space-y-3">
      <h2 className="font-semibold text-gray-900 flex items-center gap-2">
        <Mail className="w-4 h-4 text-saffron-600" /> Invite {memberName} to claim this profile
      </h2>

      {pending ? (
        <div className="flex items-center justify-between gap-3 p-3 bg-amber-50 border border-amber-100 rounded-lg text-sm">
          <div>
            <p className="text-amber-800">Invitation sent to {pending.email}</p>
            <p className="text-amber-600 text-xs mt-0.5">
              Expires {formatDate(new Date(pending.expiresAt), 'dd MMM yyyy')} · not yet accepted
            </p>
          </div>
          <button onClick={revoke} disabled={busy}
            className="text-amber-700 hover:text-red-600 flex items-center gap-1 text-xs disabled:opacity-50">
            <X className="w-3.5 h-3.5" /> Cancel
          </button>
        </div>
      ) : (
        <>
          <p className="text-sm text-gray-500">
            They&apos;ll get an email with a link to set their own password. After that they
            manage this profile themselves, and you&apos;ll no longer edit it for them.
          </p>
          <div className="flex gap-2">
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              type="email"
              className="form-input flex-1"
              placeholder="their.email@example.com"
            />
            <button onClick={send} disabled={busy}
              className="btn-primary text-sm flex items-center gap-1.5 disabled:opacity-70 whitespace-nowrap">
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              Send invite
            </button>
          </div>
        </>
      )}
    </div>
  )
}
