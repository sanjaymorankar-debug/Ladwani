'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { MoreVertical, Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'

const STATUSES = ['ACTIVE', 'INACTIVE', 'DECEASED', 'SUSPENDED']
const LEFT_REASONS = [
  { code: 'MARRIED_OUT', label: 'Married out of family' },
  { code: 'SEPARATED', label: 'Separated' },
  { code: 'MERGED', label: 'Merged with another family' },
  { code: 'ERROR', label: 'Added by mistake' },
]

export default function MemberManageMenu({ familyId, memberId, currentStatus }: { familyId: string; memberId: string; currentStatus: string }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState<'menu' | 'status' | 'remove'>('menu')
  const [isLoading, setIsLoading] = useState(false)

  const close = () => { setOpen(false); setMode('menu') }

  const changeStatus = async (status: string) => {
    setIsLoading(true)
    try {
      const res = await fetch(`/api/families/${familyId}/members/${memberId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.message || 'Failed to update status')
      toast.success('Status updated')
      close()
      router.refresh()
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setIsLoading(false)
    }
  }

  const removeMember = async (reason: string) => {
    setIsLoading(true)
    try {
      const res = await fetch(`/api/families/${familyId}/members/${memberId}?reason=${reason}`, { method: 'DELETE' })
      const json = await res.json()
      if (!res.ok) throw new Error(json.message || 'Failed to remove member')
      toast.success('Member removed from family')
      close()
      router.refresh()
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="relative" onClick={(e) => e.stopPropagation()}>
      <button type="button" onClick={() => setOpen(!open)}
        className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors">
        <MoreVertical className="w-4 h-4" />
      </button>

      {open && (
        <div className="absolute right-0 top-8 z-10 w-56 bg-white rounded-xl shadow-lg border border-gray-100 p-2">
          {mode === 'menu' && (
            <>
              <button onClick={() => setMode('status')}
                className="w-full text-left text-sm px-3 py-2 rounded-lg hover:bg-gray-50 text-gray-700">
                Change Status
              </button>
              <button onClick={() => setMode('remove')}
                className="w-full text-left text-sm px-3 py-2 rounded-lg hover:bg-red-50 text-red-600">
                Remove from Family
              </button>
            </>
          )}

          {mode === 'status' && (
            <div className="p-1">
              <p className="text-xs font-medium text-gray-500 px-2 pb-1.5">Set status</p>
              {STATUSES.map((s) => (
                <button key={s} onClick={() => changeStatus(s)} disabled={isLoading || s === currentStatus}
                  className="w-full text-left text-sm px-3 py-2 rounded-lg hover:bg-gray-50 text-gray-700 disabled:opacity-40 flex items-center justify-between">
                  {s} {isLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                </button>
              ))}
            </div>
          )}

          {mode === 'remove' && (
            <div className="p-1">
              <p className="text-xs font-medium text-gray-500 px-2 pb-1.5">Reason for removal</p>
              {LEFT_REASONS.map((r) => (
                <button key={r.code} onClick={() => removeMember(r.code)} disabled={isLoading}
                  className="w-full text-left text-sm px-3 py-2 rounded-lg hover:bg-red-50 text-red-600 disabled:opacity-40">
                  {r.label}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
      {open && <div className="fixed inset-0 z-0" onClick={close} />}
    </div>
  )
}
