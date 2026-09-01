'use client'
import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { Lock, Save, Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'

const VISIBILITY_OPTIONS = [
  { value: 'PUBLIC_COMMUNITY', label: 'Public (Community)' },
  { value: 'REGISTERED_MEMBERS', label: 'Registered Members' },
  { value: 'SAME_AREA', label: 'Same Area Only' },
  { value: 'SAME_FAMILY', label: 'Same Family Only' },
  { value: 'MATRIMONY_ONLY', label: 'Matrimony Profiles Only' },
  { value: 'PRIVATE', label: 'Private (Only Me)' },
]

const FIELD_SETTINGS = [
  { key: 'profile_photo', label: 'Profile Photo', default: 'REGISTERED_MEMBERS' },
  { key: 'date_of_birth', label: 'Date of Birth', default: 'SAME_FAMILY' },
  { key: 'mobile_primary', label: 'Mobile Number', default: 'PRIVATE' },
  { key: 'email', label: 'Email Address', default: 'PRIVATE' },
  { key: 'current_address', label: 'Current Address', default: 'PRIVATE' },
  { key: 'current_city', label: 'Current City', default: 'REGISTERED_MEMBERS' },
  { key: 'education', label: 'Education Details', default: 'REGISTERED_MEMBERS' },
  { key: 'employer_name', label: 'Employer / Company', default: 'MATRIMONY_ONLY' },
  { key: 'income_range', label: 'Income Range', default: 'MATRIMONY_ONLY' },
  { key: 'biography', label: 'About / Biography', default: 'REGISTERED_MEMBERS' },
  { key: 'blood_group', label: 'Blood Group', default: 'SAME_FAMILY' },
]

export default function PrivacySettingsPage() {
  const { data: session } = useSession()
  const memberId = (session?.user as any)?.memberId as string | undefined

  const [settings, setSettings] = useState<Record<string, string>>(
    Object.fromEntries(FIELD_SETTINGS.map((f) => [f.key, f.default]))
  )
  const [isSaving, setIsSaving] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (!memberId) return
    fetch(`/api/members/${memberId}/visibility`)
      .then((r) => r.json())
      .then((d) => {
        if (d.settings) {
          setSettings((s) => ({ ...s, ...d.settings }))
        }
      })
      .finally(() => setIsLoading(false))
  }, [memberId])

  const update = (key: string, value: string) => {
    setSettings((s) => ({ ...s, [key]: value }))
  }

  const save = async () => {
    if (!memberId) return
    setIsSaving(true)
    try {
      const res = await fetch(`/api/members/${memberId}/visibility`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings }),
      })
      if (!res.ok) throw new Error((await res.json()).message ?? 'Failed to save')
      toast.success('Privacy settings saved!')
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
          <Lock className="w-5 h-5 text-blue-600" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Privacy Settings</h1>
          <p className="text-gray-500 text-sm">Control who can see your information</p>
        </div>
      </div>

      <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 text-sm text-blue-800">
        <strong>Privacy by design:</strong> We follow strict privacy defaults. Your contact information is
        private by default and is never shared without your permission.
      </div>

      <div className="card space-y-0 divide-y divide-gray-50">
        {FIELD_SETTINGS.map((field) => (
          <div key={field.key} className="py-3 flex items-center justify-between gap-4">
            <div className="min-w-0">
              <p className="text-sm font-medium text-gray-900">{field.label}</p>
              <p className="text-xs text-gray-500 mt-0.5">
                Currently: <span className="font-medium">{VISIBILITY_OPTIONS.find((v) => v.value === settings[field.key])?.label}</span>
              </p>
            </div>
            <select
              value={settings[field.key]}
              onChange={(e) => update(field.key, e.target.value)}
              className="form-input w-auto text-sm flex-shrink-0"
            >
              {VISIBILITY_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
        ))}
      </div>

      <button onClick={save} disabled={isSaving || isLoading || !memberId}
        className="btn-primary w-full py-3 flex items-center justify-center gap-2 disabled:opacity-70">
        {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
        {isSaving ? 'Saving...' : 'Save Privacy Settings'}
      </button>
    </div>
  )
}
