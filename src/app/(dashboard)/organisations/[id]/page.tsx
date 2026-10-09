'use client'
import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { ArrowLeft } from 'lucide-react'
import MemberPicker from '@/components/organisations/MemberPicker'

const KIND: Record<string, string> = { LOCAL: 'Organisation', DISTRICT_BODY: 'LadWani District body', STATE_BODY: 'LadWani State body', NATIONAL_BODY: 'LadWani National body' }
const OFFICES = ['PRESIDENT', 'SECRETARY', 'TREASURER']
const STATUS: Record<string, string> = { PENDING_APPROVAL: 'Being verified', CORRECTION_REQUIRED: 'Correction needed', REJECTED: 'Not approved', ACTIVE: 'Active', INACTIVE: 'Inactive' }
const cap = (s: string) => s.charAt(0) + s.slice(1).toLowerCase()

/**
 * F26–F31 organisation page: details, members and posts (F27), nominations to
 * the next body (F28–F30), seats waiting for this body's confirmation, and
 * the viewer's own invitation / post offer / seat nomination to answer.
 */
export default function OrganisationPage({ params }: { params: { id: string } }) {
  const [data, setData] = useState<any>(null)
  const [invitee, setInvitee] = useState<{ id: string; name: string } | null>(null)
  const [nominees, setNominees] = useState<string[]>([])
  const load = useCallback(() => {
    fetch(`/api/organisations/${params.id}`).then(async (r) => setData(r.ok ? await r.json() : { error: true }))
  }, [params.id])
  useEffect(() => { load() }, [load])

  const post = async (url: string, body: object) => {
    const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    const json = await res.json()
    if (!res.ok) { toast.error(json.message); return false }
    toast.success(json.message); load(); return true
  }
  const memberAction = (memberId: string, action: string, extra: object = {}) => post(`/api/organisations/${params.id}/members/${memberId}`, { action, ...extra })
  const seatAction = (seatId: string, action: string, extra: object = {}) => post(`/api/body-seats/${seatId}`, { action, ...extra })
  const ask = (q: string) => window.prompt(q)?.trim()

  if (!data) return null
  if (data.error) return <p className="text-center text-gray-500 py-10">Organisation not found.</p>
  const o = data.organisation
  const me = data.me
  const active = data.members.filter((m: any) => m.status === 'ACTIVE')
  const seats = data.seats
  const myNomination = seats?.out.find((s: any) => s.memberId === me?.memberId && s.status === 'NOMINATED')
  const openSeats = seats ? seats.out.filter((s: any) => ['NOMINATED', 'ACCEPTED', 'CONFIRMED'].includes(s.status)) : []
  const need = seats ? seats.perUnit - openSeats.length : 0

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      <div className="flex items-center gap-3">
        <Link href="/organisations" className="btn-ghost p-2"><ArrowLeft className="w-4 h-4" /></Link>
        <div>
          <h1 className="text-xl font-bold text-gray-900">{o.name}</h1>
          <p className="text-sm text-gray-500">{KIND[o.kind]}{o.area ? ` · ${o.area}` : ''} · {STATUS[o.status] ?? o.status}</p>
        </div>
      </div>

      {/* Things for the viewer to answer */}
      {me?.status === 'INVITED' && (
        <div className="card border-2 border-saffron-200 flex items-center justify-between">
          <span className="text-sm">You are invited as <strong>{cap(me.designation)}</strong>.</span>
          <span className="flex gap-2">
            <button className="btn-primary text-xs" onClick={() => memberAction(me.memberId, 'accept')}>Accept</button>
            <button className="btn-secondary text-xs" onClick={() => memberAction(me.memberId, 'decline')}>Decline</button>
          </span>
        </div>
      )}
      {me?.pendingDesignation && (
        <div className="card border-2 border-saffron-200 flex items-center justify-between">
          <span className="text-sm">You are offered the post of <strong>{cap(me.pendingDesignation)}</strong>.</span>
          <span className="flex gap-2">
            <button className="btn-primary text-xs" onClick={() => memberAction(me.memberId, 'accept')}>Accept</button>
            <button className="btn-secondary text-xs" onClick={() => memberAction(me.memberId, 'decline')}>Decline</button>
          </span>
        </div>
      )}
      {myNomination && (
        <div className="card border-2 border-saffron-200 flex items-center justify-between">
          <span className="text-sm">You are nominated to the <strong>{seats.target?.name}</strong>.</span>
          <span className="flex gap-2">
            <button className="btn-primary text-xs" onClick={() => seatAction(myNomination.id, 'accept')}>Accept</button>
            <button className="btn-secondary text-xs" onClick={() => seatAction(myNomination.id, 'decline')}>Decline</button>
          </span>
        </div>
      )}
      {o.decisionNote && <div className="card text-sm text-amber-800 bg-amber-50 whitespace-pre-line">{o.decisionNote}</div>}
      {o.status === 'CORRECTION_REQUIRED' && data.full && (
        <button className="btn-primary text-sm" onClick={() => post(`/api/organisations/${o.id}/submit`, {})}>Resubmit for verification</button>
      )}

      <div className="card text-sm space-y-1">
        {o.purpose && <p>{o.purpose}</p>}
        {o.registrationNumber && <p className="text-gray-500">Registration no. {o.registrationNumber}</p>}
        {o.addressLine && <p className="text-gray-500">{o.addressLine}</p>}
        {o.hasCertificate && <a href={`/api/organisations/${o.id}/certificate`} target="_blank" rel="noreferrer" className="text-saffron-600">Certificate</a>}
      </div>

      {/* F27 members and posts */}
      <div className="card space-y-2">
        <h2 className="font-semibold text-gray-900">Members</h2>
        {data.members.filter((m: any) => m.status !== 'ENDED').map((m: any) => (
          <div key={m.memberId} className="flex flex-wrap items-center justify-between gap-2 text-sm border-b border-gray-50 py-1.5">
            <span>
              <strong>{m.name}</strong> <span className="text-gray-500">· {cap(m.designation)}</span>
              {m.status !== 'ACTIVE' && <span className="ml-1 badge-gray text-xs">{cap(m.status)}</span>}
              {m.pendingDesignation && <span className="ml-1 text-xs text-saffron-700">offered {cap(m.pendingDesignation)}</span>}
              {m.termEnd && <span className="ml-1 text-xs text-gray-400">term to {String(m.termEnd).slice(0, 10)}</span>}
            </span>
            {data.canManage && (
              <span className="flex gap-2 text-xs">
                {m.status === 'REQUESTED' && <>
                  <button className="text-green-700" onClick={() => memberAction(m.memberId, 'approve')}>Accept</button>
                  <button className="text-gray-500" onClick={() => { const r = ask('Reason'); if (r) memberAction(m.memberId, 'reject', { reason: r }) }}>Decline</button>
                </>}
                {m.status === 'ACTIVE' && m.designation === 'MEMBER' && !m.pendingDesignation && (
                  <select className="border rounded text-xs" value="" onChange={(e) => e.target.value && memberAction(m.memberId, 'designate', { designation: e.target.value })}>
                    <option value="">Hand a post…</option>
                    {OFFICES.map((p) => <option key={p} value={p}>{cap(p)}</option>)}
                  </select>
                )}
                {m.status === 'ACTIVE' && OFFICES.includes(m.designation) && (
                  <button className="text-gray-600" onClick={() => {
                    const start = ask('Term start (YYYY-MM-DD)'); const end = ask('Term end (YYYY-MM-DD)')
                    if (start || end) memberAction(m.memberId, 'term', { termStart: start || null, termEnd: end || null })
                  }}>Term</button>
                )}
                {m.status === 'ACTIVE' && m.designation === 'MEMBER' && o.kind === 'LOCAL' && (
                  <button className="text-red-600" onClick={() => { const r = ask('Reason for removing'); if (r) memberAction(m.memberId, 'remove', { reason: r }) }}>Remove</button>
                )}
              </span>
            )}
          </div>
        ))}
        {data.canManage && o.status === 'ACTIVE' && o.kind === 'LOCAL' && (
          <div className="flex items-end gap-2 pt-2">
            <div className="flex-1"><MemberPicker label="Add a member" value={invitee} onPick={setInvitee} /></div>
            <button className="btn-primary text-sm" disabled={!invitee} onClick={async () => { if (await post(`/api/organisations/${o.id}/members`, { memberId: invitee!.id })) setInvitee(null) }}>Invite</button>
          </div>
        )}
        {!data.full && o.status === 'ACTIVE' && o.kind === 'LOCAL' && (
          <button className="btn-secondary text-sm" onClick={() => post(`/api/organisations/${o.id}/members`, {})}>Request to join</button>
        )}
        {me?.status === 'ACTIVE' && (
          <button className="text-xs text-gray-500" onClick={() => { if (window.confirm('Leave this organisation?')) memberAction(me.memberId, 'resign') }}>Leave</button>
        )}
      </div>

      {/* F28–F30 nominations to the next body */}
      {seats?.target && o.status === 'ACTIVE' && (data.isPresident || seats.out.length > 0) && (
        <div className="card space-y-2">
          <h2 className="font-semibold text-gray-900">Seats on the {seats.target.name}</h2>
          <p className="text-xs text-gray-500">Exactly {seats.perUnit} per unit. Nominees accept; the body confirms. A seat gives the matching team view.</p>
          {seats.out.filter((s: any) => s.status !== 'ENDED' && s.status !== 'DECLINED' && s.status !== 'REJECTED').map((s: any) => (
            <div key={s.id} className="flex items-center justify-between text-sm">
              <span>{s.name} <span className="text-gray-500">· {cap(s.status)}</span></span>
              {data.isPresident && <button className="text-xs text-gray-500" onClick={() => { if (window.confirm('End this seat? Seats above that came from it end too.')) seatAction(s.id, 'end', { reason: 'Replaced' }) }}>End seat</button>}
            </div>
          ))}
          {data.isPresident && need > 0 && (
            <div className="space-y-1">
              <p className="text-sm">Choose {need} member{need > 1 ? 's' : ''}:</p>
              {active.filter((m: any) => !openSeats.some((s: any) => s.memberId === m.memberId)).map((m: any) => (
                <label key={m.memberId} className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={nominees.includes(m.memberId)}
                    onChange={(e) => setNominees((n) => e.target.checked ? [...n, m.memberId] : n.filter((x) => x !== m.memberId))} />
                  {m.name}
                </label>
              ))}
              <button className="btn-primary text-sm" disabled={nominees.length !== need}
                onClick={async () => { if (await post(`/api/organisations/${o.id}/nominations`, { memberIds: nominees })) setNominees([]) }}>Nominate</button>
            </div>
          )}
        </div>
      )}

      {/* Nominations waiting for this body (its President or an Admin confirms) */}
      {seats?.in.length > 0 && (
        <div className="card space-y-2">
          <h2 className="font-semibold text-gray-900">Nominations to this body</h2>
          {seats.in.map((s: any) => (
            <div key={s.id} className="flex items-center justify-between text-sm">
              <span>{s.name} <span className="text-gray-500">· {s.status === 'NOMINATED' ? 'waiting for the nominee' : 'accepted'}</span></span>
              {s.status === 'ACCEPTED' && (
                <span className="flex gap-2 text-xs">
                  <button className="text-green-700" onClick={() => seatAction(s.id, 'confirm')}>Confirm</button>
                  <button className="text-gray-500" onClick={() => { const r = ask('Reason'); if (r) seatAction(s.id, 'reject', { reason: r }) }}>Reject</button>
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
