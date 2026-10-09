'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import RelationshipSelect from './RelationshipSelect'

/**
 * F11 / F18 on one member card: the Karta can remove (with a reason) or change
 * the role; an Operator of the district can change the role with a remark.
 */
export default function MemberManageActions({ familyId, memberId, gender, canRemove, isOperator, relatives }: {
  familyId: string; memberId: string; gender: string; canRemove: boolean; isOperator: boolean
  relatives: { id: string; name: string }[]
}) {
  const router = useRouter()
  const [mode, setMode] = useState<'none' | 'remove' | 'role'>('none')
  const [reason, setReason] = useState('MOVED_OUT')
  const [role, setRole] = useState('')
  const [relativeTo, setRelativeTo] = useState(relatives[0]?.id ?? '')
  const [remark, setRemark] = useState('')

  const send = async (method: string, body: object, ok: string) => {
    const res = await fetch(`/api/families/${familyId}/members/${memberId}`, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    const json = await res.json().catch(() => ({}))
    if (!res.ok) return toast.error(json.message ?? 'Failed')
    toast.success(ok); setMode('none'); router.refresh()
  }

  return (
    <div className="mt-2 text-xs" onClick={(e) => e.preventDefault()}>
      {mode === 'none' && (
        <div className="flex gap-3">
          <button type="button" className="text-saffron-600" onClick={() => setMode('role')}>Change role</button>
          {canRemove && <button type="button" className="text-red-600" onClick={() => setMode('remove')}>Remove</button>}
        </div>
      )}
      {mode === 'remove' && (
        <div className="space-y-1.5">
          <select className="form-input text-xs" value={reason} onChange={(e) => setReason(e.target.value)}>
            <option value="WRONGLY_ADDED">Wrongly added</option>
            <option value="MOVED_OUT">Moved out</option>
            <option value="DUPLICATE">Duplicate</option>
          </select>
          <div className="flex gap-2">
            <button type="button" className="text-red-600 font-medium" onClick={() => send('DELETE', { reason }, 'Removed from this family')}>Confirm remove</button>
            <button type="button" className="text-gray-500" onClick={() => setMode('none')}>Cancel</button>
          </div>
        </div>
      )}
      {mode === 'role' && (
        <div className="space-y-1.5">
          <RelationshipSelect value={role} onChange={setRole} gender={gender} />
          <select className="form-input text-xs" value={relativeTo} onChange={(e) => setRelativeTo(e.target.value)}>
            {relatives.map((r) => <option key={r.id} value={r.id}>of {r.name}</option>)}
          </select>
          {isOperator && <input className="form-input text-xs" placeholder="Remark (required)" value={remark} onChange={(e) => setRemark(e.target.value)} />}
          <div className="flex gap-2">
            <button type="button" className="text-saffron-600 font-medium" disabled={!role}
              onClick={() => send('PATCH', { relationshipRole: role, relativeToMemberId: relativeTo, remark }, 'Role updated')}>Save role</button>
            <button type="button" className="text-gray-500" onClick={() => setMode('none')}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  )
}
