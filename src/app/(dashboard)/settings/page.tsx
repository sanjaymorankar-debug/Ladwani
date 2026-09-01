'use client'
import { useState } from 'react'
import { useSession } from 'next-auth/react'
import { Eye, EyeOff, Loader2, Save, Bell, Lock, Trash2, Shield } from 'lucide-react'
import toast from 'react-hot-toast'
import Link from 'next/link'

export default function SettingsPage() {
  const { data: session } = useSession()
  const [tab, setTab] = useState<'password' | 'notifications' | 'data'>('password')
  const [current, setCurrent] = useState('')
  const [newPwd, setNewPwd] = useState('')
  const [confirmPwd, setConfirmPwd] = useState('')
  const [showCurrent, setShowCurrent] = useState(false)
  const [showNew, setShowNew] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  const changePassword = async () => {
    if (newPwd !== confirmPwd) return toast.error('Passwords do not match')
    if (newPwd.length < 8) return toast.error('Password must be at least 8 characters')
    setIsSaving(true)
    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword: current, newPassword: newPwd }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.message ?? 'Failed')
      toast.success('Password changed successfully!')
      setCurrent(''); setNewPwd(''); setConfirmPwd('')
    } catch (e: any) {
      toast.error(e.message)
    } finally { setIsSaving(false) }
  }

  const tabs = [
    { id: 'password', icon: Lock, label: 'Password & Security' },
    { id: 'notifications', icon: Bell, label: 'Notifications' },
    { id: 'data', icon: Shield, label: 'Privacy & Data' },
  ] as const

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Account Settings</h1>
        <p className="text-gray-500 text-sm mt-0.5">{session?.user?.email ?? session?.user?.name}</p>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl">
        {tabs.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id as any)}
            className={`flex items-center gap-2 flex-1 justify-center px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              tab === t.id ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}>
            <t.icon className="w-4 h-4" />
            <span className="hidden sm:inline">{t.label}</span>
          </button>
        ))}
      </div>

      {tab === 'password' && (
        <div className="card space-y-4">
          <h2 className="font-semibold text-gray-900 border-b border-gray-100 pb-2">Change Password</h2>
          <div>
            <label className="form-label">Current Password</label>
            <div className="relative">
              <input type={showCurrent ? 'text' : 'password'} value={current}
                onChange={(e) => setCurrent(e.target.value)}
                className="form-input pr-10" placeholder="Your current password" />
              <button type="button" onClick={() => setShowCurrent(!showCurrent)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                {showCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
          <div>
            <label className="form-label">New Password</label>
            <div className="relative">
              <input type={showNew ? 'text' : 'password'} value={newPwd}
                onChange={(e) => setNewPwd(e.target.value)}
                className="form-input pr-10" placeholder="Min 8 characters" />
              <button type="button" onClick={() => setShowNew(!showNew)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
          <div>
            <label className="form-label">Confirm New Password</label>
            <input type="password" value={confirmPwd}
              onChange={(e) => setConfirmPwd(e.target.value)}
              className="form-input" placeholder="Repeat new password" />
          </div>
          <button onClick={changePassword} disabled={isSaving || !current || !newPwd || !confirmPwd}
            className="btn-primary flex items-center gap-2 disabled:opacity-60">
            {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {isSaving ? 'Changing...' : 'Change Password'}
          </button>
        </div>
      )}

      {tab === 'notifications' && (
        <div className="card space-y-4">
          <h2 className="font-semibold text-gray-900 border-b border-gray-100 pb-2">Notification Preferences</h2>
          {[
            { key: 'approval_status', label: 'Approval status updates', desc: 'When your requests are approved or rejected' },
            { key: 'matrimonial_interest', label: 'Matrimonial interests', desc: 'When someone sends you an interest' },
            { key: 'community_posts', label: 'Community announcements', desc: 'Important community-wide posts' },
            { key: 'birthday', label: 'Birthdays', desc: 'Birthday reminders for family members' },
            { key: 'family_updates', label: 'Family updates', desc: 'When family information is changed' },
          ].map((pref) => (
            <div key={pref.key} className="flex items-center justify-between py-1">
              <div>
                <p className="text-sm font-medium text-gray-900">{pref.label}</p>
                <p className="text-xs text-gray-500">{pref.desc}</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" defaultChecked className="sr-only peer" />
                <div className="w-9 h-5 bg-gray-200 peer-focus:ring-2 peer-focus:ring-saffron-500 rounded-full peer peer-checked:after:translate-x-full peer-checked:bg-saffron-600 after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all" />
              </label>
            </div>
          ))}
          <button className="btn-primary flex items-center gap-2">
            <Save className="w-4 h-4" /> Save Preferences
          </button>
        </div>
      )}

      {tab === 'data' && (
        <div className="space-y-4">
          <div className="card space-y-4">
            <h2 className="font-semibold text-gray-900 border-b border-gray-100 pb-2">Privacy & Data</h2>
            <div className="space-y-3">
              <Link href="/profile/privacy" className="flex items-center justify-between p-3 border border-gray-100 rounded-xl hover:bg-gray-50 transition-colors">
                <div>
                  <p className="font-medium text-gray-900 text-sm">Field-Level Privacy Settings</p>
                  <p className="text-xs text-gray-500">Control who can see each piece of your information</p>
                </div>
                <span className="text-gray-400">→</span>
              </Link>
              <div className="p-3 border border-gray-100 rounded-xl">
                <p className="font-medium text-gray-900 text-sm mb-1">Consent Management</p>
                <p className="text-xs text-gray-500 mb-2">Review and update your data usage consents</p>
                <div className="space-y-1.5">
                  {['Profile storage & community directory', 'Family information & registry', 'Photo storage', 'Matrimonial visibility', 'Notification communications'].map((c) => (
                    <div key={c} className="flex items-center gap-2 text-xs text-gray-600">
                      <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
                      {c}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
          <div className="card space-y-3 border-red-100">
            <h2 className="font-semibold text-gray-900 border-b border-gray-100 pb-2">Data Requests</h2>
            <p className="text-sm text-gray-600">You have rights under the DPDP Act 2023 to access, correct, or request deletion of your data.</p>
            <div className="flex flex-wrap gap-2">
              <button className="btn-secondary text-sm">Request My Data</button>
              <button className="btn-secondary text-sm text-red-600 border-red-200 hover:border-red-400 hover:bg-red-50">
                <Trash2 className="w-3.5 h-3.5 inline mr-1" />Request Deletion
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
