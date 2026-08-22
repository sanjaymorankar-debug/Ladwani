'use client'
import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Loader2, Shield, CheckCircle2, XCircle, AlertTriangle } from 'lucide-react'
import toast from 'react-hot-toast'
import { formatDate } from '@/lib/utils'

const ROLES = ['MEMBER', 'KARTA', 'OPERATOR', 'ADMIN']
const STATUSES = ['ACTIVE', 'PENDING', 'SUSPENDED', 'BLOCKED']

export default function UserDetailPage() {
  const params = useParams()
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    fetch(`/ladwani/api/admin/users/${params.id}`)
      .then((r) => r.json())
      .then(setUser)
  }, [params.id])

  const updateStatus = async (status: string) => {
    setIsSaving(true)
    try {
      const res = await fetch(`/ladwani/api/admin/users/${params.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      if (!res.ok) throw new Error('Update failed')
      setUser((u: any) => ({ ...u, status }))
      toast.success(`User status updated to ${status}`)
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setIsSaving(false)
    }
  }

  const toggleRole = async (roleCode: string) => {
    const hasRole = user?.userRoles?.some((ur: any) => ur.role.code === roleCode)
    setIsSaving(true)
    try {
      const res = await fetch(`/ladwani/api/admin/users/${params.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ toggleRole: roleCode }),
      })
      if (!res.ok) throw new Error('Update failed')
      toast.success(hasRole ? `Role ${roleCode} removed` : `Role ${roleCode} added`)
      const updated = await fetch(`/ladwani/api/admin/users/${params.id}`).then((r) => r.json())
      setUser(updated)
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setIsSaving(false)
    }
  }

  if (!user) return (
    <div className="flex items-center justify-center h-64">
      <Loader2 className="w-8 h-8 animate-spin text-saffron-500" />
    </div>
  )

  const memberName = user.member
    ? `${user.member.firstName} ${user.member.lastName ?? ''}`
    : user.email ?? user.mobile ?? 'Unknown'

  const currentRoles = user.userRoles?.map((ur: any) => ur.role.code) ?? []

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      <div className="flex items-center gap-3">
        <Link href="/admin/users" className="btn-ghost p-2"><ArrowLeft className="w-4 h-4" /></Link>
        <h1 className="text-xl font-bold text-gray-900">User Details</h1>
      </div>

      <div className="card space-y-4">
        <div className="flex items-start gap-4">
          <div className="w-14 h-14 bg-saffron-600 rounded-2xl flex items-center justify-center text-white text-xl font-bold">
            {memberName[0]}
          </div>
          <div>
            <h2 className="text-lg font-bold text-gray-900">{memberName}</h2>
            <p className="text-gray-500 text-sm">{user.email ?? '—'} {user.mobile ? `· ${user.mobile}` : ''}</p>
            <div className="flex gap-2 mt-1">
              {currentRoles.map((role: string) => (
                <span key={role} className={`badge text-xs ${
                  role === 'ADMIN' ? 'badge-red' : role === 'OPERATOR' ? 'badge-blue' :
                  role === 'KARTA' ? 'badge-orange' : 'badge-gray'
                }`}>{role}</span>
              ))}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 text-sm border-t border-gray-100 pt-4">
          <div><span className="text-gray-500">Status</span>
            <span className={`ml-2 font-medium ${user.status === 'ACTIVE' ? 'text-green-600' : user.status === 'SUSPENDED' ? 'text-red-600' : 'text-amber-600'}`}>
              {user.status}
            </span>
          </div>
          <div><span className="text-gray-500">Joined</span> <span className="font-medium ml-2">{formatDate(user.createdAt)}</span></div>
          <div><span className="text-gray-500">Email verified</span> <span className={`font-medium ml-2 ${user.emailVerified ? 'text-green-600' : 'text-red-500'}`}>{user.emailVerified ? 'Yes' : 'No'}</span></div>
          <div><span className="text-gray-500">Mobile verified</span> <span className={`font-medium ml-2 ${user.mobileVerified ? 'text-green-600' : 'text-red-500'}`}>{user.mobileVerified ? 'Yes' : 'No'}</span></div>
          <div><span className="text-gray-500">Last login</span> <span className="font-medium ml-2">{user.lastLoginAt ? formatDate(user.lastLoginAt) : 'Never'}</span></div>
          <div><span className="text-gray-500">Failed attempts</span> <span className="font-medium ml-2">{user.failedAttempts}</span></div>
        </div>
      </div>

      <div className="card space-y-3">
        <h3 className="font-semibold text-gray-900 flex items-center gap-2">
          <Shield className="w-4 h-4" /> Role Management
        </h3>
        <div className="grid grid-cols-2 gap-2">
          {ROLES.map((role) => {
            const has = currentRoles.includes(role)
            return (
              <button
                key={role}
                onClick={() => toggleRole(role)}
                disabled={isSaving}
                className={`flex items-center gap-2 px-3 py-2.5 rounded-lg border-2 text-sm font-medium transition-all ${
                  has ? 'border-saffron-400 bg-saffron-50 text-saffron-800' : 'border-gray-200 text-gray-600 hover:border-gray-300'
                }`}
              >
                {has ? <CheckCircle2 className="w-4 h-4 text-green-500" /> : <XCircle className="w-4 h-4 text-gray-300" />}
                {role}
              </button>
            )
          })}
        </div>
      </div>

      <div className="card space-y-3">
        <h3 className="font-semibold text-gray-900 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-500" /> Account Status
        </h3>
        <div className="grid grid-cols-2 gap-2">
          {STATUSES.filter((s) => s !== user.status).map((status) => (
            <button
              key={status}
              onClick={() => updateStatus(status)}
              disabled={isSaving}
              className={`px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${
                status === 'ACTIVE' ? 'border-green-200 text-green-700 hover:bg-green-50' :
                status === 'SUSPENDED' ? 'border-amber-200 text-amber-700 hover:bg-amber-50' :
                status === 'BLOCKED' ? 'border-red-200 text-red-700 hover:bg-red-50' :
                'border-gray-200 text-gray-700 hover:bg-gray-50'
              }`}
            >
              Set {status}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
