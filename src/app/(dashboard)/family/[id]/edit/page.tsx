'use client'
import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import Link from 'next/link'
import { ArrowLeft, Loader2, Save } from 'lucide-react'
import toast from 'react-hot-toast'

const schema = z.object({
  name: z.string().min(2, 'Family name required'),
  surname: z.string().optional(),
  description: z.string().optional(),
  kuladevata: z.string().optional(),
  kuladevi: z.string().optional(),
  gotra: z.string().optional(),
  traditionalOccupation: z.string().optional(),
  nativeVillage: z.string().optional(),
  nativeDistrict: z.string().optional(),
  nativeState: z.string().optional(),
})
type FormData = z.infer<typeof schema>

export default function EditFamilyPage() {
  const router = useRouter()
  const params = useParams()
  const familyId = params.id as string
  const [isLoading, setIsLoading] = useState(false)
  const [isFetching, setIsFetching] = useState(true)

  const { register, handleSubmit, reset, formState: { errors, isDirty } } = useForm<FormData>({
    resolver: zodResolver(schema),
  })

  useEffect(() => {
    fetch(`/api/families/${familyId}`)
      .then((r) => r.json())
      .then((data) => {
        reset({
          name: data.name ?? '',
          surname: data.surname ?? '',
          description: data.description ?? '',
          kuladevata: data.kuladevata ?? '',
          kuladevi: data.kuladevi ?? '',
          gotra: data.gotra ?? '',
          traditionalOccupation: data.traditionalOccupation ?? '',
          nativeVillage: data.nativeVillage ?? '',
          nativeDistrict: data.nativeDistrict ?? '',
          nativeState: data.nativeState ?? '',
        })
        setIsFetching(false)
      })
      .catch(() => setIsFetching(false))
  }, [familyId, reset])

  const onSubmit = async (data: FormData) => {
    setIsLoading(true)
    try {
      const res = await fetch(`/api/families/${familyId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.message || 'Update failed')
      toast.success('Family updated')
      router.push(`/family/${familyId}`)
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setIsLoading(false)
    }
  }

  if (isFetching) return (
    <div className="flex items-center justify-center h-64">
      <Loader2 className="w-8 h-8 animate-spin text-saffron-500" />
    </div>
  )

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Link href={`/family/${familyId}`} className="btn-ghost p-2"><ArrowLeft className="w-4 h-4" /></Link>
        <h1 className="text-xl font-bold text-gray-900">Edit Family</h1>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <div className="card space-y-4">
          <h3 className="font-semibold text-gray-900 border-b border-gray-100 pb-2">Family Information</h3>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="form-label">Family Name *</label>
              <input {...register('name')} className="form-input" />
              {errors.name && <p className="form-error">{errors.name.message}</p>}
            </div>
            <div>
              <label className="form-label">Surname / Gotra Name</label>
              <input {...register('surname')} className="form-input" />
            </div>
          </div>
          <div>
            <label className="form-label">Family Description</label>
            <textarea {...register('description')} className="form-input min-h-[80px]" />
          </div>
        </div>

        <div className="card space-y-4">
          <h3 className="font-semibold text-gray-900 border-b border-gray-100 pb-2">
            Cultural Information <span className="text-xs text-gray-400 font-normal">(all optional)</span>
          </h3>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="form-label">Kuladevata</label>
              <input {...register('kuladevata')} className="form-input" />
            </div>
            <div>
              <label className="form-label">Kuladevi</label>
              <input {...register('kuladevi')} className="form-input" />
            </div>
            <div>
              <label className="form-label">Gotra</label>
              <input {...register('gotra')} className="form-input" />
            </div>
            <div>
              <label className="form-label">Traditional Occupation</label>
              <input {...register('traditionalOccupation')} className="form-input" />
            </div>
          </div>
        </div>

        <div className="card space-y-4">
          <h3 className="font-semibold text-gray-900 border-b border-gray-100 pb-2">Native Place</h3>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="form-label">Village / Town</label>
              <input {...register('nativeVillage')} className="form-input" />
            </div>
            <div>
              <label className="form-label">District</label>
              <input {...register('nativeDistrict')} className="form-input" />
            </div>
            <div>
              <label className="form-label">State</label>
              <input {...register('nativeState')} className="form-input" />
            </div>
          </div>
        </div>

        <div className="flex gap-3">
          <Link href={`/family/${familyId}`} className="btn-secondary flex-1 py-3 text-center">Cancel</Link>
          <button type="submit" disabled={isLoading || !isDirty}
            className="btn-primary flex-1 py-3 flex items-center justify-center gap-2 disabled:opacity-60">
            {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {isLoading ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </form>
    </div>
  )
}
