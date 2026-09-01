'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Heart, Eye, EyeOff, Edit, Loader2, ArrowLeft } from 'lucide-react'
import toast from 'react-hot-toast'

export default function MyMatrimonyProfilePage() {
  const [profile, setProfile] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isToggling, setIsToggling] = useState(false)

  useEffect(() => {
    fetch('/api/matrimony/profiles/mine')
      .then((r) => r.json())
      .then((d) => setProfile(d.profile))
      .finally(() => setIsLoading(false))
  }, [])

  const toggleVisibility = async () => {
    if (!profile) return
    setIsToggling(true)
    try {
      const res = await fetch(`/api/matrimony/profiles/${profile.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isVisible: !profile.isVisible }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.message)
      setProfile((p: any) => ({ ...p, isVisible: !p.isVisible }))
      toast.success(profile.isVisible ? 'Profile hidden from matrimony search' : 'Profile visible in matrimony search')
    } catch (e: any) { toast.error(e.message) }
    finally { setIsToggling(false) }
  }

  if (isLoading) return (
    <div className="flex items-center justify-center h-48">
      <Loader2 className="w-8 h-8 animate-spin text-saffron-500" />
    </div>
  )

  if (!profile) return (
    <div className="max-w-2xl mx-auto">
      <div className="card text-center py-12">
        <Heart className="w-12 h-12 text-gray-300 mx-auto mb-3" />
        <h2 className="text-lg font-bold text-gray-900 mb-2">No Matrimonial Profile</h2>
        <p className="text-gray-500 text-sm mb-5">Create a matrimonial profile to appear in community matrimony search.</p>
        <Link href="/matrimony/create-profile" className="btn-primary inline-flex items-center gap-2">
          <Heart className="w-4 h-4" /> Create Profile
        </Link>
      </div>
    </div>
  )

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <div className="flex items-center gap-3">
        <Link href="/matrimony" className="btn-ghost p-2"><ArrowLeft className="w-4 h-4" /></Link>
        <h1 className="text-xl font-bold text-gray-900">My Matrimonial Profile</h1>
      </div>

      <div className={`card border-2 ${profile.isVisible ? 'border-green-200' : 'border-gray-200'}`}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            {profile.isVisible
              ? <span className="flex items-center gap-1.5 text-green-600 font-medium text-sm"><Eye className="w-4 h-4" /> Visible in search</span>
              : <span className="flex items-center gap-1.5 text-gray-500 font-medium text-sm"><EyeOff className="w-4 h-4" /> Hidden from search</span>
            }
          </div>
          <div className="flex gap-2">
            <Link href="/matrimony/create-profile" className="btn-secondary text-sm flex items-center gap-1.5">
              <Edit className="w-3.5 h-3.5" /> Edit
            </Link>
            <button onClick={toggleVisibility} disabled={isToggling}
              className={`text-sm px-3 py-1.5 rounded-lg font-medium transition-colors ${
                profile.isVisible
                  ? 'bg-red-50 text-red-600 hover:bg-red-100'
                  : 'bg-green-50 text-green-600 hover:bg-green-100'
              }`}>
              {isToggling ? <Loader2 className="w-4 h-4 animate-spin" /> : profile.isVisible ? 'Hide Profile' : 'Show Profile'}
            </button>
          </div>
        </div>

        {profile.about && (
          <div className="mb-4 pb-4 border-b border-gray-100">
            <p className="text-xs text-gray-500 font-medium uppercase tracking-wider mb-1">About</p>
            <p className="text-sm text-gray-700">{profile.about}</p>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3 text-sm">
          {profile.heightCm && (
            <div><span className="text-gray-500 text-xs">Height</span><div className="font-medium">{profile.heightCm} cm</div></div>
          )}
          {profile.languages?.length > 0 && (
            <div><span className="text-gray-500 text-xs">Languages</span><div className="font-medium">{profile.languages.join(', ')}</div></div>
          )}
        </div>
      </div>

      <div className="card">
        <p className="text-sm font-medium text-gray-700 mb-3">Privacy Reminder</p>
        <p className="text-sm text-gray-500 leading-relaxed">
          Your contact information is <strong>never shown</strong> in matrimony search.
          Interested parties must send an interest first, and you must accept before any contact details can be shared.
        </p>
      </div>
    </div>
  )
}
