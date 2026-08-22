'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { ArrowLeft, Heart, Loader2, Save } from 'lucide-react'
import Link from 'next/link'
import toast from 'react-hot-toast'

const schema = z.object({
  about: z.string().max(1000).optional(),
  heightCm: z.coerce.number().min(100).max(220).optional().or(z.literal('')),
  languages: z.string().optional(),
  minAge: z.coerce.number().min(18).max(70).optional().or(z.literal('')),
  maxAge: z.coerce.number().min(18).max(80).optional().or(z.literal('')),
  educationPreference: z.string().optional(),
  occupationPreference: z.string().optional(),
  preferredLocations: z.string().optional(),
})
type FormData = z.infer<typeof schema>

export default function CreateMatrimonyProfilePage() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [existingId, setExistingId] = useState<string | null>(null)

  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  })

  useEffect(() => {
    fetch('/ladwani/api/matrimony/profiles/mine')
      .then((r) => r.json())
      .then((d) => {
        if (d.profile) {
          setExistingId(d.profile.id)
          reset({
            about: d.profile.about ?? '',
            heightCm: d.profile.heightCm ?? '',
            languages: (d.profile.languages ?? []).join(', '),
            minAge: d.profile.preferences?.minAge ?? '',
            maxAge: d.profile.preferences?.maxAge ?? '',
            educationPreference: d.profile.preferences?.educationPreference ?? '',
            occupationPreference: d.profile.preferences?.occupationPreference ?? '',
            preferredLocations: (d.profile.preferences?.preferredLocations ?? []).join(', '),
          })
        }
      })
  }, [reset])

  const onSubmit = async (data: FormData) => {
    setIsLoading(true)
    try {
      const payload = {
        about: data.about,
        heightCm: data.heightCm ? Number(data.heightCm) : undefined,
        languages: data.languages ? data.languages.split(',').map((l) => l.trim()).filter(Boolean) : [],
        preferences: {
          minAge: data.minAge ? Number(data.minAge) : undefined,
          maxAge: data.maxAge ? Number(data.maxAge) : undefined,
          educationPreference: data.educationPreference,
          occupationPreference: data.occupationPreference,
          preferredLocations: data.preferredLocations
            ? data.preferredLocations.split(',').map((l) => l.trim()).filter(Boolean)
            : [],
        },
      }

      if (existingId) {
        const res = await fetch(`/ladwani/api/matrimony/profiles/${existingId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        const json = await res.json()
        if (!res.ok) throw new Error(json.message)
        toast.success('Profile updated!')
      } else {
        const res = await fetch('/ladwani/api/matrimony/profiles', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        const json = await res.json()
        if (!res.ok) throw new Error(json.message)
        toast.success('Profile created! Enable visibility in My Profile.')
      }
      router.push('/matrimony/my-profile')
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/matrimony" className="btn-ghost p-2"><ArrowLeft className="w-4 h-4" /></Link>
        <div>
          <h1 className="text-xl font-bold text-gray-900">{existingId ? 'Edit' : 'Create'} Matrimonial Profile</h1>
          <p className="text-xs text-gray-500">Profile will only appear in search when you make it visible</p>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="card space-y-4">
          <h2 className="font-semibold text-gray-900 border-b border-gray-100 pb-2">About Yourself</h2>
          <div>
            <label className="form-label">About <span className="text-gray-400 font-normal">(max 1000 chars)</span></label>
            <textarea {...register('about')} className="form-input min-h-[120px]"
              placeholder="Introduce yourself to potential matches. Mention your personality, interests, values, family background, career aspirations..." />
            {errors.about && <p className="form-error">{errors.about.message}</p>}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="form-label">Height (cm)</label>
              <input {...register('heightCm')} type="number" className="form-input" placeholder="e.g. 168" />
            </div>
            <div>
              <label className="form-label">Languages Spoken</label>
              <input {...register('languages')} className="form-input" placeholder="Hindi, Marathi, English" />
              <p className="text-xs text-gray-400 mt-1">Comma separated</p>
            </div>
          </div>
        </div>

        <div className="card space-y-4">
          <h2 className="font-semibold text-gray-900 border-b border-gray-100 pb-2">Partner Preferences <span className="text-xs text-gray-400 font-normal">optional</span></h2>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="form-label">Min Age</label>
              <input {...register('minAge')} type="number" className="form-input" placeholder="25" min="18" max="80" />
            </div>
            <div>
              <label className="form-label">Max Age</label>
              <input {...register('maxAge')} type="number" className="form-input" placeholder="32" min="18" max="80" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="form-label">Education Preference</label>
              <input {...register('educationPreference')} className="form-input" placeholder="Graduate or above" />
            </div>
            <div>
              <label className="form-label">Occupation Preference</label>
              <input {...register('occupationPreference')} className="form-input" placeholder="Any profession" />
            </div>
          </div>
          <div>
            <label className="form-label">Preferred Locations</label>
            <input {...register('preferredLocations')} className="form-input" placeholder="Pune, Mumbai, Nashik" />
            <p className="text-xs text-gray-400 mt-1">Comma separated. Leave blank for any location.</p>
          </div>
        </div>

        <div className="bg-amber-50 border border-amber-100 rounded-xl p-4 text-sm text-amber-800">
          <strong>Privacy note:</strong> Your contact information will never be visible in matrimony search.
          Only the information in this profile will be shown. You control whether this profile is visible or hidden.
        </div>

        <button type="submit" disabled={isLoading}
          className="w-full btn-primary py-3 flex items-center justify-center gap-2">
          {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {isLoading ? 'Saving...' : existingId ? 'Update Profile' : 'Create Profile'}
        </button>
      </form>
    </div>
  )
}
